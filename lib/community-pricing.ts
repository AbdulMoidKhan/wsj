import approvedPricing from '@/data/approved-pricing.json';

export interface PricingRecord {
  id?: string;
  slug?: string;
  title?: string;
  status?: string;
  excerpt?: string;
  metadata?: {
    service?: string; billingPeriod?: string; price?: number | string; amount?: number | string;
    features?: string[]; enabled?: boolean; requiresReview?: boolean; featured?: boolean; ctaLabel?: string;
  };
}

export interface MembershipPlanItem {
  id: string;
  name: string;
  slug: string;
  tier: 'community' | 'pro' | 'founder';
  monthlyPrice: number | null;
  annualPrice: number | null;
  monthlyTitle?: string;
  annualTitle?: string;
  annualFeatures?: string[];
  popular?: boolean;
  features: string[];
  ctaLabel: string;
}

export const approvedPricingRecords: PricingRecord[] = approvedPricing;
export function publishedPricing(record: PricingRecord): boolean {
  return (!record.status || record.status === 'PUBLISHED') &&
    record.metadata?.requiresReview !== true && record.metadata?.enabled !== false;
}
export function pricingAmount(record?: PricingRecord): number | null {
  const raw = record?.metadata?.price ?? record?.metadata?.amount;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// A valid empty catalog is authoritative. Only transport/schema failure returns null.
export async function loadPublishedPricing(base: string, signal?: AbortSignal): Promise<PricingRecord[] | null> {
  try {
    const records: PricingRecord[] = [];
    for (let page = 1; page <= 100; page++) {
      const response = await fetch(`${base}/public/pricing?limit=100&page=${page}`, {signal: signal ?? AbortSignal.timeout(5000)});
      if (!response.ok) return null;
      const data = await response.json();
      const batch = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(batch)) return null;
      records.push(...batch);
      if (Array.isArray(data) || batch.length === 0 || (typeof data.total === 'number' ? records.length >= data.total : batch.length < 100)) return records;
    }
    return null;
  } catch { return null; }
}

function membershipFeatures(record?: PricingRecord): string[] {
  if (!record) return [];
  const features = record.metadata?.features || [];
  const inherited = record.excerpt?.match(/everything in (Community|Professional) Membership/i)?.[1];
  return inherited && !features.some(feature => /everything in/i.test(feature))
    ? [`Everything in ${inherited} Membership`, ...features] : features;
}

export function communityPlansFromCatalog(records: PricingRecord[]): MembershipPlanItem[] {
  const pool = records.filter(p => publishedPricing(p) && p.metadata?.service === 'memberships');
  const tiers = [
    {slug: 'community-membership', tier: 'community' as const},
    {slug: 'professional-membership', tier: 'pro' as const},
    {slug: 'founder-pro-membership', tier: 'founder' as const}
  ];
  return tiers.flatMap(({slug, tier}) => {
    const matches = pool.filter(p => p.slug?.endsWith(`-${slug}`) || p.slug?.endsWith(`-${slug}-annual`) || p.slug === slug || p.slug === `${slug}-annual`);
    const monthly = matches.find(p => p.metadata?.billingPeriod === 'month');
    const annual = matches.find(p => p.metadata?.billingPeriod === 'year');
    const primary = monthly || annual;
    if (!primary) return [];
    return [{id: slug, slug, tier, name: primary.title || slug,
      monthlyTitle: monthly?.title, annualTitle: annual?.title,
      monthlyPrice: pricingAmount(monthly), annualPrice: pricingAmount(annual),
      popular: primary.metadata?.featured === true,
      features: membershipFeatures(monthly), annualFeatures: membershipFeatures(annual),
      ctaLabel: primary.metadata?.ctaLabel || 'Inquire about membership'}];
  });
}

export async function fetchCommunityPlans(): Promise<MembershipPlanItem[]> {
  const live = await loadPublishedPricing(process.env.API_URL || 'http://localhost:4000/api');
  return communityPlansFromCatalog(live ?? approvedPricingRecords);
}
