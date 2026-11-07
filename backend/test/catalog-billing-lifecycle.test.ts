import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BillingService, PlanAdminController, PublicBillingController} from '../src/billing';
import {cachedCatalog} from '../src/catalog-cache';
import {fakeDb, makeStripeSubscription, stripeFixture} from './billing-fixture';

const legacyPlan = {
  id: 'legacy-plan', slug: 'coworking-monthly', name: 'Legacy Coworking', serviceType: 'coworking',
  description: 'Legacy monthly package', billingType: 'RECURRING', interval: 'MONTH', intervalCount: 1,
  unitAmount: 1000, currency: 'usd', pricingUnit: 'PACKAGE', minQuantity: 1, maxQuantity: 1,
  active: true, archivedAt: null, includedCredits: [{kind: 'COWORKING_DAY', amount: 1}],
};
const buyer = {customerName: 'Offline Buyer', customerEmail: 'buyer@example.invalid'};
const dto = {...buyer, items: [{planSlug: legacyPlan.slug}], paymentMethod: 'MANUAL' as const, acceptRecurringTerms: true};
const adminUser = {user: {id: 'admin', email: 'admin@example.invalid'}};
const purchasedSnapshot = {
  id: 'catalog-plan', slug: legacyPlan.slug, name: 'Five Coworking Days', serviceType: 'coworking',
  includedCredits: [{kind: 'COWORKING_DAY', amount: 5, resetInterval: 'MONTH'}],
};

async function harness() {
  PublicBillingController.clearCache();
  const db = fakeDb();
  await db.plan.create({data: {...legacyPlan, metadata: {legacyMapping: 'preserve-me'}}});
  const stripe = stripeFixture();
  const billing = new BillingService(db, stripe as never);
  return {db, stripe, billing, publicApi: new PublicBillingController(db, billing), admin: new PlanAdminController(db, billing)};
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {resolve = done;});
  return {promise, resolve};
}

for (const state of ['published', 'inactive', 'archived', 'inactive-parent'] as const) {
  test(`legacy quote and checkout reject catalog-owned slug (${state}) before legacy lookup`, async () => {
    const h = await harness();
    const lookups: unknown[] = [];
    h.db.catalogPlan = {async findFirst(args: unknown) {
      lookups.push(args);
      return {id: 'catalog', active: state !== 'inactive', archivedAt: state === 'archived' ? new Date() : null,
        service: {active: state !== 'inactive-parent'}};
    }};
    let legacyReads = 0;
    h.db.plan.findFirst = async () => {legacyReads++; return legacyPlan;};
    for (const operation of [() => h.publicApi.quote(dto), () => h.publicApi.checkout(dto)]) {
      await assert.rejects(operation, (error: any) => {
        assert.match(JSON.stringify(error.response?.message ?? error.message), /catalog checkout/i);
        return true;
      });
    }
    assert.deepEqual(lookups, Array(2).fill({where: {slug: legacyPlan.slug}, select: {id: true}}));
    assert.equal(legacyReads, 0);
    assert.equal(h.db.order.rows.length, 0);
    assert.equal(h.stripe.calls.length, 0);
  });
}

test('catalog ownership is checked independently for every requested item', async () => {
  const h = await harness();
  const order: string[] = [];
  h.db.catalogPlan = {async findFirst({where}: any) {
    order.push('catalog:' + where.slug);
    return where.slug === 'owned' ? {id: 'owned'} : null;
  }};
  h.db.plan.findFirst = async ({where}: any) => {order.push('legacy:' + where.slug); return legacyPlan;};
  await assert.rejects(h.billing.priceCheckout({...dto, items: [{planSlug: legacyPlan.slug}, {planSlug: 'owned'}]}));
  assert.deepEqual(order, ['catalog:' + legacyPlan.slug, 'legacy:' + legacyPlan.slug, 'catalog:owned']);
});

for (const hasDelegate of [false, true]) {
  test(`legacy-only manual checkout works ${hasDelegate ? 'with an empty' : 'without a'} catalog delegate`, async () => {
    const h = await harness();
    if (hasDelegate) h.db.catalogPlan = {async findFirst() {return null;}};
    const quote = await h.publicApi.quote(dto);
    assert.equal(quote.dueNowAmount, legacyPlan.unitAmount);
    const checkout = await h.publicApi.checkout(dto);
    assert.equal(checkout.status, 'pending_manual_payment');
    assert.equal(h.db.orderItem.rows[0].planId, legacyPlan.id);
    assert.equal(h.stripe.calls.length, 0);
  });
}

async function catalogPurchase(h: Awaited<ReturnType<typeof harness>>) {
  const priced = await h.billing.totalsFor([{
    planId: null, slug: purchasedSnapshot.slug, name: purchasedSnapshot.name, description: 'Configured benefit',
    currency: 'usd', unitAmount: 9000, quantity: 1, amount: 9000, billingType: 'RECURRING',
    interval: 'MONTH', intervalCount: 1, metadata: {lineKind: 'MAIN', catalogPlan: structuredClone(purchasedSnapshot)},
  }]);
  const checkout = await h.billing.createCheckout(dto, priced);
  const order = h.db.order.rows.find((row: any) => row.id === checkout.orderId);
  const sub = makeStripeSubscription({id: 'stripe-catalog-sub', customer: 'offline-customer', periodStart: 1800000000,
    periodEnd: 1802592000, metadata: {orderId: order.id, customerId: order.customerId}});
  return {order, sub};
}

test('catalog identity and purchased credits survive renewal and later order/catalog price edits', async () => {
  const h = await harness();
  const {order, sub} = await catalogPurchase(h);
  const saved = await h.billing.syncSubscription(sub as never);
  assert.ok(saved);
  assert.equal(saved.planId, null);
  assert.deepEqual(saved.metadata.catalogPlan, purchasedSnapshot);
  assert.deepEqual(h.db.orderItem.rows[0].metadata.catalogPlan, purchasedSnapshot);
  assert.equal(h.billing.subscriptionView(saved).planName, purchasedSnapshot.name);
  assert.equal(h.billing.subscriptionView(saved).serviceType, 'coworking');
  await h.billing.grantEntitlements(saved.id, 'invoice-initial');
  await h.billing.grantEntitlements(saved.id, 'invoice-initial');
  assert.deepEqual(h.db.entitlementEntry.rows.map((row: any) => row.delta), [5]);
  saved.metadata.unrelated = {keep: true};
  h.db.orderItem.rows[0].metadata.catalogPlan.name = 'Edited name';
  h.db.orderItem.rows[0].metadata.catalogPlan.includedCredits[0].amount = 99;
  h.db.catalogPlan = {async findFirst() {throw new Error('Renewal must not read current catalog');}};
  const nextSub = makeStripeSubscription({id: sub.id, customer: 'offline-customer', periodStart: 1802592000,
    periodEnd: 1805184000, unitAmount: 12000, metadata: {orderId: order.id}});
  let orderReads = 0;
  h.db.orderItem.findFirst = async () => {orderReads++; throw new Error('Existing snapshot must be immutable');};
  const renewed = await h.billing.syncSubscription(nextSub as never);
  assert.deepEqual(renewed!.metadata, {catalogPlan: purchasedSnapshot, unrelated: {keep: true}});
  assert.equal(orderReads, 0);
  await h.billing.grantEntitlements(saved.id, 'invoice-renewal');
  await h.billing.grantEntitlements(saved.id, 'invoice-renewal');
  assert.deepEqual(h.db.entitlementEntry.rows.map((row: any) => row.delta), [5, 5]);
  assert.equal(h.billing.subscriptionView(renewed!).planName, purchasedSnapshot.name);
  assert.equal(renewed!.unitAmount, 12000);
  assert.equal(h.stripe.calls.length, 0);
});

test('initial snapshot sync preserves unrelated existing metadata', async () => {
  const h = await harness();
  const {order, sub} = await catalogPurchase(h);
  await h.db.subscription.create({data: {stripeSubscriptionId: sub.id, customerId: order.customerId,
    orderId: order.id, planId: null, metadata: {migration: 'keep'}}});
  const saved = await h.billing.syncSubscription(sub as never);
  assert.deepEqual(saved!.metadata, {migration: 'keep', catalogPlan: purchasedSnapshot});
});

test('legacy entitlements retain precedence and subscriptions without snapshots invent no benefits', async () => {
  const h = await harness();
  const legacy = await h.db.subscription.create({data: {customerId: 'customer', planId: legacyPlan.id,
    stripeSubscriptionId: 'legacy-sub', metadata: {catalogPlan: purchasedSnapshot}}});
  await h.billing.grantEntitlements(legacy.id, 'legacy-invoice');
  const missing = await h.db.subscription.create({data: {customerId: 'customer', planId: null, stripeSubscriptionId: 'missing-sub'}});
  await h.billing.grantEntitlements(missing.id, 'missing-invoice');
  assert.deepEqual(h.db.entitlementEntry.rows.map((row: any) => row.delta), [1]);
  assert.equal(h.billing.subscriptionView(missing).planName, 'Subscription');
  assert.equal(h.billing.subscriptionView(missing).serviceType, null);
});

test('unlimited catalog benefits use existing grant semantics and remain idempotent', async () => {
  const h = await harness();
  const subscription = await h.db.subscription.create({data: {customerId: 'customer', planId: null, stripeSubscriptionId: 'unlimited',
    metadata: {catalogPlan: {...purchasedSnapshot, includedCredits: [{kind: 'COWORKING_DAY', unlimited: true}]}}}});
  await h.billing.grantEntitlements(subscription.id, 'paid-period');
  await h.billing.grantEntitlements(subscription.id, 'paid-period');
  assert.equal(h.db.entitlementEntry.rows.length, 1);
  assert.equal(h.db.entitlementEntry.rows[0].delta, 0);
  assert.match(h.db.entitlementEntry.rows[0].reason, /Unlimited/);
});

test('admin mutations invalidate public plans and catalog projections and omission preserves plan metadata', async () => {
  const h = await harness();
  let projections = 0;
  const projection = () => cachedCatalog('legacy-projection', async () => ++projections);
  let previousPlans = await h.publicApi.plans();
  assert.equal(await projection(), 1);
  const changed = {...legacyPlan, name: 'Repriced', unitAmount: 2000};
  await h.admin.update(legacyPlan.id, changed as never, adminUser);
  assert.deepEqual(h.db.plan.rows[0].metadata, {legacyMapping: 'preserve-me'});
  let nextPlans = await h.publicApi.plans();
  assert.notStrictEqual(nextPlans, previousPlans);
  assert.equal(nextPlans.items[0].unitAmount, 2000);
  assert.equal(await projection(), 2);
  previousPlans = nextPlans;
  const created = await h.admin.create({...legacyPlan, slug: 'new-plan'} as never, adminUser);
  nextPlans = await h.publicApi.plans();
  assert.notStrictEqual(nextPlans, previousPlans);
  assert.equal(await projection(), 3);
  await h.admin.archive(created.id, adminUser);
  assert.equal((await h.publicApi.plans()).items.length, 1);
  assert.equal(await projection(), 4);
});

test('public plans cache is bounded to 200 entries, expires at 30 seconds and keeps all/service keys distinct', async () => {
  const h = await harness();
  const originalNow = Date.now;
  let now = 1800000000000;
  Date.now = () => now;
  let reads = 0;
  h.db.plan.findMany = async () => {reads++; return [];};
  try {
    for (let i = 0; i <= 200; i++) await h.publicApi.plans('service-' + i);
    assert.equal(reads, 201);
    await h.publicApi.plans('service-1');
    assert.equal(reads, 201);
    await h.publicApi.plans('service-0');
    assert.equal(reads, 202);
    PublicBillingController.clearCache();
    const all = await h.publicApi.plans();
    const namedAll = await h.publicApi.plans('__all__');
    assert.notStrictEqual(all, namedAll);
    now += 29999;
    assert.strictEqual(await h.publicApi.plans(), all);
    now++;
    assert.notStrictEqual(await h.publicApi.plans(), all);
    assert.equal(reads, 205);
  } finally {Date.now = originalNow; PublicBillingController.clearCache();}
});

test('clear during in-flight public plans read cannot repopulate or overwrite fresh cache', async () => {
  const h = await harness();
  const pending = deferred<any[]>();
  let reads = 0;
  h.db.plan.findMany = async () => ++reads === 1 ? pending.promise : [{...legacyPlan, name: 'Fresh'}];
  const oldRead = h.publicApi.plans();
  PublicBillingController.clearCache();
  const fresh = await h.publicApi.plans();
  pending.resolve([{...legacyPlan, name: 'Stale'}]);
  assert.equal((await oldRead).items[0].name, 'Stale');
  assert.strictEqual(await h.publicApi.plans(), fresh);
  assert.equal(reads, 2);

  PublicBillingController.clearCache();
  const second = deferred<any[]>();
  h.db.plan.findMany = () => second.promise;
  const staleRead = h.publicApi.plans();
  PublicBillingController.clearCache();
  second.resolve([legacyPlan]);
  await staleRead;
  h.db.plan.findMany = async () => {reads++; return [];};
  assert.deepEqual((await h.publicApi.plans()).items, []);
  assert.equal(reads, 3);
});
