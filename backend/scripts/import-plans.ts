/**
 * One-off import of the reviewed pricing catalog (Content kind="pricing") into
 * structured Plan rows used by billing.
 *
 * Rules:
 *  - Create only. An existing Plan row is never overwritten, so live prices and
 *    admin edits are preserved.
 *  - Only unambiguous billing periods ("month", "year", explicit hour/session
 *    durations) become sellable plans.
 *  - Anything ambiguous ("30 Days", "1 Month", "period not specified") is
 *    imported inactive with needsReview, so nothing is ever sold on a guess.
 *
 * Run: node --import tsx scripts/import-plans.ts   (from backend/)
 */
import 'dotenv/config';
import {PrismaClient} from '@prisma/client';

const db = new PrismaClient();

type Mapping = {
  billingType: 'ONE_TIME' | 'RECURRING';
  interval?: 'MONTH' | 'YEAR';
  pricingUnit: 'PACKAGE' | 'HOUR' | 'DAY' | 'SEAT' | 'ITEM' | 'SESSION';
  durationMinutes?: number;
  requiresSchedule: boolean;
  requiresResource: boolean;
  maxQuantity: number;
  active: boolean;
  needsReview?: string;
};

const SCHEDULED_SERVICES = new Set(['photo-studio', 'podcast-studio', 'meeting-rooms', 'events', 'workshops', 'webinars']);
/* Resource assignment is enforced by the API, but no resource inventory exists yet,
   so imported plans never require one. Switch it on per plan in admin once rooms,
   desks and studios are modelled, otherwise checkout would fail closed. */
const REQUIRE_RESOURCE = false;

function mapPeriod(rawPeriod: string, service: string): Mapping {
  const period = rawPeriod.trim().toLowerCase();
  const scheduled = SCHEDULED_SERVICES.has(service);
  if (period === 'month' || period === 'monthly') return {billingType: 'RECURRING', interval: 'MONTH', pricingUnit: 'PACKAGE', requiresSchedule: false, requiresResource: false, maxQuantity: 1, active: true};
  if (period === 'year' || period === 'yearly' || period === 'annual') return {billingType: 'RECURRING', interval: 'YEAR', pricingUnit: 'PACKAGE', requiresSchedule: false, requiresResource: false, maxQuantity: 1, active: true};
  if (/^(per\/?\s*hour|1 hour|hour|hourly)$/.test(period)) return {billingType: 'ONE_TIME', pricingUnit: 'HOUR', durationMinutes: 60, requiresSchedule: scheduled, requiresResource: scheduled, maxQuantity: 12, active: true};
  if (period === 'half day') return {billingType: 'ONE_TIME', pricingUnit: 'SESSION', durationMinutes: 240, requiresSchedule: scheduled, requiresResource: scheduled, maxQuantity: 1, active: true};
  if (period === 'full day' || period === 'day') return {billingType: 'ONE_TIME', pricingUnit: 'SESSION', durationMinutes: 480, requiresSchedule: scheduled, requiresResource: scheduled, maxQuantity: 1, active: true};
  const hours = period.match(/^(?:up to\s+)?(\d+)\s*hours?$/);
  if (hours) return {billingType: 'ONE_TIME', pricingUnit: 'SESSION', durationMinutes: Number(hours[1]) * 60, requiresSchedule: scheduled, requiresResource: scheduled, maxQuantity: 1, active: true};
  if (period.includes('state filing fee')) return {billingType: 'ONE_TIME', pricingUnit: 'PACKAGE', requiresSchedule: false, requiresResource: false, maxQuantity: 1, active: true};
  return {billingType: 'ONE_TIME', pricingUnit: 'PACKAGE', requiresSchedule: false, requiresResource: false, maxQuantity: 1, active: false, needsReview: 'Ambiguous billing period "' + rawPeriod + '". Confirm one-time vs recurring before selling.'};
}

async function main() {
  /* Only reviewed, publicly visible pricing records are imported: the same
     eligibility the public API applies (no requiresReview, not disabled). */
  const all = await db.content.findMany({where: {kind: 'pricing', status: 'PUBLISHED'}, orderBy: {sortOrder: 'asc'}});
  const rows = all.filter(row => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return meta.requiresReview !== true && meta.enabled !== false;
  });
  let created = 0;
  let skipped = 0;
  let review = 0;
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const price = Number(meta.price);
    if (!Number.isFinite(price) || price < 0) {
      skipped += 1;
      continue;
    }
    const service = String(meta.service ?? 'other');
    const mapping = mapPeriod(String(meta.billingPeriod ?? ''), service);
    const slug = row.slug.replace(/^approved-/, '').slice(0, 190);
    const existing = await db.plan.findUnique({where: {slug}});
    if (existing) {
      skipped += 1;
      continue;
    }
    await db.plan.create({
      data: {
        slug,
        name: row.title,
        serviceType: service,
        description: String(row.excerpt ?? ''),
        billingType: mapping.billingType,
        interval: mapping.interval ?? null,
        unitAmount: Math.round(price * 100),
        currency: String(meta.currency ?? 'usd').toLowerCase(),
        pricingUnit: mapping.pricingUnit,
        durationMinutes: mapping.durationMinutes ?? null,
        minQuantity: 1,
        maxQuantity: mapping.maxQuantity,
        requiresSchedule: mapping.requiresSchedule,
        requiresResource: REQUIRE_RESOURCE && mapping.requiresResource,
        requiresOnboarding: ['virtual-office', 'business-address', 'virtual-mailbox', 'llc-setup'].includes(service),
        includedCredits: [],
        active: mapping.active,
        sortOrder: row.sortOrder,
        metadata: {
          sourceContentId: row.id,
          sourceSlug: row.slug,
          billingPeriodLabel: meta.billingPeriod ?? null,
          features: meta.features ?? [],
          evidence: meta.evidence ?? null,
          ...(mapping.needsReview ? {needsReview: mapping.needsReview} : {}),
          ...(service === 'llc-setup' ? {stateFilingFeeSeparate: true} : {}),
        },
      },
    });
    created += 1;
    if (mapping.needsReview) review += 1;
  }
  console.log('Plans imported: ' + created + ' created, ' + skipped + ' skipped (already present or no price), ' + review + ' need admin review before sale.');
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
