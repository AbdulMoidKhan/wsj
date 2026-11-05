/**
 * Pure billing domain rules. No database, no Stripe, no environment access, so
 * every rule here is directly unit-testable and is the single place that decides
 * money, access and cancellation semantics.
 *
 * All amounts are integer minor currency units (US cents).
 */
export type BillingTypeValue = 'ONE_TIME' | 'RECURRING';
export type BillingIntervalValue = 'MONTH' | 'YEAR';
export type AccessStatusValue = 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'ENDED';
export type PricingUnitValue = 'PACKAGE' | 'HOUR' | 'DAY' | 'SEAT' | 'ITEM' | 'SESSION';

/** Bumped whenever the recurring-billing terms shown at checkout change. */
export const BILLING_TERMS_VERSION = '2026-11-recurring-v1';
/** Default days of access kept after a failed renewal before service suspension. */
export const DEFAULT_GRACE_DAYS = 7;
/** Stripe refuses card charges below this (USD). A nonzero total under it is never "paid". */
export const STRIPE_MIN_CHARGE_CENTS = 50;
/** Business timezone for date-only selections and schedules. */
export const BUSINESS_TIMEZONE = 'America/Chicago';

export const STRIPE_SUBSCRIPTION_STATUSES = ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'unpaid', 'paused', 'canceled'] as const;
export type StripeSubscriptionStatus = (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];

export interface PlanLike {
  id?: string;
  slug?: string;
  name: string;
  billingType: BillingTypeValue;
  interval?: BillingIntervalValue | null;
  intervalCount?: number | null;
  unitAmount: number;
  currency?: string;
  pricingUnit?: PricingUnitValue;
  durationMinutes?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  requiresSchedule?: boolean;
  requiresResource?: boolean;
  requiresOnboarding?: boolean;
  trialDays?: number | null;
  includedCredits?: unknown;
  active?: boolean;
  archivedAt?: Date | string | null;
}

export class PricingError extends Error {}

/**
 * Normalised access status. An unknown Stripe status is never treated as active:
 * it degrades to PENDING so no paid access is granted by accident.
 */
export function accessStatusFor(stripeStatus: string, options: {graceEndsAt?: Date | null; now?: Date} = {}): AccessStatusValue {
  const now = options.now ?? new Date();
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'past_due': {
      const grace = options.graceEndsAt ? new Date(options.graceEndsAt) : null;
      return grace && grace.getTime() <= now.getTime() ? 'SUSPENDED' : 'PAST_DUE';
    }
    case 'unpaid':
    case 'paused':
      return 'SUSPENDED';
    case 'canceled':
    case 'incomplete_expired':
      return 'ENDED';
    case 'incomplete':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

export function isRecurring(plan: PlanLike): boolean {
  return plan.billingType === 'RECURRING';
}

/** A plan is sellable only when explicitly active and not archived. */
export function isPurchasable(plan: PlanLike): boolean {
  return plan.active !== false && !plan.archivedAt;
}

/** Quantity bounds come from the catalog, never from the request. */
export function resolveQuantity(plan: PlanLike, requested: unknown): number {
  const min = Math.max(1, plan.minQuantity ?? 1);
  const max = Math.max(min, plan.maxQuantity ?? min);
  const value = requested === undefined || requested === null ? min : Number(requested);
  if (!Number.isInteger(value)) throw new PricingError('Quantity must be a whole number');
  if (value < min || value > max) throw new PricingError('Quantity for ' + plan.name + ' must be between ' + min + ' and ' + max);
  return value;
}

/** Price is always quantity x configured unit amount, computed server side. */
export function lineAmount(plan: PlanLike, quantity: number): number {
  if (!Number.isInteger(plan.unitAmount) || plan.unitAmount < 0) throw new PricingError('Plan ' + plan.name + ' has no valid configured price');
  return plan.unitAmount * quantity;
}

/** Reservation length derives from the pricing unit, never from a label. */
export function reservationMinutes(plan: PlanLike, quantity: number): number | null {
  if (!plan.requiresSchedule) return null;
  if (plan.pricingUnit === 'HOUR') return 60 * quantity;
  if (plan.durationMinutes && plan.durationMinutes > 0) return plan.durationMinutes * (plan.pricingUnit === 'SESSION' ? quantity : 1);
  return null;
}

export interface SelectionInput {
  quantity?: number;
  startAt?: string | Date | null;
  resourceId?: string | null;
}

/** Catalog-driven validation of what a buyer submitted for one plan. */
export function selectionErrors(plan: PlanLike, input: SelectionInput): string[] {
  const errors: string[] = [];
  if (!isPurchasable(plan)) errors.push(plan.name + ' is not available for sale');
  if (plan.billingType === 'RECURRING' && !plan.interval) errors.push(plan.name + ' is recurring but has no billing interval configured');
  if (plan.billingType === 'ONE_TIME' && plan.interval) errors.push(plan.name + ' is one-time but has a recurring interval configured');
  if (plan.requiresSchedule && !input.startAt) errors.push(plan.name + ' requires a date and time');
  if (!plan.requiresSchedule && input.startAt) errors.push(plan.name + ' does not take a date and time');
  if (plan.requiresResource && !input.resourceId) errors.push(plan.name + ' requires a resource selection');
  return errors;
}

export interface Discount {
  /** Percentage off, 0-100. */
  percentOff?: number | null;
  /** Fixed minor units off. */
  amountOff?: number | null;
  /** Stripe coupon duration: once | repeating | forever. */
  duration?: 'once' | 'repeating' | 'forever' | null;
  durationInMonths?: number | null;
  code?: string;
}

export interface TotalsInput {
  lines: Array<{amount: number; billingType: BillingTypeValue; interval?: BillingIntervalValue | null}>;
  discount?: Discount | null;
  taxAmount?: number;
}

export interface Totals {
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  dueNowAmount: number;
  recurringAmount: number;
  recurringInterval: BillingIntervalValue | null;
}

/** Discount never exceeds the subtotal and never produces a negative total. */
export function discountAmountFor(subtotal: number, discount?: Discount | null): number {
  if (!discount) return 0;
  const percent = Math.min(100, Math.max(0, Number(discount.percentOff ?? 0)));
  const byPercent = percent > 0 ? Math.round((subtotal * percent) / 100) : 0;
  const byAmount = Math.max(0, Math.round(Number(discount.amountOff ?? 0)));
  return Math.min(subtotal, byPercent + byAmount);
}

/**
 * Server-authoritative totals. Due-now and recurring amounts are kept separate so
 * the customer is never shown a recurring price as a one-time charge.
 */
export function computeTotals(input: TotalsInput): Totals {
  const subtotalAmount = input.lines.reduce((sum, line) => sum + line.amount, 0);
  const discountAmount = discountAmountFor(subtotalAmount, input.discount);
  const taxAmount = Math.max(0, Math.round(input.taxAmount ?? 0));
  const totalAmount = Math.max(0, subtotalAmount - discountAmount + taxAmount);
  const recurringLines = input.lines.filter(line => line.billingType === 'RECURRING');
  const oneTimeLines = input.lines.filter(line => line.billingType === 'ONE_TIME');
  const recurringAmount = recurringLines.reduce((sum, line) => sum + line.amount, 0);
  const intervals = new Set(recurringLines.map(line => line.interval));
  if (intervals.size > 1) throw new PricingError('A single checkout cannot mix monthly and yearly billing intervals');
  const recurringInterval = (recurringLines[0]?.interval as BillingIntervalValue | undefined) ?? null;
  const oneTimeAmount = oneTimeLines.reduce((sum, line) => sum + line.amount, 0);
  /* A recurring checkout charges the first period immediately, so due-now covers
     both the one-time lines and the first recurring invoice. */
  const dueNowAmount = Math.max(0, oneTimeAmount + recurringAmount - discountAmount + taxAmount);
  return {subtotalAmount, discountAmount, taxAmount, totalAmount, dueNowAmount, recurringAmount, recurringInterval};
}

/** A nonzero total below Stripe's minimum can never be collected by card. */
export function paymentOutcome(dueNowAmount: number): 'FREE' | 'CHARGEABLE' | 'BELOW_MINIMUM' {
  if (dueNowAmount === 0) return 'FREE';
  return dueNowAmount < STRIPE_MIN_CHARGE_CENTS ? 'BELOW_MINIMUM' : 'CHARGEABLE';
}

export function graceEndsAt(from: Date, days = DEFAULT_GRACE_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface CreditGrant {
  kind: 'COWORKING_DAY' | 'MEETING_ROOM_HOUR' | 'STUDIO_HOUR' | 'CREDIT';
  amount: number;
  /** MONTH refreshes every billing month even on an annual term. */
  resetInterval: BillingIntervalValue;
  unlimited?: boolean;
}

const CREDIT_KINDS = new Set(['COWORKING_DAY', 'MEETING_ROOM_HOUR', 'STUDIO_HOUR', 'CREDIT']);

/** Included benefits are explicit configuration; nothing is inferred from a title. */
export function creditGrantsFor(plan: PlanLike): CreditGrant[] {
  const raw = Array.isArray(plan.includedCredits) ? plan.includedCredits : [];
  const grants: CreditGrant[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const value = entry as Record<string, unknown>;
    const kind = String(value.kind ?? '');
    if (!CREDIT_KINDS.has(kind)) continue;
    const unlimited = value.unlimited === true;
    const amount = unlimited ? 0 : Math.max(0, Math.round(Number(value.amount ?? 0)));
    if (!unlimited && amount === 0) continue;
    const resetInterval: BillingIntervalValue = value.resetInterval === 'YEAR' ? 'YEAR' : 'MONTH';
    grants.push({kind: kind as CreditGrant['kind'], amount, resetInterval, unlimited});
  }
  return grants;
}

/** Ledger balance. Grants are positive, holds and consumption negative. */
export function entitlementBalance(entries: Array<{delta: number}>): number {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

export interface CancellationPreview {
  mode: 'PERIOD_END' | 'IMMEDIATE';
  effectiveAt: Date | null;
  lastAccessDate: Date | null;
  willRenewAgain: boolean;
  refundIssued: boolean;
  note: string;
}

/** What the customer or admin is told before confirming a cancellation. */
export function cancellationPreview(subscription: {currentPeriodEnd?: Date | string | null; cancelAtPeriodEnd?: boolean}, mode: 'PERIOD_END' | 'IMMEDIATE', now = new Date()): CancellationPreview {
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (mode === 'IMMEDIATE') {
    return {
      mode,
      effectiveAt: now,
      lastAccessDate: now,
      willRenewAgain: false,
      refundIssued: false,
      note: 'Access ends immediately. No refund is issued unless one is approved separately.',
    };
  }
  return {
    mode,
    effectiveAt: periodEnd,
    lastAccessDate: periodEnd,
    willRenewAgain: false,
    refundIssued: false,
    note: periodEnd
      ? 'Automatic renewal stops. Access continues until the end of the paid period.'
      : 'Automatic renewal stops at the end of the current paid period.',
  };
}

/** Stripe timestamps are seconds; never derive periods from 30/365-day maths. */
export function fromStripeTimestamp(value: unknown): Date | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000);
}

export function describeInterval(interval: BillingIntervalValue | null | undefined, count = 1): string {
  if (!interval) return 'one-time';
  const unit = interval === 'YEAR' ? 'year' : 'month';
  return count > 1 ? 'every ' + count + ' ' + unit + 's' : 'every ' + unit;
}

export function formatAmount(amountMinor: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: currency.toUpperCase()}).format(amountMinor / 100);
}

/* ───────────────────────── Business timezone helpers ─────────────────────────
   Instants are stored in UTC; date-only selections and operating hours are
   interpreted in the business timezone, including across DST transitions.
   ──────────────────────────────────────────────────────────────────────────── */

/** Offset in minutes of the business timezone at a given instant (e.g. -300 CDT, -360 CST). */
export function businessOffsetMinutes(instant: Date, timeZone = BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(instant);
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Convert a local calendar date + wall-clock time in the business timezone into
 * the correct UTC instant. A date-only value never shifts to another calendar
 * day, and the offset is resolved at the target date (so 1 Mar and 1 Jul differ).
 */
export function businessTimeToUtc(dateOnly: string, time = '00:00', timeZone = BUSINESS_TIMEZONE): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (!year || !month || !day) throw new PricingError('A booking date must look like YYYY-MM-DD');
  const guess = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  /* Two passes settle the offset even when the guess lands on the other side of a DST change. */
  let offset = businessOffsetMinutes(new Date(guess), timeZone);
  offset = businessOffsetMinutes(new Date(guess - offset * 60000), timeZone);
  return new Date(guess - offset * 60000);
}

/** The calendar day a UTC instant falls on in the business timezone. */
export function businessDate(instant: Date, timeZone = BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(instant);
}

/** Half-open reservation window [start, end) derived from catalog duration. */
export function reservationWindow(startUtc: Date, minutes: number, bufferMinutes = 0): {start: Date; end: Date} {
  return {start: startUtc, end: new Date(startUtc.getTime() + (minutes + bufferMinutes) * 60000)};
}

export function overlaps(a: {start: Date; end: Date}, b: {start: Date; end: Date}): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}
