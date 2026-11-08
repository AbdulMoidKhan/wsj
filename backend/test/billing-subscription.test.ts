import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BillingService, BillingWebhookService, PublicBillingController, CustomerPortalController, BillingAdminController, PlanAdminController} from '../src/billing';
import {fakeDb, makeEvent, makeStripeSubscription, stripeFixture} from './billing-fixture';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-value-that-is-long-enough-123456';
process.env.FRONTEND_URL = 'http://localhost:3100';

const MONTHLY = {
  id: 'plan-monthly',
  slug: 'community-membership',
  name: 'Community Membership',
  serviceType: 'memberships',
  description: 'Monthly community access',
  billingType: 'RECURRING',
  interval: 'MONTH',
  intervalCount: 1,
  unitAmount: 2900,
  currency: 'usd',
  pricingUnit: 'PACKAGE',
  minQuantity: 1,
  maxQuantity: 1,
  requiresSchedule: false,
  requiresResource: false,
  requiresOnboarding: false,
  includedCredits: [{kind: 'MEETING_ROOM_HOUR', amount: 5, resetInterval: 'MONTH'}],
  active: true,
  archivedAt: null,
};
const ANNUAL = {...MONTHLY, id: 'plan-annual', slug: 'professional-annual', name: 'Professional Membership (annual)', interval: 'YEAR', unitAmount: 79900};
const DAY_PASS = {...MONTHLY, id: 'plan-daypass', slug: 'coworking-day-pass', name: 'Coworking Day Pass', serviceType: 'coworking', billingType: 'ONE_TIME', interval: null, unitAmount: 5000, includedCredits: []};
const ROOM_HOUR = {...DAY_PASS, id: 'plan-room', slug: 'huddle-room-hour', name: 'Huddle Room', serviceType: 'meeting-rooms', unitAmount: 3500, pricingUnit: 'HOUR', maxQuantity: 8, requiresSchedule: true, durationMinutes: 60};

async function harness(plans: Array<Record<string, unknown>> = [MONTHLY, ANNUAL, DAY_PASS, ROOM_HOUR]) {
  const db = fakeDb();
  const stripe = stripeFixture();
  for (const plan of plans) await db.plan.create({data: plan});
  const billing = new BillingService(db, stripe as never);
  const webhooks = new BillingWebhookService(db, billing);
  return {
    db,
    stripe,
    billing,
    webhooks,
    publicApi: new PublicBillingController(db, billing),
    portal: new CustomerPortalController(db, billing),
    admin: new BillingAdminController(db, billing),
    plansAdmin: new PlanAdminController(db, billing),
  };
}

const buyer = {customerName: 'Dana Buyer', customerEmail: 'dana@example.invalid'};
/** Nest exceptions carry their detail in response.message, not message. */
const rejectsWith = (fn: () => Promise<unknown>, pattern: RegExp) =>
  assert.rejects(fn, (error: any) => {
    const detail = JSON.stringify(error?.response?.message ?? error?.message ?? '');
    assert.match(detail, pattern);
    return true;
  });

const adminUser = {user: {id: 'admin-1', email: 'admin@example.invalid', role: 'ADMIN'}} as never;
const editorUser = {user: {id: 'editor-1', email: 'editor@example.invalid', role: 'EDITOR'}} as never;

/** Buy a monthly plan and complete it through the webhook, as Stripe would. */
async function buyMonthly(h: Awaited<ReturnType<typeof harness>>, planSlug = 'community-membership', interval: 'month' | 'year' = 'month') {
  const checkout = await h.publicApi.checkout({...buyer, items: [{planSlug}], acceptRecurringTerms: true} as never);
  const order = await h.db.order.findUnique({where: {id: checkout.orderId}});
  const customer = await h.db.customer.findUnique({where: {id: order.customerId}});
  const sub = makeStripeSubscription({customer: customer.stripeCustomerId, interval, unitAmount: interval === 'year' ? 79900 : 2900, metadata: {orderId: order.id, customerId: customer.id}});
  h.stripe.subscriptions.set(sub.id, sub);
  await h.webhooks.process(makeEvent('checkout.session.completed', {id: 'cs_1', metadata: {orderId: order.id}, payment_status: 'paid', subscription: sub.id, amount_total: sub.items.data[0].price.unit_amount}) as never);
  const saved = await h.db.subscription.findUnique({where: {stripeSubscriptionId: sub.id}});
  return {checkout, order, customer, stripeSub: sub, subscription: saved};
}

/* ─────────────── checkout and server-authoritative pricing ─────────────── */

test('recurring checkout creates a durable order and a Stripe subscription session', async () => {
  const h = await harness();
  const result = await h.publicApi.checkout({...buyer, items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true} as never);
  assert.equal(result.status, 'pending_payment');
  assert.ok(result.checkoutUrl);
  const order = await h.db.order.findUnique({where: {id: result.orderId}, include: {items: true}});
  assert.equal(order.status, 'PENDING');
  assert.equal(order.mode, 'SUBSCRIPTION');
  assert.equal(order.dueNowAmount, 2900);
  assert.equal(order.recurringAmount, 2900);
  assert.equal(order.recurringInterval, 'MONTH');
  assert.ok(order.termsAcceptedAt, 'accepted recurring terms are persisted with the order');
  const session = h.stripe.calls.find(call => call.kind === 'checkout.sessions.create')!.input as Record<string, any>;
  assert.equal(session.mode, 'subscription');
  assert.equal(session.line_items[0].price_data.unit_amount, 2900);
  assert.equal(session.line_items[0].price_data.recurring.interval, 'month');
  assert.equal(session.idempotencyKey, 'checkout:' + result.orderId, 'repeated submits reuse one Stripe session');
});

test('an embedded checkout returns a client secret and the publishable key, never the secret key', async () => {
  const h = await harness();
  const previous = process.env.STRIPE_PUBLISHABLE_KEY;
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_fixture_value';
  try {
    const result: any = await h.publicApi.checkout({...buyer, items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true, embedded: true} as never);
    const session = h.stripe.calls.find(call => call.kind === 'checkout.sessions.create')!.input as Record<string, any>;
    /* Stripe renamed this value: 'embedded' became 'embedded_page' in the API
       version this SDK targets. Embedded Checkout is unchanged. */
    assert.equal(session.ui_mode, 'embedded_page');
    assert.match(session.return_url, /\/booking-confirmation\/\?order=.+&session_id=\{CHECKOUT_SESSION_ID\}$/);
    assert.equal(session.success_url, undefined, 'embedded sessions must not set a hosted success URL');
    assert.ok(result.clientSecret, 'the browser receives a client secret for the embedded form');
    assert.equal(result.publishableKey, 'pk_test_fixture_value');
    assert.ok(!JSON.stringify(result).includes('sk_'), 'no secret key is ever returned to the browser');
    assert.equal(result.checkoutUrl, null);
  } finally {
    if (previous === undefined) delete process.env.STRIPE_PUBLISHABLE_KEY;
    else process.env.STRIPE_PUBLISHABLE_KEY = previous;
  }
});

test('a hosted checkout still redirects, so nothing existing breaks', async () => {
  const h = await harness();
  const result = await h.publicApi.checkout({...buyer, items: [{planSlug: 'coworking-day-pass'}]} as never);
  const session = h.stripe.calls.find(call => call.kind === 'checkout.sessions.create')!.input as Record<string, any>;
  assert.equal(session.ui_mode, undefined);
  assert.ok(session.success_url);
  assert.ok(result.checkoutUrl);
  assert.equal((result as any).clientSecret, undefined);
});

test('recurring checkout is refused without an explicit acknowledgement of the terms', async () => {
  const h = await harness();
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'community-membership'}]} as never), /recurring billing terms/);
});

test('a one-time purchase never creates a subscription', async () => {
  const h = await harness();
  const result = await h.publicApi.checkout({...buyer, items: [{planSlug: 'coworking-day-pass'}]} as never);
  const order = await h.db.order.findUnique({where: {id: result.orderId}});
  assert.equal(order.mode, 'PAYMENT');
  assert.equal(order.recurringAmount, 0);
  const session = h.stripe.calls.find(call => call.kind === 'checkout.sessions.create')!.input as Record<string, any>;
  assert.equal(session.mode, 'payment');
  assert.equal(session.line_items[0].price_data.recurring, undefined);
  await h.webhooks.process(makeEvent('checkout.session.completed', {id: 'cs_one', metadata: {orderId: order.id}, payment_status: 'paid', payment_intent: 'pi_1'}) as never);
  assert.equal((await h.db.order.findUnique({where: {id: order.id}})).status, 'PAID');
  assert.equal(h.db.subscription.rows.length, 0);
});

test('client-supplied prices, totals and quantities cannot change what is charged', async () => {
  const h = await harness();
  const tampered = {...buyer, items: [{planSlug: 'huddle-room-hour', quantity: 2, startAt: '2026-07-08T14:00:00.000Z', unitAmount: 1, amount: 1}], totalAmount: 1, dueNowAmount: 1} as never;
  const result = await h.publicApi.checkout(tampered);
  const order = await h.db.order.findUnique({where: {id: result.orderId}, include: {items: true}});
  assert.equal(order.dueNowAmount, 7000, 'server recomputed 2 x $35.00');
  assert.equal(order.items[0].unitAmount, 3500);
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'huddle-room-hour', quantity: 99, startAt: '2026-07-08T14:00:00.000Z'}]} as never), /Quantity/);
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'not-a-real-plan'}]} as never), /Unknown or unavailable/);
});

test('an invalid coupon is rejected and a valid one discounts the server total', async () => {
  const h = await harness();
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'coworking-day-pass'}], couponCode: 'NOPE'} as never), /Invalid or expired coupon/);
  h.stripe.promotion = {id: 'promo_1', code: 'HALFOFF', coupon: {valid: true, percent_off: 50, amount_off: null, duration: 'once', duration_in_months: null}};
  const quote = await h.publicApi.quote({...buyer, items: [{planSlug: 'coworking-day-pass'}], couponCode: 'HALFOFF'} as never);
  assert.equal(quote.discountAmount, 2500);
  assert.equal(quote.dueNowAmount, 2500);
  assert.equal(quote.discountDuration, 'once', 'the customer is told how long the discount lasts');
});

test('manual payment stays unpaid and never activates access', async () => {
  const h = await harness();
  const result = await h.publicApi.checkout({...buyer, items: [{planSlug: 'coworking-day-pass'}], paymentMethod: 'MANUAL'} as never);
  assert.equal(result.status, 'pending_manual_payment');
  assert.equal(result.checkoutUrl, null);
  const order = await h.db.order.findUnique({where: {id: result.orderId}});
  assert.equal(order.status, 'PENDING');
  assert.equal(order.paymentMethod, 'MANUAL');
  assert.equal(h.stripe.calls.filter(call => call.kind === 'checkout.sessions.create').length, 0);
});

test('a nonzero total below the Stripe minimum is refused instead of marked paid', async () => {
  const h = await harness([{...DAY_PASS, id: 'tiny', slug: 'tiny-item', unitAmount: 25}]);
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'tiny-item'}]} as never), /below the minimum card payment/);
  assert.equal(h.db.order.rows.filter((row: any) => row.status === 'PAID').length, 0);
});

test('a membership checkout needs no date or time, a room booking does', async () => {
  const h = await harness();
  const membership = await h.publicApi.checkout({...buyer, items: [{planSlug: 'community-membership'}], acceptRecurringTerms: true} as never);
  assert.equal(membership.status, 'pending_payment');
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'huddle-room-hour'}]} as never), /requires a date and time/);
});

test('monthly and yearly commitments cannot be mixed in one checkout', async () => {
  const h = await harness();
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'community-membership'}, {planSlug: 'professional-annual'}], acceptRecurringTerms: true} as never), /cannot mix monthly and yearly/);
});

/* ─────────────── webhooks, renewals and recovery ─────────────── */

test('a customer who closes the browser still gets the purchase completed by webhook', async () => {
  const h = await harness();
  const {order, subscription} = await buyMonthly(h);
  const stored = await h.db.order.findUnique({where: {id: order.id}});
  assert.equal(stored.status, 'PAID');
  assert.ok(stored.paidAt);
  assert.equal(subscription.accessStatus, 'ACTIVE');
  assert.equal(subscription.stripeStatus, 'active');
  const status = await h.publicApi.orderStatus(order.id);
  assert.equal(status.processing, false);
  assert.equal(status.paid, true);
  /* An order id is a reference, not proof of identity: the public status must
     never hand out a credential for the whole customer account. */
  assert.equal('manageToken' in status, false);
  assert.doesNotMatch(JSON.stringify(status), /eyJ|token/i);
});

test('duplicate and out-of-order webhooks never duplicate orders, subscriptions or credits', async () => {
  const h = await harness();
  const {order, stripeSub} = await buyMonthly(h);
  const duplicate = makeEvent('checkout.session.completed', {id: 'cs_1', metadata: {orderId: order.id}, payment_status: 'paid', subscription: stripeSub.id}, 'evt_dup');
  await h.webhooks.process(duplicate as never);
  const again = await h.webhooks.process(duplicate as never);
  assert.equal(again, 'duplicate');
  /* An older subscription.updated arriving late must not resurrect a stale state. */
  await h.webhooks.process(makeEvent('customer.subscription.updated', {...stripeSub, status: 'active'}) as never);
  assert.equal(h.db.order.rows.length, 1);
  assert.equal(h.db.subscription.rows.length, 1);
  const grants = h.db.entitlementEntry.rows.filter((row: any) => row.delta > 0);
  assert.equal(grants.length, 1, 'included credits are granted once per paid period');
});

test('monthly renewal extends the paid period from Stripe and refreshes credits', async () => {
  const h = await harness();
  const {stripeSub, subscription} = await buyMonthly(h);
  const firstEnd = subscription.currentPeriodEnd.getTime();
  const nextStart = stripeSub.current_period_end;
  const nextEnd = nextStart + 30 * 86400;
  stripeSub.current_period_start = nextStart;
  stripeSub.current_period_end = nextEnd;
  stripeSub.items.data[0].current_period_start = nextStart;
  stripeSub.items.data[0].current_period_end = nextEnd;
  await h.webhooks.process(makeEvent('invoice.paid', {id: 'in_renewal_1', subscription: stripeSub.id, customer: stripeSub.customer, amount_due: 2900, amount_paid: 2900, currency: 'usd', status: 'paid', period_start: nextStart, period_end: nextEnd}) as never);
  const renewed = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(renewed.stripeStatus, 'active');
  assert.equal(renewed.accessStatus, 'ACTIVE');
  assert.ok(renewed.currentPeriodEnd.getTime() > firstEnd, 'the paid period moved forward');
  assert.equal(renewed.currentPeriodEnd.getTime(), nextEnd * 1000);
  assert.equal(h.db.entitlementEntry.rows.filter((row: any) => row.delta > 0).length, 2, 'the new period grants credits again');
  assert.equal(h.db.invoice.rows.length, 1);
});

test('yearly renewal keeps the annual amount and the Stripe-provided year period', async () => {
  const h = await harness();
  const {subscription, stripeSub} = await buyMonthly(h, 'professional-annual', 'year');
  assert.equal(subscription.interval, 'YEAR');
  assert.equal(subscription.unitAmount, 79900);
  const spanDays = Math.round((subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime()) / 86400000);
  assert.equal(spanDays, 365);
  const nextStart = stripeSub.current_period_end;
  const nextEnd = nextStart + 366 * 86400; /* a leap year, which fixed arithmetic would get wrong */
  stripeSub.current_period_start = nextStart;
  stripeSub.current_period_end = nextEnd;
  await h.webhooks.process(makeEvent('invoice.paid', {id: 'in_year_2', subscription: stripeSub.id, customer: stripeSub.customer, amount_due: 79900, amount_paid: 79900, currency: 'usd', status: 'paid'}) as never);
  const renewed = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(renewed.currentPeriodEnd.getTime(), nextEnd * 1000);
});

test('a failed payment starts a grace period, suspends after it, and recovers on payment', async () => {
  const h = await harness();
  const {subscription, stripeSub} = await buyMonthly(h);
  stripeSub.status = 'past_due';
  await h.webhooks.process(makeEvent('invoice.payment_failed', {id: 'in_failed_1', subscription: stripeSub.id, customer: stripeSub.customer, amount_due: 2900, amount_paid: 0, currency: 'usd', status: 'open', hosted_invoice_url: 'https://invoice.test/1'}) as never);
  let current = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(current.stripeStatus, 'past_due');
  assert.equal(current.accessStatus, 'PAST_DUE', 'access continues during the grace period');
  assert.ok(current.graceEndsAt.getTime() > Date.now());
  assert.ok(current.latestInvoiceUrl, 'the customer gets a link to fix the payment');

  /* Grace expires: access is suspended, but this is never reported as a Stripe cancellation. */
  await h.db.subscription.update({where: {id: subscription.id}, data: {graceEndsAt: new Date(Date.now() - 1000)}});
  const suspended = await h.billing.applyGracePolicy();
  assert.equal(suspended, 1);
  current = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(current.accessStatus, 'SUSPENDED');
  assert.equal(current.stripeStatus, 'past_due', 'Stripe still owns the subscription status');

  /* Recovery. */
  stripeSub.status = 'active';
  await h.webhooks.process(makeEvent('invoice.paid', {id: 'in_recovered', subscription: stripeSub.id, customer: stripeSub.customer, amount_due: 2900, amount_paid: 2900, currency: 'usd', status: 'paid'}) as never);
  current = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(current.accessStatus, 'ACTIVE');
  assert.equal(current.graceEndsAt, null);
});

test('an unpaid asynchronous checkout never activates the order', async () => {
  const h = await harness();
  const created = await h.publicApi.checkout({...buyer, items: [{planSlug: 'coworking-day-pass'}]} as never);
  await h.webhooks.process(makeEvent('checkout.session.completed', {id: 'cs_unpaid', metadata: {orderId: created.orderId}, payment_status: 'unpaid'}) as never);
  assert.equal((await h.db.order.findUnique({where: {id: created.orderId}})).status, 'PENDING');
  await h.webhooks.process(makeEvent('checkout.session.async_payment_failed', {id: 'cs_unpaid', metadata: {orderId: created.orderId}}) as never);
  assert.equal((await h.db.order.findUnique({where: {id: created.orderId}})).status, 'FAILED');
});

test('a failing webhook is journaled and rethrown so Stripe retries', async () => {
  const h = await harness();
  const {order} = await buyMonthly(h);
  h.db.order.findUnique = async () => {
    throw new Error('database unavailable');
  };
  await assert.rejects(() => h.webhooks.process(makeEvent('checkout.session.expired', {id: 'cs_x', metadata: {orderId: order.id}}, 'evt_fail') as never));
  const journal = h.db.webhookEvent.rows.find((row: any) => row.stripeEventId === 'evt_fail');
  assert.equal(journal.status, 'FAILED');
  assert.ok(journal.error);
});

/* ─────────────── cancellation ─────────────── */

test('customer period-end cancellation calls Stripe and keeps access until the period ends', async () => {
  const h = await harness();
  const {subscription, customer} = await buyMonthly(h);
  const token = h.billing.portalToken(customer.id);
  const request = {headers: {authorization: 'Bearer ' + token}} as never;
  const preview = await h.portal.preview(request, subscription.id, 'PERIOD_END');
  assert.equal(preview.willRenewAgain, false);
  assert.equal(preview.refundIssued, false);

  const result = await h.portal.cancel(request, subscription.id, {} as never);
  assert.equal(result.cancelAtPeriodEnd, true);
  assert.ok(result.cancellationRequestedAt);
  assert.equal(result.accessStatus, 'ACTIVE', 'the customer keeps access until the paid period ends');
  assert.equal(result.renewsAt, null, 'no further renewal is scheduled');
  const stripeCall = h.stripe.calls.find(call => call.kind === 'subscriptions.update');
  assert.deepEqual((stripeCall!.input as Record<string, unknown>).cancel_at_period_end, true, 'Stripe was actually updated');
  const audit = h.db.billingEvent.rows.find((row: any) => row.action === 'CANCELLATION_SCHEDULED');
  assert.equal(audit.actorType, 'CUSTOMER');
  assert.equal(audit.data.refundIssued, false);
});

test('a scheduled cancellation can be withdrawn before it takes effect, an ended one cannot', async () => {
  const h = await harness();
  const {subscription, customer, stripeSub} = await buyMonthly(h);
  const request = {headers: {authorization: 'Bearer ' + h.billing.portalToken(customer.id)}} as never;
  await h.portal.cancel(request, subscription.id, {} as never);
  const resumed = await h.portal.resume(request, subscription.id);
  assert.equal(resumed.cancelAtPeriodEnd, false);
  assert.equal(resumed.cancellationRequestedAt, null);
  assert.ok(h.db.billingEvent.rows.some((row: any) => row.action === 'CANCELLATION_WITHDRAWN'));

  stripeSub.status = 'canceled';
  await h.db.subscription.update({where: {id: subscription.id}, data: {stripeStatus: 'canceled', accessStatus: 'ENDED'}});
  await assert.rejects(() => h.portal.resume(request, subscription.id), /already ended/);
});

test('one customer cannot see or cancel another customer subscription', async () => {
  const h = await harness();
  const {subscription} = await buyMonthly(h);
  const intruder = await h.db.customer.create({data: {email: 'intruder@example.invalid', name: 'Intruder'}});
  const request = {headers: {authorization: 'Bearer ' + h.billing.portalToken(intruder.id)}} as never;
  await rejectsWith(() => h.portal.cancel(request, subscription.id, {} as never), /Not Found/);
  await rejectsWith(() => h.portal.overview({headers: {authorization: 'Bearer not-a-token'}} as never), /expired|Sign-in/);
});

test('admin period-end cancellation is recorded against the admin who made it', async () => {
  const h = await harness();
  const {subscription} = await buyMonthly(h);
  const preview = await h.admin.preview(subscription.id, 'PERIOD_END');
  assert.equal(preview.prorationBehavior, 'none');
  assert.equal(preview.invoiceNow, false);
  const result = await h.admin.cancel(subscription.id, {reason: 'Customer called the front desk', note: 'Ticket 123'} as never, adminUser);
  assert.equal(result.cancelAtPeriodEnd, true);
  const audit = h.db.billingEvent.rows.find((row: any) => row.action === 'CANCELLATION_SCHEDULED' && row.actorType === 'ADMIN');
  assert.equal(audit.actorId, 'admin-1');
  assert.equal(audit.reason, 'Customer called the front desk');
  assert.equal(audit.note, 'Ticket 123');
  assert.ok(audit.stripeRef);
});

test('admin immediate cancellation ends access through Stripe and refunds nothing by default', async () => {
  const h = await harness();
  const {subscription, stripeSub} = await buyMonthly(h);
  const result = await h.admin.cancel(subscription.id, {mode: 'IMMEDIATE', reason: 'Fraud review'} as never, adminUser);
  assert.equal(result.accessStatus, 'ENDED');
  const cancelCall = h.stripe.calls.find(call => call.kind === 'subscriptions.cancel');
  assert.ok(cancelCall, 'Stripe cancellation was actually requested');
  assert.equal((cancelCall!.input as Record<string, unknown>).prorate, false);
  assert.equal((cancelCall!.input as Record<string, unknown>).invoice_now, false);
  assert.equal(h.stripe.calls.filter(call => call.kind === 'refunds.create').length, 0, 'cancelling never refunds automatically');
  assert.equal(stripeSub.status, 'canceled');
  await rejectsWith(() => h.admin.cancel(subscription.id, {mode: 'IMMEDIATE'} as never, adminUser), /already ended/);
});

test('an editor cannot cancel immediately and an unknown subscription is rejected', async () => {
  const h = await harness();
  const {subscription} = await buyMonthly(h);
  await rejectsWith(() => h.admin.cancel(subscription.id, {mode: 'IMMEDIATE'} as never, editorUser), /administrator/);
  await rejectsWith(() => h.admin.cancel('does-not-exist', {} as never, adminUser), /not found/i);
  /* The editor may still schedule a period-end cancellation. */
  const result = await h.admin.cancel(subscription.id, {} as never, editorUser);
  assert.equal(result.cancelAtPeriodEnd, true);
});

test('a Stripe failure during cancellation changes nothing locally', async () => {
  const h = await harness();
  const {subscription} = await buyMonthly(h);
  const client = h.stripe.client() as never as Record<string, any>;
  const original = client.subscriptions;
  h.stripe.client = () => ({...client, subscriptions: {...original, update: async () => {throw new Error('stripe unavailable');}}}) as never;
  await rejectsWith(() => h.admin.cancel(subscription.id, {} as never, adminUser), /did not confirm/);
  const unchanged = await h.db.subscription.findUnique({where: {id: subscription.id}});
  assert.equal(unchanged.cancelAtPeriodEnd, false, 'no local status was changed without Stripe');
  assert.equal(unchanged.cancellationRequestedAt, null);
});

/* ─────────────── entitlements, catalog and admin tooling ─────────────── */

test('credits cannot be double spent or driven negative', async () => {
  const h = await harness();
  const {subscription} = await buyMonthly(h);
  await h.admin.adjust(subscription.id, {kind: 'MEETING_ROOM_HOUR', delta: -5, reason: 'Used 5 hours'} as never, adminUser);
  await rejectsWith(() => h.admin.adjust(subscription.id, {kind: 'MEETING_ROOM_HOUR', delta: -1, reason: 'Overspend'} as never, adminUser), /negative balance/);
  const summary = await h.billing.entitlementSummary(subscription.customerId);
  assert.equal(summary.balances.find(entry => entry.kind === 'MEETING_ROOM_HOUR')!.balance, 0);
  assert.ok(h.db.billingEvent.rows.some((row: any) => row.action === 'ENTITLEMENT_ADJUSTED' && row.actorId === 'admin-1'));
});

test('an annual plan still refreshes its monthly credits', async () => {
  const h = await harness([{...ANNUAL, includedCredits: [{kind: 'STUDIO_HOUR', amount: 2, resetInterval: 'MONTH'}]}]);
  const {subscription, stripeSub} = await buyMonthly(h, 'professional-annual', 'year');
  await h.webhooks.process(makeEvent('invoice.paid', {id: 'in_month_2', subscription: stripeSub.id, customer: stripeSub.customer, amount_due: 0, amount_paid: 0, currency: 'usd', status: 'paid'}) as never);
  const grants = h.db.entitlementEntry.rows.filter((row: any) => row.subscriptionId === subscription.id && row.delta > 0);
  assert.equal(grants.length, 2, 'each confirmed billing event refreshes the monthly allowance');
  assert.equal(grants[0].kind, 'STUDIO_HOUR');
});

test('admin plan management validates billing configuration and archives instead of deleting', async () => {
  const h = await harness();
  await rejectsWith(() => h.plansAdmin.create({name: 'Broken', slug: 'broken', serviceType: 'coworking', billingType: 'RECURRING', unitAmount: 1000} as never, adminUser), /billing interval/);
  const created = await h.plansAdmin.create({name: 'Dedicated desk monthly', slug: 'dedicated-monthly', serviceType: 'dedicated', billingType: 'RECURRING', interval: 'MONTH', unitAmount: 37500} as never, adminUser);
  assert.equal(created.unitAmount, 37500);
  await h.plansAdmin.update(created.id, {...created, unitAmount: 39500} as never, adminUser);
  const priceEvent = h.db.billingEvent.rows.find((row: any) => row.action === 'PLAN_UPDATED');
  assert.match(String(priceEvent.data.note), /new purchases only/, 'existing subscriptions keep their agreed price');
  await h.plansAdmin.archive(created.id, adminUser);
  const archived = await h.db.plan.findUnique({where: {id: created.id}});
  assert.equal(archived.active, false);
  assert.ok(archived.archivedAt);
  await rejectsWith(() => h.publicApi.checkout({...buyer, items: [{planSlug: 'dedicated-monthly'}], acceptRecurringTerms: true} as never), /Unknown or unavailable/);
});

test('admin subscription search, detail and reconciliation use real Stripe state', async () => {
  const h = await harness();
  const {subscription, stripeSub} = await buyMonthly(h);
  const listed = await h.admin.subscriptions({search: 'dana@example.invalid'} as never);
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].customerEmail, 'dana@example.invalid');
  const detail = await h.admin.subscription(subscription.id);
  assert.match(detail.stripeDashboardUrl, /dashboard\.stripe\.com/);
  assert.ok(detail.events.length > 0, 'the audit trail is visible in admin');

  /* Stripe changed out of band; reconciliation makes local state match. */
  stripeSub.status = 'past_due';
  const reconciled = await h.admin.reconcile(subscription.id, adminUser);
  assert.equal(reconciled!.stripeStatus, 'past_due');
  assert.ok(h.db.billingEvent.rows.some((row: any) => row.action === 'RECONCILED'));
});

test('the customer portal shows the plan, renewal date and cancellation state', async () => {
  const h = await harness();
  const {customer, subscription} = await buyMonthly(h);
  const request = {headers: {authorization: 'Bearer ' + h.billing.portalToken(customer.id)}} as never;
  const view = await h.portal.overview(request);
  assert.equal(view.customer.email, 'dana@example.invalid');
  assert.equal(view.subscriptions.length, 1);
  assert.equal(view.subscriptions[0].planName, 'Community Membership');
  assert.equal(view.subscriptions[0].intervalDescription, 'every month');
  assert.ok(view.subscriptions[0].renewsAt, 'the next renewal date is shown');
  assert.equal(view.orders.length, 1);
  assert.equal(view.entitlements.balances[0].balance, 5);
  await h.portal.cancel(request, subscription.id, {} as never);
  const after = await h.portal.overview(request);
  assert.equal(after.subscriptions[0].cancelAtPeriodEnd, true);
  assert.equal(after.subscriptions[0].accessStatus, 'ACTIVE');
});
