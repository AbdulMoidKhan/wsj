import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  accessStatusFor,
  businessDate,
  businessTimeToUtc,
  cancellationPreview,
  computeTotals,
  creditGrantsFor,
  discountAmountFor,
  entitlementBalance,
  fromStripeTimestamp,
  graceEndsAt,
  lineAmount,
  overlaps,
  paymentOutcome,
  PricingError,
  reservationMinutes,
  reservationWindow,
  resolveQuantity,
  selectionErrors,
} from '../src/billing-core';

const hourlyRoom = {name: 'Huddle room', billingType: 'ONE_TIME' as const, unitAmount: 3500, pricingUnit: 'HOUR' as const, minQuantity: 1, maxQuantity: 8, requiresSchedule: true, requiresResource: true};
const monthlyPlan = {name: 'Community membership', billingType: 'RECURRING' as const, interval: 'MONTH' as const, unitAmount: 2900};
const annualPlan = {name: 'Professional membership', billingType: 'RECURRING' as const, interval: 'YEAR' as const, unitAmount: 79900, includedCredits: [{kind: 'MEETING_ROOM_HOUR', amount: 5, resetInterval: 'MONTH'}]};

test('unknown Stripe status never grants access', () => {
  assert.equal(accessStatusFor('active'), 'ACTIVE');
  assert.equal(accessStatusFor('trialing'), 'ACTIVE');
  assert.equal(accessStatusFor('incomplete'), 'PENDING');
  assert.equal(accessStatusFor('unpaid'), 'SUSPENDED');
  assert.equal(accessStatusFor('paused'), 'SUSPENDED');
  assert.equal(accessStatusFor('canceled'), 'ENDED');
  assert.equal(accessStatusFor('incomplete_expired'), 'ENDED');
  assert.equal(accessStatusFor('something_new_from_stripe'), 'PENDING');
});

test('past_due keeps access until the grace period expires, then suspends', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  assert.equal(accessStatusFor('past_due', {graceEndsAt: new Date('2026-03-17T12:00:00Z'), now}), 'PAST_DUE');
  assert.equal(accessStatusFor('past_due', {graceEndsAt: new Date('2026-03-09T12:00:00Z'), now}), 'SUSPENDED');
  assert.equal(graceEndsAt(now).toISOString(), '2026-03-17T12:00:00.000Z');
});

test('hourly price and reservation length both follow the selected hours', () => {
  assert.equal(lineAmount(hourlyRoom, 3), 10500);
  assert.equal(reservationMinutes(hourlyRoom, 3), 180);
  const window = reservationWindow(new Date('2026-06-01T15:00:00Z'), 180, 15);
  assert.equal(window.end.toISOString(), '2026-06-01T18:15:00.000Z');
  assert.ok(overlaps({start: new Date('2026-06-01T17:00:00Z'), end: new Date('2026-06-01T19:00:00Z')}, window));
  assert.ok(!overlaps({start: new Date('2026-06-01T18:15:00Z'), end: new Date('2026-06-01T19:00:00Z')}, window));
});

test('quantity outside the configured range is rejected', () => {
  assert.equal(resolveQuantity(hourlyRoom, 8), 8);
  assert.throws(() => resolveQuantity(hourlyRoom, 9), PricingError);
  assert.throws(() => resolveQuantity(hourlyRoom, 1.5), PricingError);
  assert.equal(resolveQuantity(monthlyPlan, undefined), 1);
});

test('a membership needs no date and a room booking does', () => {
  assert.deepEqual(selectionErrors(monthlyPlan, {}), []);
  assert.ok(selectionErrors(hourlyRoom, {}).some(message => message.includes('requires a date')));
  assert.ok(selectionErrors(monthlyPlan, {startAt: '2026-06-01T15:00:00Z'}).some(message => message.includes('does not take a date')));
  assert.ok(selectionErrors({...monthlyPlan, interval: null} as never, {}).some(message => message.includes('no billing interval')));
});

test('totals separate due-now from the recurring commitment and never go negative', () => {
  const totals = computeTotals({lines: [{amount: 2900, billingType: 'RECURRING', interval: 'MONTH'}, {amount: 1500, billingType: 'ONE_TIME'}], discount: {percentOff: 10}});
  assert.equal(totals.subtotalAmount, 4400);
  assert.equal(totals.discountAmount, 440);
  assert.equal(totals.dueNowAmount, 3960);
  assert.equal(totals.recurringAmount, 2900);
  assert.equal(totals.recurringInterval, 'MONTH');
  assert.equal(discountAmountFor(1000, {percentOff: 500, amountOff: 99999}), 1000);
  assert.equal(computeTotals({lines: [{amount: 1000, billingType: 'ONE_TIME'}], discount: {percentOff: 100}}).totalAmount, 0);
});

test('a checkout cannot mix monthly and yearly intervals', () => {
  assert.throws(() => computeTotals({lines: [{amount: 2900, billingType: 'RECURRING', interval: 'MONTH'}, {amount: 79900, billingType: 'RECURRING', interval: 'YEAR'}]}), PricingError);
});

test('a nonzero amount below the Stripe minimum is never chargeable', () => {
  assert.equal(paymentOutcome(0), 'FREE');
  assert.equal(paymentOutcome(49), 'BELOW_MINIMUM');
  assert.equal(paymentOutcome(50), 'CHARGEABLE');
});

test('annual billing can still refresh monthly credits', () => {
  const grants = creditGrantsFor(annualPlan);
  assert.equal(grants.length, 1);
  assert.equal(grants[0].kind, 'MEETING_ROOM_HOUR');
  assert.equal(grants[0].amount, 5);
  assert.equal(grants[0].resetInterval, 'MONTH');
  assert.deepEqual(creditGrantsFor({...annualPlan, includedCredits: [{kind: 'NONSENSE', amount: 5}]}), []);
  assert.equal(entitlementBalance([{delta: 5}, {delta: -2}, {delta: -1}]), 2);
});

test('cancellation preview tells the customer exactly what happens', () => {
  const periodEnd = new Date('2026-07-01T05:00:00Z');
  const scheduled = cancellationPreview({currentPeriodEnd: periodEnd}, 'PERIOD_END');
  assert.equal(scheduled.willRenewAgain, false);
  assert.equal(scheduled.refundIssued, false);
  assert.equal(scheduled.lastAccessDate?.toISOString(), periodEnd.toISOString());
  const immediate = cancellationPreview({currentPeriodEnd: periodEnd}, 'IMMEDIATE', new Date('2026-06-10T00:00:00Z'));
  assert.equal(immediate.lastAccessDate?.toISOString(), '2026-06-10T00:00:00.000Z');
  assert.equal(immediate.refundIssued, false);
});

test('Stripe periods come from Stripe, never from 30/365-day arithmetic', () => {
  assert.equal(fromStripeTimestamp(1772323200)?.toISOString(), new Date(1772323200000).toISOString());
  assert.equal(fromStripeTimestamp(null), null);
  assert.equal(fromStripeTimestamp(0), null);
});

test('Chicago date-only selections keep their calendar day across DST', () => {
  /* 1 March 2026 is CST (-06:00); after the 8 March switch and in July it is CDT (-05:00). */
  assert.equal(businessTimeToUtc('2026-03-01', '09:00').toISOString(), '2026-03-01T15:00:00.000Z');
  assert.equal(businessTimeToUtc('2026-03-08', '09:00').toISOString(), '2026-03-08T14:00:00.000Z');
  assert.equal(businessTimeToUtc('2026-07-08', '09:00').toISOString(), '2026-07-08T14:00:00.000Z');
  /* A late-evening local booking must not roll into the next calendar day. */
  const lateEvening = businessTimeToUtc('2026-07-08', '20:00');
  assert.equal(businessDate(lateEvening), '2026-07-08');
  assert.equal(businessDate(new Date('2026-07-09T04:30:00Z')), '2026-07-08');
  /* The spring-forward hour resolves to a real instant on the same day. */
  assert.equal(businessDate(businessTimeToUtc('2026-03-08', '02:30')), '2026-03-08');
});
