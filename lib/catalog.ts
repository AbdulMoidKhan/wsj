/**
 * Shared types and server-side readers for the dynamic service catalog.
 *
 * Marketing pages and the booking dialog both describe the same catalog, so the
 * shapes live here once. Server components call fetchCatalogService* during
 * render; the browser talks to the same endpoints through PUBLIC_API_URL.
 *
 * No price is ever written in a component: if the catalog cannot be reached a
 * page shows "on request" rather than a number that could contradict the
 * database.
 */

/** Server-side base URL. The browser uses PUBLIC_API_URL from lib/public-api. */
export const SERVER_API_URL = process.env.API_URL || 'http://localhost:4000/api';

export type BillingUnit = 'ONE_TIME' | 'PER_HOUR' | 'PER_DAY' | 'PER_MONTH' | 'PER_YEAR' | 'PER_SESSION' | 'PER_ITEM' | 'PER_SETUP' | 'PER_BOOKING' | 'PER_PODCAST' | 'PER_CLIP' | 'CUSTOM';
export type QuantityBasis = 'FLAT' | 'QUANTITY' | 'HOURS' | 'DAYS';
export type FlowStep = 'service' | 'plan' | 'amenities' | 'extras' | 'schedule' | 'circle' | 'checkout';
export type FlowType = 'STANDARD' | 'NO_EXTRAS' | 'MEMBERSHIP' | 'CUSTOM';

export interface CatalogAmenity {
  slug: string;
  name: string;
  description: string;
  iconName: string;
  iconUrl: string | null;
}

export interface CatalogAddOn {
  slug: string;
  name: string;
  description: string;
  unitAmountCents: number;
  listPriceCents: number;
  hasOverride?: boolean;
  currency: string;
  billingUnit: BillingUnit;
  unitLabel: string;
  quantityBasis: QuantityBasis;
  quantityNoun: string;
  billingType: 'ONE_TIME' | 'RECURRING';
  interval: 'MONTH' | 'YEAR' | null;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  imageUrl: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface CatalogPlan {
  slug: string;
  name: string;
  description: string;
  serviceSlug: string;
  unitAmountCents: number;
  currency: string;
  billingUnit: BillingUnit;
  unitLabel: string;
  quantityBasis: QuantityBasis;
  quantityNoun: string;
  billingType: 'ONE_TIME' | 'RECURRING';
  interval: 'MONTH' | 'YEAR' | null;
  intervalDescription: string;
  requiresSchedule: boolean;
  durationMinutes: number | null;
  durationDays: number | null;
  minQuantity: number;
  maxQuantity: number;
  capacityText: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  featured: boolean;
  sortOrder: number;
  rulesNotice: string | null;
  governmentNotice: string | null;
  metadata?: Record<string, unknown>;
  addOns: CatalogAddOn[];
  amenities: CatalogAmenity[];
}

export interface ServiceSummary {
  slug: string;
  name: string;
  description: string;
  categoryBadge: string | null;
  iconName: string;
  heroImageUrl: string | null;
  displayOrder: number;
  flowType: FlowType;
  customSteps: string[];
  planCount: number;
  priceFromCents: number | null;
  currency: string;
  addOnCount: number;
  metadata?: Record<string, unknown>;
}

export interface ServiceDetail extends ServiceSummary {
  steps: FlowStep[];
  amenities: CatalogAmenity[];
  addOns: CatalogAddOn[];
  plans: CatalogPlan[];
  termsVersion: string | null;
}

/** Whole cents to a display string. The only place a page formats money. */
export function money(minorUnits: number, currency = 'usd'): string {
  return (minorUnits / 100).toLocaleString('en-US', {style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: minorUnits % 100 === 0 ? 0 : 2});
}

/** Price plus its billing unit, e.g. "$150 per month". */
export function priceLabel(plan: Pick<CatalogPlan, 'unitAmountCents' | 'currency' | 'unitLabel'> | null | undefined, fallback = 'On request'): string {
  if (!plan) return fallback;
  return money(plan.unitAmountCents, plan.currency) + ' ' + plan.unitLabel;
}

/** Price multiplied by a duration, for pages that advertise bundled hours. */
export function multipliedLabel(plan: Pick<CatalogPlan, 'unitAmountCents' | 'currency'> | null | undefined, units: number, fallback = 'On request'): string {
  if (!plan) return fallback;
  return money(plan.unitAmountCents * Math.max(1, units), plan.currency);
}

async function readJson<T>(path: string, revalidateSeconds: number): Promise<T | null> {
  try {
    const response = await fetch(SERVER_API_URL + path, {
      next: {revalidate: revalidateSeconds},
      // Match the other public readers: an unavailable API must not hold a
      // server render open indefinitely. Existing on-request fallbacks remain.
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** All published services, in administrator display order. */
export async function fetchCatalogServices(revalidateSeconds = 60): Promise<ServiceSummary[]> {
  const body = await readJson<{items: ServiceSummary[]}>('/public/catalog/services', revalidateSeconds);
  return body?.items ?? [];
}

/** One service with its packages, amenities, add-ons and booking steps. */
export async function fetchCatalogService(slug: string, revalidateSeconds = 60): Promise<ServiceDetail | null> {
  return readJson<ServiceDetail>('/public/catalog/services/' + encodeURIComponent(slug), revalidateSeconds);
}

/** Find a package by slug, then by exact name, then by a name that contains it. */
export function findPlan(service: ServiceDetail | null, ...keys: string[]): CatalogPlan | null {
  if (!service) return null;
  for (const key of keys) {
    const needle = key.trim().toLowerCase();
    if (!needle) continue;
    const match =
      service.plans.find(plan => plan.slug === needle) ||
      service.plans.find(plan => plan.name.toLowerCase() === needle) ||
      service.plans.find(plan => plan.name.toLowerCase().includes(needle));
    if (match) return match;
  }
  return null;
}

/** The distinct validity / usage rules an administrator wrote for a service. */
export function serviceRules(service: ServiceDetail | null): string[] {
  return [...new Set((service?.plans ?? []).map(plan => plan.rulesNotice).filter((value): value is string => Boolean(value)))];
}
