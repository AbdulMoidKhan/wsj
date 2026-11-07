/** Shapes returned by GET /admin/catalog/overview, plus small shared helpers. */
export type BillingUnit =
  | 'ONE_TIME'
  | 'PER_HOUR'
  | 'PER_DAY'
  | 'PER_MONTH'
  | 'PER_YEAR'
  | 'PER_SESSION'
  | 'PER_ITEM'
  | 'PER_SETUP'
  | 'PER_BOOKING'
  | 'PER_PODCAST'
  | 'PER_CLIP'
  | 'CUSTOM';

export type FlowType = 'STANDARD' | 'NO_EXTRAS' | 'MEMBERSHIP' | 'CUSTOM';

export interface CatalogPlan {
  id: string;
  slug: string;
  serviceId: string;
  name: string;
  description: string;
  unitAmountCents: number;
  currency: string;
  billingUnit: BillingUnit;
  durationMinutes: number | null;
  durationDays: number | null;
  minQuantity: number;
  maxQuantity: number;
  capacityText: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  featured: boolean;
  active: boolean;
  archivedAt: string | null;
  sortOrder: number;
  rulesNotice: string | null;
  governmentNotice: string | null;
  adminFlagNote: string | null;
  metadata: Record<string, unknown>;
  priceLabel: string;
  status: string;
  addOnIds: string[];
  amenityIds: string[];
}

export interface CatalogService {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryBadge: string | null;
  iconName: string;
  heroImageUrl: string | null;
  displayOrder: number;
  active: boolean;
  flowType: FlowType;
  customSteps: unknown;
  metadata: Record<string, unknown>;
  archivedAt: string | null;
  updatedAt: string;
  planCount: number;
  activePlanCount: number;
  status: string;
  plans: CatalogPlan[];
  addOnIds: string[];
  amenityIds: string[];
}

export interface CatalogAddOn {
  id: string;
  slug: string;
  name: string;
  description: string;
  unitAmountCents: number;
  currency: string;
  billingUnit: BillingUnit;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  imageUrl: string | null;
  active: boolean;
  archivedAt: string | null;
  adminFlagNote: string | null;
  priceLabel: string;
  serviceIds: string[];
  planIds: string[];
  assignments: Array<{scope: 'SERVICE' | 'PLAN'; id: string; priceOverrideCents: number | null; isRequired: boolean}>;
}

export interface CatalogAmenity {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  iconUrl: string | null;
  active: boolean;
  serviceIds: string[];
  planIds: string[];
}

export interface CatalogOverview {
  services: CatalogService[];
  addOns: CatalogAddOn[];
  amenities: CatalogAmenity[];
  billingUnits: Array<{value: BillingUnit; label: string; basis: string; recurring: boolean}>;
  flowTypes: FlowType[];
}

export const BILLING_UNIT_OPTIONS: Array<{value: BillingUnit; label: string; hint: string}> = [
  {value: 'ONE_TIME', label: 'one_time', hint: 'Single flat charge at checkout.'},
  {value: 'PER_HOUR', label: 'per_hour', hint: 'Multiplied by the hours the customer selects (1–24).'},
  {value: 'PER_DAY', label: 'per_day', hint: 'Multiplied by the number of days booked.'},
  {value: 'PER_MONTH', label: 'per_month', hint: 'Recurring monthly subscription (30-day cycle).'},
  {value: 'PER_YEAR', label: 'per_year', hint: 'Recurring annual subscription.'},
  {value: 'PER_SESSION', label: 'per_session', hint: 'Charged for each booked session.'},
  {value: 'PER_ITEM', label: 'per_item', hint: 'Multiplied by the gear or item quantity.'},
  {value: 'PER_SETUP', label: 'per_setup', hint: 'Flat technical or studio staging fee.'},
  {value: 'PER_BOOKING', label: 'per_booking', hint: 'Flat surcharge applied once per booking.'},
  {value: 'PER_PODCAST', label: 'per_podcast', hint: 'Media fee for each podcast episode.'},
  {value: 'PER_CLIP', label: 'per_clip', hint: 'Media fee for each highlight clip.'},
  {value: 'CUSTOM', label: 'custom', hint: 'Admin-defined duration; priced by quantity.'},
];

export const FLOW_OPTIONS: Array<{value: FlowType; label: string; hint: string}> = [
  {value: 'STANDARD', label: 'Standard', hint: 'Service → package → amenities → extras → schedule → checkout.'},
  {value: 'NO_EXTRAS', label: 'No extras', hint: 'Skips the add-on step entirely.'},
  {value: 'MEMBERSHIP', label: 'Membership', hint: 'Skips amenities, extras and the calendar; asks for an Industry Circle.'},
  {value: 'CUSTOM', label: 'Custom steps', hint: 'Uses the step list you define below.'},
];

export const CUSTOM_STEP_OPTIONS = ['service', 'plan', 'amenities', 'extras', 'schedule', 'circle', 'checkout'];

export const dollarsFromCents = (cents: number | null | undefined) => ((Number(cents) || 0) / 100).toFixed(2);
export const centsFromDollars = (value: unknown) => Math.round(Number(value || 0) * 100);
export const money = (cents: number, currency = 'usd') =>
  (cents / 100).toLocaleString('en-US', {style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2});

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

/** Which quantity question a billing unit implies, mirrored from the server. */
export const unitBasis = (unit: BillingUnit): 'FLAT' | 'QUANTITY' | 'HOURS' | 'DAYS' =>
  unit === 'PER_HOUR' ? 'HOURS' : unit === 'PER_DAY' ? 'DAYS' : ['PER_SESSION', 'PER_ITEM', 'PER_PODCAST', 'PER_CLIP', 'CUSTOM'].includes(unit) ? 'QUANTITY' : 'FLAT';
