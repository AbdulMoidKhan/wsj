import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatalogService, clearCatalogCache} from '../src/catalog';
import {cachedCatalog} from '../src/catalog-cache';
import {BillingService} from '../src/billing';
import {BILLING_UNITS, resolveUnits} from '../src/catalog-core';
import {fakeDb, stripeFixture} from './billing-fixture';

const legacyPlan = {
 id: 'legacy-plan', slug: 'quarterly-desk', name: 'Quarterly Desk', serviceType: 'coworking', description: 'A quarterly desk',
 billingType: 'RECURRING', interval: 'MONTH', intervalCount: 3, unitAmount: 9000, currency: 'usd', pricingUnit: 'PACKAGE',
 minQuantity: 1, maxQuantity: 1, requiresSchedule: false, requiresResource: false, active: true, archivedAt: null, metadata: {},
};
async function legacyHarness(overrides: Record<string, unknown> = {}) {
 clearCatalogCache();
 const db = fakeDb();
 await db.plan.create({data: {...legacyPlan, ...overrides}});
 Object.assign(db, {catalogPlan: {findFirst: async () => null}, serviceCategory: {findMany: async () => [], count: async () => 0}});
 const billing = new BillingService(db, stripeFixture() as never);
 const recorded: Array<{dto: any; priced: any}> = [];
 billing.createCheckout = async (dto: any, priced: any) => {recorded.push({dto, priced}); return {accepted: true} as never;};
 return {catalog: new CatalogService(db, billing), recorded};
}
const customer = {customerName: 'Fixture', customerEmail: 'fixture@example.invalid', acceptRecurringTerms: true};

test('legacy catalog quote and checkout preserve the configured multi-month interval', async () => {
 const {catalog, recorded} = await legacyHarness();
 const quote = await catalog.quote({planSlug: legacyPlan.slug});
 assert.match(quote.recurringDescription!, /3 months/);
 await catalog.checkout({...customer, planSlug: legacyPlan.slug});
 assert.equal(recorded[0].priced.lines[0].intervalCount, 3);
 assert.equal(recorded[0].priced.lines[0].planId, legacyPlan.id);
});

test('legacy PACKAGE scheduling and resource requirements cannot be bypassed', async () => {
 const {catalog, recorded} = await legacyHarness({requiresSchedule: true, requiresResource: true});
 await assert.rejects(() => catalog.checkout({...customer, planSlug: legacyPlan.slug}), /date and time/);
 await assert.rejects(() => catalog.checkout({...customer, planSlug: legacyPlan.slug, startAt: '2027-01-10T15:00:00Z'}), (error: any) => JSON.stringify(error.getResponse()).includes('resource selection'));
 await catalog.checkout({...customer, planSlug: legacyPlan.slug, startAt: '2027-01-10T15:00:00Z', resourceId: 'fixture-room'});
 assert.equal(recorded.length, 1);
 assert.equal(recorded[0].dto.items[0].resourceId, 'fixture-room');
 assert.equal(recorded[0].dto.items[0].startAt, '2027-01-10T15:00:00Z');
});

test('legacy unscheduled package still rejects an unexpected schedule', async () => {
 const {catalog, recorded} = await legacyHarness();
 await assert.rejects(() => catalog.checkout({...customer, planSlug: legacyPlan.slug, startAt: '2027-01-10T15:00:00Z'}), (error: any) => JSON.stringify(error.getResponse()).includes('does not take a date and time'));
 assert.equal(recorded.length, 0);
});

test('explicit zero deselects optional add-ons for every billing unit', () => {
 for (const billingUnit of BILLING_UNITS) {
  const entry = {name: 'Optional', unitAmountCents: 1000, billingUnit, minQuantity: 0, maxQuantity: 1};
  assert.equal(resolveUnits(entry, {quantity: 0, durationHours: 2, days: 3}, {allowZero: true}), 0, billingUnit);
 }
});

test('an additional-hour add-on uses its own selected hours, not package hours', async () => {
 const db = fakeDb();
 const addOn = {slug: 'extension', name: 'Additional Hour', unitAmountCents: 7000, currency: 'usd', billingUnit: 'PER_HOUR', minQuantity: 0, maxQuantity: 12, defaultQuantity: 1, active: true, archivedAt: null};
 const service = {id: 'service', slug: 'studio', name: 'Studio', active: true, archivedAt: null, flowType: 'STANDARD', serviceAddOns: [{addOnId: 'extension', addOn, isRequired: false, priceOverrideCents: null, sortOrder: 0}]};
 const plan = {id: 'studio-plan', slug: 'studio-hour', name: 'Studio Hour', description: '', unitAmountCents: 7500, currency: 'usd', billingUnit: 'PER_HOUR', minQuantity: 1, maxQuantity: 24, active: true, archivedAt: null, metadata: {}, service, planAddOns: []};
 Object.assign(db, {catalogPlan: {findFirst: async () => plan}});
 const catalog = new CatalogService(db, new BillingService(db, stripeFixture() as never));
 const quote = await catalog.quote({planSlug: plan.slug, durationHours: 2, addOns: [{slug: addOn.slug, quantity: 1}]});
 assert.equal(quote.items.find(item => item.kind === 'PLAN')?.units, 2);
 assert.equal(quote.items.find(item => item.kind === 'ADDON')?.units, 1);
 assert.equal(quote.totalAmount, 22000);
 const deselected = await catalog.quote({planSlug: plan.slug, durationHours: 2, addOns: [{slug: addOn.slug, quantity: 0}]});
 assert.equal(deselected.items.length, 1);
 assert.equal(deselected.totalAmount, 15000);
});

test('inactive catalog service and plan cannot fall back to a legacy lookalike', async () => {
 const db = fakeDb();
 await db.plan.create({data: legacyPlan});
 Object.assign(db, {
  serviceCategory: {findMany: async () => [], count: async () => 1, findFirst: async () => ({slug: 'coworking', active: false})},
  catalogPlan: {findFirst: async () => ({slug: legacyPlan.slug, active: true, archivedAt: null, service: {slug: 'coworking', active: false}})},
 });
 const catalog = new CatalogService(db, {} as never);
 clearCatalogCache();
 const list = await catalog.publicServices();
 assert.equal(list.source, 'CATALOG');
 assert.deepEqual(list.items, []);
 await assert.rejects(() => catalog.publicService('coworking'), /Unknown service/);
 await assert.rejects(() => catalog.publicPlan(legacyPlan.slug), /Unknown package/);
});

test('clearing catalog cache during a pending read prevents stale repopulation', async () => {
 clearCatalogCache();
 let resolve!: (value: string) => void;
 const pending = cachedCatalog('fixture', () => new Promise<string>(done => {resolve = done;}));
 clearCatalogCache(); resolve('old');
 assert.equal(await pending, 'old');
 assert.equal(await cachedCatalog('fixture', async () => 'new'), 'new');
});
