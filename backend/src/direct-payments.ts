/**
 * Custom checkout: our own payment form, Stripe's payment processing.
 *
 * The browser renders the Payment Element and confirms the intent itself, so
 * no customer is ever redirected to a Stripe-hosted page and no card detail
 * reaches this server. Everything that decides money or access is computed
 * here from the database:
 *
 *  - the price comes from CatalogService.priceSelection, which reads the
 *    catalogue; an amount in the request body is ignored and rejected,
 *  - automatic renewal happens only when the buyer explicitly asked for it,
 *    and an unchecked box buys one finite paid term with no stored mandate,
 *  - a purchase is never treated as paid because the browser said so. The
 *    verified webhook in billing.ts is the only writer of PAID.
 *
 * Reading an order back needs the capability token minted for that attempt, so
 * knowing or guessing an order id discloses nothing.
 */
import {Controller, Get, Post, Param, Req, Inject, Injectable, HttpException, HttpStatus, BadRequestException} from '@nestjs/common';
import {ApiTags} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {IsBoolean, IsOptional} from 'class-validator';
import Stripe from 'stripe';
import {Db} from './core';
import {ValidatedBody} from './validation';
import {PaymentClient} from './payments';
import {frontendOrigins} from './origins';
import {CatalogService, CatalogCheckoutDto} from './catalog';
import {BillingService} from './billing';
import {BILLING_TERMS_VERSION, describeInterval, paymentOutcome, type BillingIntervalValue} from './billing-core';
import {
  apiFailure,
  apiSuccess,
  describeProviderError,
  hashCheckoutToken,
  isValidCheckoutToken,
  isValidIdempotencyKey,
  providerErrorLogLabel,
  renewalDecision,
  requestFingerprint,
  termDaysFor,
  tokenMatches,
} from './direct-payments-core';

/** Checkout attempts stay payable for an hour, then the order expires. */
const ATTEMPT_TTL_MS = 60 * 60 * 1000;

export class DirectPaymentDto extends CatalogCheckoutDto {
  /** Must be sent explicitly. Absent or false never enrols a recurring charge. */
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsBoolean() acceptTerms?: boolean;
}

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

function header(req: RequestLike, name: string): string | undefined {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function fail(status: number, message: string, code: string, retryable = false): never {
  throw new HttpException(apiFailure(message, code, retryable), status);
}

/** A rejected read must look identical whether the order exists or not. */
function notFound(): never {
  fail(HttpStatus.NOT_FOUND, 'We could not find that checkout.', 'not_found');
}

@Injectable()
export class DirectPaymentsService {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(CatalogService) private catalog: CatalogService,
    @Inject(BillingService) private billing: BillingService,
    @Inject(PaymentClient) private payments: PaymentClient = new PaymentClient(),
  ) {}

  private stripe(): Stripe {
    return this.payments.client();
  }

  publishableKey(): string {
    const key = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
    if (!key) fail(HttpStatus.SERVICE_UNAVAILABLE, 'Online payment is temporarily unavailable. Please contact our team.', 'payments_unconfigured', true);
    return key;
  }

  /* ───────────────────────────── Create or resume ───────────────────────────── */

  async createIntent(dto: DirectPaymentDto, context: {idempotencyKey: string; checkoutToken: string}) {
    if (dto.website) throw new BadRequestException('Invalid submission');

    /* Price first: an unknown package or an impossible quantity must fail
       before any customer row, token or provider object is created. */
    const {plan, priced} = await this.catalog.priceSelection(dto);
    const decision = renewalDecision({hasRecurring: priced.hasRecurring, autoRenew: dto.autoRenew, acceptRecurringTerms: dto.acceptRecurringTerms});
    if (decision.error) fail(HttpStatus.BAD_REQUEST, decision.error, 'renewal_not_accepted');
    if (dto.acceptTerms !== true) fail(HttpStatus.BAD_REQUEST, 'Please accept the Terms of Use and Privacy Notice to continue.', 'terms_not_accepted');
    if (plan.requiresSchedule && !dto.startAt) fail(HttpStatus.BAD_REQUEST, plan.name + ' requires a date and time.', 'schedule_required');

    const fingerprint = requestFingerprint({
      planSlug: dto.planSlug,
      quantity: dto.quantity ?? null,
      durationHours: dto.durationHours ?? null,
      days: dto.days ?? null,
      addOns: dto.addOns ?? null,
      couponCode: dto.couponCode ?? null,
      customerEmail: dto.customerEmail,
      autoRenew: decision.autoRenew,
      startAt: dto.startAt ?? null,
    });

    /* A repeated key is the same purchase, never a second charge. */
    /* Reattaching a provider object to an order that has one is never a second
       charge: Stripe is called with the same idempotency key as the first try. */
    const start = (order: OrderWithItems) => async () => {
      const buyer = await this.billing.customerForGuest(dto.customerEmail, dto.customerName, dto.customerPhone);
      return decision.mode === 'SUBSCRIPTION' ? this.startSubscription(order, priced, buyer) : this.startPayment(order, buyer);
    };

    const prior = await this.db.order.findUnique({where: {idempotencyKey: context.idempotencyKey}, include: {items: true}});
    if (prior) return this.resume(prior, {fingerprint, checkoutToken: context.checkoutToken, start: start(prior)});

    const outcome = paymentOutcome(priced.totals.dueNowAmount);
    if (outcome === 'BELOW_MINIMUM') fail(HttpStatus.BAD_REQUEST, 'The amount due is below the minimum card payment. Please contact our team to complete this purchase.', 'below_minimum');

    const customer = await this.billing.customerForGuest(dto.customerEmail, dto.customerName, dto.customerPhone);
    const planLine = priced.lines[0];
    const termDays = termDaysFor(plan.billingUnit, plan.durationDays ?? null, planLine?.quantity ?? 1);

    let order;
    try {
      order = await this.db.order.create({
        data: {
          customerId: customer.id,
          status: 'PENDING',
          mode: decision.mode === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'PAYMENT',
          currency: priced.currency,
          subtotalAmount: priced.totals.subtotalAmount,
          discountAmount: priced.totals.discountAmount,
          taxAmount: priced.totals.taxAmount,
          totalAmount: priced.totals.totalAmount,
          dueNowAmount: priced.totals.dueNowAmount,
          /* A non-renewing purchase has no future charge, whatever the
             catalogue's billing unit says about the package itself. */
          recurringAmount: decision.autoRenew ? priced.totals.recurringAmount : 0,
          recurringInterval: decision.autoRenew ? priced.totals.recurringInterval : null,
          couponCode: dto.couponCode ?? null,
          paymentMethod: 'STRIPE',
          checkoutTokenHash: hashCheckoutToken(context.checkoutToken),
          idempotencyKey: context.idempotencyKey,
          requestFingerprint: fingerprint,
          autoRenew: decision.autoRenew,
          recurringConsentAt: decision.autoRenew ? new Date() : null,
          termsVersion: BILLING_TERMS_VERSION,
          termsAcceptedAt: new Date(),
          notes: dto.notes ?? null,
          metadata: {
            flow: 'DIRECT_PAYMENT_ELEMENT',
            termDays,
            planSlug: plan.slug,
            serviceSlug: plan.serviceSlug,
            ...(dto.membershipCircle ? {membershipCircle: dto.membershipCircle} : {}),
            ...(dto.startAt ? {schedule: [{planSlug: plan.slug, startAt: dto.startAt}]} : {}),
          },
          expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
          items: {
            create: priced.lines.map(line => ({
              planId: line.planId,
              description: line.name,
              quantity: line.quantity,
              unitAmount: line.unitAmount,
              amount: line.amount,
              billingType: line.billingType,
              interval: line.interval,
              metadata: {...line.metadata, autoRenew: decision.autoRenew, termDays} as object,
            })),
          },
        },
        include: {items: true},
      });
    } catch (error) {
      /* Two parallel submissions of the same attempt: the loser re-reads. */
      if ((error as {code?: string})?.code === 'P2002') {
        const raced = await this.db.order.findUnique({where: {idempotencyKey: context.idempotencyKey}, include: {items: true}});
        if (raced) return this.resume(raced, {fingerprint, checkoutToken: context.checkoutToken, start: start(raced)});
      }
      throw error;
    }

    await this.billing.record({
      orderId: order.id,
      customerId: customer.id,
      actorType: 'CUSTOMER',
      actorLabel: customer.email,
      action: 'DIRECT_CHECKOUT_CREATED',
      toState: 'PENDING',
      data: {dueNow: order.dueNowAmount, autoRenew: decision.autoRenew, mode: order.mode, termDays},
    });

    if (outcome === 'FREE' && decision.mode !== 'SUBSCRIPTION') {
      const paid = await this.db.order.update({where: {id: order.id}, data: {status: 'PAID', paidAt: new Date()}, include: {items: true}});
      await this.billing.record({orderId: order.id, customerId: customer.id, actorType: 'SYSTEM', action: 'ORDER_PAID', fromState: 'PENDING', toState: 'PAID', data: {reason: 'server-priced total is zero'}});
      await this.billing.activatePaidTerm(order.id);
      return this.view(paid, {intentType: 'none', clientSecret: null});
    }

    return decision.mode === 'SUBSCRIPTION' ? this.startSubscription(order, priced, customer) : this.startPayment(order, customer);
  }

  /** One charge for one paid term. No payment method is stored for later use. */
  private async startPayment(order: {id: string; customerId: string; currency: string; dueNowAmount: number}, customer: {id: string; email: string; name: string; phone?: string | null; stripeCustomerId?: string | null}) {
    const stripeCustomerId = await this.billing.stripeCustomerFor(customer);
    let intent: Stripe.PaymentIntent;
    try {
      intent = await this.stripe().paymentIntents.create(
        {
          amount: order.dueNowAmount,
          currency: order.currency,
          customer: stripeCustomerId,
          description: 'Workspace Junction order ' + order.id,
          automatic_payment_methods: {enabled: true},
          metadata: {orderId: order.id, customerId: order.customerId, autoRenew: 'false'},
        },
        {idempotencyKey: 'direct-payment:' + order.id},
      );
    } catch (error) {
      return this.providerFailed(order, error);
    }
    const saved = await this.db.order.update({where: {id: order.id}, data: {stripePaymentIntentId: intent.id}, include: {items: true}});
    return this.view(saved, {intentType: 'payment', clientSecret: intent.client_secret ?? null});
  }

  /** Explicitly requested renewal: a real Stripe subscription, confirmed here. */
  private async startSubscription(
    order: {id: string; customerId: string; currency: string; dueNowAmount: number},
    priced: {lines: Array<{name: string; description: string; currency: string; unitAmount: number; quantity: number; billingType: string; interval: string | null; intervalCount: number; slug: string}>; coupon: {promotionCodeId: string} | null},
    customer: {id: string; email: string; name: string; phone?: string | null; stripeCustomerId?: string | null},
  ) {
    const stripeCustomerId = await this.billing.stripeCustomerFor(customer);
    const recurring = priced.lines.filter(line => line.billingType === 'RECURRING');
    const oneTime = priced.lines.filter(line => line.billingType !== 'RECURRING');
    const intervals = new Set(recurring.map(line => (line.interval === 'YEAR' ? 'year' : 'month') + ':' + (line.intervalCount || 1)));
    if (intervals.size > 1) fail(HttpStatus.BAD_REQUEST, 'These packages renew on different cycles and cannot be bought together.', 'mixed_intervals');

    let subscription: Stripe.Subscription;
    try {
      /* Prices are created from the server-priced lines, so the subscription
         can only ever renew at an amount this server computed. */
      const recurringPrices = await Promise.all(recurring.map((line, index) => this.priceFor(order.id, 'plan-' + index, line)));
      const oneTimePrices = await Promise.all(oneTime.map((line, index) => this.priceFor(order.id, 'extra-' + index, line)));
      subscription = await this.stripe().subscriptions.create(
        {
          customer: stripeCustomerId,
          items: recurringPrices.map((price, index) => ({price: price.id, quantity: recurring[index].quantity})),
          ...(oneTimePrices.length ? {add_invoice_items: oneTimePrices.map((price, index) => ({price: price.id, quantity: oneTime[index].quantity}))} : {}),
          ...(priced.coupon ? {discounts: [{promotion_code: priced.coupon.promotionCodeId}]} : {}),
          collection_method: 'charge_automatically',
          payment_behavior: 'default_incomplete',
          /* The mandate is stored because the customer asked to renew. */
          payment_settings: {save_default_payment_method: 'on_subscription'},
          metadata: {orderId: order.id, customerId: order.customerId, autoRenew: 'true'},
          expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent'],
        },
        {idempotencyKey: 'direct-subscription:' + order.id},
      );
    } catch (error) {
      return this.providerFailed(order, error);
    }

    const secret = subscriptionClientSecret(subscription);
    if (!secret.clientSecret) {
      console.error('[direct-payments] subscription ' + subscription.id + ' returned no confirmation secret for order ' + order.id);
      return this.providerFailed(order, {type: 'StripeAPIError'});
    }
    const saved = await this.db.order.update({where: {id: order.id}, data: {stripeDirectSubscriptionId: subscription.id}, include: {items: true}});
    return this.view(saved, {intentType: secret.intentType, clientSecret: secret.clientSecret});
  }

  /** One reusable Stripe price per order line, created idempotently. */
  private priceFor(orderId: string, reference: string, line: {name: string; currency: string; unitAmount: number; billingType: string; interval: string | null; intervalCount: number}) {
    return this.stripe().prices.create(
      {
        currency: line.currency,
        unit_amount: line.unitAmount,
        product_data: {name: line.name},
        ...(line.billingType === 'RECURRING' ? {recurring: {interval: line.interval === 'YEAR' ? ('year' as const) : ('month' as const), interval_count: line.intervalCount || 1}} : {}),
      },
      {idempotencyKey: 'direct-price:' + orderId + ':' + reference},
    );
  }

  private async providerFailed(order: {id: string; customerId: string}, error: unknown): Promise<never> {
    console.error('[direct-payments] provider failure for order ' + order.id + ' (' + providerErrorLogLabel(error) + ')');
    await this.db.order.update({where: {id: order.id}, data: {status: 'FAILED'}}).catch(() => undefined);
    await this.billing
      .record({orderId: order.id, customerId: order.customerId, actorType: 'SYSTEM', action: 'DIRECT_CHECKOUT_FAILED', toState: 'FAILED', data: {provider: providerErrorLogLabel(error)}})
      .catch(() => undefined);
    const safe = describeProviderError(error);
    fail(safe.status, safe.message, safe.code, safe.retryable);
  }

  /**
   * Re-answer an attempt that already exists. A network retry must get the
   * same order and the same provider object, never a second charge.
   */
  private async resume(order: OrderWithItems, context: {fingerprint: string; checkoutToken: string; start?: () => Promise<ReturnType<DirectPaymentsService['view']>>}) {
    if (order.requestFingerprint !== context.fingerprint) {
      fail(HttpStatus.CONFLICT, 'This checkout was already started for a different selection. Please refresh and try again.', 'idempotency_conflict');
    }
    if (!tokenMatches(context.checkoutToken, order.checkoutTokenHash)) notFound();
    if (order.status === 'PAID') return this.view(order, {intentType: 'none', clientSecret: null});
    if (order.status === 'CANCELLED' || order.status === 'EXPIRED' || order.status === 'FAILED') {
      fail(HttpStatus.CONFLICT, 'This checkout is no longer payable. Please start again.', 'checkout_closed');
    }

    try {
      if (order.stripeDirectSubscriptionId) {
        const subscription = await this.stripe().subscriptions.retrieve(order.stripeDirectSubscriptionId, {expand: ['latest_invoice.confirmation_secret', 'pending_setup_intent']});
        const secret = subscriptionClientSecret(subscription as Stripe.Subscription);
        return this.view(order, {intentType: secret.clientSecret ? secret.intentType : 'none', clientSecret: secret.clientSecret});
      }
      if (order.stripePaymentIntentId) {
        const intent = await this.stripe().paymentIntents.retrieve(order.stripePaymentIntentId);
        if (intent.status === 'succeeded' || intent.status === 'processing') return this.view(order, {intentType: 'none', clientSecret: null});
        return this.view(order, {intentType: 'payment', clientSecret: intent.client_secret ?? null});
      }
    } catch (error) {
      const safe = describeProviderError(error);
      fail(safe.status, safe.message, safe.code, safe.retryable);
    }
    /* The order exists but its provider object was never attached, for example
       because two submissions of the same attempt raced. Attach it now. */
    if (context.start) return context.start();
    fail(HttpStatus.CONFLICT, 'This checkout could not be resumed. Please start again.', 'checkout_closed');
  }

  /* ───────────────────────────── Reads ───────────────────────────── */

  /** The whole read path for a guest: capability first, data second. */
  async readOrder(id: string, token: unknown) {
    if (!isValidCheckoutToken(token)) notFound();
    const order = await this.db.order.findUnique({where: {id}, include: {items: true, subscriptions: true}});
    if (!order || !tokenMatches(token, order.checkoutTokenHash)) notFound();
    return this.statusView(order);
  }

  /** Abandoning an unpaid attempt. A paid order is never cancellable here. */
  async cancelOrder(id: string, token: unknown) {
    if (!isValidCheckoutToken(token)) notFound();
    const order = await this.db.order.findUnique({where: {id}, include: {items: true, subscriptions: true}});
    if (!order || !tokenMatches(token, order.checkoutTokenHash)) notFound();
    if (order.status === 'PAID' || order.paidAt) fail(HttpStatus.CONFLICT, 'This payment already completed and cannot be cancelled here. Contact our team for help.', 'already_paid');
    if (order.subscriptions.length) fail(HttpStatus.CONFLICT, 'This purchase is already active. Manage it from your account.', 'already_active');
    if (order.status !== 'PENDING') return this.statusView(order);

    try {
      if (order.stripePaymentIntentId) {
        const intent = await this.stripe().paymentIntents.retrieve(order.stripePaymentIntentId);
        if (intent.status === 'succeeded' || intent.status === 'processing') {
          fail(HttpStatus.CONFLICT, 'This payment is being processed and cannot be cancelled here.', 'already_paid');
        }
        if (intent.status !== 'canceled') await this.stripe().paymentIntents.cancel(order.stripePaymentIntentId);
      } else if (order.stripeDirectSubscriptionId) {
        const subscription = await this.stripe().subscriptions.retrieve(order.stripeDirectSubscriptionId);
        if (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due') {
          fail(HttpStatus.CONFLICT, 'This subscription is already active. Manage it from your account.', 'already_active');
        }
        if (subscription.status !== 'canceled') await this.stripe().subscriptions.cancel(order.stripeDirectSubscriptionId);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const safe = describeProviderError(error);
      fail(safe.status, safe.message, safe.code, safe.retryable);
    }

    const cancelled = await this.db.order.update({where: {id: order.id}, data: {status: 'CANCELLED'}, include: {items: true, subscriptions: true}});
    await this.billing.record({orderId: order.id, customerId: order.customerId, actorType: 'CUSTOMER', action: 'DIRECT_CHECKOUT_ABANDONED', fromState: order.status, toState: 'CANCELLED'});
    return this.statusView(cancelled);
  }

  /* ───────────────────────────── Views ───────────────────────────── */

  private view(order: OrderWithItems, payment: {intentType: 'payment' | 'setup' | 'none'; clientSecret: string | null}) {
    return {
      orderId: order.id,
      clientSecret: payment.clientSecret,
      intentType: payment.intentType,
      publishableKey: this.publishableKey(),
      amount: order.dueNowAmount,
      currency: order.currency,
      autoRenew: order.autoRenew,
      status: order.status,
      expiresAt: order.expiresAt?.toISOString() ?? null,
      recurringAmount: order.recurringAmount,
      recurringDescription: order.recurringAmount ? describeInterval(order.recurringInterval as BillingIntervalValue | null) : null,
      termsVersion: order.termsVersion,
    };
  }

  private statusView(order: OrderWithItems & {subscriptions?: Array<Record<string, unknown>>}) {
    const subscriptions = (order.subscriptions ?? []) as Array<{id: string; accessStatus: string; autoRenew: boolean; currentPeriodEnd: Date | null; paidThrough: Date | null; cancelAtPeriodEnd: boolean}>;
    const current = subscriptions[0];
    return {
      id: order.id,
      status: order.status,
      processing: order.status === 'PENDING',
      currency: order.currency,
      dueNowAmount: order.dueNowAmount,
      autoRenew: order.autoRenew,
      recurringAmount: order.recurringAmount,
      recurringDescription: order.recurringAmount ? describeInterval(order.recurringInterval as BillingIntervalValue | null) : null,
      currentPeriodEnd: (current?.currentPeriodEnd ?? current?.paidThrough ?? null)?.toISOString() ?? null,
      items: (order.items ?? []).map(item => ({description: item.description, quantity: item.quantity, amount: item.amount, billingType: item.billingType})),
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        accessStatus: sub.accessStatus,
        autoRenew: sub.autoRenew,
        renews: Boolean(sub.autoRenew) && !sub.cancelAtPeriodEnd,
        activeUntil: (sub.currentPeriodEnd ?? sub.paidThrough ?? null)?.toISOString() ?? null,
      })),
    };
  }
}

type OrderWithItems = {
  id: string;
  customerId: string;
  status: string;
  currency: string;
  dueNowAmount: number;
  recurringAmount: number;
  recurringInterval: string | null;
  autoRenew: boolean;
  termsVersion: string | null;
  expiresAt: Date | null;
  paidAt?: Date | null;
  checkoutTokenHash: string | null;
  requestFingerprint: string | null;
  stripePaymentIntentId: string | null;
  stripeDirectSubscriptionId: string | null;
  items?: Array<{description: string; quantity: number; amount: number; billingType: string}>;
};

/**
 * Stripe returns the secret the browser needs in one of two places: the first
 * invoice when money is due now, or a setup intent when it is not (a full
 * discount or a trial). Reading both keeps a free first period working without
 * inventing a payment.
 */
export function subscriptionClientSecret(subscription: Stripe.Subscription): {intentType: 'payment' | 'setup'; clientSecret: string | null} {
  const record = subscription as unknown as {
    latest_invoice?: {confirmation_secret?: {client_secret?: string | null} | null; payment_intent?: {client_secret?: string | null} | string | null} | string | null;
    pending_setup_intent?: {client_secret?: string | null} | string | null;
  };
  const invoice = typeof record.latest_invoice === 'object' && record.latest_invoice ? record.latest_invoice : null;
  const fromInvoice = invoice?.confirmation_secret?.client_secret ?? (typeof invoice?.payment_intent === 'object' && invoice?.payment_intent ? invoice.payment_intent.client_secret : null);
  if (fromInvoice) return {intentType: 'payment', clientSecret: fromInvoice};
  const setup = typeof record.pending_setup_intent === 'object' && record.pending_setup_intent ? record.pending_setup_intent.client_secret : null;
  if (setup) return {intentType: 'setup', clientSecret: setup};
  return {intentType: 'payment', clientSecret: null};
}

/* ───────────────────────────── Public API ───────────────────────────── */

@ApiTags('Payments') @Controller('public/payments')
export class PublicPaymentsController {
  constructor(@Inject(DirectPaymentsService) private payments: DirectPaymentsService) {}

  /** Cross-origin writes are only accepted from our own front ends. */
  private assertOrigin(req: RequestLike) {
    const origin = header(req, 'origin');
    if (!origin) return;
    let allowed: string[];
    try {
      allowed = frontendOrigins();
    } catch {
      fail(HttpStatus.SERVICE_UNAVAILABLE, 'Payments are temporarily unavailable.', 'payments_unconfigured', true);
    }
    if (!allowed.includes(origin)) fail(HttpStatus.FORBIDDEN, 'This request did not come from our checkout.', 'bad_origin');
  }

  @Get('config') @Throttle({default: {limit: 120, ttl: 60000}})
  config() {
    return apiSuccess('Payment configuration', {publishableKey: this.payments.publishableKey()});
  }

  @Post('intents') @Throttle({default: {limit: 8, ttl: 60000}})
  async createIntent(@Req() req: RequestLike, @ValidatedBody(DirectPaymentDto) dto: DirectPaymentDto) {
    this.assertOrigin(req);
    const idempotencyKey = header(req, 'idempotency-key');
    const checkoutToken = header(req, 'x-checkout-token');
    if (!isValidIdempotencyKey(idempotencyKey)) fail(HttpStatus.BAD_REQUEST, 'This checkout request was malformed. Please refresh and try again.', 'invalid_idempotency_key');
    if (!isValidCheckoutToken(checkoutToken)) fail(HttpStatus.BAD_REQUEST, 'This checkout request was malformed. Please refresh and try again.', 'invalid_checkout_token');
    const data = await this.payments.createIntent(dto, {idempotencyKey: idempotencyKey as string, checkoutToken: checkoutToken as string});
    return apiSuccess('Checkout ready', data);
  }

  @Get('orders/:id') @Throttle({default: {limit: 240, ttl: 60000}})
  async orderStatus(@Req() req: RequestLike, @Param('id') id: string) {
    return apiSuccess('Order status', await this.payments.readOrder(id, header(req, 'x-checkout-token')));
  }

  @Post('orders/:id/cancel') @Throttle({default: {limit: 20, ttl: 60000}})
  async cancel(@Req() req: RequestLike, @Param('id') id: string) {
    this.assertOrigin(req);
    return apiSuccess('Checkout cancelled', await this.payments.cancelOrder(id, header(req, 'x-checkout-token')));
  }
}
