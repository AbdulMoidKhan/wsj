/**
 * Subscription plan changes: upgrade, downgrade and billing-interval change.
 *
 * Policy (documented assumption, no conflicting approved policy was found):
 *  - UPGRADE (same interval, higher price): applies immediately, but only once
 *    the prorated payment has succeeded. Stripe holds the update as a pending
 *    update if the payment fails or needs authentication, so the customer keeps
 *    the plan they already paid for and gains nothing early.
 *  - DOWNGRADE and INTERVAL_CHANGE: take effect at the end of the paid period,
 *    through a Stripe subscription schedule. No refund or credit is issued, and
 *    the customer can withdraw the change until it takes effect.
 *
 * Every amount shown comes from Stripe's invoice preview. Nothing here
 * estimates proration with calendar arithmetic. A change touches exactly one
 * subscription and only its plan item; other items (recurring add-ons) and
 * other subscriptions are left alone, and one-time add-ons were charged once
 * at purchase and are unaffected.
 */
import {BadRequestException, ConflictException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import Stripe from 'stripe';
import {Db} from './core';
import {PaymentClient} from './payments';
import {BillingService} from './billing';
import {CardService} from './account-cards';
import {creditGrantsFor, describeInterval, type BillingIntervalValue} from './billing-core';
import {classifyPlanChange, signProof, verifyProof, type PlanChangeKind} from './account-core';

const PREVIEW_PURPOSE = 'plan-change-preview';
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const refOf = (value: unknown): string | null => (typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as {id: unknown}).id) : null);

export interface PlanTarget {
  slug: string;
  name: string;
  serviceType: string;
  unitAmount: number;
  currency: string;
  interval: BillingIntervalValue;
  intervalCount: number;
  includedCredits: unknown[];
  legacyPlanId: string | null;
  catalogPlan: {id: string; slug: string; name: string; serviceType: string; includedCredits: unknown[]} | null;
  minQuantity: number;
  maxQuantity: number;
}

type SubRow = {
  id: string; customerId: string; planId: string | null; metadata: unknown; stripeSubscriptionId: string; stripeCustomerId: string; stripePriceId: string | null; stripeItemId: string | null;
  interval: string; intervalCount: number; currency: string; unitAmount: number; quantity: number; stripeStatus: string; accessStatus: string; cancelAtPeriodEnd: boolean; pendingUpdate: boolean;
  currentPeriodEnd: Date | null; stripeScheduleId: string | null; plan?: {slug: string; name: string; serviceType: string; includedCredits: unknown} | null;
};

interface PreviewToken extends Record<string, unknown> {
  s: string;
  t: string;
  k: PlanChangeKind;
  pd: number;
  due: number;
  price: string;
  amt: number;
}

@Injectable()
export class PlanChangeService {
  constructor(@Inject(Db) private db: Db, @Inject(PaymentClient) private payments: PaymentClient, @Inject(BillingService) private billing: BillingService, @Inject(CardService) private cards: CardService) {}

  private stripe(): Stripe {
    return this.payments.client();
  }

  /** Row-level ownership: the subscription must belong to a profile this account owns. */
  private async owned(accountId: string, subscriptionId: string): Promise<SubRow> {
    const ids = await this.cards.ownedIds(accountId);
    const sub = await this.db.subscription.findUnique({where: {id: subscriptionId}, include: {plan: true}});
    if (!sub || !ids.includes(sub.customerId)) throw new NotFoundException();
    return sub as unknown as SubRow;
  }

  private snapshot(sub: SubRow) {
    const meta = (sub.metadata && typeof sub.metadata === 'object' && !Array.isArray(sub.metadata) ? sub.metadata : {}) as {catalogPlan?: {id?: string; slug?: string; name?: string; serviceType?: string; includedCredits?: unknown[]}};
    const catalogPlan = meta.catalogPlan ?? null;
    return {
      slug: sub.plan?.slug ?? catalogPlan?.slug ?? null,
      name: sub.plan?.name ?? catalogPlan?.name ?? 'Subscription',
      serviceType: sub.plan?.serviceType ?? catalogPlan?.serviceType ?? null,
      includedCredits: (Array.isArray(sub.plan?.includedCredits) ? sub.plan!.includedCredits : catalogPlan?.includedCredits ?? []) as unknown[],
      legacyPlanId: sub.planId,
      catalogPlan,
    };
  }

  /** Published catalog plans for the same service are the only possible targets. */
  private async targets(sub: SubRow): Promise<PlanTarget[]> {
    const current = this.snapshot(sub);
    if (!current.serviceType) return [];
    const catalog = await this.db.catalogPlan.findMany({
      where: {active: true, archivedAt: null, billingUnit: {in: ['PER_MONTH', 'PER_YEAR']}, service: {slug: current.serviceType, active: true, archivedAt: null}},
      include: {service: true},
      orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}],
    });
    let found: PlanTarget[] = catalog.map(plan => {
      const credits = Array.isArray((plan.metadata as {includedCredits?: unknown[]} | null)?.includedCredits) ? ((plan.metadata as {includedCredits: unknown[]}).includedCredits) : [];
      return {
        slug: plan.slug, name: plan.name, serviceType: plan.service.slug, unitAmount: plan.unitAmountCents, currency: plan.currency,
        interval: plan.billingUnit === 'PER_YEAR' ? 'YEAR' : 'MONTH', intervalCount: 1, includedCredits: credits, legacyPlanId: null,
        catalogPlan: {id: plan.id, slug: plan.slug, name: plan.name, serviceType: plan.service.slug, includedCredits: credits}, minQuantity: plan.minQuantity, maxQuantity: plan.maxQuantity,
      };
    });
    if (!found.length) {
      /* A service that has not been moved into the dynamic catalog still sells its legacy plans. */
      const legacy = await this.db.plan.findMany({where: {serviceType: current.serviceType, billingType: 'RECURRING', active: true, archivedAt: null}, orderBy: [{sortOrder: 'asc'}, {unitAmount: 'asc'}]});
      found = legacy.filter(plan => plan.interval).map(plan => ({
        slug: plan.slug, name: plan.name, serviceType: plan.serviceType, unitAmount: plan.unitAmount, currency: plan.currency, interval: plan.interval as BillingIntervalValue, intervalCount: plan.intervalCount || 1,
        includedCredits: Array.isArray(plan.includedCredits) ? (plan.includedCredits as unknown[]) : [], legacyPlanId: plan.id, catalogPlan: null, minQuantity: plan.minQuantity, maxQuantity: plan.maxQuantity,
      }));
    }
    return found.filter(target => target.slug !== current.slug && target.currency === sub.currency && sub.quantity >= Math.max(1, target.minQuantity) && sub.quantity <= Math.max(target.minQuantity, target.maxQuantity) && this.kind(sub, target) !== 'SAME');
  }

  private kind(sub: SubRow, target: PlanTarget): PlanChangeKind {
    return classifyPlanChange({unitAmount: sub.unitAmount, interval: sub.interval as BillingIntervalValue, intervalCount: sub.intervalCount}, target);
  }

  private benefitChanges(sub: SubRow, target: PlanTarget) {
    const label = (grant?: {amount: number; unlimited?: boolean}) => (!grant ? 'None' : grant.unlimited ? 'Unlimited' : String(grant.amount));
    const before = new Map(creditGrantsFor({name: '', billingType: 'RECURRING', unitAmount: 0, includedCredits: this.snapshot(sub).includedCredits}).map(grant => [grant.kind, grant]));
    const after = new Map(creditGrantsFor({name: '', billingType: 'RECURRING', unitAmount: 0, includedCredits: target.includedCredits}).map(grant => [grant.kind, grant]));
    return [...new Set([...before.keys(), ...after.keys()])].map(kind => ({kind, from: label(before.get(kind)), to: label(after.get(kind))})).filter(entry => entry.from !== entry.to);
  }

  private async openChange(subscriptionId: string) {
    return this.db.subscriptionChange.findFirst({where: {subscriptionId, status: {in: ['PENDING_PAYMENT', 'SCHEDULED']}}, orderBy: {createdAt: 'desc'}});
  }

  private blocker(sub: SubRow, open: unknown): string | null {
    if (sub.accessStatus === 'ENDED' || sub.stripeStatus === 'canceled') return 'This subscription has ended. Start a new purchase instead.';
    if (sub.stripeStatus !== 'active') return 'Plan changes are available once this subscription is active and paid up.';
    if (sub.cancelAtPeriodEnd) return 'This subscription is set to end. Undo the cancellation before changing plan.';
    if (sub.pendingUpdate || open) return 'A plan change is already pending for this subscription.';
    if (!sub.stripeItemId) return 'This subscription cannot be changed online. Please contact our team.';
    return null;
  }

  changeView(change: {id: string; kind: string; status: string; toSnapshot: unknown; effectiveAt: Date | null; amountDueNow: number; currency: string; createdAt: Date} | null) {
    if (!change) return null;
    const to = (change.toSnapshot ?? {}) as {name?: string; unitAmount?: number; interval?: string};
    return {id: change.id, kind: change.kind, status: change.status, targetName: to.name ?? 'New plan', targetUnitAmount: to.unitAmount ?? null, targetInterval: to.interval ?? null, effectiveAt: change.effectiveAt, amountDueNow: change.amountDueNow, currency: change.currency, requestedAt: change.createdAt, canWithdraw: change.status === 'SCHEDULED'};
  }

  async options(accountId: string, subscriptionId: string) {
    const sub = await this.owned(accountId, subscriptionId);
    const open = await this.openChange(sub.id);
    const blocked = this.blocker(sub, open);
    const targets = blocked ? [] : await this.targets(sub);
    return {
      current: {name: this.snapshot(sub).name, unitAmount: sub.unitAmount, currency: sub.currency, interval: sub.interval, intervalDescription: describeInterval(sub.interval as BillingIntervalValue, sub.intervalCount), quantity: sub.quantity},
      blocked,
      pendingChange: this.changeView(open),
      targets: targets.map(target => {
        const kind = this.kind(sub, target);
        return {slug: target.slug, name: target.name, unitAmount: target.unitAmount, currency: target.currency, interval: target.interval, intervalDescription: describeInterval(target.interval, target.intervalCount), kind, effective: kind === 'UPGRADE' ? 'IMMEDIATE' : 'PERIOD_END', benefitChanges: this.benefitChanges(sub, target)};
      }),
      policy: 'Upgrades start as soon as the prorated payment succeeds. Downgrades and billing-interval changes start at the end of your paid period, with no refund for the current period. Buying a different service is a separate purchase, not a plan change.',
    };
  }

  /** A Stripe Price for the target, created once and reused (idempotent by key). */
  private async ensurePrice(target: PlanTarget): Promise<string> {
    const key = [target.slug, target.currency, target.unitAmount, target.interval, target.intervalCount].join(':');
    const existing = await this.db.stripePriceRef.findUnique({where: {key}});
    if (existing) return existing.stripePriceId;
    const price = await this.stripe().prices.create(
      {currency: target.currency, unit_amount: target.unitAmount, recurring: {interval: target.interval === 'YEAR' ? 'year' : 'month', interval_count: target.intervalCount || 1}, product_data: {name: target.name}, metadata: {planSlug: target.slug}},
      {idempotencyKey: 'price:' + key},
    );
    try {
      await this.db.stripePriceRef.create({data: {key, stripePriceId: price.id}});
    } catch {
      const raced = await this.db.stripePriceRef.findUnique({where: {key}});
      if (raced) return raced.stripePriceId;
    }
    return price.id;
  }

  private async resolveTarget(sub: SubRow, slug: string): Promise<PlanTarget> {
    const target = (await this.targets(sub)).find(entry => entry.slug === slug);
    if (!target) throw new BadRequestException('That plan is not available as a change for this subscription.');
    return target;
  }

  private async stripePreview(sub: SubRow, priceId: string, prorationDate: number) {
    try {
      const invoice = await this.stripe().invoices.createPreview({
        customer: sub.stripeCustomerId,
        subscription: sub.stripeSubscriptionId,
        subscription_details: {items: [{id: sub.stripeItemId!, price: priceId, quantity: sub.quantity}], proration_behavior: 'always_invoice', proration_date: prorationDate},
      });
      const record = invoice as unknown as {total_taxes?: Array<{amount?: number}> | null; tax?: number | null; lines?: {data?: Array<{description?: string | null; amount?: number}>}};
      const lines = (record.lines?.data ?? []).slice(0, 20).map(line => ({description: String(line.description ?? '').slice(0, 200), amount: Number(line.amount ?? 0)}));
      return {
        amountDue: invoice.amount_due ?? 0,
        subtotal: invoice.subtotal ?? 0,
        total: invoice.total ?? 0,
        taxAmount: record.total_taxes ? record.total_taxes.reduce((sum, row) => sum + (row.amount ?? 0), 0) : record.tax ?? 0,
        credit: lines.filter(line => line.amount < 0).reduce((sum, line) => sum + line.amount, 0),
        lines,
      };
    } catch {
      throw new BadRequestException('We could not get a price for this change from Stripe. Nothing was changed; please try again.');
    }
  }

  /** Server-generated preview. The returned token pins exactly what was shown. */
  async preview(accountId: string, subscriptionId: string, targetSlug: string) {
    const sub = await this.owned(accountId, subscriptionId);
    const blocked = this.blocker(sub, await this.openChange(sub.id));
    if (blocked) throw new ConflictException(blocked);
    const target = await this.resolveTarget(sub, targetSlug);
    return this.buildPreview(sub, target, Math.floor(Date.now() / 1000));
  }

  private async buildPreview(sub: SubRow, target: PlanTarget, prorationDate: number) {
    const kind = this.kind(sub, target);
    const priceId = await this.ensurePrice(target);
    const immediate = kind === 'UPGRADE';
    const quote = immediate ? await this.stripePreview(sub, priceId, prorationDate) : {amountDue: 0, subtotal: 0, total: 0, taxAmount: 0, credit: 0, lines: [] as Array<{description: string; amount: number}>};
    const token: PreviewToken = {s: sub.id, t: target.slug, k: kind, pd: prorationDate, due: quote.amountDue, price: priceId, amt: target.unitAmount};
    return {
      kind,
      effective: immediate ? ('IMMEDIATE' as const) : ('PERIOD_END' as const),
      effectiveAt: immediate ? new Date(prorationDate * 1000) : sub.currentPeriodEnd,
      current: {name: this.snapshot(sub).name, unitAmount: sub.unitAmount, intervalDescription: describeInterval(sub.interval as BillingIntervalValue, sub.intervalCount)},
      target: {slug: target.slug, name: target.name, unitAmount: target.unitAmount, intervalDescription: describeInterval(target.interval, target.intervalCount)},
      currency: sub.currency,
      quantity: sub.quantity,
      /* From Stripe's invoice preview, including any tax Stripe is configured to charge. */
      amountDueNow: quote.amountDue,
      prorationCredit: quote.credit,
      taxAmount: quote.taxAmount,
      lines: quote.lines,
      /* Catalog price x quantity; tax and discounts on the renewal are decided by Stripe at that time. */
      nextRenewalTotal: target.unitAmount * sub.quantity,
      nextRenewalIsEstimate: true,
      nextRenewalAt: immediate ? sub.currentPeriodEnd : null,
      benefitChanges: this.benefitChanges(sub, target),
      notes: immediate
        ? ['Your new plan starts once this payment succeeds. Until then your current plan stays exactly as it is.', 'If your bank asks you to confirm the payment, you will be sent to Stripe to finish it.']
        : ['Your current plan and benefits continue until the end of the paid period.', 'No refund or credit is issued for the current period.', 'You can withdraw this change any time before it takes effect.'],
      confirmToken: signProof(PREVIEW_PURPOSE, token, process.env.JWT_SECRET!, PREVIEW_TTL_MS),
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    };
  }

  /**
   * Confirm a previewed change. The quote is re-run with the same proration
   * date; if the amount moved, nothing is changed and the customer is shown the
   * new figures to accept again.
   */
  async confirm(accountId: string, subscriptionId: string, input: {targetSlug: string; confirmToken: string; idempotencyKey?: string}, actor: {id: string; label: string}) {
    const sub = await this.owned(accountId, subscriptionId);
    const token = verifyProof<PreviewToken>(PREVIEW_PURPOSE, input.confirmToken, process.env.JWT_SECRET!);
    if (!token || token.s !== sub.id || token.t !== input.targetSlug) throw new ConflictException({statusCode: 409, code: 'PREVIEW_EXPIRED', message: 'This price preview has expired. Please review the change again.'});
    return this.cards.operation(sub.customerId, 'PLAN_CHANGE', input.idempotencyKey, {subscriptionId: sub.id, target: input.targetSlug}, () =>
      this.cards.withLock(sub.customerId, async () => {
        const fresh = await this.owned(accountId, subscriptionId);
        const blocked = this.blocker(fresh, await this.openChange(fresh.id));
        if (blocked) throw new ConflictException(blocked);
        const target = await this.resolveTarget(fresh, input.targetSlug);
        const kind = this.kind(fresh, target);
        const priceId = await this.ensurePrice(target);
        const requote = async () => ({statusCode: 409, code: 'PREVIEW_CHANGED', message: 'The price for this change has been updated. Please review the new amounts before confirming.', preview: await this.buildPreview(fresh, target, Math.floor(Date.now() / 1000))});
        if (kind !== token.k || priceId !== token.price || target.unitAmount !== token.amt) throw new ConflictException(await requote());

        const current = this.snapshot(fresh);
        const base = {
          subscriptionId: fresh.id, customerId: fresh.customerId, kind, currency: fresh.currency, targetPriceId: priceId,
          fromSnapshot: {name: current.name, unitAmount: fresh.unitAmount, interval: fresh.interval, includedCredits: current.includedCredits} as object,
          toSnapshot: {name: target.name, slug: target.slug, unitAmount: target.unitAmount, interval: target.interval, includedCredits: target.includedCredits, legacyPlanId: target.legacyPlanId, ...(target.catalogPlan ? {catalogPlan: target.catalogPlan} : {})} as object,
        };
        return kind === 'UPGRADE' ? this.applyUpgrade(fresh, target, priceId, token, base, actor, requote) : this.schedule(fresh, target, priceId, base, actor);
      }),
    );
  }

  private async applyUpgrade(sub: SubRow, target: PlanTarget, priceId: string, token: PreviewToken, base: Record<string, unknown>, actor: {id: string; label: string}, requote: () => Promise<Record<string, unknown>>) {
    const quote = await this.stripePreview(sub, priceId, token.pd);
    if (quote.amountDue !== token.due) throw new ConflictException(await requote());
    /* The row exists before Stripe is asked, so a webhook that races us can settle it. */
    const change = await this.db.subscriptionChange.create({data: {...base, status: 'PENDING_PAYMENT', amountDueNow: quote.amountDue, effectiveAt: new Date()} as never});
    let updated: Stripe.Subscription;
    try {
      updated = await this.stripe().subscriptions.update(
        sub.stripeSubscriptionId,
        {items: [{id: sub.stripeItemId!, price: priceId, quantity: sub.quantity}], proration_behavior: 'always_invoice', proration_date: token.pd, payment_behavior: 'pending_if_incomplete'},
        {idempotencyKey: 'plan-change:' + change.id},
      );
    } catch {
      await this.db.subscriptionChange.update({where: {id: change.id}, data: {status: 'FAILED'}});
      await this.billing.record({subscriptionId: sub.id, customerId: sub.customerId, actorType: 'CUSTOMER', actorId: actor.id, actorLabel: actor.label, action: 'PLAN_CHANGE_FAILED', reason: 'Stripe did not accept the upgrade'});
      throw new BadRequestException('Stripe did not accept the change, so your current plan is unchanged. Check your card and try again.');
    }
    const invoiceId = refOf(updated.latest_invoice);
    await this.db.subscriptionChange.update({where: {id: change.id}, data: {stripeInvoiceId: invoiceId}});
    await this.billing.record({subscriptionId: sub.id, customerId: sub.customerId, actorType: 'CUSTOMER', actorId: actor.id, actorLabel: actor.label, action: 'PLAN_CHANGE_REQUESTED', toState: target.name, stripeRef: sub.stripeSubscriptionId, data: {kind: 'UPGRADE', amountDueNow: quote.amountDue, pending: Boolean(updated.pending_update)}});
    /* syncSubscription settles the change: APPLIED only if Stripe shows the new price with no pending update. */
    await this.billing.syncSubscription(updated);
    const settled = await this.db.subscriptionChange.findUnique({where: {id: change.id}});
    if (settled?.status === 'APPLIED') return {status: 'APPLIED', change: this.changeView(settled), message: 'Your plan is now ' + target.name + '.'};
    /* Payment failed or needs authentication (3-D Secure): the previous plan stays in force.
       Stripe's hosted invoice page completes the payment and the authentication safely. */
    let paymentUrl: string | null = null;
    if (invoiceId) {
      try {
        paymentUrl = (await this.stripe().invoices.retrieve(invoiceId)).hosted_invoice_url ?? null;
      } catch {
        paymentUrl = null;
      }
    }
    return {status: 'PENDING_PAYMENT', change: this.changeView(settled), paymentUrl, message: 'Your payment needs to be completed before the new plan starts. Your current plan is unchanged until then.'};
  }

  private async schedule(sub: SubRow, target: PlanTarget, priceId: string, base: Record<string, unknown>, actor: {id: string; label: string}) {
    const stripe = this.stripe();
    let scheduleId: string;
    let effectiveAt: Date | null;
    try {
      const live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      scheduleId = refOf(live.schedule) ?? (await stripe.subscriptionSchedules.create({from_subscription: sub.stripeSubscriptionId}, {idempotencyKey: 'schedule:' + sub.id + ':' + (sub.currentPeriodEnd?.getTime() ?? 0)})).id;
      const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const phase = schedule.phases.find(entry => entry.start_date <= nowSeconds && entry.end_date > nowSeconds) ?? schedule.phases[0];
      if (!phase) throw new Error('no current phase');
      const currentItems = phase.items.map(item => ({price: refOf(item.price)!, quantity: item.quantity ?? 1}));
      /* Swap only the plan item; every other item carries over unchanged. */
      let swapped = false;
      const nextItems = currentItems.map(item => {
        if (!swapped && item.price === sub.stripePriceId) {
          swapped = true;
          return {price: priceId, quantity: item.quantity};
        }
        return item;
      });
      if (!swapped) nextItems[0] = {price: priceId, quantity: currentItems[0]?.quantity ?? sub.quantity};
      await stripe.subscriptionSchedules.update(scheduleId, {
        end_behavior: 'release',
        proration_behavior: 'none',
        phases: [
          {items: currentItems, start_date: phase.start_date, end_date: phase.end_date},
          /* One billing period on the new price, then the schedule releases and the subscription simply continues. */
          {items: nextItems, duration: {interval: target.interval === 'YEAR' ? 'year' : 'month', interval_count: target.intervalCount || 1}},
        ],
      });
      /* The provider's own period boundary, never a 30-day assumption. */
      effectiveAt = new Date(phase.end_date * 1000);
    } catch {
      throw new BadRequestException('Stripe did not confirm the scheduled change. Nothing was changed; please try again.');
    }
    const change = await this.db.subscriptionChange.create({data: {...base, status: 'SCHEDULED', stripeScheduleId: scheduleId, effectiveAt} as never});
    await this.db.subscription.update({where: {id: sub.id}, data: {stripeScheduleId: scheduleId}});
    await this.billing.record({subscriptionId: sub.id, customerId: sub.customerId, actorType: 'CUSTOMER', actorId: actor.id, actorLabel: actor.label, action: 'PLAN_CHANGE_SCHEDULED', toState: target.name, stripeRef: scheduleId, data: {kind: base.kind, effectiveAt: effectiveAt?.toISOString() ?? null}});
    await this.billing.notify(sub.customerId, 'plan_change', {summary: 'Your plan will change to ' + target.name + ' on ' + (effectiveAt ? new Intl.DateTimeFormat('en-US', {dateStyle: 'long', timeZone: 'America/Chicago'}).format(effectiveAt) : 'your next renewal') + '. Your current plan continues until then, and you can withdraw the change before that date.'}, 'plan-scheduled:' + change.id);
    return {status: 'SCHEDULED', change: this.changeView(change), message: 'Your plan will change to ' + target.name + ' at the end of your paid period.'};
  }

  /** Withdraw a scheduled change before it takes effect. */
  async withdraw(accountId: string, subscriptionId: string, actor: {id: string; label: string}) {
    const sub = await this.owned(accountId, subscriptionId);
    return this.cards.withLock(sub.customerId, async () => {
      const change = await this.db.subscriptionChange.findFirst({where: {subscriptionId: sub.id, status: 'SCHEDULED'}, orderBy: {createdAt: 'desc'}});
      if (!change?.stripeScheduleId) throw new BadRequestException('There is no scheduled plan change to withdraw.');
      try {
        await this.stripe().subscriptionSchedules.release(change.stripeScheduleId);
      } catch {
        throw new BadRequestException('Stripe did not confirm the withdrawal. The scheduled change is still in place; please try again.');
      }
      await this.db.subscriptionChange.update({where: {id: change.id}, data: {status: 'WITHDRAWN'}});
      await this.db.subscription.update({where: {id: sub.id}, data: {stripeScheduleId: null}});
      await this.billing.record({subscriptionId: sub.id, customerId: sub.customerId, actorType: 'CUSTOMER', actorId: actor.id, actorLabel: actor.label, action: 'PLAN_CHANGE_WITHDRAWN', stripeRef: change.stripeScheduleId});
      return {status: 'WITHDRAWN', message: 'The scheduled plan change was withdrawn. Your current plan continues.'};
    });
  }
}
