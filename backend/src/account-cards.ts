/**
 * Saved cards and the minimum-one-card invariant, plus the post-payment
 * account lifecycle hook.
 *
 * Stripe is authoritative for cards. We never see or store a PAN or CVC: cards
 * are added with Stripe.js + a SetupIntent, and only brand / last four / expiry
 * are mirrored locally.
 *
 * Invariant: an activated, card-backed customer keeps at least one attached
 * reusable card. A customer-requested removal of the last card is refused by
 * the API under a per-profile lease lock, so two simultaneous removals cannot
 * both succeed. Cards detached outside this app (Stripe dashboard, issuer) are
 * detected on reconciliation and flagged; they are never hidden or invented.
 */
import {BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {Db} from './core';
import {PaymentClient} from './payments';
import {OutboxService} from './mail';
import {cardStatusFor, displayName, isCardExpired, isCardExpiringSoon, type CardStatus} from './account-core';

export const LAST_CARD_MESSAGE = 'Add a replacement card before removing this one.';
const LIVE_SUBSCRIPTION_ACCESS = ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const;

export interface Profile {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  stripeCustomerId: string | null;
  cardStatus: string;
  accountStatus: string;
  shadowState: string | null;
}

export interface CardView {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  expired: boolean;
  expiringSoon: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const idOf = (value: unknown): string | null => (typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as {id: unknown}).id) : null);

@Injectable()
export class CardService {
  constructor(@Inject(Db) private db: Db, @Inject(PaymentClient) private payments: PaymentClient, @Optional() @Inject(OutboxService) private outbox?: OutboxService) {}

  private stripe(): Stripe {
    return this.payments.client();
  }

  /** Billing profiles an account owns: itself plus purchases it has verifiably claimed. */
  async ownedProfiles(accountId: string): Promise<Profile[]> {
    const primary = await this.db.customer.findUnique({where: {id: accountId}});
    if (!primary) throw new NotFoundException();
    const claimed = await this.db.customer.findMany({where: {mergedIntoId: accountId, shadowState: 'CLAIMED'}});
    return [primary, ...claimed];
  }

  async ownedIds(accountId: string): Promise<string[]> {
    return (await this.ownedProfiles(accountId)).map(profile => profile.id);
  }

  /** The profile is always resolved from the session; a browser-supplied id only selects among owned ones. */
  async profileFor(accountId: string, profileId?: string | null): Promise<Profile> {
    const profiles = await this.ownedProfiles(accountId);
    const profile = profileId ? profiles.find(entry => entry.id === profileId) : profiles[0];
    if (!profile) throw new NotFoundException();
    return profile;
  }

  /**
   * Lease lock on the profile row. A compare-and-set UPDATE acquires it, so it
   * serialises card and plan mutations across application instances without
   * holding a database transaction open across Stripe calls. A crashed holder's
   * lease simply expires.
   */
  async withLock<T>(profileId: string, work: () => Promise<T>, leaseMs = 30000, waitMs = 8000): Promise<T> {
    const token = randomUUID();
    const deadline = Date.now() + waitMs;
    for (;;) {
      const now = new Date();
      const acquired = await this.db.customer.updateMany({
        where: {id: profileId, OR: [{mutationLockUntil: null}, {mutationLockUntil: {lt: now}}]},
        data: {mutationLockToken: token, mutationLockUntil: new Date(now.getTime() + leaseMs)},
      });
      if (acquired.count === 1) break;
      if (Date.now() > deadline) throw new ConflictException('Another change to your account is still in progress. Please try again in a moment.');
      await sleep(120);
    }
    try {
      return await work();
    } finally {
      await this.db.customer.updateMany({where: {id: profileId, mutationLockToken: token}, data: {mutationLockToken: null, mutationLockUntil: null}}).catch(() => undefined);
    }
  }

  /** Idempotency + recovery record. A replayed key returns the stored result instead of repeating the mutation. */
  async operation<T extends Record<string, unknown>>(customerId: string, kind: string, key: string | undefined, request: Record<string, unknown>, work: () => Promise<T>): Promise<T> {
    if (!key) return work();
    const where = {customerId_kind_idempotencyKey: {customerId, kind, idempotencyKey: key}};
    let record = await this.db.customerOperation.findUnique({where});
    if (record?.status === 'SUCCEEDED') return record.result as T;
    if (!record) {
      try {
        record = await this.db.customerOperation.create({data: {customerId, kind, idempotencyKey: key, request: request as object}});
      } catch {
        record = await this.db.customerOperation.findUnique({where});
        if (record?.status === 'SUCCEEDED') return record.result as T;
      }
    }
    try {
      const result = await work();
      if (record) await this.db.customerOperation.update({where: {id: record.id}, data: {status: 'SUCCEEDED', result: result as object}});
      return result;
    } catch (error) {
      if (record) await this.db.customerOperation.update({where: {id: record.id}, data: {status: 'FAILED'}}).catch(() => undefined);
      throw error;
    }
  }

  private async event(profile: {id: string}, action: string, actor: {type: string; id?: string | null; label?: string | null}, data: Record<string, unknown> = {}, reason?: string) {
    await this.db.billingEvent.create({data: {customerId: profile.id, actorType: actor.type, actorId: actor.id ?? null, actorLabel: actor.label ?? null, action, reason: reason ?? null, data: data as object}});
  }

  private async liveSubscriptions(stripeCustomerId: string) {
    return this.db.subscription.findMany({where: {stripeCustomerId, accessStatus: {in: [...LIVE_SUBSCRIPTION_ACCESS]}}, include: {plan: true}});
  }

  async ensureStripeCustomer(profile: Profile): Promise<string> {
    if (profile.stripeCustomerId) return profile.stripeCustomerId;
    const created = await this.stripe().customers.create({email: profile.email, name: profile.name || undefined, phone: profile.phone || undefined, metadata: {customerId: profile.id}}, {idempotencyKey: 'customer:' + profile.id});
    await this.db.customer.update({where: {id: profile.id}, data: {stripeCustomerId: created.id}});
    profile.stripeCustomerId = created.id;
    return created.id;
  }

  /**
   * Reconcile the local mirror with Stripe and re-evaluate the invariant.
   * Returns the authoritative card list for this profile.
   */
  async sync(profile: Profile, now = new Date()): Promise<{cards: CardView[]; status: CardStatus; defaultPaymentMethodId: string | null; byCardId: Map<string, string>}> {
    if (!profile.stripeCustomerId) {
      await this.setStatus(profile, 'MISSING', now);
      return {cards: [], status: 'MISSING', defaultPaymentMethodId: null, byCardId: new Map()};
    }
    const stripe = this.stripe();
    const [customer, list] = await Promise.all([stripe.customers.retrieve(profile.stripeCustomerId), stripe.customers.listPaymentMethods(profile.stripeCustomerId, {type: 'card', limit: 100})]);
    const defaultId = (customer as Stripe.Customer).deleted ? null : idOf((customer as Stripe.Customer).invoice_settings?.default_payment_method);
    const attached = list.data.filter(method => method.card);
    const seen = new Set<string>();
    const cards: CardView[] = [];
    const byCardId = new Map<string, string>();
    for (const method of attached) {
      seen.add(method.id);
      const data = {brand: method.card!.brand ?? 'card', last4: method.card!.last4 ?? '', expMonth: method.card!.exp_month ?? 0, expYear: method.card!.exp_year ?? 0, isDefault: method.id === defaultId, detachedAt: null};
      const row = await this.db.customerCard.upsert({where: {stripePaymentMethodId: method.id}, update: {...data, customerId: profile.id}, create: {...data, customerId: profile.id, stripePaymentMethodId: method.id}});
      byCardId.set(row.id, method.id);
      cards.push({id: row.id, brand: row.brand, last4: row.last4, expMonth: row.expMonth, expYear: row.expYear, isDefault: row.isDefault, expired: isCardExpired(row, now), expiringSoon: isCardExpiringSoon(row, now)});
    }
    /* Anything we still think is attached but Stripe no longer lists was removed elsewhere. */
    const stale = await this.db.customerCard.findMany({where: {customerId: profile.id, detachedAt: null}});
    for (const row of stale) if (!seen.has(row.stripePaymentMethodId)) await this.db.customerCard.update({where: {id: row.id}, data: {detachedAt: now, isDefault: false}});
    const status = cardStatusFor(cards, now);
    await this.setStatus(profile, status, now);
    return {cards, status, defaultPaymentMethodId: defaultId, byCardId};
  }

  private async setStatus(profile: Profile, status: CardStatus, now: Date) {
    const previous = profile.cardStatus;
    await this.db.customer.update({where: {id: profile.id}, data: {cardStatus: status, cardCheckedAt: now}});
    profile.cardStatus = status;
    /* An invariant broken outside this app is surfaced, audited and mailed once a day at most. */
    if (status === 'MISSING' && previous === 'OK') {
      await this.event(profile, 'CARD_INVARIANT_BROKEN', {type: 'SYSTEM'}, {previous}, 'No attached card remains; removed outside the account area');
      if (this.outbox && profile.accountStatus === 'ACTIVE' && !profile.shadowState) {
        await this.outbox.enqueue({customerId: profile.id, to: profile.email, template: 'card_missing', payload: {name: displayName(profile)}, dedupeKey: 'card-missing:' + profile.id + ':' + now.toISOString().slice(0, 10)}).catch(() => undefined);
      }
    }
  }

  /** Cards across every billing profile the account owns, with what each default affects. */
  async list(accountId: string) {
    const profiles = await this.ownedProfiles(accountId);
    const result = [];
    for (const [index, profile] of profiles.entries()) {
      const synced = await this.sync(profile);
      const subscriptions = profile.stripeCustomerId ? await this.liveSubscriptions(profile.stripeCustomerId) : [];
      result.push({
        profileId: profile.id,
        primary: index === 0,
        status: synced.status,
        hasDefault: synced.cards.some(card => card.isDefault),
        cards: synced.cards,
        /* A default-card change applies to every subscription billed through this profile. */
        affectedSubscriptions: subscriptions.map(sub => ({id: sub.id, planName: sub.plan?.name ?? ((sub.metadata as {catalogPlan?: {name?: string}} | null)?.catalogPlan?.name || 'Subscription'), renewsAt: sub.cancelAtPeriodEnd ? null : sub.nextInvoiceAt ?? sub.currentPeriodEnd})),
      });
    }
    return {profiles: result, minimumCardMessage: LAST_CARD_MESSAGE};
  }

  /** Start adding a card. Creates a SetupIntent only: nothing is charged. */
  async createSetupIntent(accountId: string, profileId?: string | null) {
    const profile = await this.profileFor(accountId, profileId);
    const stripeCustomerId = await this.ensureStripeCustomer(profile);
    const intent = await this.stripe().setupIntents.create({customer: stripeCustomerId, usage: 'off_session', allowed_payment_method_types: ['card'], metadata: {customerId: profile.id}});
    return {setupIntentId: intent.id, clientSecret: intent.client_secret, publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY || '').trim(), profileId: profile.id};
  }

  /**
   * Finish adding a card. The SetupIntent is re-read from Stripe and must belong
   * to this profile's Stripe customer; a browser cannot present someone else's.
   */
  async completeSetup(accountId: string, input: {setupIntentId: string; profileId?: string | null; makeDefault?: boolean}, actor: {id: string; label: string}) {
    const profile = await this.profileFor(accountId, input.profileId);
    if (!profile.stripeCustomerId) throw new NotFoundException();
    let intent: Stripe.SetupIntent;
    try {
      intent = await this.stripe().setupIntents.retrieve(input.setupIntentId);
    } catch {
      throw new NotFoundException();
    }
    if (idOf(intent.customer) !== profile.stripeCustomerId) throw new NotFoundException();
    if (intent.status !== 'succeeded') {
      /* requires_action (3-D Secure), processing, requires_payment_method: report, change nothing. */
      return {status: intent.status, added: false as const};
    }
    const methodId = idOf(intent.payment_method);
    if (!methodId) throw new BadRequestException('The card could not be saved. Please try again.');
    return this.withLock(profile.id, async () => {
      const before = await this.sync(profile);
      await this.db.customer.update({where: {id: profile.id}, data: {cardConsentAt: new Date()}});
      const needsDefault = input.makeDefault === true || !before.cards.some(card => card.isDefault);
      if (needsDefault) await this.applyDefault(profile, methodId, await this.liveSubscriptions(profile.stripeCustomerId!));
      await this.event(profile, 'CARD_ADDED', {type: 'CUSTOMER', id: actor.id, label: actor.label}, {madeDefault: needsDefault});
      const after = await this.sync(profile);
      return {status: 'succeeded', added: true as const, cards: after.cards};
    });
  }

  /** Stripe-side ownership proof: the method must be attached to this exact Stripe customer. */
  private async ownedMethod(profile: Profile, cardId: string): Promise<{row: {id: string; stripePaymentMethodId: string}; method: Stripe.PaymentMethod}> {
    if (!profile.stripeCustomerId) throw new NotFoundException();
    const row = await this.db.customerCard.findFirst({where: {id: cardId, customerId: profile.id}});
    if (!row) throw new NotFoundException();
    try {
      const method = await this.stripe().customers.retrievePaymentMethod(profile.stripeCustomerId, row.stripePaymentMethodId);
      if (idOf(method.customer) !== profile.stripeCustomerId || !method.card) throw new Error('not owned');
      return {row, method};
    } catch {
      throw new NotFoundException();
    }
  }

  /**
   * Point the Stripe customer and the given subscriptions at a card, then read
   * Stripe back. Throws unless every reference was confirmed.
   */
  private async applyDefault(profile: Profile, methodId: string, subscriptions: Array<{id: string; stripeSubscriptionId: string}>) {
    const stripe = this.stripe();
    const stripeCustomerId = profile.stripeCustomerId!;
    try {
      await stripe.customers.update(stripeCustomerId, {invoice_settings: {default_payment_method: methodId}});
      for (const sub of subscriptions) await stripe.subscriptions.update(sub.stripeSubscriptionId, {default_payment_method: methodId});
      const customer = (await stripe.customers.retrieve(stripeCustomerId)) as Stripe.Customer;
      if (idOf(customer.invoice_settings?.default_payment_method) !== methodId) throw new Error('customer default not confirmed');
      for (const sub of subscriptions) {
        const fresh = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
        if (idOf(fresh.default_payment_method) !== methodId) throw new Error('subscription default not confirmed');
      }
    } catch {
      throw new BadRequestException('Stripe did not confirm the card change, so nothing was removed. Please try again.');
    }
    for (const sub of subscriptions) await this.db.subscription.update({where: {id: sub.id}, data: {defaultPaymentMethodId: methodId}});
  }

  async setDefault(accountId: string, cardId: string, input: {profileId?: string | null; idempotencyKey?: string}, actor: {id: string; label: string}) {
    const profile = await this.profileFor(accountId, input.profileId);
    return this.operation(profile.id, 'CARD_DEFAULT', input.idempotencyKey, {cardId}, () =>
      this.withLock(profile.id, async () => {
        const {method} = await this.ownedMethod(profile, cardId);
        const subscriptions = await this.liveSubscriptions(profile.stripeCustomerId!);
        await this.applyDefault(profile, method.id, subscriptions);
        await this.event(profile, 'CARD_DEFAULT_CHANGED', {type: 'CUSTOMER', id: actor.id, label: actor.label}, {subscriptions: subscriptions.length});
        const after = await this.sync(profile);
        return {cards: after.cards, affectedSubscriptions: subscriptions.length};
      }),
    );
  }

  /**
   * Remove a card. Refused when it is the last one. When the card is the default
   * or is referenced by a subscription, the replacement is set and verified on
   * Stripe first; only then is the old card detached. A failed replacement
   * leaves the existing card attached.
   */
  async remove(accountId: string, cardId: string, input: {profileId?: string | null; replacementCardId?: string | null; idempotencyKey?: string}, actor: {type?: 'CUSTOMER' | 'ADMIN'; id: string; label: string}, options: {allowLast?: boolean; reason?: string} = {}) {
    const profile = await this.profileFor(accountId, input.profileId);
    return this.operation(profile.id, 'CARD_REMOVE', input.idempotencyKey, {cardId, replacementCardId: input.replacementCardId ?? null}, () =>
      this.withLock(profile.id, async () => {
        /* Re-read Stripe inside the lock: this is the state the decision is made on. */
        const current = await this.sync(profile);
        const target = current.cards.find(card => card.id === cardId);
        if (!target) throw new NotFoundException();
        const {method} = await this.ownedMethod(profile, cardId);
        const others = current.cards.filter(card => card.id !== cardId);
        if (!others.length && !options.allowLast) throw new ConflictException(LAST_CARD_MESSAGE);

        const stripe = this.stripe();
        const subscriptions = await this.liveSubscriptions(profile.stripeCustomerId!);
        const referencing = [];
        for (const sub of subscriptions) {
          const fresh = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          const used = idOf(fresh.default_payment_method);
          /* A subscription with no card of its own bills the customer default. */
          if (used === method.id || (!used && target.isDefault)) referencing.push(sub);
        }
        if ((target.isDefault || referencing.length) && others.length) {
          const replacementId = input.replacementCardId ?? (others.length === 1 ? others[0].id : null);
          if (!replacementId || replacementId === cardId) throw new BadRequestException('Choose which card should replace this one before removing it.');
          const replacement = await this.ownedMethod(profile, replacementId);
          await this.applyDefault(profile, replacement.method.id, referencing);
        }
        try {
          await stripe.paymentMethods.detach(method.id, {}, input.idempotencyKey ? {idempotencyKey: 'detach:' + profile.id + ':' + input.idempotencyKey} : undefined);
        } catch {
          throw new BadRequestException('Stripe did not confirm the removal. Your card is still saved; please try again.');
        }
        await this.event(profile, options.allowLast ? 'CARD_REMOVED_ADMIN_OVERRIDE' : 'CARD_REMOVED', {type: actor.type ?? 'CUSTOMER', id: actor.id, label: actor.label}, {replaced: Boolean(target.isDefault || referencing.length), remaining: others.length}, options.reason);
        const after = await this.sync(profile);
        return {cards: after.cards, removed: true};
      }),
    );
  }

  /** A Stripe event told us something about this Stripe customer's cards: reconcile. */
  async onStripeCustomer(stripeCustomerId: string | null | undefined) {
    if (!stripeCustomerId) return;
    const profile = await this.db.customer.findUnique({where: {stripeCustomerId}});
    if (profile) await this.sync(profile);
  }
}

/* ───────────────────────────── Lifecycle ───────────────────────────── */

/**
 * What happens to the account once a payment is verified. Called only from the
 * signature-verified webhook path (or the server's own zero-total decision),
 * never from a browser redirect. Every step is idempotent: replays, retries
 * and refreshes cannot create a second account, setup email or receipt.
 */
@Injectable()
export class AccountLifecycle {
  constructor(@Inject(Db) private db: Db, @Inject(CardService) private cards: CardService, @Inject(OutboxService) private outbox: OutboxService) {}

  async onOrderPaid(orderId: string) {
    const order = await this.db.order.findUnique({where: {id: orderId}, include: {items: true, customer: true}});
    if (!order || order.status !== 'PAID') return;
    const customer = order.customer;
    const consents = ((order.metadata as {consents?: Record<string, unknown>} | null)?.consents ?? {}) as Record<string, unknown>;
    const contactName = order.contactName || displayName(customer);

    if (customer.shadowState === 'PENDING_CLAIM') {
      /* Bought with the email of an existing account, without signing in: the owner must claim it. */
      await this.outbox.enqueue({customerId: customer.id, to: customer.email, template: 'claim_available', payload: {}, dedupeKey: 'claim:' + customer.id});
    } else if (!customer.shadowState && customer.accountStatus !== 'ACTIVE') {
      /* Compare-and-set so two concurrent webhooks provision exactly once. */
      const moved = await this.db.customer.updateMany({where: {id: customer.id, accountStatus: 'GUEST'}, data: {accountStatus: 'PENDING_SETUP'}});
      await this.db.customer.update({
        where: {id: customer.id},
        data: {
          ...(consents.accountTermsVersion && !customer.accountTermsAcceptedAt ? {accountTermsVersion: String(consents.accountTermsVersion), accountTermsAcceptedAt: order.termsAcceptedAt ?? order.createdAt} : {}),
          ...(consents.saveCard === true && !customer.cardConsentAt ? {cardConsentAt: order.createdAt} : {}),
          ...(consents.marketing === true && !customer.marketingOptIn ? {marketingOptIn: true, marketingConsentAt: order.createdAt} : {}),
        },
      });
      if (moved.count === 1) await this.db.billingEvent.create({data: {customerId: customer.id, orderId: order.id, actorType: 'SYSTEM', action: 'ACCOUNT_PROVISIONED', fromState: 'GUEST', toState: 'PENDING_SETUP'}});
      /* The unique dedupe key means the welcome email exists once however often this runs. */
      await this.outbox.enqueue({customerId: customer.id, to: customer.email, template: 'account_setup', payload: {name: contactName}, dedupeKey: 'setup:' + customer.id});
    }

    await this.outbox.enqueue({
      customerId: customer.id,
      to: customer.email,
      template: 'purchase_receipt',
      dedupeKey: 'receipt:' + order.id,
      payload: {name: contactName, orderId: order.id, currency: order.currency, dueNowAmount: order.dueNowAmount, recurringAmount: order.recurringAmount, recurringDescription: order.recurringInterval === 'YEAR' ? 'every year' : 'every month', items: order.items.map(item => ({description: item.description, quantity: item.quantity, amount: item.amount}))},
    });

    /* Card state is reconciled after the purchase is safely recorded; a provider hiccup never loses the order. */
    try {
      const synced = await this.cards.sync(customer);
      if (customer.stripeCustomerId && synced.cards.length && !synced.defaultPaymentMethodId) {
        const first = synced.byCardId.get(synced.cards[0].id);
        if (first) {
          await this.cards['stripe']().customers.update(customer.stripeCustomerId, {invoice_settings: {default_payment_method: first}});
          await this.cards.sync(customer);
        }
      }
    } catch {
      await this.db.customer.update({where: {id: customer.id}, data: {cardStatus: 'UNKNOWN'}}).catch(() => undefined);
    }
  }
}
