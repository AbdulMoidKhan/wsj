/**
 * Billing module: catalog plans, server-authoritative checkout, real Stripe
 * subscriptions, verified webhook reconciliation, customer self-service and
 * admin cancellation with a full audit trail.
 *
 * Money is always integer minor units. Stripe is the authority for subscription
 * state: nothing is reported as cancelled, paid or active until Stripe (webhook
 * or a direct retrieve) confirms it.
 */
import {Controller, Get, Post, Patch, Delete, Param, Query, Req, Res, All, HttpCode, Optional, UseGuards, Inject, Injectable, BadRequestException, ConflictException, GoneException, NotFoundException, ForbiddenException} from '@nestjs/common';
import {ApiBearerAuth} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Max, MinLength, ValidateIf, ValidateNested, IsDateString} from 'class-validator';
import {Type, Transform} from 'class-transformer';
import Stripe from 'stripe';
import {Db, AuthGuard, Roles, parsePagination} from './core';
import {ValidatedBody, ValidatedQuery} from './validation';
import {PaymentClient} from './payments';
import {frontendOrigins} from './origins';
import {clearCatalogCache} from './catalog-cache';
import {OutboxService, issueToken, tokenLink} from './mail';
import {AccountLifecycle} from './account-cards';
import {CustomerAuthService, assertTrustedOrigin} from './account-auth';
import {ACCOUNT_TERMS_VERSION, displayName, normalizeEmail, signProof, verifyProof} from './account-core';
import {
  BILLING_TERMS_VERSION,
  DEFAULT_GRACE_DAYS,
  accessStatusFor,
  cancellationPreview,
  computeTotals,
  creditGrantsFor,
  describeInterval,
  entitlementBalance,
  fromStripeTimestamp,
  graceEndsAt,
  lineAmount,
  paymentOutcome,
  PricingError,
  resolveQuantity,
  selectionErrors,
  type BillingIntervalValue,
  type BillingTypeValue,
  type Discount,
  type Totals,
} from './billing-core';

/** Order-scoped receipt proof: lets the buyer's own browser see that one purchase's details, nothing else. */
const RECEIPT_PROOF_TTL_MS = 2 * 60 * 60 * 1000;
const RECEIPT_PURPOSE = 'order-receipt';

/** Who is checking out, decided by the server from the session cookie, never from the form. */
export interface CheckoutContext {
  /** Set only when a valid customer session accompanied the request. */
  accountId?: string | null;
}

/** Invoice -> subscription id, for both the current API shape and the pre-2025 one. */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  const record = invoice as {parent?: {subscription_details?: {subscription?: unknown} | null} | null; subscription?: unknown};
  const value = record.parent?.subscription_details?.subscription ?? record.subscription;
  return typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as {id: unknown}).id) : null;
}

/** Checkout-time JSON only: never resolve current catalog benefits on renewal. */
function catalogPlanSnapshot(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const snapshot = (metadata as Record<string, unknown>).catalogPlan;
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : null;
}

/* ───────────────────────────── DTOs ───────────────────────────── */

export class CheckoutItemDto {
  @IsString() @MinLength(1) @MaxLength(200) planSlug!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) quantity?: number;
  @IsOptional() @IsDateString({strict: true}) @MaxLength(40) startAt?: string;
  @IsOptional() @IsString() @MaxLength(100) resourceId?: string;
}

export class CheckoutDto {
  @Transform(({value}) => (typeof value === 'string' ? value.trim() : value)) @IsString() @MinLength(1) @MaxLength(200) customerName!: string;
  @Transform(({value}) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(254) customerEmail!: string;
  @IsOptional() @IsString() @MaxLength(50) customerPhone?: string;
  @IsArray() @ValidateNested({each: true}) @Type(() => CheckoutItemDto) items!: CheckoutItemDto[];
  @IsOptional() @IsString() @MaxLength(100) couponCode?: string;
  @IsOptional() @IsIn(['STRIPE', 'MANUAL']) paymentMethod?: 'STRIPE' | 'MANUAL';
  /** Recurring purchases require an explicit acknowledgement of the renewal terms. */
  @IsOptional() @IsBoolean() acceptRecurringTerms?: boolean;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) membershipCircle?: string;
  /** Render Stripe Checkout inside our own dialog instead of redirecting away. */
  @IsOptional() @IsBoolean() embedded?: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  /** Card payments create a customer account and save the card to it; this records that consent. */
  @IsOptional() @IsBoolean() acceptAccountTerms?: boolean;
  /** Separate and optional. Never implied by any other checkbox. */
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
  /** Signed-in buyer confirming they want a second subscription to a plan they already hold. */
  @IsOptional() @IsBoolean() confirmAdditionalSubscription?: boolean;
}

export class PlanDto {
  @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @Transform(({value}) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsString() @MaxLength(200) slug!: string;
  @IsString() @MinLength(1) @MaxLength(100) serviceType!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsIn(['ONE_TIME', 'RECURRING']) billingType!: 'ONE_TIME' | 'RECURRING';
  @IsOptional() @IsIn(['MONTH', 'YEAR']) interval?: BillingIntervalValue;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) intervalCount?: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000000) unitAmount!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsIn(['PACKAGE', 'HOUR', 'DAY', 'SEAT', 'ITEM', 'SESSION']) pricingUnit?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10080) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) minQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) maxQuantity?: number;
  @IsOptional() @IsBoolean() requiresSchedule?: boolean;
  @IsOptional() @IsBoolean() requiresResource?: boolean;
  @IsOptional() @IsBoolean() requiresOnboarding?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(90) trialDays?: number;
  @IsOptional() @IsArray() includedCredits?: unknown[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(-2147483648) @Max(2147483647) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() metadata?: Record<string, unknown>;
}

export class PlanUpdateDto extends PlanDto {}

export class CancelDto {
  @IsOptional() @IsIn(['PERIOD_END', 'IMMEDIATE']) mode?: 'PERIOD_END' | 'IMMEDIATE';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}

export class EntitlementAdjustDto {
  @IsIn(['COWORKING_DAY', 'MEETING_ROOM_HOUR', 'STUDIO_HOUR', 'CREDIT']) kind!: string;
  @Type(() => Number) @IsInt() @Min(-100000) @Max(100000) delta!: number;
  @IsString() @MinLength(1) @MaxLength(300) reason!: string;
}

export class PortalLinkDto {
  @Transform(({value}) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(254) email!: string;
}

export class BillingListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @IsString() @MaxLength(40) accessStatus?: string;
  @IsOptional() @IsString() @MaxLength(100) serviceType?: string;
}

/* ───────────────────────────── Service ───────────────────────────── */

/**
 * One server-priced checkout line, normalised so the Stripe path does not care
 * whether the amount came from the legacy plan table or from the dynamic
 * service catalog. planId is null for catalog-sourced lines, which keeps the
 * order item readable without inventing a legacy plan row.
 */
export interface PricedLine {
  planId: string | null;
  slug: string;
  name: string;
  description: string;
  currency: string;
  unitAmount: number;
  quantity: number;
  amount: number;
  billingType: BillingTypeValue;
  interval: BillingIntervalValue | null;
  intervalCount: number;
  metadata: Record<string, unknown>;
}

export interface PricedBundle {
  lines: PricedLine[];
  totals: Totals;
  coupon: {promotionCodeId: string; discount: Discount} | null;
  hasRecurring: boolean;
  currency: string;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(PaymentClient) private payments: PaymentClient = new PaymentClient(),
    @Optional() @Inject(OutboxService) private outbox?: OutboxService,
    @Optional() @Inject(AccountLifecycle) private lifecycle?: AccountLifecycle,
  ) {}

  private stripe(): Stripe {
    return this.payments.client();
  }

  private origin(): string {
    return frontendOrigins()[0];
  }

  /** Durable audit row for every state change, whoever caused it. */
  async record(entry: {subscriptionId?: string | null; orderId?: string | null; customerId?: string | null; actorType: string; actorId?: string | null; actorLabel?: string | null; action: string; fromState?: string | null; toState?: string | null; reason?: string | null; note?: string | null; stripeRef?: string | null; data?: Record<string, unknown>}) {
    await this.db.billingEvent.create({
      data: {
        subscriptionId: entry.subscriptionId ?? null,
        orderId: entry.orderId ?? null,
        customerId: entry.customerId ?? null,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        actorLabel: entry.actorLabel ?? null,
        action: entry.action,
        fromState: entry.fromState ?? null,
        toState: entry.toState ?? null,
        reason: entry.reason ?? null,
        note: entry.note ?? null,
        stripeRef: entry.stripeRef ?? null,
        data: (entry.data ?? {}) as object,
      },
    });
  }

  /**
   * Decide which customer record a checkout belongs to.
   *
   * - ACCOUNT: a valid customer session accompanied the request. The account and
   *   its Stripe customer come from the session; the form's email and any id in
   *   the body are ignored for identity and never overwrite the profile.
   * - GUEST: no session, and the email is new or belongs to a record that has
   *   never been activated. The one record per address is reused so retries and
   *   concurrent submissions cannot create duplicate identities or Stripe
   *   customers. Only blank profile fields are filled; nothing is overwritten.
   * - SHADOW: no session, but the email belongs to an ACTIVATED account. A typed
   *   email proves nothing, so the purchase goes to a separate unverified record
   *   with its own Stripe customer. It is invisible to the account and its card
   *   never touches the account's billing profile until the verified owner
   *   claims it. The buyer sees exactly the same checkout either way.
   */
  async resolveCheckoutCustomer(input: {email: string; name: string; phone?: string | null}, context: CheckoutContext = {}) {
    if (context.accountId) {
      const account = await this.db.customer.findUnique({where: {id: context.accountId}});
      if (!account || account.accountStatus !== 'ACTIVE' || account.shadowState) throw new ForbiddenException('Please sign in again to continue.');
      return {customer: account, mode: 'ACCOUNT' as const};
    }
    const email = normalizeEmail(input.email);
    const name = input.name?.trim() || email;
    const phone = input.phone?.trim() || null;
    let existing = await this.db.customer.findUnique({where: {emailKey: email}});
    if (!existing) {
      try {
        return {customer: await this.db.customer.create({data: {email, emailKey: email, name, phone}}), mode: 'GUEST' as const};
      } catch {
        /* A concurrent checkout with the same email won the unique emailKey: use its row. */
        existing = await this.db.customer.findUnique({where: {emailKey: email}});
        if (!existing) throw new BadRequestException('Unable to start checkout. Please try again.');
      }
    }
    if (existing.accountStatus === 'ACTIVE' || existing.passwordHash) {
      return {customer: await this.db.customer.create({data: {email, emailKey: null, shadowState: 'PENDING_CLAIM', name, phone}}), mode: 'SHADOW' as const};
    }
    const fill = {...(!existing.name || existing.name === existing.email ? {name} : {}), ...(!existing.phone && phone ? {phone} : {})};
    return {customer: Object.keys(fill).length ? await this.db.customer.update({where: {id: existing.id}, data: fill}) : existing, mode: 'GUEST' as const};
  }

  /** Kept for callers that only need the guest path. */
  async customerFor(email: string, name: string, phone?: string) {
    return (await this.resolveCheckoutCustomer({email, name, phone})).customer;
  }

  /** Short-lived proof scoped to one order; it is not a session and opens nothing else. */
  receiptProof(orderId: string): string {
    return signProof(RECEIPT_PURPOSE, {o: orderId}, process.env.JWT_SECRET!, RECEIPT_PROOF_TTL_MS);
  }

  receiptProofMatches(orderId: string, proof: unknown): boolean {
    return verifyProof<{o: string}>(RECEIPT_PURPOSE, proof, process.env.JWT_SECRET!)?.o === orderId;
  }

  /** Reuse the Stripe customer across purchases so subscriptions stay on one profile. */
  async stripeCustomerFor(customer: {id: string; email: string; name: string; phone?: string | null; stripeCustomerId?: string | null}): Promise<string> {
    if (customer.stripeCustomerId) return customer.stripeCustomerId;
    const created = await this.stripe().customers.create(
      {email: customer.email, name: customer.name || undefined, phone: customer.phone || undefined, metadata: {customerId: customer.id}},
      {idempotencyKey: 'customer:' + customer.id},
    );
    await this.db.customer.update({where: {id: customer.id}, data: {stripeCustomerId: created.id}});
    return created.id;
  }

  /** Coupons stay in Stripe (single source of truth) and are validated before use. */
  async resolveCoupon(code?: string): Promise<{promotionCodeId: string; discount: Discount} | null> {
    if (!code) return null;
    const promos = await this.stripe().promotionCodes.list({code, active: true, limit: 1, expand: ['data.coupon']});
    const promo = promos.data[0] as (Stripe.PromotionCode & {coupon?: Stripe.Coupon}) | undefined;
    const coupon = promo?.coupon;
    if (!promo || !coupon?.valid) throw new BadRequestException('Invalid or expired coupon code');
    return {
      promotionCodeId: promo.id,
      discount: {
        code,
        percentOff: coupon.percent_off ?? null,
        amountOff: coupon.amount_off ?? null,
        duration: (coupon.duration as Discount['duration']) ?? null,
        durationInMonths: coupon.duration_in_months ?? null,
      },
    };
  }

  /** Server recomputes everything; the request only names catalog entries. */
  async priceCheckout(dto: CheckoutDto): Promise<PricedBundle> {
    if (!dto.items?.length) throw new BadRequestException('Select at least one package');
    if (dto.items.length > 10) throw new BadRequestException('Too many items in one checkout');
    const lines: PricedLine[] = [];
    const errors: string[] = [];
    for (const item of dto.items) {
      // Ownership is independent of publication and parent status. An old Plan
      // row must never bypass catalog pricing, archives or required add-ons.
      // Older fakeDb callers have no catalog delegate and remain legacy-only.
      const catalogPlan = this.db.catalogPlan;
      if (catalogPlan && await catalogPlan.findFirst({where: {slug: item.planSlug}, select: {id: true}})) {
        errors.push('Use the catalog checkout for package: ' + item.planSlug);
        continue;
      }
      const plan = await this.db.plan.findFirst({where: {slug: item.planSlug, active: true, archivedAt: null}});
      if (!plan) {
        errors.push('Unknown or unavailable package: ' + item.planSlug);
        continue;
      }
      errors.push(...selectionErrors(plan as never, {quantity: item.quantity, startAt: item.startAt ?? null, resourceId: item.resourceId ?? null}));
      try {
        const quantity = resolveQuantity(plan as never, item.quantity);
        lines.push({
          planId: plan.id,
          slug: plan.slug,
          name: plan.name,
          description: plan.description || plan.serviceType,
          currency: plan.currency,
          unitAmount: plan.unitAmount,
          quantity,
          amount: lineAmount(plan as never, quantity),
          billingType: plan.billingType as BillingTypeValue,
          interval: plan.interval as BillingIntervalValue | null,
          intervalCount: plan.intervalCount || 1,
          metadata: {slug: plan.slug, serviceType: plan.serviceType},
        });
      } catch (error) {
        errors.push(error instanceof PricingError ? error.message : 'Invalid quantity');
      }
    }
    if (errors.length) throw new BadRequestException(errors);
    return this.totalsFor(lines, dto.couponCode);
  }

  /**
   * Shared tail of every pricing path: one currency, a verified coupon and
   * server-side totals. Lines may come from the legacy plan table or from the
   * dynamic service catalog; the maths is identical for both.
   */
  async totalsFor(lines: PricedLine[], couponCode?: string): Promise<PricedBundle> {
    if (!lines.length) throw new BadRequestException('Select at least one package');
    const currencies = new Set(lines.map(line => line.currency));
    if (currencies.size > 1) throw new BadRequestException('All packages in one checkout must share a currency');
    const coupon = await this.resolveCoupon(couponCode);
    let totals;
    try {
      totals = computeTotals({
        lines: lines.map(line => ({amount: line.amount, billingType: line.billingType, interval: line.interval})),
        discount: coupon?.discount ?? null,
      });
    } catch (error) {
      throw new BadRequestException(error instanceof PricingError ? error.message : 'Unable to price this selection');
    }
    const hasRecurring = lines.some(line => line.billingType === 'RECURRING');
    return {lines, totals, coupon, hasRecurring, currency: lines[0]?.currency ?? 'usd'};
  }

  /**
   * Persist the checkout attempt first, then contact Stripe. A browser that
   * disappears after paying still has a durable order the webhook can complete.
   */
  async createCheckout(dto: CheckoutDto, pricedOverride?: PricedBundle, context: CheckoutContext = {}) {
    if (dto.website) throw new BadRequestException('Invalid submission');
    const priced = pricedOverride ?? (await this.priceCheckout(dto));
    if (priced.hasRecurring && dto.acceptRecurringTerms !== true) throw new BadRequestException('You must accept the recurring billing terms to continue');

    const outcome = paymentOutcome(priced.totals.dueNowAmount);
    if (outcome === 'BELOW_MINIMUM') throw new BadRequestException('The amount due is below the minimum card payment. Please contact our team to complete this purchase.');
    const manual = dto.paymentMethod === 'MANUAL';
    /* A card payment provisions an account and saves the card to it. That needs explicit consent. */
    const cardPayment = !manual && outcome === 'CHARGEABLE';
    if (cardPayment && dto.acceptAccountTerms !== true) throw new BadRequestException('Please confirm that a customer account will be created and your card saved to it.');

    const {customer, mode: identity} = await this.resolveCheckoutCustomer({email: dto.customerEmail, name: dto.customerName, phone: dto.customerPhone}, context);
    if (identity === 'ACCOUNT' && priced.hasRecurring && dto.confirmAdditionalSubscription !== true) await this.assertNotDuplicateSubscription(customer.id, priced.lines);
    const now = new Date();
    const order = await this.db.order.create({
      data: {
        customerId: customer.id,
        status: 'PENDING',
        mode: priced.hasRecurring ? 'SUBSCRIPTION' : 'PAYMENT',
        currency: priced.currency,
        subtotalAmount: priced.totals.subtotalAmount,
        discountAmount: priced.totals.discountAmount,
        taxAmount: priced.totals.taxAmount,
        totalAmount: priced.totals.totalAmount,
        dueNowAmount: priced.totals.dueNowAmount,
        recurringAmount: priced.totals.recurringAmount,
        recurringInterval: priced.totals.recurringInterval,
        couponCode: dto.couponCode ?? null,
        paymentMethod: manual ? 'MANUAL' : 'STRIPE',
        termsVersion: priced.hasRecurring ? BILLING_TERMS_VERSION : null,
        termsAcceptedAt: priced.hasRecurring || dto.acceptAccountTerms === true ? now : null,
        /* What the buyer typed, kept on the order. The customer profile is not rewritten from it. */
        contactName: dto.customerName?.trim() || null,
        contactEmail: normalizeEmail(dto.customerEmail) || null,
        contactPhone: dto.customerPhone?.trim() || null,
        notes: dto.notes ?? null,
        metadata: {
          ...(dto.membershipCircle ? {membershipCircle: dto.membershipCircle} : {}),
          ...(dto.items.some(i => i.startAt) ? {schedule: dto.items.map(i => ({planSlug: i.planSlug, startAt: i.startAt ?? null}))} : {}),
          identity,
          consents: {
            ...(dto.acceptAccountTerms === true ? {accountTermsVersion: ACCOUNT_TERMS_VERSION, saveCard: cardPayment} : {}),
            /* Marketing is recorded only when its own box was ticked. */
            marketing: dto.marketingOptIn === true,
            at: now.toISOString(),
          },
        },
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        items: {
          create: priced.lines.map(line => ({
            planId: line.planId,
            description: line.name,
            quantity: line.quantity,
            unitAmount: line.unitAmount,
            amount: line.amount,
            billingType: line.billingType,
            interval: line.interval,
            metadata: line.metadata as object,
          })),
        },
      },
      include: {items: true},
    });
    await this.record({orderId: order.id, customerId: customer.id, actorType: 'CUSTOMER', actorLabel: customer.email, action: 'CHECKOUT_CREATED', toState: 'PENDING', data: {dueNow: order.dueNowAmount, recurring: order.recurringAmount, mode: order.mode, identity}});
    const receiptProof = this.receiptProof(order.id);

    /* Manual payment never activates access; it stays an unpaid order for staff and provisions no account. */
    if (manual) {
      return {orderId: order.id, status: 'pending_manual_payment' as const, checkoutUrl: null, receiptProof, summary: this.orderSummary(order)};
    }
    if (outcome === 'FREE') {
      /* Zero total from server-side pricing: no charge exists and none is invented. No card was
         collected either, so the account starts in the add-a-card remediation state. */
      const paid = await this.db.order.update({where: {id: order.id}, data: {status: 'PAID', paidAt: new Date()}, include: {items: true}});
      await this.record({orderId: order.id, customerId: customer.id, actorType: 'SYSTEM', action: 'ORDER_PAID', fromState: 'PENDING', toState: 'PAID', data: {reason: 'zero total from server pricing'}});
      await this.lifecycle?.onOrderPaid(order.id).catch(() => undefined);
      return {orderId: paid.id, status: 'paid' as const, checkoutUrl: null, receiptProof, summary: this.orderSummary(paid)};
    }

    const stripeCustomerId = await this.stripeCustomerFor(customer);
    const origin = this.origin();
    const recurringLines = priced.lines.filter(line => line.billingType === 'RECURRING');
    const oneTimeLines = priced.lines.filter(line => line.billingType === 'ONE_TIME');
    const mode: Stripe.Checkout.SessionCreateParams.Mode = recurringLines.length ? 'subscription' : 'payment';

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = recurringLines.map(line => ({
      quantity: line.quantity,
      price_data: {
        currency: line.currency,
        unit_amount: line.unitAmount,
        recurring: {interval: line.interval === 'YEAR' ? 'year' : 'month', interval_count: line.intervalCount || 1},
        product_data: {name: line.name, description: (line.description || line.slug).slice(0, 300)},
      },
    }));
    const oneTimeItems: Stripe.Checkout.SessionCreateParams.LineItem[] = oneTimeLines.map(line => ({
      quantity: line.quantity,
      price_data: {currency: line.currency, unit_amount: line.unitAmount, product_data: {name: line.name, description: (line.description || line.slug).slice(0, 300)}},
    }));

    const params: Stripe.Checkout.SessionCreateParams = {
      mode,
      customer: stripeCustomerId,
      client_reference_id: order.id,
      metadata: {orderId: order.id, customerId: customer.id},
      /* In subscription mode the one-time lines ride along on the first invoice. */
      line_items: mode === 'subscription' ? [...lineItems, ...oneTimeItems] : oneTimeItems,
      /* The card is saved to this Stripe customer for renewals and later purchases. A subscription
         always keeps its card; a one-time payment needs setup_future_usage and gets an invoice. */
      ...(mode === 'subscription'
        ? {subscription_data: {metadata: {orderId: order.id, customerId: customer.id}}}
        : {payment_intent_data: {metadata: {orderId: order.id, customerId: customer.id}, setup_future_usage: 'off_session' as const}, invoice_creation: {enabled: true, invoice_data: {metadata: {orderId: order.id}}}}),
      /* Only a signed-in owner is offered the cards saved on their own profile. Removal inside
         Checkout stays off so it cannot bypass the minimum-one-card rule. */
      ...(identity === 'ACCOUNT' ? {saved_payment_method_options: {allow_redisplay_filters: ['always', 'limited', 'unspecified'] as Array<'always' | 'limited' | 'unspecified'>, payment_method_save: 'enabled' as const, payment_method_remove: 'disabled' as const}} : {}),
      ...(priced.coupon ? {discounts: [{promotion_code: priced.coupon.promotionCodeId}]} : {}),
      /* Embedded Checkout renders Stripe's own payment UI in an iframe we host, and
         redirects the top window to return_url once the payment completes. */
      ...(dto.embedded
        ? {ui_mode: 'embedded_page' as const, return_url: origin + '/booking-confirmation/?order=' + order.id + '&session_id={CHECKOUT_SESSION_ID}'}
        : {success_url: origin + '/booking-confirmation/?order=' + order.id, cancel_url: origin + '/?checkout_cancelled=' + order.id}),
    };

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe().checkout.sessions.create(params, {idempotencyKey: 'checkout:' + order.id});
    } catch (error: unknown) {
      /* Log the provider failure type for operators only; never echo provider
         detail back to the client, which can disclose account/config internals. */
      const kind = error && typeof error === 'object' && 'type' in error ? String((error as {type?: unknown}).type) : 'unknown_error';
      console.error('Stripe checkout session failed for order ' + order.id + ' (' + kind + ')');
      await this.db.order.update({where: {id: order.id}, data: {status: 'FAILED'}});
      await this.record({orderId: order.id, customerId: customer.id, actorType: 'SYSTEM', action: 'CHECKOUT_FAILED', fromState: 'PENDING', toState: 'FAILED'});
      throw new BadRequestException('Unable to start checkout. Please try again.');
    }
    const saved = await this.db.order.update({where: {id: order.id}, data: {stripeCheckoutSessionId: session.id}, include: {items: true}});
    return {
      orderId: saved.id,
      status: 'pending_payment' as const,
      checkoutUrl: session.url,
      /* Only the publishable key ever reaches the browser. */
      ...(dto.embedded ? {clientSecret: session.client_secret, publishableKey: (process.env.STRIPE_PUBLISHABLE_KEY || '').trim()} : {}),
      receiptProof,
      summary: this.orderSummary(saved),
    };
  }

  /**
   * A signed-in customer buying a plan they already subscribe to must say so
   * explicitly: this purchase adds a second, separately billed subscription; it
   * does not change the existing one (that is a plan change in the account area).
   */
  private async assertNotDuplicateSubscription(accountId: string, lines: PricedLine[]) {
    const claimed = await this.db.customer.findMany({where: {mergedIntoId: accountId, shadowState: 'CLAIMED'}});
    const subscriptions = await this.db.subscription.findMany({where: {customerId: {in: [accountId, ...claimed.map(entry => entry.id)]}, accessStatus: {in: ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED']}}, include: {plan: true}});
    for (const line of lines.filter(entry => entry.billingType === 'RECURRING')) {
      const match = subscriptions.find(sub => (sub.plan?.slug ?? catalogPlanSnapshot(sub.metadata)?.slug) === line.slug);
      if (match) {
        throw new ConflictException({
          statusCode: 409,
          code: 'DUPLICATE_SUBSCRIPTION',
          subscriptionId: match.id,
          message: 'You already have an active ' + line.name + ' subscription. Continuing buys an additional, separately billed subscription. To change your existing one instead, use My subscriptions in your account.',
        });
      }
    }
  }

  orderSummary(order: {currency: string; subtotalAmount: number; discountAmount: number; taxAmount: number; dueNowAmount: number; recurringAmount: number; recurringInterval: string | null; status: string; mode: string; items?: Array<{description: string; quantity: number; amount: number; billingType: string; interval: string | null}>}) {
    return {
      currency: order.currency,
      status: order.status,
      mode: order.mode,
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      dueNowAmount: order.dueNowAmount,
      recurringAmount: order.recurringAmount,
      recurringInterval: order.recurringInterval,
      recurringDescription: order.recurringAmount ? describeInterval(order.recurringInterval as BillingIntervalValue | null) : null,
      items: (order.items ?? []).map(item => ({description: item.description, quantity: item.quantity, amount: item.amount, billingType: item.billingType, interval: item.interval})),
    };
  }

  /* ── Subscription reconciliation ── */

  /** Persist a Stripe subscription object as the authoritative local state. */
  async syncSubscription(sub: Stripe.Subscription, context: {orderId?: string | null; customerId?: string | null} = {}) {
    const existing = await this.db.subscription.findUnique({where: {stripeSubscriptionId: sub.id}});
    /* The plan item is the one we recorded; other items (recurring add-ons) are left alone. */
    const item = sub.items?.data?.find(entry => existing?.stripeItemId && entry.id === existing.stripeItemId) ?? sub.items?.data?.[0];
    const price = item?.price;
    const interval: BillingIntervalValue = price?.recurring?.interval === 'year' ? 'YEAR' : 'MONTH';
    const stripeCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    const orderId = context.orderId ?? sub.metadata?.orderId ?? existing?.orderId ?? null;

    let customerId: string | null = context.customerId ?? sub.metadata?.customerId ?? existing?.customerId ?? null;
    if (!customerId && stripeCustomerId) {
      const found = await this.db.customer.findUnique({where: {stripeCustomerId}});
      customerId = found?.id ?? null;
    }
    if (!customerId && orderId) {
      const order = await this.db.order.findUnique({where: {id: orderId}});
      customerId = order?.customerId ?? null;
    }
    if (!customerId) return null;

    let planId = existing?.planId ?? null;
    const savedSnapshot = catalogPlanSnapshot(existing?.metadata);
    let initialSnapshot: Record<string, unknown> | null = null;
    if (!planId && !savedSnapshot && orderId) {
      const orderItem = await this.db.orderItem.findFirst({where: {orderId, billingType: 'RECURRING'}});
      planId = orderItem?.planId ?? null;
      if (!planId) initialSnapshot = catalogPlanSnapshot(orderItem?.metadata);
    }

    const periodStart = fromStripeTimestamp((sub as never as Record<string, unknown>).current_period_start ?? item?.current_period_start);
    const periodEnd = fromStripeTimestamp((sub as never as Record<string, unknown>).current_period_end ?? item?.current_period_end);
    const graceBase = existing?.graceEndsAt ?? null;
    const grace = sub.status === 'past_due' ? (graceBase ?? graceEndsAt(new Date(), DEFAULT_GRACE_DAYS)) : sub.status === 'active' || sub.status === 'trialing' ? null : graceBase;
    const access = accessStatusFor(sub.status, {graceEndsAt: grace});

    const resolvedCustomerId: string = customerId;
    const data = {
      customerId: resolvedCustomerId,
      orderId,
      planId,
      // Do not rewrite existing metadata or the immutable purchased benefits.
      ...(initialSnapshot ? {metadata: {
        ...(existing?.metadata && typeof existing.metadata === 'object' && !Array.isArray(existing.metadata) ? existing.metadata : {}),
        catalogPlan: JSON.parse(JSON.stringify(initialSnapshot)),
      } as object} : {}),
      stripeCustomerId: String(stripeCustomerId ?? existing?.stripeCustomerId ?? ''),
      stripePriceId: price?.id ?? existing?.stripePriceId ?? null,
      stripeItemId: item?.id ?? existing?.stripeItemId ?? null,
      interval,
      intervalCount: price?.recurring?.interval_count ?? 1,
      currency: price?.currency ?? existing?.currency ?? 'usd',
      unitAmount: price?.unit_amount ?? existing?.unitAmount ?? 0,
      quantity: item?.quantity ?? 1,
      stripeStatus: sub.status,
      accessStatus: access,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      nextInvoiceAt: sub.cancel_at_period_end ? null : periodEnd,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      cancelAt: fromStripeTimestamp(sub.cancel_at),
      endedAt: fromStripeTimestamp(sub.ended_at),
      graceEndsAt: grace,
      latestInvoiceId: typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id ?? existing?.latestInvoiceId ?? null,
      defaultPaymentMethodId: typeof sub.default_payment_method === 'string' ? sub.default_payment_method : sub.default_payment_method?.id ?? null,
      stripeScheduleId: typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id ?? null,
      /* A pending update means a plan change is waiting on payment: the old plan is still in force. */
      pendingUpdate: Boolean(sub.pending_update),
    };

    const saved = existing
      ? await this.db.subscription.update({where: {id: existing.id}, data})
      : await this.db.subscription.create({data: {...data, stripeSubscriptionId: sub.id, cancellationRequestedAt: sub.cancel_at_period_end ? new Date() : null}});
    await this.applyPlanChanges(saved, sub, price?.id ?? null);

    if (!existing || existing.stripeStatus !== sub.status || existing.cancelAtPeriodEnd !== saved.cancelAtPeriodEnd) {
      await this.record({
        subscriptionId: saved.id,
        customerId: resolvedCustomerId,
        orderId,
        actorType: 'STRIPE',
        action: existing ? 'SUBSCRIPTION_SYNCED' : 'SUBSCRIPTION_CREATED',
        fromState: existing?.stripeStatus ?? null,
        toState: sub.status,
        stripeRef: sub.id,
        data: {accessStatus: access, cancelAtPeriodEnd: saved.cancelAtPeriodEnd},
      });
    }
    return saved;
  }

  /**
   * Settle requested plan changes against what Stripe now reports. Benefits and
   * the local plan snapshot move only when Stripe shows the target price in
   * force with no pending update: never on request, never on a browser return.
   */
  private async applyPlanChanges(saved: {id: string; customerId: string; metadata: unknown}, sub: Stripe.Subscription, priceId: string | null) {
    const changes = this.db.subscriptionChange;
    if (!changes) return;
    const open = await changes.findMany({where: {subscriptionId: saved.id, status: {in: ['PENDING_PAYMENT', 'SCHEDULED']}}});
    for (const change of open) {
      const reached = Boolean(priceId && change.targetPriceId === priceId && !sub.pending_update);
      if (reached) {
        const to = (change.toSnapshot ?? {}) as {catalogPlan?: Record<string, unknown>; legacyPlanId?: string | null; name?: string; includedCredits?: unknown};
        const from = (change.fromSnapshot ?? {}) as {name?: string; includedCredits?: unknown};
        const metadata = {...(saved.metadata && typeof saved.metadata === 'object' && !Array.isArray(saved.metadata) ? (saved.metadata as Record<string, unknown>) : {})};
        if (to.catalogPlan) metadata.catalogPlan = to.catalogPlan;
        else delete metadata.catalogPlan;
        await this.db.subscription.update({where: {id: saved.id}, data: {planId: to.legacyPlanId ?? null, metadata: metadata as object}});
        const settled = await changes.updateMany({where: {id: change.id, status: change.status}, data: {status: 'APPLIED', appliedAt: new Date()}});
        if (settled.count !== 1) continue;
        await this.record({subscriptionId: saved.id, customerId: saved.customerId, actorType: 'STRIPE', action: 'PLAN_CHANGE_APPLIED', fromState: from.name ?? null, toState: to.name ?? null, stripeRef: sub.id, data: {kind: change.kind}});
        if (change.kind === 'UPGRADE') await this.grantUpgradeDifference(saved.id, change.id, from, to);
        await this.notify(saved.customerId, 'plan_change', {summary: 'Your plan is now ' + (to.name ?? 'updated') + '.'}, 'plan-applied:' + change.id);
      } else if (change.status === 'PENDING_PAYMENT' && !sub.pending_update && Date.now() - new Date(change.createdAt).getTime() > 2 * 60000) {
        /* The payment was never completed and Stripe dropped the pending update: the previous plan stands. */
        const settled = await changes.updateMany({where: {id: change.id, status: 'PENDING_PAYMENT'}, data: {status: 'FAILED'}});
        if (settled.count === 1) await this.record({subscriptionId: saved.id, customerId: saved.customerId, actorType: 'STRIPE', action: 'PLAN_CHANGE_FAILED', reason: 'Payment for the upgrade was not completed', stripeRef: sub.id});
      } else if (change.status === 'SCHEDULED' && !sub.schedule && Date.now() - new Date(change.createdAt).getTime() > 2 * 60000) {
        /* The schedule was released outside this app before it took effect. */
        const settled = await changes.updateMany({where: {id: change.id, status: 'SCHEDULED'}, data: {status: 'WITHDRAWN'}});
        if (settled.count === 1) await this.record({subscriptionId: saved.id, customerId: saved.customerId, actorType: 'STRIPE', action: 'PLAN_CHANGE_WITHDRAWN', reason: 'Schedule released', stripeRef: sub.id});
      }
    }
  }

  /**
   * An upgrade keeps what the period already granted and adds only the
   * difference, once. The periodic grant is skipped for the proration invoice.
   */
  private async grantUpgradeDifference(subscriptionId: string, changeId: string, from: {includedCredits?: unknown}, to: {includedCredits?: unknown; catalogPlan?: Record<string, unknown>}) {
    const sub = await this.db.subscription.findUnique({where: {id: subscriptionId}});
    if (!sub) return;
    const before = new Map(creditGrantsFor({name: '', billingType: 'RECURRING', unitAmount: 0, includedCredits: from.includedCredits}).map(grant => [grant.kind, grant]));
    for (const grant of creditGrantsFor({name: '', billingType: 'RECURRING', unitAmount: 0, includedCredits: to.includedCredits ?? to.catalogPlan?.includedCredits})) {
      const previous = before.get(grant.kind);
      const delta = grant.unlimited ? 0 : grant.amount - (previous && !previous.unlimited ? previous.amount : 0);
      if (!grant.unlimited && delta <= 0) continue;
      const sourceRef = 'upgrade:' + changeId + ':' + grant.kind;
      if (await this.db.entitlementEntry.findUnique({where: {sourceRef}})) continue;
      await this.db.entitlementEntry.create({data: {customerId: sub.customerId, subscriptionId: sub.id, kind: grant.kind, delta, reason: grant.unlimited ? 'Unlimited benefit from plan upgrade' : 'Additional benefit from plan upgrade', sourceRef, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd}}).catch(() => undefined);
    }
  }

  /** Transactional notice through the outbox. A missing mail service never fails a billing operation. */
  async notify(customerId: string, template: 'plan_change' | 'cancellation_scheduled' | 'cancellation_withdrawn' | 'payment_failed', payload: Record<string, unknown>, dedupeKey?: string) {
    if (!this.outbox) return;
    const customer = await this.db.customer.findUnique({where: {id: customerId}});
    if (!customer) return;
    /* A claimed purchase reports to the account that owns it. */
    const owner = customer.mergedIntoId && customer.shadowState === 'CLAIMED' ? ((await this.db.customer.findUnique({where: {id: customer.mergedIntoId}})) ?? customer) : customer;
    await this.outbox.enqueue({customerId: owner.id, to: owner.email, template, payload: {name: displayName(owner), ...payload}, dedupeKey: dedupeKey ?? null}).catch(() => undefined);
  }

  /**
   * Grant the plan's included credits exactly once per paid period.
   * sourceRef is unique, so a replayed webhook cannot double-grant.
   */
  async grantEntitlements(subscriptionId: string, periodRef: string) {
    const sub = await this.db.subscription.findUnique({where: {id: subscriptionId}, include: {plan: true}});
    if (!sub) return;
    const benefitPlan = sub.plan ?? catalogPlanSnapshot(sub.metadata);
    if (!benefitPlan) return;
    for (const grant of creditGrantsFor(benefitPlan as never)) {
      const sourceRef = 'grant:' + subscriptionId + ':' + grant.kind + ':' + periodRef;
      const existing = await this.db.entitlementEntry.findUnique({where: {sourceRef}});
      if (existing) continue;
      await this.db.entitlementEntry.create({
        data: {
          customerId: sub.customerId,
          subscriptionId: sub.id,
          kind: grant.kind,
          delta: grant.unlimited ? 0 : grant.amount,
          reason: grant.unlimited ? 'Unlimited benefit for the paid period' : 'Included benefit for the paid period',
          sourceRef,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
        },
      });
    }
  }

  async entitlementSummary(customerId: string) {
    const entries = await this.db.entitlementEntry.findMany({where: {customerId}, orderBy: {createdAt: 'desc'}, take: 500});
    const byKind = new Map<string, {kind: string; balance: number; entries: number}>();
    for (const entry of entries) {
      const current = byKind.get(entry.kind) ?? {kind: entry.kind, balance: 0, entries: 0};
      current.balance += entry.delta;
      current.entries += 1;
      byKind.set(entry.kind, current);
    }
    return {balances: [...byKind.values()], recent: entries.slice(0, 20)};
  }

  /* ── Cancellation (always via Stripe first) ── */

  async cancelSubscription(subscriptionId: string, mode: 'PERIOD_END' | 'IMMEDIATE', actor: {type: 'CUSTOMER' | 'ADMIN'; id?: string | null; label?: string | null}, reason?: string, note?: string) {
    const sub = await this.db.subscription.findUnique({where: {id: subscriptionId}});
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.accessStatus === 'ENDED' || sub.stripeStatus === 'canceled') throw new BadRequestException('This subscription has already ended. Start a new purchase to reactivate.');

    /* A scheduled plan change cannot outlive the subscription: release it first so the
       cancellation is the only thing left pending. */
    if (sub.stripeScheduleId && this.db.subscriptionChange) {
      try {
        await this.stripe().subscriptionSchedules.release(sub.stripeScheduleId);
      } catch {
        throw new BadRequestException('Stripe did not confirm the cancellation. Nothing was changed; please retry.');
      }
      await this.db.subscriptionChange.updateMany({where: {subscriptionId: sub.id, status: 'SCHEDULED'}, data: {status: 'WITHDRAWN'}});
      await this.db.subscription.update({where: {id: sub.id}, data: {stripeScheduleId: null}});
    }

    let updated: Stripe.Subscription;
    try {
      updated =
        mode === 'IMMEDIATE'
          ? await this.stripe().subscriptions.cancel(sub.stripeSubscriptionId, {invoice_now: false, prorate: false})
          : await this.stripe().subscriptions.update(sub.stripeSubscriptionId, {cancel_at_period_end: true}, {idempotencyKey: 'cancel-period-end:' + sub.id + ':' + sub.stripeStatus});
    } catch {
      throw new BadRequestException('Stripe did not confirm the cancellation. Nothing was changed; please retry.');
    }

    const synced = await this.syncSubscription(updated);
    const saved = await this.db.subscription.update({
      where: {id: sub.id},
      data: {
        cancellationRequestedAt: sub.cancellationRequestedAt ?? new Date(),
        canceledByType: actor.type,
        canceledById: actor.id ?? null,
        cancelReason: reason ?? null,
        ...(mode === 'IMMEDIATE' ? {endedAt: synced?.endedAt ?? new Date(), accessStatus: 'ENDED' as const} : {}),
      },
    });
    await this.record({
      subscriptionId: sub.id,
      customerId: sub.customerId,
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorLabel: actor.label ?? null,
      action: mode === 'IMMEDIATE' ? 'CANCELLED_IMMEDIATELY' : 'CANCELLATION_SCHEDULED',
      fromState: sub.stripeStatus,
      toState: updated.status,
      reason: reason ?? null,
      note: note ?? null,
      stripeRef: updated.id,
      data: {requestedAt: new Date().toISOString(), effectiveAt: (saved.cancelAt ?? saved.currentPeriodEnd ?? saved.endedAt)?.toISOString() ?? null, refundIssued: false},
    });
    if (mode === 'PERIOD_END') {
      const lastAccess = saved.cancelAt ?? saved.currentPeriodEnd;
      await this.notify(sub.customerId, 'cancellation_scheduled', {planName: await this.planNameOf(sub), lastAccess: lastAccess ? new Intl.DateTimeFormat('en-US', {dateStyle: 'long', timeZone: 'America/Chicago'}).format(lastAccess) : 'the end of the paid period'});
    }
    return saved;
  }

  private async planNameOf(sub: {planId: string | null; metadata: unknown}): Promise<string> {
    const snapshot = catalogPlanSnapshot(sub.metadata);
    if (typeof snapshot?.name === 'string') return snapshot.name;
    const plan = sub.planId ? await this.db.plan.findUnique({where: {id: sub.planId}}) : null;
    return plan?.name ?? 'your subscription';
  }

  async withdrawCancellation(subscriptionId: string, actor: {type: 'CUSTOMER' | 'ADMIN'; id?: string | null; label?: string | null}) {
    const sub = await this.db.subscription.findUnique({where: {id: subscriptionId}});
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.stripeStatus === 'canceled' || sub.accessStatus === 'ENDED') throw new BadRequestException('This subscription has already ended and cannot be resumed. Start a new purchase.');
    if (!sub.cancelAtPeriodEnd) throw new BadRequestException('No scheduled cancellation to withdraw');
    let updated: Stripe.Subscription;
    try {
      updated = await this.stripe().subscriptions.update(sub.stripeSubscriptionId, {cancel_at_period_end: false});
    } catch {
      throw new BadRequestException('Stripe did not confirm the change. Nothing was changed; please retry.');
    }
    await this.syncSubscription(updated);
    const saved = await this.db.subscription.update({where: {id: sub.id}, data: {cancellationRequestedAt: null, cancelReason: null, canceledByType: null, canceledById: null}});
    await this.record({subscriptionId: sub.id, customerId: sub.customerId, actorType: actor.type, actorId: actor.id ?? null, actorLabel: actor.label ?? null, action: 'CANCELLATION_WITHDRAWN', fromState: 'cancel_at_period_end', toState: updated.status, stripeRef: updated.id});
    await this.notify(sub.customerId, 'cancellation_withdrawn', {planName: await this.planNameOf(sub)});
    return saved;
  }

  /** Re-read Stripe and overwrite local state. Used by admin reconciliation. */
  async reconcile(subscriptionId: string) {
    const sub = await this.db.subscription.findUnique({where: {id: subscriptionId}});
    if (!sub) throw new NotFoundException('Subscription not found');
    const fresh = await this.stripe().subscriptions.retrieve(sub.stripeSubscriptionId);
    return this.syncSubscription(fresh as Stripe.Subscription);
  }

  /** Suspend access for subscriptions whose grace period has expired. */
  async applyGracePolicy(now = new Date()) {
    const overdue = await this.db.subscription.findMany({where: {accessStatus: 'PAST_DUE', graceEndsAt: {lte: now}}});
    for (const sub of overdue) {
      await this.db.subscription.update({where: {id: sub.id}, data: {accessStatus: 'SUSPENDED'}});
      await this.record({subscriptionId: sub.id, customerId: sub.customerId, actorType: 'SYSTEM', action: 'ACCESS_SUSPENDED', fromState: 'PAST_DUE', toState: 'SUSPENDED', reason: 'Grace period expired after a failed payment', data: {stripeStatus: sub.stripeStatus}});
    }
    return overdue.length;
  }

  /* The legacy multi-use management JWT (portalToken / customerFromToken) was removed.
     Customers authenticate with a server-side session (account-auth.ts); emailed access
     is a single-use, short-lived link exchanged for that session. Any JWT still in
     circulation is no longer accepted by any endpoint. */

  /** Store a Stripe invoice with the detail the account's billing history shows. */
  async upsertInvoice(invoice: Stripe.Invoice, link: {orderId?: string | null} = {}) {
    if (!invoice.id) return null;
    const subscriptionId = invoiceSubscriptionId(invoice);
    const stripeCustomerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const local = subscriptionId ? await this.db.subscription.findUnique({where: {stripeSubscriptionId: subscriptionId}}) : null;
    const customer = stripeCustomerId ? await this.db.customer.findUnique({where: {stripeCustomerId}}) : null;
    const record = invoice as unknown as {total_taxes?: Array<{amount?: number}> | null; total_discount_amounts?: Array<{amount?: number}> | null; tax?: number | null; metadata?: Record<string, string> | null; lines?: {data?: Array<Record<string, unknown>>}};
    const sum = (rows: Array<{amount?: number}> | null | undefined) => (rows ?? []).reduce((total, row) => total + (row.amount ?? 0), 0);
    const orderId = link.orderId ?? record.metadata?.orderId ?? null;
    const detail = {
      amountDue: invoice.amount_due ?? 0,
      amountPaid: invoice.amount_paid ?? 0,
      amountRemaining: invoice.amount_remaining ?? 0,
      subtotal: invoice.subtotal ?? 0,
      total: invoice.total ?? 0,
      taxAmount: record.total_taxes ? sum(record.total_taxes) : record.tax ?? 0,
      discountAmount: sum(record.total_discount_amounts),
      number: invoice.number ?? null,
      status: invoice.status ?? 'draft',
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
      dueDate: fromStripeTimestamp(invoice.due_date),
      /* A bounded, display-only snapshot. Never the full provider object. */
      lines: (record.lines?.data ?? []).slice(0, 40).map(line => ({description: String(line.description ?? '').slice(0, 200), amount: Number(line.amount ?? 0), quantity: Number(line.quantity ?? 1)})) as object,
    };
    return this.db.invoice.upsert({
      where: {stripeInvoiceId: invoice.id},
      update: {...detail, ...(orderId ? {orderId} : {})},
      create: {
        ...detail,
        stripeInvoiceId: invoice.id,
        subscriptionId: local?.id ?? null,
        customerId: local?.customerId ?? customer?.id ?? null,
        orderId,
        currency: invoice.currency ?? 'usd',
        periodStart: fromStripeTimestamp(invoice.period_start),
        periodEnd: fromStripeTimestamp(invoice.period_end),
      },
    });
  }

  subscriptionView(sub: Record<string, unknown> & {plan?: {name?: string; serviceType?: string} | null}) {
    const cancelScheduled = Boolean(sub.cancelAtPeriodEnd);
    const snapshot = catalogPlanSnapshot(sub.metadata);
    return {
      id: sub.id,
      planName: sub.plan?.name ?? (typeof snapshot?.name === 'string' ? snapshot.name : 'Subscription'),
      serviceType: sub.plan?.serviceType ?? (typeof snapshot?.serviceType === 'string' ? snapshot.serviceType : null),
      interval: sub.interval,
      intervalDescription: describeInterval(sub.interval as BillingIntervalValue, Number(sub.intervalCount ?? 1)),
      unitAmount: sub.unitAmount,
      quantity: sub.quantity,
      currency: sub.currency,
      stripeStatus: sub.stripeStatus,
      accessStatus: sub.accessStatus,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      renewsAt: cancelScheduled ? null : sub.nextInvoiceAt ?? sub.currentPeriodEnd,
      cancelAtPeriodEnd: cancelScheduled,
      cancellationRequestedAt: sub.cancellationRequestedAt,
      cancelAt: sub.cancelAt,
      endedAt: sub.endedAt,
      cancelReason: sub.cancelReason,
      graceEndsAt: sub.graceEndsAt,
      latestInvoiceUrl: sub.latestInvoiceUrl,
      stripeSubscriptionId: sub.stripeSubscriptionId,
    };
  }
}

/* ───────────────────────────── Webhook processing ───────────────────────────── */

@Injectable()
export class BillingWebhookService {
  constructor(@Inject(Db) private db: Db, @Inject(BillingService) private billing: BillingService, @Optional() @Inject(AccountLifecycle) private lifecycle?: AccountLifecycle) {}

  /** True when this event belongs to the billing module rather than legacy bookings. */
  static handles(event: Stripe.Event): boolean {
    if (event.type.startsWith('customer.subscription.') || event.type.startsWith('invoice.')) return true;
    /* Card and plan-schedule state. These events update billing state only: a payment or
       setup event never authenticates a person or opens an account. */
    if (event.type.startsWith('setup_intent.') || event.type.startsWith('payment_method.') || event.type.startsWith('subscription_schedule.') || event.type === 'customer.updated') return true;
    if (event.type.startsWith('checkout.session.')) {
      const session = event.data.object as Stripe.Checkout.Session;
      return Boolean(session.metadata?.orderId);
    }
    return false;
  }

  /**
   * Idempotent by Stripe event id. A duplicate delivery is acknowledged without
   * repeating any side effect; a transient failure is recorded and rethrown so
   * Stripe retries.
   */
  async process(event: Stripe.Event): Promise<'processed' | 'duplicate'> {
    const existing = await this.db.webhookEvent.findUnique({where: {stripeEventId: event.id}});
    if (existing?.status === 'PROCESSED') return 'duplicate';
    const journal = existing
      ? await this.db.webhookEvent.update({where: {id: existing.id}, data: {attempts: {increment: 1}, status: 'PENDING'}})
      : await this.db.webhookEvent.create({data: {stripeEventId: event.id, type: event.type, attempts: 1, payload: {id: event.id, type: event.type} as object}});
    try {
      await this.handle(event);
      await this.db.webhookEvent.update({where: {id: journal.id}, data: {status: 'PROCESSED', processedAt: new Date(), error: null}});
      return 'processed';
    } catch (error) {
      await this.db.webhookEvent.update({where: {id: journal.id}, data: {status: 'FAILED', error: error instanceof Error ? error.message.slice(0, 500) : 'unknown failure'}}).catch(() => {});
      throw error;
    }
  }

  private async handle(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      case 'checkout.session.expired':
        return this.onCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      case 'checkout.session.async_payment_failed':
        return this.onCheckoutFailed(event.data.object as Stripe.Checkout.Session);
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.deleted':
        return this.onSubscriptionEvent(event.data.object as Stripe.Subscription);
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        return this.onInvoicePaid(event.data.object as Stripe.Invoice);
      case 'invoice.payment_failed':
        return this.onInvoiceFailed(event.data.object as Stripe.Invoice);
      case 'invoice.finalized':
      case 'invoice.updated':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible':
      case 'invoice.payment_action_required':
        return this.onInvoiceChanged(event.data.object as Stripe.Invoice);
      case 'payment_method.attached':
      case 'payment_method.detached':
      case 'payment_method.updated':
      case 'payment_method.automatically_updated':
        return this.onPaymentMethodEvent(event);
      case 'setup_intent.succeeded':
      case 'setup_intent.setup_failed':
        return this.onCustomerCards(event.data.object as {customer?: unknown});
      case 'customer.updated':
        return this.onCustomerCards({customer: (event.data.object as {id?: string}).id});
      case 'subscription_schedule.updated':
      case 'subscription_schedule.released':
      case 'subscription_schedule.canceled':
      case 'subscription_schedule.completed':
        return this.onScheduleEvent(event.data.object as {subscription?: unknown; released_subscription?: unknown});
      default:
        return undefined;
    }
  }

  private static ref(value: unknown): string | null {
    return typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String((value as {id: unknown}).id) : null;
  }

  /** Reconcile cards from Stripe's own list rather than trusting the event's order or content. */
  private async onCustomerCards(object: {customer?: unknown}) {
    await this.lifecycle?.['cards'].onStripeCustomer(BillingWebhookService.ref(object.customer));
  }

  private async onPaymentMethodEvent(event: Stripe.Event) {
    const object = event.data.object as {customer?: unknown};
    /* After a detach the object no longer names its customer; the previous value does. */
    const previous = (event.data as {previous_attributes?: {customer?: unknown}}).previous_attributes?.customer;
    await this.lifecycle?.['cards'].onStripeCustomer(BillingWebhookService.ref(object.customer) ?? BillingWebhookService.ref(previous));
  }

  /** A schedule moved: re-read the subscription so out-of-order events converge on Stripe's state. */
  private async onScheduleEvent(schedule: {subscription?: unknown; released_subscription?: unknown}) {
    const subscriptionId = BillingWebhookService.ref(schedule.subscription) ?? BillingWebhookService.ref(schedule.released_subscription);
    if (!subscriptionId) return;
    const local = await this.db.subscription.findUnique({where: {stripeSubscriptionId: subscriptionId}});
    if (!local) return;
    const fresh = (await this.billing['stripe']().subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
    await this.billing.syncSubscription(fresh);
  }

  private async onInvoiceChanged(invoice: Stripe.Invoice) {
    await this.billing.upsertInvoice(invoice);
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (!orderId) return;
    const order = await this.db.order.findUnique({where: {id: orderId}});
    if (!order) return;
    /* Never activate an unpaid asynchronous checkout. */
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return;
    if (order.status !== 'PAID') {
      await this.db.order.update({
        where: {id: order.id},
        data: {status: 'PAID', paidAt: new Date(), stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null, stripeCheckoutSessionId: session.id},
      });
      await this.billing.record({orderId: order.id, customerId: order.customerId, actorType: 'STRIPE', action: 'ORDER_PAID', fromState: order.status, toState: 'PAID', stripeRef: session.id, data: {amountTotal: session.amount_total}});
    }
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (subscriptionId) {
      const sub = await this.billing['stripe']().subscriptions.retrieve(subscriptionId);
      const saved = await this.billing.syncSubscription(sub as Stripe.Subscription, {orderId: order.id, customerId: order.customerId});
      if (saved) await this.billing.grantEntitlements(saved.id, saved.currentPeriodStart?.toISOString() ?? session.id);
    }
    /* One-time purchases get a Stripe invoice (invoice_creation); tie it to the order. */
    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
    if (invoiceId && this.db.invoice) {
      const existing = await this.db.invoice.findUnique({where: {stripeInvoiceId: invoiceId}});
      if (existing && !existing.orderId) await this.db.invoice.update({where: {id: existing.id}, data: {orderId: order.id}});
      else if (!existing) await this.db.invoice.create({data: {stripeInvoiceId: invoiceId, customerId: order.customerId, orderId: order.id, currency: order.currency, status: 'paid', amountDue: order.dueNowAmount, amountPaid: order.dueNowAmount, total: order.dueNowAmount}}).catch(() => undefined);
    }
    /* Verified payment is the only trigger for account provisioning. Idempotent: a
       replayed or duplicated event provisions nothing twice. A failure here must not
       fail the payment record, so setup stays a separate recoverable state. */
    await this.lifecycle?.onOrderPaid(order.id).catch(() => console.error('[billing] account provisioning deferred for order ' + order.id));
  }

  private async onCheckoutExpired(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (!orderId) return;
    const order = await this.db.order.findUnique({where: {id: orderId}});
    if (!order || order.status !== 'PENDING') return;
    await this.db.order.update({where: {id: order.id}, data: {status: 'EXPIRED'}});
    await this.billing.record({orderId: order.id, customerId: order.customerId, actorType: 'STRIPE', action: 'CHECKOUT_EXPIRED', fromState: 'PENDING', toState: 'EXPIRED', stripeRef: session.id});
  }

  private async onCheckoutFailed(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId || session.client_reference_id;
    if (!orderId) return;
    const order = await this.db.order.findUnique({where: {id: orderId}});
    if (!order || order.status === 'PAID') return;
    await this.db.order.update({where: {id: order.id}, data: {status: 'FAILED'}});
    await this.billing.record({orderId: order.id, customerId: order.customerId, actorType: 'STRIPE', action: 'PAYMENT_FAILED', fromState: order.status, toState: 'FAILED', stripeRef: session.id});
  }

  private async onSubscriptionEvent(sub: Stripe.Subscription) {
    await this.billing.syncSubscription(sub);
  }

  private async onInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionId = invoiceSubscriptionId(invoice);
    await this.billing.upsertInvoice({...invoice, status: invoice.status ?? 'paid'} as Stripe.Invoice);

    if (!subscriptionId) return;
    /* Retrieve the subscription so the paid period comes from Stripe, not arithmetic. */
    const fresh = (await this.billing['stripe']().subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
    const saved = await this.billing.syncSubscription(fresh);
    if (!saved) return;
    await this.db.subscription.update({where: {id: saved.id}, data: {paymentFailedAt: null, graceEndsAt: null, latestInvoiceId: invoice.id ?? null, latestInvoiceUrl: invoice.hosted_invoice_url ?? null, accessStatus: accessStatusFor(fresh.status, {graceEndsAt: null})}});
    /* A proration invoice for a plan change is not a new period: the upgrade path grants only the difference. */
    if ((invoice as {billing_reason?: string | null}).billing_reason !== 'subscription_update') await this.billing.grantEntitlements(saved.id, String(invoice.id ?? saved.currentPeriodStart?.toISOString() ?? ''));
    await this.billing.record({subscriptionId: saved.id, customerId: saved.customerId, actorType: 'STRIPE', action: 'INVOICE_PAID', toState: fresh.status, stripeRef: invoice.id ?? null, data: {amountPaid: invoice.amount_paid, periodEnd: saved.currentPeriodEnd?.toISOString() ?? null}});
  }

  private async onInvoiceFailed(invoice: Stripe.Invoice) {
    const subscriptionId = invoiceSubscriptionId(invoice);
    await this.billing.upsertInvoice(invoice);
    if (!subscriptionId) return;
    const local = await this.db.subscription.findUnique({where: {stripeSubscriptionId: subscriptionId}});
    if (!local) return;
    const failedAt = local.paymentFailedAt ?? new Date();
    const grace = local.graceEndsAt ?? graceEndsAt(failedAt, DEFAULT_GRACE_DAYS);
    const fresh = (await this.billing['stripe']().subscriptions.retrieve(subscriptionId)) as Stripe.Subscription;
    await this.billing.syncSubscription(fresh);
    await this.db.subscription.update({
      where: {id: local.id},
      data: {paymentFailedAt: failedAt, graceEndsAt: grace, stripeStatus: fresh.status, accessStatus: accessStatusFor(fresh.status, {graceEndsAt: grace}), latestInvoiceId: invoice.id ?? null, latestInvoiceUrl: invoice.hosted_invoice_url ?? null},
    });
    await this.billing.record({subscriptionId: local.id, customerId: local.customerId, actorType: 'STRIPE', action: 'INVOICE_PAYMENT_FAILED', fromState: local.stripeStatus, toState: fresh.status, stripeRef: invoice.id ?? null, data: {graceEndsAt: grace.toISOString()}});
    /* One notice per failed invoice, however many times Stripe retries or redelivers. */
    await this.billing.notify(local.customerId, 'payment_failed', {planName: await this.billing['planNameOf'](local)}, 'payment-failed:' + (invoice.id ?? local.id));
  }
}

/* ───────────────────────────── Public API ───────────────────────────── */

const globalPlansCache = new Map<string, {time: number; data: any}>();
const PLANS_CACHE_TTL = 30000;
const PLANS_CACHE_MAX = 200;
let plansCacheGeneration = 0;

function prunePlansCache(now: number) {
  for (const [key, entry] of globalPlansCache) {
    if (now - entry.time >= PLANS_CACHE_TTL) globalPlansCache.delete(key);
  }
}

@Controller()
export class PublicBillingController {
  static clearCache() {
    plansCacheGeneration++;
    globalPlansCache.clear();
    clearCatalogCache();
  }

  constructor(@Inject(Db) private db: Db, @Inject(BillingService) private billing: BillingService, @Optional() @Inject(CustomerAuthService) private auth?: CustomerAuthService) {}

  @Get('public/plans') @Throttle({default: {limit: 600, ttl: 60000}})
  async plans(@Query('serviceType') serviceType?: string) {
    const cacheKey = serviceType ? 'service:' + serviceType : '__all__';
    prunePlansCache(Date.now());
    const hit = globalPlansCache.get(cacheKey);
    if (hit) return hit.data;
    const generation = plansCacheGeneration;

    const items = await this.db.plan.findMany({
      where: {active: true, archivedAt: null, ...(serviceType ? {serviceType} : {})},
      orderBy: [{serviceType: 'asc'}, {sortOrder: 'asc'}, {unitAmount: 'asc'}],
    });
    const result = {
      termsVersion: BILLING_TERMS_VERSION,
      items: items.map(plan => ({
        slug: plan.slug,
        name: plan.name,
        serviceType: plan.serviceType,
        description: plan.description,
        billingType: plan.billingType,
        interval: plan.interval,
        intervalDescription: describeInterval(plan.interval as BillingIntervalValue | null, plan.intervalCount),
        unitAmount: plan.unitAmount,
        currency: plan.currency,
        pricingUnit: plan.pricingUnit,
        durationMinutes: plan.durationMinutes,
        minQuantity: plan.minQuantity,
        maxQuantity: plan.maxQuantity,
        requiresSchedule: plan.requiresSchedule,
        requiresResource: plan.requiresResource,
        requiresOnboarding: plan.requiresOnboarding,
        includedCredits: plan.includedCredits,
        metadata: plan.metadata,
      })),
    };
    if (generation === plansCacheGeneration) {
      prunePlansCache(Date.now());
      globalPlansCache.delete(cacheKey);
      while (globalPlansCache.size >= PLANS_CACHE_MAX) {
        globalPlansCache.delete(globalPlansCache.keys().next().value!);
      }
      globalPlansCache.set(cacheKey, {time: Date.now(), data: result});
    }
    return result;
  }

  /** Price preview: identical server maths to checkout, no Stripe objects created. */
  @Post('billing/quote') @Throttle({default: {limit: 30, ttl: 60000}})
  async quote(@ValidatedBody(CheckoutDto) dto: CheckoutDto) {
    const priced = await this.billing.priceCheckout(dto);
    return {
      currency: priced.currency,
      ...priced.totals,
      recurringDescription: priced.totals.recurringInterval ? describeInterval(priced.totals.recurringInterval) : null,
      discountDuration: priced.coupon?.discount.duration ?? null,
      discountDurationInMonths: priced.coupon?.discount.durationInMonths ?? null,
      termsVersion: priced.hasRecurring ? BILLING_TERMS_VERSION : null,
      items: priced.lines.map(line => ({planSlug: line.slug, name: line.name, quantity: line.quantity, amount: line.amount, billingType: line.billingType, interval: line.interval})),
    };
  }

  @Post('billing/checkout') @Throttle({default: {limit: 5, ttl: 60000}})
  async checkout(@ValidatedBody(CheckoutDto) dto: CheckoutDto, @Req() req?: CheckoutRequest) {
    return this.billing.createCheckout(dto, undefined, await checkoutContext(this.auth, req));
  }

  /**
   * Success page polls this. An order id (or a payment return URL) is not a
   * credential, so by default the answer is only the payment state. Itemised
   * detail needs proof tied to this one purchase: the buyer's own order-scoped
   * receipt proof, or a signed-in session that owns the order. It never returns
   * a token, and never reveals whether the email already had an account.
   */
  @Get('billing/orders/:id/status') @Throttle({default: {limit: 240, ttl: 60000}})
  async orderStatus(@Param('id') id: string, @Req() req?: CheckoutRequest, @Res({passthrough: true}) res?: {setHeader: (name: string, value: string) => void}) {
    res?.setHeader('Cache-Control', 'no-store, private');
    const order = await this.db.order.findUnique({where: {id}, include: {items: true, subscriptions: true, customer: true}});
    if (!order) throw new NotFoundException();
    const principal = this.auth && req ? await this.auth.resolve(req) : null;
    const owned = Boolean(principal && (order.customerId === principal.id || (order.customer?.mergedIntoId === principal.id && order.customer?.shadowState === 'CLAIMED')));
    const minimal = {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      processing: order.status === 'PENDING',
      /* ready: the signed-in owner. check_email: everyone else, identically, whether the
         address is new, awaiting setup or belongs to an existing account. */
      account: order.status !== 'PAID' ? null : owned ? ('ready' as const) : ('check_email' as const),
      detail: false,
    };
    if (!owned && !this.billing.receiptProofMatches(order.id, req?.headers?.['x-order-proof'])) return minimal;
    return {
      ...this.billing.orderSummary(order),
      ...minimal,
      detail: true,
      subscriptions: order.subscriptions.map(sub => ({accessStatus: sub.accessStatus, currentPeriodEnd: sub.currentPeriodEnd})),
    };
  }

  /** Legacy path kept for old pages: now sends a single-use link, with the same generic answer. */
  @Post('billing/portal/request-link') @HttpCode(201) @Throttle({default: {limit: 3, ttl: 60000}})
  async requestLink(@ValidatedBody(PortalLinkDto) dto: PortalLinkDto) {
    if (this.auth) await this.auth.requestLink(dto.email);
    return {requested: true};
  }
}

export type CheckoutRequest = {method?: string; headers: Record<string, string | string[] | undefined>; cookies?: Record<string, unknown>; ip?: string};

/**
 * The buyer's identity for a checkout comes from the session cookie alone. A
 * cookie-authenticated checkout is a state-changing request, so it must also
 * come from our own origin.
 */
export async function checkoutContext(auth: CustomerAuthService | undefined, req: CheckoutRequest | undefined): Promise<CheckoutContext> {
  if (!auth || !req) return {};
  const principal = await auth.resolve(req);
  if (!principal) return {};
  assertTrustedOrigin(req);
  return {accountId: principal.id};
}

/* ───────────────────────────── Retired customer portal ─────────────────────────────
   The token-authenticated portal (GET /billing/portal, its cancel/resume routes and the
   Stripe Billing Portal hand-off) is gone. Account management lives under /account/*
   behind a customer session, and no endpoint creates a Stripe Billing Portal session
   for a customer any more, so the hosted portal cannot be used to remove a last card
   or to bypass the cancellation and plan-change rules.
   ─────────────────────────────────────────────────────────────────────────────────── */

@Controller('billing/portal')
export class RetiredPortalController {
  @All() @Throttle({default: {limit: 60, ttl: 60000}})
  root() {
    throw new GoneException('This link is no longer supported. Sign in at /login/ to manage your account.');
  }

  @All('*rest') @Throttle({default: {limit: 60, ttl: 60000}})
  rest() {
    throw new GoneException('This link is no longer supported. Sign in at /login/ to manage your account.');
  }
}

/* ───────────────────────────── Admin API ───────────────────────────── */

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin/plans')
export class PlanAdminController {
  constructor(@Inject(Db) private db: Db, @Inject(BillingService) private billing: BillingService) {}

  @Get() async list(@ValidatedQuery(BillingListDto) q: BillingListDto) {
    const {page, limit, skip, take, search} = parsePagination(q, 10);
    const where = {
      ...(search ? {OR: [{name: {contains: search, mode: 'insensitive' as const}}, {slug: {contains: search, mode: 'insensitive' as const}}, {serviceType: {contains: search, mode: 'insensitive' as const}}]} : {}),
      ...(q.serviceType ? {serviceType: q.serviceType} : {}),
      ...(q.status === 'PUBLISHED' ? {active: true, archivedAt: null} : q.status === 'DRAFT' ? {active: false, archivedAt: null} : q.status === 'ARCHIVED' ? {archivedAt: {not: null}} : {}),
    };
    const [items, total] = await Promise.all([this.db.plan.findMany({where, skip, take, orderBy: [{serviceType: 'asc'}, {sortOrder: 'asc'}]}), this.db.plan.count({where})]);
    return {
      items: items.map(plan => ({
        ...plan,
        /* Rendered by the shared admin table: a readable summary and a real status. */
        excerpt: plan.serviceType + ' · ' + (plan.unitAmount / 100).toFixed(2) + ' ' + plan.currency.toUpperCase() + ' · ' + (plan.billingType === 'RECURRING' ? describeInterval(plan.interval as BillingIntervalValue, plan.intervalCount) : 'one-time, per ' + plan.pricingUnit.toLowerCase()),
        status: plan.archivedAt ? 'ARCHIVED' : plan.active ? 'PUBLISHED' : 'DRAFT',
      })),
      total,
      page,
      limit,
    };
  }

  @Get(':id') async detail(@Param('id') id: string) {
    const item = await this.db.plan.findUnique({where: {id}});
    if (!item) throw new NotFoundException();
    return item;
  }

  @Post() @Roles('ADMIN', 'EDITOR') async create(@ValidatedBody(PlanDto) dto: PlanDto, @Req() req: {user: {id: string; email: string}}) {
    this.validate(dto);
    const item = await this.db.plan.create({data: this.data(dto)});
    PublicBillingController.clearCache();
    await this.billing.record({actorType: 'ADMIN', actorId: req.user.id, actorLabel: req.user.email, action: 'PLAN_CREATED', toState: item.slug, data: {unitAmount: item.unitAmount, billingType: item.billingType}});
    return item;
  }

  @Patch(':id') @Roles('ADMIN', 'EDITOR') async update(@Param('id') id: string, @ValidatedBody(PlanUpdateDto) dto: PlanUpdateDto, @Req() req: {user: {id: string; email: string}}) {
    const existing = await this.db.plan.findUnique({where: {id}});
    if (!existing) throw new NotFoundException();
    this.validate(dto);
    const item = await this.db.plan.update({where: {id}, data: this.data(dto)});
    PublicBillingController.clearCache();
    await this.billing.record({
      actorType: 'ADMIN',
      actorId: req.user.id,
      actorLabel: req.user.email,
      action: 'PLAN_UPDATED',
      fromState: String(existing.unitAmount),
      toState: String(item.unitAmount),
      /* Existing subscriptions keep their agreed Stripe price; this only affects new purchases. */
      data: {note: 'New price applies to new purchases only', slug: item.slug},
    });
    return item;
  }

  /** Archive instead of deleting so historical orders keep their references. */
  @Delete(':id') @Roles('ADMIN') async archive(@Param('id') id: string, @Req() req: {user: {id: string; email: string}}) {
    const existing = await this.db.plan.findUnique({where: {id}});
    if (!existing) throw new NotFoundException();
    const item = await this.db.plan.update({where: {id}, data: {active: false, archivedAt: new Date()}});
    PublicBillingController.clearCache();
    await this.billing.record({actorType: 'ADMIN', actorId: req.user.id, actorLabel: req.user.email, action: 'PLAN_ARCHIVED', fromState: 'active', toState: 'archived', data: {slug: item.slug}});
    return {archived: true};
  }

  private validate(dto: PlanDto) {
    const errors: string[] = [];
    if (dto.billingType === 'RECURRING' && !dto.interval) errors.push('A recurring package needs a billing interval');
    if (dto.billingType === 'ONE_TIME' && dto.interval) errors.push('A one-time package cannot have a billing interval');
    if (dto.minQuantity && dto.maxQuantity && dto.minQuantity > dto.maxQuantity) errors.push('Minimum quantity cannot exceed maximum quantity');
    if (errors.length) throw new BadRequestException(errors);
  }

  private data(dto: PlanDto) {
    return {
      slug: dto.slug,
      name: dto.name,
      serviceType: dto.serviceType,
      description: dto.description ?? '',
      billingType: dto.billingType,
      interval: dto.interval ?? null,
      intervalCount: dto.intervalCount ?? 1,
      unitAmount: dto.unitAmount,
      currency: (dto.currency ?? 'usd').toLowerCase(),
      pricingUnit: (dto.pricingUnit ?? 'PACKAGE') as never,
      durationMinutes: dto.durationMinutes ?? null,
      minQuantity: dto.minQuantity ?? 1,
      maxQuantity: dto.maxQuantity ?? dto.minQuantity ?? 1,
      requiresSchedule: dto.requiresSchedule ?? false,
      requiresResource: dto.requiresResource ?? false,
      requiresOnboarding: dto.requiresOnboarding ?? false,
      trialDays: dto.trialDays ?? 0,
      includedCredits: (dto.includedCredits ?? []) as object,
      sortOrder: dto.sortOrder ?? 0,
      active: dto.active ?? true,
      ...(dto.metadata !== undefined ? {metadata: dto.metadata as object} : {}),
    };
  }
}

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin/billing')
export class BillingAdminController {
  constructor(@Inject(Db) private db: Db, @Inject(BillingService) private billing: BillingService) {}

  @Get('subscriptions') async subscriptions(@ValidatedQuery(BillingListDto) q: BillingListDto) {
    const {page, limit, skip, take, search} = parsePagination(q, 10);
    const where = {
      ...(q.status ? {stripeStatus: q.status} : {}),
      ...(q.accessStatus ? {accessStatus: q.accessStatus as never} : {}),
      ...(search
        ? {
            OR: [
              {stripeSubscriptionId: {contains: search, mode: 'insensitive' as const}},
              {customer: {email: {contains: search, mode: 'insensitive' as const}}},
              {customer: {name: {contains: search, mode: 'insensitive' as const}}},
              {plan: {name: {contains: search, mode: 'insensitive' as const}}},
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.subscription.findMany({where, skip, take, orderBy: {createdAt: 'desc'}, include: {plan: true, customer: true}}),
      this.db.subscription.count({where}),
    ]);
    return {
      items: rows.map(sub => ({
        ...(this.billing.subscriptionView(sub as never) as Record<string, unknown>),
        customerEmail: sub.customer.email,
        customerName: sub.customer.name,
        title: sub.customer.name || sub.customer.email,
        excerpt: (sub.plan?.name ?? 'Subscription') + ' · ' + (sub.unitAmount / 100).toFixed(2) + ' ' + sub.currency.toUpperCase() + ' ' + describeInterval(sub.interval as BillingIntervalValue, sub.intervalCount) + (sub.cancelAtPeriodEnd ? ' · cancellation scheduled' : ''),
        status: sub.stripeStatus,
      })),
      total,
      page,
      limit,
    };
  }

  @Get('subscriptions/:id') async subscription(@Param('id') id: string) {
    const sub = await this.db.subscription.findUnique({where: {id}, include: {plan: true, customer: true, invoices: {orderBy: {createdAt: 'desc'}, take: 20}, events: {orderBy: {createdAt: 'desc'}, take: 50}}});
    if (!sub) throw new NotFoundException();
    const entitlements = await this.billing.entitlementSummary(sub.customerId);
    return {
      ...this.billing.subscriptionView(sub as never),
      customer: {id: sub.customer.id, email: sub.customer.email, name: sub.customer.name},
      stripeDashboardUrl: 'https://dashboard.stripe.com/subscriptions/' + sub.stripeSubscriptionId,
      invoices: sub.invoices,
      events: sub.events,
      entitlements,
    };
  }

  @Get('subscriptions/:id/cancellation-preview') async preview(@Param('id') id: string, @Query('mode') mode?: string) {
    const sub = await this.db.subscription.findUnique({where: {id}});
    if (!sub) throw new NotFoundException();
    const base = cancellationPreview(sub, mode === 'IMMEDIATE' ? 'IMMEDIATE' : 'PERIOD_END');
    return {
      ...base,
      prorationBehavior: 'none',
      invoiceNow: false,
      accessConsequence: base.mode === 'IMMEDIATE' ? 'Access and included credits stop immediately.' : 'Access and included credits continue until ' + (base.lastAccessDate ? base.lastAccessDate.toISOString() : 'the end of the paid period') + '.',
    };
  }

  /** Admin cancellation always calls Stripe; a local status change alone is not a cancellation. */
  @Post('subscriptions/:id/cancel') @Roles('ADMIN', 'EDITOR')
  async cancel(@Param('id') id: string, @ValidatedBody(CancelDto) dto: CancelDto, @Req() req: {user: {id: string; email: string; role: string}}) {
    if (dto.mode === 'IMMEDIATE' && req.user.role !== 'ADMIN') throw new ForbiddenException('Only an administrator can cancel immediately');
    const saved = await this.billing.cancelSubscription(id, dto.mode === 'IMMEDIATE' ? 'IMMEDIATE' : 'PERIOD_END', {type: 'ADMIN', id: req.user.id, label: req.user.email}, dto.reason, dto.note);
    return this.billing.subscriptionView(saved as never);
  }

  @Post('subscriptions/:id/resume') @Roles('ADMIN', 'EDITOR')
  async resume(@Param('id') id: string, @Req() req: {user: {id: string; email: string}}) {
    const saved = await this.billing.withdrawCancellation(id, {type: 'ADMIN', id: req.user.id, label: req.user.email});
    return this.billing.subscriptionView(saved as never);
  }

  @Post('subscriptions/:id/reconcile') @Roles('ADMIN', 'EDITOR')
  async reconcile(@Param('id') id: string, @Req() req: {user: {id: string; email: string}}) {
    const saved = await this.billing.reconcile(id);
    await this.billing.record({subscriptionId: id, actorType: 'ADMIN', actorId: req.user.id, actorLabel: req.user.email, action: 'RECONCILED', toState: saved?.stripeStatus ?? null});
    return saved ? this.billing.subscriptionView(saved as never) : null;
  }

  @Post('subscriptions/:id/entitlements') @Roles('ADMIN', 'EDITOR')
  async adjust(@Param('id') id: string, @ValidatedBody(EntitlementAdjustDto) dto: EntitlementAdjustDto, @Req() req: {user: {id: string; email: string}}) {
    const sub = await this.db.subscription.findUnique({where: {id}});
    if (!sub) throw new NotFoundException();
    const balance = entitlementBalance(await this.db.entitlementEntry.findMany({where: {customerId: sub.customerId, kind: dto.kind as never}, select: {delta: true}}));
    if (balance + dto.delta < 0) throw new BadRequestException('Adjustment would create a negative balance');
    const entry = await this.db.entitlementEntry.create({data: {customerId: sub.customerId, subscriptionId: sub.id, kind: dto.kind as never, delta: dto.delta, reason: dto.reason, sourceRef: 'admin:' + id + ':' + Date.now()}});
    await this.billing.record({subscriptionId: id, customerId: sub.customerId, actorType: 'ADMIN', actorId: req.user.id, actorLabel: req.user.email, action: 'ENTITLEMENT_ADJUSTED', reason: dto.reason, data: {kind: dto.kind, delta: dto.delta}});
    return entry;
  }

  @Get('orders') async orders(@ValidatedQuery(BillingListDto) q: BillingListDto) {
    const {page, limit, skip, take, search, status} = parsePagination(q, 10);
    const where = {
      ...(status ? {status: status as never} : {}),
      ...(search ? {OR: [{id: {contains: search, mode: 'insensitive' as const}}, {customer: {email: {contains: search, mode: 'insensitive' as const}}}]} : {}),
    };
    const [rows, total] = await Promise.all([this.db.order.findMany({where, skip, take, orderBy: {createdAt: 'desc'}, include: {items: true, customer: true}}), this.db.order.count({where})]);
    return {items: rows.map(order => ({id: order.id, title: order.customer.name || order.customer.email, excerpt: order.items.map(item => item.description).join(', ') + ' · ' + (order.dueNowAmount / 100).toFixed(2) + ' ' + order.currency.toUpperCase(), customerEmail: order.customer.email, status: order.status, mode: order.mode, dueNowAmount: order.dueNowAmount, recurringAmount: order.recurringAmount, currency: order.currency, paymentMethod: order.paymentMethod, createdAt: order.createdAt, updatedAt: order.updatedAt, items: order.items})), total, page, limit};
  }

  @Get('events') async events(@ValidatedQuery(BillingListDto) q: BillingListDto) {
    const {page, limit, skip, take, search} = parsePagination(q, 10);
    const where = search ? {OR: [{action: {contains: search, mode: 'insensitive' as const}}, {actorLabel: {contains: search, mode: 'insensitive' as const}}]} : {};
    const [items, total] = await Promise.all([this.db.billingEvent.findMany({where, skip, take, orderBy: {createdAt: 'desc'}}), this.db.billingEvent.count({where})]);
    return {items: items.map(event => ({...event, title: event.action.replaceAll('_', ' ').toLowerCase(), excerpt: [event.actorLabel ?? event.actorType, event.fromState && event.toState ? event.fromState + ' → ' + event.toState : null, event.reason].filter(Boolean).join(' · '), status: event.actorType})), total, page, limit};
  }

  @Get('webhooks') async webhooks(@ValidatedQuery(BillingListDto) q: BillingListDto) {
    const {page, limit, skip, take, status} = parsePagination(q, 10);
    const where = status ? {status: status as never} : {};
    const [items, total] = await Promise.all([this.db.webhookEvent.findMany({where, skip, take, orderBy: {receivedAt: 'desc'}}), this.db.webhookEvent.count({where})]);
    return {items: items.map(event => ({...event, title: event.type, excerpt: event.stripeEventId + ' · ' + event.attempts + ' attempt(s)' + (event.error ? ' · ' + event.error : ''), updatedAt: event.processedAt ?? event.receivedAt})), total, page, limit};
  }

  /** Recovery sweep: re-read Stripe for anything stuck or overdue. */
  @Post('reconcile') @Roles('ADMIN', 'EDITOR')
  async reconcileAll(@Req() req: {user: {id: string; email: string}}) {
    const stale = await this.db.subscription.findMany({where: {OR: [{accessStatus: 'PENDING'}, {stripeStatus: 'past_due'}, {stripeStatus: 'incomplete'}]}, take: 50});
    let reconciled = 0;
    const failures: string[] = [];
    for (const sub of stale) {
      try {
        await this.billing.reconcile(sub.id);
        reconciled += 1;
      } catch {
        failures.push(sub.stripeSubscriptionId);
      }
    }
    const suspended = await this.billing.applyGracePolicy();
    await this.billing.record({actorType: 'ADMIN', actorId: req.user.id, actorLabel: req.user.email, action: 'RECONCILE_SWEEP', data: {reconciled, suspended, failures: failures.length}});
    return {reconciled, suspended, failures};
  }

  /** Staff-issued management link for a customer who cannot receive email. */
  @Post('customers/:id/portal-link') @Roles('ADMIN')
  async portalLink(@Param('id') id: string, @Req() req: {user: {id: string; email: string}}) {
    const customer = await this.db.customer.findUnique({where: {id}});
    if (!customer) throw new NotFoundException();
    if (customer.shadowState || !customer.emailKey) throw new BadRequestException('This record is not a sign-in identity. Resolve its claim or collision first.');
    const active = customer.accountStatus === 'ACTIVE';
    /* Single-use and short-lived. For a customer who has not set a password yet this is an
       activation link; it never bypasses password setup. Every issue is audited. */
    const token = await issueToken(this.db, id, active ? 'LOGIN_LINK' : 'ACCOUNT_SETUP');
    await this.billing.record({customerId: id, actorType: 'ADMIN', actorId: req.user.id, actorLabel: req.user.email, action: 'PORTAL_LINK_ISSUED', data: {kind: active ? 'login' : 'setup'}});
    return {url: tokenLink(active ? 'login' : 'setup', token), singleUse: true, expiresInMinutes: active ? 15 : 24 * 60};
  }
}
