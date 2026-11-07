import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  BILLING_UNITS,
  billingTypeFor,
  billingUnitLabel,
  buildQuoteLine,
  catalogLineAmount,
  computeCatalogQuote,
  effectiveAddOnPrice,
  flowSteps,
  intervalFor,
  isBillingUnit,
  isSellable,
  quantityBasis,
  requiresSchedule,
  resolveUnits,
  PricingError,
  type BillingUnit,
} from '../src/catalog-core';

const entry = (over: Partial<{name: string; unitAmountCents: number; billingUnit: BillingUnit; minQuantity: number; maxQuantity: number}> = {}) => ({
  name: 'Test entry',
  unitAmountCents: 5000,
  billingUnit: 'ONE_TIME' as BillingUnit,
  minQuantity: 1,
  maxQuantity: 1,
  ...over,
});

test('every billing unit is classified, labelled and recognised', () => {
  assert.equal(BILLING_UNITS.length, 12);
  for (const unit of BILLING_UNITS) {
    assert.ok(isBillingUnit(unit));
    assert.ok(billingUnitLabel(unit).length > 0);
    assert.ok(['FLAT', 'QUANTITY', 'HOURS', 'DAYS'].includes(quantityBasis(unit)));
  }
  assert.equal(isBillingUnit('PER_DECADE'), false);
});

test('only monthly and annual units bill recurringly', () => {
  assert.equal(billingTypeFor('PER_MONTH'), 'RECURRING');
  assert.equal(intervalFor('PER_MONTH'), 'MONTH');
  assert.equal(billingTypeFor('PER_YEAR'), 'RECURRING');
  assert.equal(intervalFor('PER_YEAR'), 'YEAR');
  for (const unit of BILLING_UNITS.filter(value => value !== 'PER_MONTH' && value !== 'PER_YEAR')) {
    assert.equal(billingTypeFor(unit), 'ONE_TIME');
    assert.equal(intervalFor(unit), null);
  }
});

test('hourly, daily, session and booking units require a schedule', () => {
  assert.equal(requiresSchedule('PER_HOUR'), true);
  assert.equal(requiresSchedule('PER_DAY'), true);
  assert.equal(requiresSchedule('PER_SESSION'), true);
  assert.equal(requiresSchedule('PER_BOOKING'), true);
  assert.equal(requiresSchedule('PER_MONTH'), false);
  assert.equal(requiresSchedule('ONE_TIME'), false);
});

test('hours drive the multiplier for a per-hour entry and are clamped to the catalog', () => {
  const hourly = entry({billingUnit: 'PER_HOUR', maxQuantity: 24, unitAmountCents: 2500});
  assert.equal(resolveUnits(hourly, {durationHours: 3}), 3);
  assert.equal(catalogLineAmount(hourly.unitAmountCents, resolveUnits(hourly, {durationHours: 3})), 7500);
  assert.equal(resolveUnits(hourly, {}), 1);
  assert.throws(() => resolveUnits(hourly, {durationHours: 25}), PricingError);
  assert.throws(() => resolveUnits(hourly, {durationHours: 1.5}), PricingError);
});

test('a flat entry is never multiplied unless the catalog raises its maximum', () => {
  assert.equal(resolveUnits(entry(), {quantity: 7}), 1);
  assert.equal(resolveUnits(entry({maxQuantity: 10}), {quantity: 7}), 7);
  assert.throws(() => resolveUnits(entry({maxQuantity: 10}), {quantity: 11}), PricingError);
});

test('a monthly subscription is priced per cycle, not per month selected', () => {
  const monthly = entry({billingUnit: 'PER_MONTH', unitAmountCents: 15000});
  assert.equal(resolveUnits(monthly, {quantity: 6, durationHours: 6, days: 6}), 1);
  assert.equal(catalogLineAmount(monthly.unitAmountCents, 1), 15000);
});

test('item, session, podcast and clip units multiply by quantity', () => {
  for (const unit of ['PER_ITEM', 'PER_SESSION', 'PER_PODCAST', 'PER_CLIP'] as BillingUnit[]) {
    const line = entry({billingUnit: unit, maxQuantity: 20, unitAmountCents: 800});
    assert.equal(resolveUnits(line, {quantity: 4}), 4, unit);
    assert.equal(catalogLineAmount(line.unitAmountCents, 4), 3200, unit);
  }
});

test('optional add-ons may resolve to zero units, required ones may not', () => {
  const optional = entry({billingUnit: 'PER_ITEM', minQuantity: 0, maxQuantity: 10});
  assert.equal(resolveUnits(optional, {quantity: 0}, {allowZero: true}), 0);
  assert.throws(() => resolveUnits(optional, {quantity: 0}), PricingError);
});

test('a price override replaces the library price and must be a whole positive amount', () => {
  assert.equal(effectiveAddOnPrice(5000, null), 5000);
  assert.equal(effectiveAddOnPrice(5000, undefined), 5000);
  assert.equal(effectiveAddOnPrice(5000, 3000), 3000);
  assert.equal(effectiveAddOnPrice(5000, 0), 0);
  assert.throws(() => effectiveAddOnPrice(5000, -1), PricingError);
  assert.throws(() => effectiveAddOnPrice(5000, 10.5), PricingError);
});

test('archived or inactive entries are never sellable', () => {
  assert.equal(isSellable({name: 'x', unitAmountCents: 1, billingUnit: 'ONE_TIME'}), true);
  assert.equal(isSellable({name: 'x', unitAmountCents: 1, billingUnit: 'ONE_TIME', active: false}), false);
  assert.equal(isSellable({name: 'x', unitAmountCents: 1, billingUnit: 'ONE_TIME', archivedAt: new Date()}), false);
});

test('a negative or fractional configured price can never produce a line', () => {
  assert.throws(() => catalogLineAmount(-100, 1), PricingError);
  assert.throws(() => catalogLineAmount(10.5, 1), PricingError);
  assert.throws(() => catalogLineAmount(100, -1), PricingError);
});

test('an hourly package plus a per-podcast add-on totals from the server side only', () => {
  const quote = computeCatalogQuote([
    {kind: 'PLAN', slug: 'podcast-solo-starter', name: 'Solo Creator Studio', unitAmountCents: 7500, currency: 'usd', billingUnit: 'PER_HOUR', units: 2},
    {kind: 'ADDON', slug: 'addon-podcast-editing', name: 'Podcast Editing', unitAmountCents: 7500, currency: 'usd', billingUnit: 'PER_PODCAST', units: 1},
    {kind: 'ADDON', slug: 'addon-podcast-social-clips', name: 'Social Media Clips', unitAmountCents: 4000, currency: 'usd', billingUnit: 'PER_CLIP', units: 3},
  ]);
  assert.equal(quote.totals.subtotalAmount, 15000 + 7500 + 12000);
  assert.equal(quote.totals.dueNowAmount, 34500);
  assert.equal(quote.totals.recurringAmount, 0);
  assert.equal(quote.hasRecurring, false);
  assert.equal(quote.lines[0].description, '2 hours');
});

test('a monthly package with a monthly add-on reports one recurring amount', () => {
  const quote = computeCatalogQuote([
    {kind: 'PLAN', slug: 'coworking-gold', name: 'Gold', unitAmountCents: 15000, currency: 'usd', billingUnit: 'PER_MONTH', units: 1},
    {kind: 'ADDON', slug: 'addon-business-address', name: 'Business Address', unitAmountCents: 2500, currency: 'usd', billingUnit: 'PER_MONTH', units: 1},
  ]);
  assert.equal(quote.totals.recurringAmount, 17500);
  assert.equal(quote.totals.recurringInterval, 'MONTH');
  assert.equal(quote.totals.dueNowAmount, 17500);
  assert.equal(quote.recurringDescription, 'every month');
});

test('a checkout cannot mix monthly and yearly intervals or two currencies', () => {
  assert.throws(
    () =>
      computeCatalogQuote([
        {kind: 'PLAN', slug: 'a', name: 'A', unitAmountCents: 1000, currency: 'usd', billingUnit: 'PER_MONTH', units: 1},
        {kind: 'ADDON', slug: 'b', name: 'B', unitAmountCents: 1000, currency: 'usd', billingUnit: 'PER_YEAR', units: 1},
      ]),
    PricingError,
  );
  assert.throws(
    () =>
      computeCatalogQuote([
        {kind: 'PLAN', slug: 'a', name: 'A', unitAmountCents: 1000, currency: 'usd', billingUnit: 'ONE_TIME', units: 1},
        {kind: 'ADDON', slug: 'b', name: 'B', unitAmountCents: 1000, currency: 'eur', billingUnit: 'ONE_TIME', units: 1},
      ]),
    PricingError,
  );
  assert.throws(() => computeCatalogQuote([]), PricingError);
});

test('a discount never exceeds the subtotal', () => {
  const quote = computeCatalogQuote([{kind: 'PLAN', slug: 'a', name: 'A', unitAmountCents: 5000, currency: 'usd', billingUnit: 'ONE_TIME', units: 1}], {discount: {amountOff: 999999}});
  assert.equal(quote.totals.discountAmount, 5000);
  assert.equal(quote.totals.totalAmount, 0);
  assert.equal(quote.totals.dueNowAmount, 0);
});

test('a quote line carries its own billing classification', () => {
  const line = buildQuoteLine({kind: 'ADDON', slug: 'addon-llc-registered-agent', name: 'Registered Agent Service', unitAmountCents: 15000, currency: 'usd', billingUnit: 'PER_YEAR', units: 1});
  assert.equal(line.amount, 15000);
  assert.equal(line.billingType, 'RECURRING');
  assert.equal(line.interval, 'YEAR');
  assert.equal(line.unitLabel, 'per year');
});

test('flow type decides the steps, and empty sections are dropped', () => {
  assert.deepEqual(flowSteps({flowType: 'STANDARD', hasAddOns: true, hasAmenities: true, needsSchedule: true}), ['service', 'plan', 'amenities', 'extras', 'schedule', 'checkout']);
  assert.deepEqual(flowSteps({flowType: 'NO_EXTRAS', hasAddOns: true, hasAmenities: true, needsSchedule: false}), ['service', 'plan', 'amenities', 'checkout']);
  assert.deepEqual(flowSteps({flowType: 'MEMBERSHIP', hasAddOns: true, hasAmenities: true, needsSchedule: true}), ['service', 'plan', 'circle', 'checkout']);
  assert.deepEqual(flowSteps({flowType: 'STANDARD', hasAddOns: false, hasAmenities: false, needsSchedule: false}), ['service', 'plan', 'checkout']);
});

test('custom steps are honoured, sanitised and always end at checkout', () => {
  assert.deepEqual(flowSteps({flowType: 'CUSTOM', customSteps: ['plan', 'schedule'], hasAddOns: true, hasAmenities: true, needsSchedule: true}), ['plan', 'schedule', 'checkout']);
  assert.deepEqual(flowSteps({flowType: 'CUSTOM', customSteps: ['plan', 'nonsense'], hasAddOns: false, hasAmenities: false, needsSchedule: false}), ['plan', 'checkout']);
  /* An unusable custom list falls back to the derived standard flow. */
  assert.deepEqual(flowSteps({flowType: 'CUSTOM', customSteps: [], hasAddOns: false, hasAmenities: true, needsSchedule: false}), ['service', 'plan', 'amenities', 'checkout']);
});
