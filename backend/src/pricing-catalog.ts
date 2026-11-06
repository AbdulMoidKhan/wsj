/**
 * Single authoritative source for everything a booking payment can charge.
 * The server NEVER trusts a client-supplied price: every checkout total is
 * computed here from a planId/addOn id the client merely references. Amounts
 * are in whole US cents (Stripe's native unit) to avoid floating-point drift.
 */
export type PlanId = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AddOnId = 'printing' | 'storage' | 'mail' | 'podcast' | 'assistant' | 'events';

export interface CatalogPlan { id: PlanId; name: string; amountCents: number; period: string; description: string; featured: boolean }
export interface CatalogAddOn { id: AddOnId; name: string; amountCents: number; description: string }

export const CURRENCY = 'usd';

export const PLAN_CATALOG: Record<PlanId, CatalogPlan> = {
  bronze: { id: 'bronze', name: 'Bronze', amountCents: 5000, period: '/month', description: 'Perfect for freelancers and solo workers starting out.', featured: false },
  silver: { id: 'silver', name: 'Silver', amountCents: 10000, period: '/month', description: 'Great for professionals who need reliable access.', featured: false },
  gold: { id: 'gold', name: 'Gold', amountCents: 15000, period: '/month', description: 'Ideal for teams that want more space and amenities.', featured: true },
  platinum: { id: 'platinum', name: 'Platinum', amountCents: 25000, period: '/month', description: 'Full access with premium perks for growing businesses.', featured: false },
};

export const ADDON_CATALOG: Record<AddOnId, CatalogAddOn> = {
  printing: { id: 'printing', name: 'Printing Bundle', amountCents: 1500, description: '200 pages/month' },
  storage: { id: 'storage', name: 'Dedicated Storage', amountCents: 2000, description: 'Locked cabinet' },
  mail: { id: 'mail', name: 'Mail Handling', amountCents: 2500, description: 'Receive & forward mail' },
  podcast: { id: 'podcast', name: 'Podcast Studio', amountCents: 3000, description: '2 hrs/month' },
  assistant: { id: 'assistant', name: 'Virtual Assistant', amountCents: 7500, description: '5 hrs/month' },
  events: { id: 'events', name: 'Event Credits', amountCents: 1000, description: '$50 event credit' },
};

export const PLAN_IDS = Object.keys(PLAN_CATALOG) as PlanId[];
export const ADDON_IDS = Object.keys(ADDON_CATALOG) as AddOnId[];

export function isPlanId(value: unknown): value is PlanId { return typeof value === 'string' && (PLAN_IDS as string[]).includes(value); }
export function isAddOnId(value: unknown): value is AddOnId { return typeof value === 'string' && (ADDON_IDS as string[]).includes(value); }

export class UnknownAddOnError extends Error { constructor(public readonly addOnId: string) { super('Unknown add-on: ' + addOnId); } }

/** Deterministic, server-only total. Rejects unknown or repeated add-on ids. */
export function resolveBookingTotal(planId: PlanId, addOnIds: readonly string[]): { subtotalCents: number; addOnsCents: number; totalCents: number; addOns: CatalogAddOn[] } {
  const plan = PLAN_CATALOG[planId];
  if (!plan) throw new Error('Unknown plan: ' + planId);
  const addOns: CatalogAddOn[] = [];
  const seen = new Set<AddOnId>();
  for (const id of addOnIds) {
    if (!isAddOnId(id)) throw new UnknownAddOnError(id);
    if (seen.has(id)) throw new Error('Duplicate add-on: ' + id);
    seen.add(id);
    addOns.push(ADDON_CATALOG[id]);
  }
  const addOnsCents = addOns.reduce((sum, a) => sum + a.amountCents, 0);
  return { subtotalCents: plan.amountCents, addOnsCents, totalCents: plan.amountCents + addOnsCents, addOns };
}

export function publicCatalog() {
  return {
    currency: CURRENCY,
    plans: PLAN_IDS.map(id => PLAN_CATALOG[id]),
    addOns: ADDON_IDS.map(id => ADDON_CATALOG[id]),
  };
}
