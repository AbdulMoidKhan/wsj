/**
 * Custom checkout: the rules that decide who is enrolled in a recurring
 * charge, what a guest can read back, and what makes an order paid.
 *
 * Everything here runs offline against the in-memory database and the Stripe
 * double. No key is read, no network call is made and no charge is created.
 */
import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {CatalogService, clearCatalogCache} from '../src/catalog';
import {BillingService, BillingWebhookService} from '../src/billing';
import {DirectPaymentsService, subscriptionClientSecret} from '../src/direct-payments';
import {
  describeProviderError,
  finiteAccessStatus,
  hashCheckoutToken,
  isValidCheckoutToken,
  isValidIdempotencyKey,
  renewalDecision,
  requestFingerprint,
  termDaysFor,
  termEndFor,
  tokenMatches,
} from '../src/direct-payments-core';
import {fakeDb, stripeFixture, makeEvent} from './billing-fixture';

process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_fixture';

/* ───────────────────────────── Pure rules ───────────────────────────── */

test('an unticked renewal box never buys a renewing subscription', () => {
  assert.deepEqual(renewalDecision({hasRecurring: true, autoRenew: undefined}), {mode: 'ONE_TIME', autoRenew: false, error: null});
  assert.deepEqual(renewalDecision({hasRecurring: true, autoRenew: false}), {mode: 'ONE_TIME', autoRenew: false, error: null});
  /* Nothing truthy-but-not-true may be read as consent. */
  for (const value of ['true', 1, {}, [], 'on']) {
    assert.equal(renewalDecision({hasRecurring: true, autoRenew: value as never}).mode, 'ONE_TIME');
  }
});

test('renewal requires both the tick and the recurring terms, on a recurring package', () => {
  assert.match(renewalDecision({hasRecurring: true, autoRenew: true}).error!, /renewal terms/);
  assert.match(renewalDecision({hasRecurring: false, autoRenew: true, acceptRecurringTerms: true}).error!, /not sold as a renewing subscription/);
  assert.deepEqual(renewalDecision({hasRecurring: true, autoRenew: true, acceptRecurringTerms: true}), {mode: 'SUBSCRIPTION', autoRenew: true, error: null});
});

test('checkout capability tokens are hashed, shape-checked and compared whole', () => {
  const token = randomBytes(32).toString('hex');
  assert.ok(isValidCheckoutToken(token));
  assert.equal(isValidCheckoutToken(token.toUpperCase()), false);
  assert.equal(isValidCheckoutToken(token.slice(0, 63)), false);
  assert.equal(isValidCheckoutToken(null), false);
  const stored = hashCheckoutToken(token);
  assert.notEqual(stored, token);
  assert.ok(tokenMatches(token, stored));
  assert.equal(tokenMatches(randomBytes(32).toString('hex'), stored), false);
  assert.equal(tokenMatches(token, null), false);
  assert.equal(tokenMatches(token, 'not-hex'), false);
  /* A prefix of the stored hash must not be accepted. */
  assert.equal(tokenMatches(token, stored.slice(0, 32)), false);
});

test('idempotency keys are validated before they can reserve an order', () => {
  assert.ok(isValidIdempotencyKey('9f1c2b7a-1111-4222-8333-444455556666'));
  assert.equal(isValidIdempotencyKey('short'), false);
  assert.equal(isValidIdempotencyKey('has spaces and symbols $$$$$$$$$$'), false);
  assert.equal(isValidIdempotencyKey(42), false);
});

test('the request fingerprint pins the purchase, not the request shape', () => {
  const base = {planSlug: 'desk', customerEmail: 'Buyer@Example.invalid', autoRenew: false, addOns: [{slug: 'b'}, {slug: 'a', quantity: 2}]};
  const same = {planSlug: 'DESK', customerEmail: 'buyer@example.invalid', autoRenew: false, addOns: [{slug: 'a', quantity: 2}, {slug: 'b'}]};
  assert.equal(requestFingerprint(base), requestFingerprint(same));
  assert.notEqual(requestFingerprint(base), requestFingerprint({...base, autoRenew: true}));
  assert.notEqual(requestFingerprint(base), requestFingerprint({...base, couponCode: 'SAVE10'}));
  assert.notEqual(requestFingerprint(base), requestFingerprint({...base, planSlug: 'suite'}));
});

test('a paid term lasts the configured period and then ends', () => {
  assert.equal(termDaysFor('PER_MONTH', null, 1), 30);
  assert.equal(termDaysFor('PER_MONTH', 45, 1), 45);
  assert.equal(termDaysFor('PER_YEAR', null, 1), 365);
  assert.equal(termDaysFor('PER_DAY', null, 3), 3);
  /* An hourly room booking is a reservation, not a period of access. */
  assert.equal(termDaysFor('PER_HOUR', null, 2), null);
  assert.equal(termDaysFor('ONE_TIME', null, 1), null);
  const start = new Date('2026-11-08T00:00:00Z');
  assert.equal(termEndFor(start, 30)!.toISOString(), '2026-12-08T00:00:00.000Z');
  assert.equal(termEndFor(start, null), null);
  assert.equal(finiteAccessStatus(new Date('2026-12-08T00:00:00Z'), start), 'ACTIVE');
  assert.equal(finiteAccessStatus(new Date('2026-11-07T00:00:00Z'), start), 'ENDED');
});

test('provider failures are translated without disclosing provider internals', () => {
  const declined = describeProviderError({type: 'StripeCardError', code: 'card_declined', message: 'Your card was declined by acct_123 using api 2026-01-01'});
  assert.equal(declined.status, 402);
  assert.equal(declined.code, 'card_declined');
  assert.doesNotMatch(declined.message, /acct_|api|2026-01-01/);
  assert.equal(describeProviderError({type: 'StripeCardError', code: 'expired_card'}).code, 'expired_card');
  assert.equal(describeProviderError({type: 'StripeConnectionError'}).status, 503);
  assert.equal(describeProviderError(new Error('boom')).code, 'payment_failed');
  for (const sample of [{type: 'StripeCardError', code: 'card_declined'}, {type: 'StripeAPIError'}, new Error('internal: secret sk_live_x')]) {
    assert.doesNotMatch(describeProviderError(sample).message, /sk_live|secret|boom|internal/i);
  }
});

test('a subscription secret is read from the first invoice, or a setup intent when nothing is due', () => {
  assert.deepEqual(subscriptionClientSecret({latest_invoice: {confirmation_secret: {client_secret: 'cs_1'}}} as never), {intentType: 'payment', clientSecret: 'cs_1'});
  assert.deepEqual(subscriptionClientSecret({latest_invoice: null, pending_setup_intent: {client_secret: 'seti_1'}} as never), {intentType: 'setup', clientSecret: 'seti_1'});
  assert.equal(subscriptionClientSecret({} as never).clientSecret, null);
});

/* ───────────────────────────── Service behaviour ───────────────────────────── */

const monthlyPlan = {
  id: 'plan-silver',
  slug: 'coworking-silver',
  name: 'Silver',
  description: '5 days of coworking access per month.',
  unitAmountCents: 10000,
  currency: 'usd',
  billingUnit: 'PER_MONTH',
  durationDays: 30,
  minQuantity: 1,
  maxQuantity: 1,
  active: true,
  archivedAt: null,
  metadata: {includedCredits: [{kind: 'COWORKING_DAY', amount: 5}]},
  planAddOns: [],
  service: {id: 'svc', slug: 'coworking', name: 'Co-Working', active: true, archivedAt: null, flowType: 'STANDARD', serviceAddOns: [], serviceAmenities: []},
};

function harness(plan: Record<string, unknown> = monthlyPlan) {
  clearCatalogCache();
  const db = fakeDb();
  Object.assign(db, {catalogPlan: {findFirst: async () => plan}, serviceCategory: {findMany: async () => [], count: async () => 1}});
  const stripe = stripeFixture();
  const billing = new BillingService(db, stripe as never);
  const catalog = new CatalogService(db, billing);
  const payments = new DirectPaymentsService(db, catalog, billing, stripe as never);
  const webhooks = new BillingWebhookService(db, billing);
  return {db, stripe, billing, catalog, payments, webhooks};
}

const buyer = {customerName: 'Fixture Buyer', customerEmail: 'buyer@example.invalid', acceptTerms: true};
const attempt = () => ({idempotencyKey: randomBytes(16).toString('hex'), checkoutToken: randomBytes(32).toString('hex')});

test('an unticked renewal box charges once and creates no Stripe subscription', async () => {
  const {payments, stripe, db} = harness();
  const context = attempt();
  const result = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, context);

  assert.equal(result.autoRenew, false);
  assert.equal(result.intentType, 'payment');
  assert.equal(result.amount, 10000);
  assert.equal(result.recurringAmount, 0, 'a non-renewing purchase must advertise no future charge');
  assert.ok(result.clientSecret);
  assert.equal(stripe.calls.filter(call => call.kind === 'subscriptions.create').length, 0);
  assert.equal(stripe.calls.filter(call => call.kind === 'paymentIntents.create').length, 1);

  const order = await db.order.findUnique({where: {id: result.orderId}});
  assert.equal(order.autoRenew, false);
  assert.equal(order.recurringConsentAt, null);
  assert.equal(order.status, 'PENDING', 'nothing is paid until the verified webhook says so');
  /* The raw capability is never stored. */
  assert.notEqual(order.checkoutTokenHash, context.checkoutToken);
});

test('an explicit renewal creates a Stripe subscription that stores the mandate', async () => {
  const {payments, stripe, db} = harness();
  const result = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug, autoRenew: true, acceptRecurringTerms: true} as never, attempt());

  assert.equal(result.autoRenew, true);
  assert.equal(result.recurringAmount, 10000);
  assert.match(result.recurringDescription!, /month/);
  assert.ok(result.clientSecret);
  const created = stripe.calls.find(call => call.kind === 'subscriptions.create')!.input as Record<string, any>;
  assert.equal(created.payment_behavior, 'default_incomplete');
  assert.equal(created.payment_settings.save_default_payment_method, 'on_subscription');
  assert.equal(created.metadata.orderId, result.orderId);
  const order = await db.order.findUnique({where: {id: result.orderId}});
  assert.ok(order.recurringConsentAt, 'the consent moment is recorded');
  assert.ok(order.stripeDirectSubscriptionId);
});

test('renewal is refused without the recurring terms, and on a package that does not renew', async () => {
  const {payments} = harness();
  await assert.rejects(() => payments.createIntent({...buyer, planSlug: monthlyPlan.slug, autoRenew: true} as never, attempt()), /renewal terms/);
  const hourly = {...monthlyPlan, slug: 'studio-hour', billingUnit: 'PER_HOUR', durationDays: null, maxQuantity: 8};
  const {payments: hourlyPayments} = harness(hourly);
  await assert.rejects(
    () => hourlyPayments.createIntent({...buyer, planSlug: hourly.slug, autoRenew: true, acceptRecurringTerms: true, startAt: '2027-01-10T15:00:00Z'} as never, attempt()),
    /not sold as a renewing subscription/,
  );
});

test('the terms must be accepted and a scheduled package still needs its date', async () => {
  const {payments} = harness();
  await assert.rejects(() => payments.createIntent({customerName: 'X', customerEmail: 'x@example.invalid', planSlug: monthlyPlan.slug} as never, attempt()), /Terms of Use/);
  const hourly = {...monthlyPlan, slug: 'studio-hour', billingUnit: 'PER_HOUR', durationDays: null, maxQuantity: 8};
  const {payments: hourlyPayments} = harness(hourly);
  await assert.rejects(() => hourlyPayments.createIntent({...buyer, planSlug: hourly.slug} as never, attempt()), /date and time/);
});

test('an amount sent by the browser cannot change what is charged', async () => {
  const {payments, stripe} = harness();
  const result = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug, unitAmountCents: 1, amount: 1, dueNowAmount: 1} as never, attempt());
  assert.equal(result.amount, 10000);
  const intent = stripe.calls.find(call => call.kind === 'paymentIntents.create')!.input as Record<string, any>;
  assert.equal(intent.amount, 10000);
});

test('a repeated attempt returns the same order instead of charging twice', async () => {
  const {payments, stripe} = harness();
  const context = attempt();
  const first = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, context);
  const second = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, context);
  assert.equal(second.orderId, first.orderId);
  assert.equal(stripe.calls.filter(call => call.kind === 'paymentIntents.create').length, 1, 'a retry must not create a second charge');
  assert.ok(second.clientSecret);

  /* Reusing a key for a different purchase is refused outright. */
  await assert.rejects(() => payments.createIntent({...buyer, planSlug: monthlyPlan.slug, autoRenew: true, acceptRecurringTerms: true} as never, context), /different selection/);
});

test('parallel submissions of one attempt converge on a single order', async () => {
  const {payments, stripe} = harness();
  const context = attempt();
  const [a, b] = await Promise.all([
    payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, context),
    payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, context),
  ]);
  assert.equal(a.orderId, b.orderId);
  assert.equal(a.clientSecret, b.clientSecret);
  /* The provider's idempotency key collapses the duplicate into one intent. */
  assert.equal(stripe.paymentIntents.size, 1, 'a race must never create a second charge');
});

test('an order can only be read back with the capability minted for it', async () => {
  const {payments} = harness();
  const context = attempt();
  const created = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, context);

  const status = await payments.readOrder(created.orderId, context.checkoutToken);
  assert.equal(status.id, created.orderId);
  assert.equal(status.processing, true);
  assert.equal(status.autoRenew, false);
  assert.equal(Object.keys(status).includes('manageToken'), false, 'a guest read must never mint account access');

  for (const bad of [undefined, null, '', 'nope', randomBytes(32).toString('hex')]) {
    await assert.rejects(() => payments.readOrder(created.orderId, bad), /could not find/);
  }
  /* A valid token for one order discloses nothing about another. */
  const other = attempt();
  const second = await payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, other);
  await assert.rejects(() => payments.readOrder(second.orderId, context.checkoutToken), /could not find/);
});

test('a declined card leaves the attempt payable and never activates anything', async () => {
  const {payments, stripe, db} = harness();
  stripe.failPaymentIntent = true;
  await assert.rejects(() => payments.createIntent({...buyer, planSlug: monthlyPlan.slug} as never, attempt()), (error: any) => {
    const body = error.getResponse();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'card_declined');
    assert.equal(body.data, null);
    return true;
  });
  assert.equal(db.subscription.rows.length, 0);
  assert.equal(db.order.rows.every((row: any) => row.status !== 'PAID'), true);
});

/* ───────────────────────────── Payment confirmation ───────────────────────────── */

async function paidOnce(harnessed: ReturnType<typeof harness>, overrides: Record<string, unknown> = {}) {
  const context = attempt();
  const created = await harnessed.payments.createIntent({...buyer, planSlug: monthlyPlan.slug, ...overrides} as never, context);
  const order = await harnessed.db.order.findUnique({where: {id: created.orderId}});
  const intent = {
    id: order.stripePaymentIntentId,
    object: 'payment_intent',
    status: 'succeeded',
    amount: order.dueNowAmount,
    amount_received: order.dueNowAmount,
    currency: order.currency,
    metadata: {orderId: order.id, customerId: order.customerId},
  };
  return {context, created, order, intent};
}

test('only a verified payment event marks an order paid and opens the paid term', async () => {
  const kit = harness();
  const {created, intent, context} = await paidOnce(kit);
  await kit.webhooks.process(makeEvent('payment_intent.succeeded', intent) as never);

  const order = await kit.db.order.findUnique({where: {id: created.orderId}});
  assert.equal(order.status, 'PAID');
  const term = kit.db.subscription.rows[0];
  assert.equal(term.autoRenew, false);
  assert.equal(term.stripeSubscriptionId, null, 'a non-renewing purchase has no Stripe subscription');
  assert.equal(term.accessStatus, 'ACTIVE');
  assert.equal(Math.round((term.paidThrough.getTime() - term.currentPeriodStart.getTime()) / 86400000), 30);
  assert.equal(kit.db.entitlementEntry.rows.length, 1);
  assert.equal(kit.db.entitlementEntry.rows[0].delta, 5);

  const status = await kit.payments.readOrder(created.orderId, context.checkoutToken);
  assert.equal(status.processing, false);
  assert.equal(status.subscriptions[0].renews, false);
  assert.ok(status.currentPeriodEnd);
});

test('a replayed or duplicated payment event never grants twice', async () => {
  const kit = harness();
  const {created, intent} = await paidOnce(kit);
  const event = makeEvent('payment_intent.succeeded', intent);
  assert.equal(await kit.webhooks.process(event as never), 'processed');
  assert.equal(await kit.webhooks.process(event as never), 'duplicate');
  /* A different event id carrying the same intent must also be harmless. */
  await kit.webhooks.process(makeEvent('payment_intent.succeeded', intent) as never);

  assert.equal(kit.db.subscription.rows.filter((row: any) => row.orderId === created.orderId).length, 1);
  assert.equal(kit.db.entitlementEntry.rows.length, 1);
  assert.equal(kit.db.billingEvent.rows.filter((row: any) => row.action === 'ORDER_PAID').length, 1);
});

test('a payment event that does not match the order is ignored', async () => {
  const kit = harness();
  const {created, intent} = await paidOnce(kit);

  await kit.webhooks.process(makeEvent('payment_intent.succeeded', {...intent, id: 'pi_someone_else'}) as never);
  await kit.webhooks.process(makeEvent('payment_intent.succeeded', {...intent, amount_received: 1}) as never);
  await kit.webhooks.process(makeEvent('payment_intent.succeeded', {...intent, currency: 'eur'}) as never);
  await kit.webhooks.process(makeEvent('payment_intent.succeeded', {...intent, metadata: {orderId: 'not-an-order'}}) as never);

  const order = await kit.db.order.findUnique({where: {id: created.orderId}});
  assert.equal(order.status, 'PENDING');
  assert.equal(kit.db.subscription.rows.length, 0);
});

test('a failed payment keeps the order payable; a cancelled one closes it', async () => {
  const kit = harness();
  const {created, intent} = await paidOnce(kit);
  await kit.webhooks.process(makeEvent('payment_intent.payment_failed', {...intent, status: 'requires_payment_method', amount_received: 0, last_payment_error: {code: 'card_declined'}}) as never);
  let order = await kit.db.order.findUnique({where: {id: created.orderId}});
  assert.equal(order.status, 'PENDING', 'a decline must let the customer retry on the same order');

  await kit.webhooks.process(makeEvent('payment_intent.canceled', {...intent, status: 'canceled', amount_received: 0}) as never);
  order = await kit.db.order.findUnique({where: {id: created.orderId}});
  assert.equal(order.status, 'CANCELLED');
  assert.equal(kit.db.subscription.rows.length, 0);
});

test('the billing webhook only claims payment events that carry an order', () => {
  assert.equal(BillingWebhookService.handles(makeEvent('payment_intent.succeeded', {metadata: {orderId: 'o1'}}) as never), true);
  assert.equal(BillingWebhookService.handles(makeEvent('payment_intent.succeeded', {metadata: {}}) as never), false);
});

/* ───────────────────────────── Lifecycle ───────────────────────────── */

test('a finite paid term has no renewal to cancel and expires on its own', async () => {
  const kit = harness();
  const {intent} = await paidOnce(kit);
  await kit.webhooks.process(makeEvent('payment_intent.succeeded', intent) as never);
  const term = kit.db.subscription.rows[0];

  await assert.rejects(() => kit.billing.cancelSubscription(term.id, 'PERIOD_END', {type: 'CUSTOMER'}), /does not renew/);
  await assert.rejects(() => kit.billing.withdrawCancellation(term.id, {type: 'CUSTOMER'}), /no renewal to resume/);
  /* Access is kept for the whole paid period and is never charged again. */
  assert.equal(kit.billing.subscriptionView(term as never).accessStatus, 'ACTIVE');
  assert.equal(kit.billing.subscriptionView(term as never).renewsAt, null);
  assert.equal(kit.stripe.calls.some(call => call.kind === 'subscriptions.cancel'), false);

  assert.equal(await kit.billing.expirePaidTerms(new Date(Date.now() - 86400000)), 0);
  assert.equal(await kit.billing.expirePaidTerms(new Date(Date.now() + 31 * 86400000)), 1);
  assert.equal(kit.db.subscription.rows[0].accessStatus, 'ENDED');
});

test('an unpaid attempt can be abandoned, a paid one cannot', async () => {
  const kit = harness();
  const {created, context, intent} = await paidOnce(kit);
  const cancelled = await kit.payments.cancelOrder(created.orderId, context.checkoutToken);
  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(kit.stripe.calls.some(call => call.kind === 'paymentIntents.cancel'), true);

  const second = harness();
  const paid = await paidOnce(second);
  await second.webhooks.process(makeEvent('payment_intent.succeeded', paid.intent) as never);
  await assert.rejects(() => second.payments.cancelOrder(paid.created.orderId, paid.context.checkoutToken), /already completed/);
  await assert.rejects(() => second.payments.cancelOrder(paid.created.orderId, randomBytes(32).toString('hex')), /could not find/);
  void intent;
});

test('guest checkout never overwrites an existing customer profile', async () => {
  const kit = harness();
  await kit.db.customer.create({data: {email: 'known@example.invalid', name: 'Real Name', phone: '+1 555 0100'}});
  await kit.billing.customerForGuest('Known@example.invalid', 'Impostor', '+1 555 9999');
  const stored = await kit.db.customer.findUnique({where: {email: 'known@example.invalid'}});
  assert.equal(stored.name, 'Real Name');
  assert.equal(stored.phone, '+1 555 0100');

  /* A blank profile is still completed, and a new buyer is created normally. */
  await kit.db.customer.create({data: {email: 'blank@example.invalid', name: 'blank@example.invalid', phone: null}});
  await kit.billing.customerForGuest('blank@example.invalid', 'Given Name', '+1 555 0111');
  const filled = await kit.db.customer.findUnique({where: {email: 'blank@example.invalid'}});
  assert.equal(filled.name, 'Given Name');
  assert.equal(filled.phone, '+1 555 0111');
  const fresh = await kit.billing.customerForGuest('new@example.invalid', 'New Buyer');
  assert.equal(fresh.name, 'New Buyer');
});
