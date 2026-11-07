import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatalogService, clearCatalogCache} from '../src/catalog';
import {BILLING_TERMS_VERSION} from '../src/billing-core';

const summaryQuery = {
  where: {active: true, archivedAt: null},
  orderBy: [{displayOrder: 'asc'}, {name: 'asc'}],
  select: {
    slug: true,
    name: true,
    description: true,
    categoryBadge: true,
    iconName: true,
    heroImageUrl: true,
    displayOrder: true,
    flowType: true,
    customSteps: true,
    metadata: true,
    plans: {
      where: {active: true, archivedAt: null},
      orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}],
      select: {active: true, archivedAt: true, unitAmountCents: true, currency: true},
    },
    serviceAddOns: {select: {addOn: {select: {active: true, archivedAt: true}}}},
  },
};

/** Minimal projected records, deliberately missing full plan/add-on fields. */
const coworking = {
  slug: 'coworking',
  name: 'Coworking',
  description: 'Shared workspaces',
  categoryBadge: 'Flexible',
  iconName: 'Desk',
  heroImageUrl: '/coworking.webp',
  displayOrder: 2,
  flowType: 'STANDARD',
  customSteps: ['PLAN', 'ADDONS'],
  metadata: {nested: {featured: true}, labels: ['quiet', 'shared'], zero: 0},
  plans: [
    // The first plan in sortOrder order supplies currency, not the cheapest.
    {active: true, archivedAt: null, unitAmountCents: 900, currency: 'eur'},
    {active: true, archivedAt: null, unitAmountCents: 0, currency: 'usd'},
    {active: true, archivedAt: null, unitAmountCents: 400, currency: 'gbp'},
  ],
  serviceAddOns: [
    {addOn: {active: true, archivedAt: null}},
    {addOn: {active: true, archivedAt: null}},
    {addOn: {active: false, archivedAt: null}},
    {addOn: {active: true, archivedAt: new Date('2026-01-01')}},
    {addOn: null},
  ],
};

function harness(services: unknown[] = [], legacyPlans: unknown[] = [], checkProjection = true, catalogRows = services.length) {
  clearCatalogCache();
  const calls = {services: [] as unknown[], legacy: [] as unknown[], count: 0};
  const db = {
    serviceCategory: {
      async findMany(args: unknown) {
        calls.services.push(args);
        if (checkProjection) assert.deepEqual(args, summaryQuery);
        return services;
      },
      async count() {
        calls.count++;
        return catalogRows;
      },
    },
    plan: {
      async findMany(args: unknown) {
        calls.legacy.push(args);
        return legacyPlans;
      },
    },
  };
  // No Db/Prisma/BillingService instance, connection, credentials or network.
  return {catalog: new CatalogService(db as never, {} as never), calls};
}

const expectedCoworking = {
  slug: 'coworking', name: 'Coworking', description: 'Shared workspaces',
  categoryBadge: 'Flexible', iconName: 'Desk', heroImageUrl: '/coworking.webp',
  displayOrder: 2, flowType: 'STANDARD', customSteps: ['PLAN', 'ADDONS'],
  planCount: 3, priceFromCents: 0, currency: 'eur', addOnCount: 2,
  metadata: {nested: {featured: true}, labels: ['quiet', 'shared'], zero: 0},
};

test('publicServices selects only summary fields, without count, amenities or full plans/add-ons', async () => {
  const {catalog, calls} = harness([coworking]);
  const result = await catalog.publicServices();
  assert.deepEqual(result, {source: 'CATALOG', termsVersion: BILLING_TERMS_VERSION, items: [expectedCoworking]});
  assert.deepEqual(calls.services, [summaryQuery]);
  assert.equal(calls.count, 0);
  assert.deepEqual(calls.legacy, []);
  // The existing cache behavior remains: a warm read does not refetch.
  assert.deepEqual(await catalog.publicServices(), result);
  assert.equal(calls.services.length, 1);
});

test('summary preserves service order, no-plan defaults, customSteps normalization and metadata', async () => {
  const noPlans = {
    ...coworking, slug: 'empty', name: 'Empty', displayOrder: 1,
    customSteps: {not: 'an array'}, metadata: {}, plans: [], serviceAddOns: [],
  };
  const {catalog} = harness([noPlans, coworking]);
  assert.deepEqual(await catalog.publicServices(), {
    source: 'CATALOG', termsVersion: BILLING_TERMS_VERSION,
    items: [
      {...expectedCoworking, slug: 'empty', name: 'Empty', displayOrder: 1, customSteps: [], metadata: {}, planCount: 0, priceFromCents: null, currency: 'usd', addOnCount: 0},
      expectedCoworking,
    ],
  });
});

test('summary keeps defensive active/archive plan filtering and sellable add-on semantics', async () => {
  const archivedAt = new Date('2026-01-01');
  const {catalog} = harness([{
    ...coworking,
    plans: [
      {active: false, archivedAt: null, unitAmountCents: 0, currency: 'cad'},
      {active: true, archivedAt, unitAmountCents: 1, currency: 'aud'},
      {active: true, archivedAt: null, unitAmountCents: 450, currency: 'gbp'},
    ],
    serviceAddOns: [
      {addOn: {active: false, archivedAt: null}},
      {addOn: {active: true, archivedAt}},
      {addOn: {active: true, archivedAt: null}},
      {},
    ],
  }]);
  assert.deepEqual(await catalog.publicServices(), {
    source: 'CATALOG', termsVersion: BILLING_TERMS_VERSION,
    items: [{...expectedCoworking, planCount: 1, priceFromCents: 450, currency: 'gbp', addOnCount: 1}],
  });
});

test('an empty catalog uses the unchanged legacy plan projection after an existence check', async () => {
  const legacy = {
    slug: 'day-pass', name: 'Day Pass', description: 'Desk access',
    serviceType: 'coworking', unitAmount: 0, currency: 'cad',
    billingType: 'ONE_TIME', interval: null, intervalCount: 1, pricingUnit: 'DAY',
    minQuantity: 1, maxQuantity: 1, requiresSchedule: true,
    durationMinutes: null, sortOrder: 0, metadata: {},
  };
  const {catalog, calls} = harness([], [legacy, {
    ...legacy, slug: 'locker', name: 'Locker', unitAmount: 100,
    pricingUnit: 'ITEM', metadata: {addOn: true},
  }]);
  assert.deepEqual(await catalog.publicServices(), {
    source: 'LEGACY', termsVersion: BILLING_TERMS_VERSION,
    items: [{
      slug: 'coworking', name: 'Coworking', description: '', categoryBadge: null,
      iconName: 'Layers', heroImageUrl: null, displayOrder: 0, flowType: 'STANDARD',
      customSteps: [], planCount: 1, priceFromCents: 0, currency: 'cad', addOnCount: 1, metadata: {},
    }],
  });
  assert.deepEqual(calls.services, [summaryQuery]);
  assert.equal(calls.count, 1);
  assert.deepEqual(calls.legacy, [{
    where: {active: true, archivedAt: null},
    orderBy: [{serviceType: 'asc'}, {sortOrder: 'asc'}, {unitAmount: 'asc'}],
  }]);
});

test('an empty catalog and empty legacy table still return the LEGACY empty response', async () => {
  const {catalog, calls} = harness();
  assert.deepEqual(await catalog.publicServices(), {source: 'LEGACY', termsVersion: BILLING_TERMS_VERSION, items: []});
  assert.equal(calls.count, 1);
  assert.equal(calls.services.length, 1);
  assert.equal(calls.legacy.length, 1);
});

test('activeServices retains its existing full include query and returned rows', async () => {
  const rows = [{...coworking, id: 'service-1', serviceAmenities: [{amenity: {name: 'Wi-Fi'}}]}];
  const {catalog, calls} = harness(rows, [], false);
  assert.deepEqual(await catalog.activeServices(), rows);
  assert.deepEqual(calls.services, [{
    where: {active: true, archivedAt: null},
    orderBy: [{displayOrder: 'asc'}, {name: 'asc'}],
    include: {
      plans: {where: {active: true, archivedAt: null}, orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}]},
      serviceAddOns: {include: {addOn: true}, orderBy: {sortOrder: 'asc'}},
      serviceAmenities: {include: {amenity: true}, orderBy: {sortOrder: 'asc'}},
    },
  }]);
});
