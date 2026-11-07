/**
 * Pure rules for the dynamic service catalog. No database, no Stripe, no
 * environment access, so every billing-unit decision here is unit-testable and
 * is the single place that turns a catalog entry plus a customer selection into
 * money.
 *
 * All amounts are integer minor currency units (US cents).
 */
import {PricingError, computeTotals, describeInterval, type BillingIntervalValue, type BillingTypeValue, type Discount, type Totals} from './billing-core';

export const BILLING_UNITS = ['ONE_TIME', 'PER_HOUR', 'PER_DAY', 'PER_MONTH', 'PER_YEAR', 'PER_SESSION', 'PER_ITEM', 'PER_SETUP', 'PER_BOOKING', 'PER_PODCAST', 'PER_CLIP', 'CUSTOM'] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

export const BOOKING_FLOWS = ['STANDARD', 'NO_EXTRAS', 'MEMBERSHIP', 'CUSTOM'] as const;
export type BookingFlow = (typeof BOOKING_FLOWS)[number];

/** Default step order of a STANDARD service flow. */
export const STANDARD_STEPS = ['service', 'plan', 'amenities', 'extras', 'schedule', 'checkout'] as const;
export type FlowStep = 'service' | 'plan' | 'amenities' | 'extras' | 'schedule' | 'circle' | 'checkout';

/** How a selection multiplies the configured unit price. */
export type QuantityBasis = 'FLAT' | 'QUANTITY' | 'HOURS' | 'DAYS';

const BASIS: Record<BillingUnit, QuantityBasis> = {
  ONE_TIME: 'FLAT',
  PER_HOUR: 'HOURS',
  PER_DAY: 'DAYS',
  PER_MONTH: 'FLAT',
  PER_YEAR: 'FLAT',
  PER_SESSION: 'QUANTITY',
  PER_ITEM: 'QUANTITY',
  PER_SETUP: 'FLAT',
  PER_BOOKING: 'FLAT',
  PER_PODCAST: 'QUANTITY',
  PER_CLIP: 'QUANTITY',
  CUSTOM: 'QUANTITY',
};

/** Customer-facing suffix. Presentation only; it never changes an amount. */
const LABELS: Record<BillingUnit, string> = {
  ONE_TIME: 'one-time',
  PER_HOUR: 'per hour',
  PER_DAY: 'per day',
  PER_MONTH: 'per month',
  PER_YEAR: 'per year',
  PER_SESSION: 'per session',
  PER_ITEM: 'per item',
  PER_SETUP: 'per setup',
  PER_BOOKING: 'per booking',
  PER_PODCAST: 'per podcast',
  PER_CLIP: 'per clip',
  CUSTOM: 'custom duration',
};

/** Noun used when asking the customer "how many?". */
const QUANTITY_NOUNS: Record<BillingUnit, string> = {
  ONE_TIME: 'quantity',
  PER_HOUR: 'hours',
  PER_DAY: 'days',
  PER_MONTH: 'quantity',
  PER_YEAR: 'quantity',
  PER_SESSION: 'sessions',
  PER_ITEM: 'items',
  PER_SETUP: 'setups',
  PER_BOOKING: 'bookings',
  PER_PODCAST: 'episodes',
  PER_CLIP: 'clips',
  CUSTOM: 'quantity',
};

export function isBillingUnit(value: unknown): value is BillingUnit {
  return typeof value === 'string' && (BILLING_UNITS as readonly string[]).includes(value);
}

export function quantityBasis(unit: BillingUnit): QuantityBasis {
  return BASIS[unit] ?? 'FLAT';
}

export function billingUnitLabel(unit: BillingUnit): string {
  return LABELS[unit] ?? 'one-time';
}

export function quantityNoun(unit: BillingUnit): string {
  return QUANTITY_NOUNS[unit] ?? 'quantity';
}

/** Only monthly and annual units create a Stripe subscription. */
export function isRecurringUnit(unit: BillingUnit): boolean {
  return unit === 'PER_MONTH' || unit === 'PER_YEAR';
}

export function billingTypeFor(unit: BillingUnit): BillingTypeValue {
  return isRecurringUnit(unit) ? 'RECURRING' : 'ONE_TIME';
}

export function intervalFor(unit: BillingUnit): BillingIntervalValue | null {
  if (unit === 'PER_MONTH') return 'MONTH';
  if (unit === 'PER_YEAR') return 'YEAR';
  return null;
}

/** An hourly package always needs a start time; a subscription never does. */
export function requiresSchedule(unit: BillingUnit): boolean {
  return unit === 'PER_HOUR' || unit === 'PER_DAY' || unit === 'PER_SESSION' || unit === 'PER_BOOKING';
}

export interface CatalogPriceLike {
  slug?: string;
  name: string;
  unitAmountCents: number;
  currency?: string;
  billingUnit: BillingUnit | string;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  active?: boolean | null;
  archivedAt?: Date | string | null;
}

export interface SelectionAmounts {
  /** Explicit item/session/seat count. */
  quantity?: number | null;
  /** Hours chosen for a PER_HOUR entry (1-24). */
  durationHours?: number | null;
  /** Days chosen for a PER_DAY entry. */
  days?: number | null;
}

export const MAX_DURATION_HOURS = 24;
export const MAX_DURATION_DAYS = 365;

export function unitOf(entry: CatalogPriceLike): BillingUnit {
  if (!isBillingUnit(entry.billingUnit)) throw new PricingError(entry.name + ' has an unknown billing unit');
  return entry.billingUnit;
}

export function isSellable(entry: CatalogPriceLike): boolean {
  return entry.active !== false && !entry.archivedAt;
}

/**
 * The multiplier applied to the unit price, resolved from the billing unit and
 * clamped to the catalog's own bounds. Nothing here trusts a client amount.
 */
export function resolveUnits(entry: CatalogPriceLike, selection: SelectionAmounts, options: {allowZero?: boolean} = {}): number {
  const unit = unitOf(entry);
  const basis = quantityBasis(unit);
  const floor = options.allowZero ? 0 : 1;
  const min = Math.max(floor, Math.trunc(entry.minQuantity ?? 1) || floor);
  const max = Math.max(min, Math.trunc(entry.maxQuantity ?? min) || min);

  // Explicitly deselected optional add-ons cost nothing, regardless of their
  // billing unit or a separately supplied package duration.
  if (options.allowZero && selection.quantity === 0) return 0;

  if (basis === 'FLAT') {
    /* A flat entry can still be bought more than once when the catalog allows it. */
    if (max <= 1) return Math.max(floor, Math.min(1, max || 1));
    return clamp(entry, selection.quantity, min, max, 'quantity');
  }
  if (basis === 'HOURS') {
    const hours = clamp(entry, selection.durationHours ?? selection.quantity, Math.max(1, min), Math.min(max, MAX_DURATION_HOURS), 'hours');
    return hours;
  }
  if (basis === 'DAYS') {
    return clamp(entry, selection.days ?? selection.quantity, Math.max(1, min), Math.min(max, MAX_DURATION_DAYS), 'days');
  }
  return clamp(entry, selection.quantity, min, max, quantityNoun(unit));
}

function clamp(entry: CatalogPriceLike, requested: unknown, min: number, max: number, noun: string): number {
  const value = requested === undefined || requested === null || requested === '' ? min : Number(requested);
  if (!Number.isInteger(value)) throw new PricingError('The number of ' + noun + ' for ' + entry.name + ' must be a whole number');
  if (value < min || value > max) throw new PricingError('The number of ' + noun + ' for ' + entry.name + ' must be between ' + min + ' and ' + max);
  return value;
}

/** Unit price x resolved units. The only place a catalog amount is multiplied. */
export function catalogLineAmount(unitAmountCents: number, units: number): number {
  if (!Number.isInteger(unitAmountCents) || unitAmountCents < 0) throw new PricingError('This item has no valid configured price');
  if (!Number.isInteger(units) || units < 0) throw new PricingError('Invalid quantity');
  return unitAmountCents * units;
}

/**
 * The price actually charged for an add-on in a given context: a service- or
 * plan-level override replaces the library price when one is configured.
 */
export function effectiveAddOnPrice(libraryPrice: number, override?: number | null): number {
  if (override === null || override === undefined) return libraryPrice;
  if (!Number.isInteger(override) || override < 0) throw new PricingError('An add-on price override must be a whole number of cents');
  return override;
}

export interface QuoteLineInput {
  kind: 'PLAN' | 'ADDON';
  slug: string;
  name: string;
  unitAmountCents: number;
  currency: string;
  billingUnit: BillingUnit;
  units: number;
}

export interface QuoteLine extends QuoteLineInput {
  amount: number;
  billingType: BillingTypeValue;
  interval: BillingIntervalValue | null;
  unitLabel: string;
  description: string;
}

export function describeLine(line: QuoteLineInput): string {
  const unit = line.billingUnit;
  const basis = quantityBasis(unit);
  if (basis === 'HOURS') return line.units + ' hour' + (line.units === 1 ? '' : 's');
  if (basis === 'DAYS') return line.units + ' day' + (line.units === 1 ? '' : 's');
  if (line.units > 1) return line.units + ' x ' + billingUnitLabel(unit);
  return billingUnitLabel(unit);
}

export function buildQuoteLine(input: QuoteLineInput): QuoteLine {
  return {
    ...input,
    amount: catalogLineAmount(input.unitAmountCents, input.units),
    billingType: billingTypeFor(input.billingUnit),
    interval: intervalFor(input.billingUnit),
    unitLabel: billingUnitLabel(input.billingUnit),
    description: describeLine(input),
  };
}

export interface CatalogQuote {
  currency: string;
  lines: QuoteLine[];
  totals: Totals;
  recurringDescription: string | null;
  hasRecurring: boolean;
}

/** Server-computed authoritative quote. The client only names catalog entries. */
export function computeCatalogQuote(lines: QuoteLineInput[], options: {discount?: Discount | null; taxAmount?: number; currency?: string} = {}): CatalogQuote {
  if (!lines.length) throw new PricingError('Select at least one package');
  const built = lines.map(buildQuoteLine);
  const currencies = new Set(built.map(line => line.currency.toLowerCase()));
  if (currencies.size > 1) throw new PricingError('All items in one checkout must share a currency');
  const totals = computeTotals({
    lines: built.map(line => ({amount: line.amount, billingType: line.billingType, interval: line.interval})),
    discount: options.discount ?? null,
    taxAmount: options.taxAmount,
  });
  return {
    currency: options.currency ?? built[0]?.currency ?? 'usd',
    lines: built,
    totals,
    recurringDescription: totals.recurringInterval ? describeInterval(totals.recurringInterval) : null,
    hasRecurring: built.some(line => line.billingType === 'RECURRING'),
  };
}

/**
 * The steps a booking wizard should render for a service. Derived from the
 * admin-selected flow type and what is actually attached, never from a label.
 */
export function flowSteps(input: {flowType: BookingFlow; customSteps?: unknown; hasAddOns: boolean; hasAmenities: boolean; needsSchedule: boolean}): FlowStep[] {
  if (input.flowType === 'CUSTOM') {
    const allowed: FlowStep[] = ['service', 'plan', 'amenities', 'extras', 'schedule', 'circle', 'checkout'];
    const raw = Array.isArray(input.customSteps) ? input.customSteps : [];
    const steps = raw.map(step => String(step)).filter((step): step is FlowStep => (allowed as string[]).includes(step));
    if (steps.length) {
      if (!steps.includes('checkout')) steps.push('checkout');
      return steps;
    }
  }
  if (input.flowType === 'MEMBERSHIP') return ['service', 'plan', 'circle', 'checkout'];
  const steps: FlowStep[] = ['service', 'plan'];
  if (input.hasAmenities) steps.push('amenities');
  if (input.flowType !== 'NO_EXTRAS' && input.hasAddOns) steps.push('extras');
  if (input.needsSchedule) steps.push('schedule');
  steps.push('checkout');
  return steps;
}

export {PricingError};
