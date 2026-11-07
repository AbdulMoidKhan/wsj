/**
 * Dynamic service catalog: services, packages, a reusable add-on library and
 * amenities, all editable from the admin portal with no code change.
 *
 * Two rules shape this module:
 *  1. The browser never sends an amount. It names catalog entries (service
 *     slug, plan slug, add-on slugs, hours/days/quantity) and the server
 *     recomputes every cent from the database before Stripe is contacted.
 *  2. Editing a price here never rewrites history. Orders keep their own
 *     snapshot (OrderItem.unitAmount) and live subscriptions keep the Stripe
 *     price they were created with, so a change only affects new purchases.
 *
 * Until the catalog is seeded the public endpoints project the legacy Plan
 * table into the same shape, so the public site and booking dialog keep
 * working on a database that has no catalog rows yet.
 */
import {Controller, Get, Post, Patch, Delete, Param, Query, Req, UseGuards, Inject, Injectable, BadRequestException, NotFoundException} from '@nestjs/common';
import {ApiBearerAuth, ApiTags} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, Max, MinLength, ValidateNested, IsDateString} from 'class-validator';
import {Type, Transform} from 'class-transformer';
import {Db, AuthGuard, Roles} from './core';
import {ValidatedBody} from './validation';
import {audit} from './admin';
import {BILLING_TERMS_VERSION, describeInterval, PricingError, selectionErrors, type PlanLike, type BillingIntervalValue, type BillingTypeValue} from './billing-core';
import {
  BILLING_UNITS,
  BOOKING_FLOWS,
  billingTypeFor,
  billingUnitLabel,
  buildQuoteLine,
  effectiveAddOnPrice,
  flowSteps,
  intervalFor,
  isBillingUnit,
  isSellable,
  quantityBasis,
  quantityNoun,
  requiresSchedule,
  resolveUnits,
  type BillingUnit,
  type BookingFlow,
  type FlowStep,
  type QuoteLine,
} from './catalog-core';
import {BillingService, type PricedLine} from './billing';
import {cachedCatalog as cached, clearCatalogCache} from './catalog-cache';
export {clearCatalogCache} from './catalog-cache';

/* ───────────────────────────── Stored row shapes ─────────────────────────────
   These mirror the Prisma models in schema.prisma. They are declared here so
   the business logic below is fully typed while the catalog delegates are
   reached through one narrow facade (see `tables`), which keeps this module
   compiling against a generated client regardless of its generation order.
   ──────────────────────────────────────────────────────────────────────────── */

export interface ServiceRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryBadge: string | null;
  iconName: string;
  heroImageUrl: string | null;
  displayOrder: number;
  active: boolean;
  flowType: BookingFlow;
  customSteps: unknown;
  metadata: Record<string, unknown>;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  plans?: PlanRow[];
  serviceAddOns?: ServiceAddOnRow[];
  serviceAmenities?: ServiceAmenityRow[];
  _count?: {plans: number; serviceAddOns: number; serviceAmenities: number};
}

export interface PlanRow {
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
  archivedAt: Date | null;
  sortOrder: number;
  rulesNotice: string | null;
  governmentNotice: string | null;
  adminFlagNote: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  service?: ServiceRow;
  planAddOns?: PlanAddOnRow[];
  planAmenities?: PlanAmenityRow[];
}

export interface AddOnRow {
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
  archivedAt: Date | null;
  adminFlagNote: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  serviceAddOns?: ServiceAddOnRow[];
  planAddOns?: PlanAddOnRow[];
}

export interface AmenityRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconUrl: string | null;
  iconName: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  serviceAmenities?: ServiceAmenityRow[];
  planAmenities?: PlanAmenityRow[];
}

export interface ServiceAddOnRow {
  serviceId: string;
  addOnId: string;
  priceOverrideCents: number | null;
  isRequired: boolean;
  sortOrder: number;
  addOn?: AddOnRow;
  service?: ServiceRow;
}
export interface PlanAddOnRow {
  planId: string;
  addOnId: string;
  priceOverrideCents: number | null;
  isRequired: boolean;
  sortOrder: number;
  addOn?: AddOnRow;
  plan?: PlanRow;
}
export interface ServiceAmenityRow {
  serviceId: string;
  amenityId: string;
  sortOrder: number;
  amenity?: AmenityRow;
}
export interface PlanAmenityRow {
  planId: string;
  amenityId: string;
  sortOrder: number;
  amenity?: AmenityRow;
}

/** Narrow Prisma delegate surface actually used by this module. */
interface Delegate {
  findMany<T>(args?: Record<string, unknown>): Promise<T[]>;
  findFirst<T>(args?: Record<string, unknown>): Promise<T | null>;
  findUnique<T>(args: Record<string, unknown>): Promise<T | null>;
  create<T>(args: Record<string, unknown>): Promise<T>;
  update<T>(args: Record<string, unknown>): Promise<T>;
  upsert<T>(args: Record<string, unknown>): Promise<T>;
  delete<T>(args: Record<string, unknown>): Promise<T>;
  deleteMany(args?: Record<string, unknown>): Promise<{count: number}>;
  count(args?: Record<string, unknown>): Promise<number>;
}

function tables(db: Db) {
  const client = db as unknown as Record<string, Delegate>;
  return {
    services: client.serviceCategory,
    plans: client.catalogPlan,
    addOns: client.catalogAddOn,
    amenities: client.catalogAmenity,
    serviceAddOns: client.serviceAddOn,
    planAddOns: client.planAddOn,
    serviceAmenities: client.serviceAmenity,
    planAmenities: client.planAmenity,
  };
}

/* ───────────────────────────── DTOs ───────────────────────────── */

const slugRule = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const trim = Transform(({value}) => (typeof value === 'string' ? value.trim() : value));
const lower = Transform(({value}) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class ServiceDto {
  @lower @Matches(slugRule, {message: 'Slug must be lower-case words separated by single hyphens'}) @MaxLength(200) slug!: string;
  @trim @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) categoryBadge?: string;
  @IsOptional() @IsString() @MaxLength(60) iconName?: string;
  @IsOptional() @IsString() @MaxLength(2000) heroImageUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) displayOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsIn(BOOKING_FLOWS as unknown as string[]) flowType?: BookingFlow;
  @IsOptional() @IsArray() customSteps?: string[];
  @IsOptional() metadata?: Record<string, unknown>;
}
export class ServiceUpdateDto extends ServiceDto {
  @IsOptional() @lower @Matches(slugRule) @MaxLength(200) declare slug: string;
  @IsOptional() @trim @IsString() @MinLength(1) @MaxLength(200) declare name: string;
}

export class PlanDto {
  @lower @Matches(slugRule, {message: 'Slug must be lower-case words separated by single hyphens'}) @MaxLength(200) slug!: string;
  @IsUUID() serviceId!: string;
  @trim @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  /** Whole cents. The admin UI converts the dollar input before sending. */
  @Type(() => Number) @IsInt() @Min(0) @Max(100000000) unitAmountCents!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsIn(BILLING_UNITS as unknown as string[]) billingUnit!: BillingUnit;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10080) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650) durationDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(500) minQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) maxQuantity?: number;
  @IsOptional() @IsString() @MaxLength(120) capacityText?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) capacityMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) capacityMax?: number;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(-2147483648) @Max(2147483647) sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(2000) rulesNotice?: string;
  @IsOptional() @IsString() @MaxLength(2000) governmentNotice?: string;
  @IsOptional() @IsString() @MaxLength(2000) adminFlagNote?: string;
  @IsOptional() metadata?: Record<string, unknown>;
}
export class PlanUpdateDto extends PlanDto {
  @IsOptional() @lower @Matches(slugRule) @MaxLength(200) declare slug: string;
  @IsOptional() @IsUUID() declare serviceId: string;
  @IsOptional() @trim @IsString() @MinLength(1) @MaxLength(200) declare name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000) declare unitAmountCents: number;
  @IsOptional() @IsIn(BILLING_UNITS as unknown as string[]) declare billingUnit: BillingUnit;
}

export class AddOnDto {
  @lower @Matches(slugRule, {message: 'Slug must be lower-case words separated by single hyphens'}) @MaxLength(200) slug!: string;
  @trim @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000000) unitAmountCents!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsIn(BILLING_UNITS as unknown as string[]) billingUnit!: BillingUnit;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(500) minQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) maxQuantity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(500) defaultQuantity?: number;
  @IsOptional() @IsString() @MaxLength(2000) imageUrl?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  /** Internal note, e.g. a price that two sources disagree on. Never shown publicly. */
  @IsOptional() @IsString() @MaxLength(2000) adminFlagNote?: string;
  @IsOptional() metadata?: Record<string, unknown>;
}
export class AddOnUpdateDto extends AddOnDto {
  @IsOptional() @lower @Matches(slugRule) @MaxLength(200) declare slug: string;
  @IsOptional() @trim @IsString() @MinLength(1) @MaxLength(200) declare name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000) declare unitAmountCents: number;
  @IsOptional() @IsIn(BILLING_UNITS as unknown as string[]) declare billingUnit: BillingUnit;
}

export class AmenityDto {
  @IsOptional() @lower @Matches(slugRule) @MaxLength(200) slug?: string;
  @trim @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) iconUrl?: string;
  @IsOptional() @IsString() @MaxLength(60) iconName?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class AmenityUpdateDto extends AmenityDto {
  @IsOptional() @trim @IsString() @MinLength(1) @MaxLength(200) declare name: string;
}

export class AssignAddOnDto {
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsUUID() addOnId!: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  /** Whole cents. Null clears the override and falls back to the library price. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000000) priceOverrideCents?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class AssignAmenityDto {
  @IsOptional() @IsUUID() serviceId?: string;
  @IsOptional() @IsUUID() planId?: string;
  @IsUUID() amenityId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class ReorderDto {
  @IsArray() @ValidateNested({each: true}) @Type(() => ReorderEntryDto) items!: ReorderEntryDto[];
}
export class ReorderEntryDto {
  @IsUUID() id!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) displayOrder!: number;
}

export class QuoteAddOnDto {
  @lower @IsString() @MinLength(1) @MaxLength(200) slug!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(500) quantity?: number;
}

export class CatalogQuoteDto {
  @lower @IsString() @MinLength(1) @MaxLength(200) planSlug!: string;
  @IsOptional() @IsArray() @ValidateNested({each: true}) @Type(() => QuoteAddOnDto) addOns?: QuoteAddOnDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) durationHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) quantity?: number;
  @IsOptional() @IsString() @MaxLength(100) couponCode?: string;
}

export class CatalogCheckoutDto extends CatalogQuoteDto {
  @trim @IsString() @MinLength(1) @MaxLength(200) customerName!: string;
  @lower @IsEmail() @MaxLength(254) customerEmail!: string;
  @IsOptional() @IsString() @MaxLength(50) customerPhone?: string;
  @IsOptional() @IsDateString({strict: true}) @MaxLength(40) startAt?: string;
  @IsOptional() @IsString() @MaxLength(100) resourceId?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(120) membershipCircle?: string;
  @IsOptional() @IsBoolean() acceptRecurringTerms?: boolean;
  @IsOptional() @IsBoolean() embedded?: boolean;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

/* ───────────────────────────── Public views ───────────────────────────── */

const titleCase = (value: string) => value.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

export interface AddOnView {
  slug: string;
  name: string;
  description: string;
  unitAmountCents: number;
  listPriceCents: number;
  hasOverride: boolean;
  currency: string;
  billingUnit: BillingUnit;
  unitLabel: string;
  quantityBasis: string;
  quantityNoun: string;
  billingType: BillingTypeValue;
  interval: BillingIntervalValue | null;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  imageUrl: string | null;
  isRequired: boolean;
  sortOrder: number;
}

function amenityView(row: AmenityRow) {
  return {slug: row.slug, name: row.name, description: row.description, iconName: row.iconName, iconUrl: row.iconUrl};
}

/** Public add-on shape. The admin-only review note is deliberately omitted. */
function addOnView(addOn: AddOnRow, link?: {priceOverrideCents: number | null; isRequired: boolean; sortOrder: number}): AddOnView {
  const price = effectiveAddOnPrice(addOn.unitAmountCents, link?.priceOverrideCents ?? null);
  return {
    slug: addOn.slug,
    name: addOn.name,
    description: addOn.description,
    unitAmountCents: price,
    listPriceCents: addOn.unitAmountCents,
    hasOverride: price !== addOn.unitAmountCents,
    currency: addOn.currency,
    billingUnit: addOn.billingUnit,
    unitLabel: billingUnitLabel(addOn.billingUnit),
    quantityBasis: quantityBasis(addOn.billingUnit),
    quantityNoun: quantityNoun(addOn.billingUnit),
    billingType: billingTypeFor(addOn.billingUnit),
    interval: intervalFor(addOn.billingUnit),
    minQuantity: addOn.minQuantity,
    maxQuantity: addOn.maxQuantity,
    defaultQuantity: addOn.defaultQuantity,
    imageUrl: addOn.imageUrl,
    isRequired: link?.isRequired ?? false,
    sortOrder: link?.sortOrder ?? 0,
  };
}

function planView(plan: PlanRow, options: {serviceSlug: string; addOns: AddOnView[]; amenities: ReturnType<typeof amenityView>[]}) {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    serviceSlug: options.serviceSlug,
    unitAmountCents: plan.unitAmountCents,
    currency: plan.currency,
    billingUnit: plan.billingUnit,
    unitLabel: billingUnitLabel(plan.billingUnit),
    quantityBasis: quantityBasis(plan.billingUnit),
    quantityNoun: quantityNoun(plan.billingUnit),
    billingType: billingTypeFor(plan.billingUnit),
    interval: intervalFor(plan.billingUnit),
    intervalDescription: describeInterval(intervalFor(plan.billingUnit)),
    requiresSchedule: requiresSchedule(plan.billingUnit),
    durationMinutes: plan.durationMinutes,
    durationDays: plan.durationDays,
    minQuantity: plan.minQuantity,
    maxQuantity: plan.maxQuantity,
    capacityText: plan.capacityText,
    capacityMin: plan.capacityMin,
    capacityMax: plan.capacityMax,
    featured: plan.featured,
    sortOrder: plan.sortOrder,
    rulesNotice: plan.rulesNotice,
    governmentNotice: plan.governmentNotice,
    metadata: plan.metadata,
    addOns: options.addOns,
    amenities: options.amenities,
  };
}

/* ───────────────────────────── Service ───────────────────────────── */

/** A plan resolved for pricing, whatever table it came from. */
interface ResolvedPlan {
  source: 'CATALOG' | 'LEGACY';
  legacyPlanId: string | null;
  slug: string;
  name: string;
  description: string;
  unitAmountCents: number;
  currency: string;
  billingUnit: BillingUnit;
  minQuantity: number;
  maxQuantity: number;
  active: boolean;
  archivedAt: Date | null;
  rulesNotice: string | null;
  governmentNotice: string | null;
  serviceSlug: string;
  serviceName: string;
  flowType: BookingFlow;
  planId: string | null;
  intervalCount: number;
  requiresSchedule: boolean;
  legacyPlan?: PlanLike;
  includedCredits?: unknown[];
}

/** Legacy pricing units map onto the richer catalog billing units. */
function legacyBillingUnit(plan: {billingType: string; interval: string | null; pricingUnit: string}): BillingUnit {
  if (plan.billingType === 'RECURRING') return plan.interval === 'YEAR' ? 'PER_YEAR' : 'PER_MONTH';
  switch (plan.pricingUnit) {
    case 'HOUR':
      return 'PER_HOUR';
    case 'DAY':
      return 'PER_DAY';
    case 'SESSION':
      return 'PER_SESSION';
    case 'ITEM':
      return 'PER_ITEM';
    default:
      return 'ONE_TIME';
  }
}

@Injectable()
export class CatalogService {
  constructor(@Inject(Db) private db: Db, @Inject(BillingService) private billing: BillingService) {}

  private get t() {
    return tables(this.db);
  }

  /* ── Reads ── */

  async activeServices() {
    return this.t.services.findMany<ServiceRow>({
      where: {active: true, archivedAt: null},
      orderBy: [{displayOrder: 'asc'}, {name: 'asc'}],
      include: {
        plans: {where: {active: true, archivedAt: null}, orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}]},
        serviceAddOns: {include: {addOn: true}, orderBy: {sortOrder: 'asc'}},
        serviceAmenities: {include: {amenity: true}, orderBy: {sortOrder: 'asc'}},
      },
    });
  }

  /** Only summary inputs; keep activeServices()'s full rows for other callers. */
  private async activeServiceSummaries() {
    return this.t.services.findMany<ServiceRow>({
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
        serviceAddOns: {
          select: {addOn: {select: {active: true, archivedAt: true}}},
        },
      },
    });
  }

  /** Add-ons offered with a plan: the service library, overridden per package. */
  private addOnsFor(service: ServiceRow, plan?: PlanRow): AddOnView[] {
    const byId = new Map<string, AddOnView>();
    for (const link of service.serviceAddOns ?? []) {
      if (!link.addOn || !isSellable(link.addOn)) continue;
      byId.set(link.addOnId, addOnView(link.addOn, link));
    }
    for (const link of plan?.planAddOns ?? []) {
      if (!link.addOn || !isSellable(link.addOn)) continue;
      byId.set(link.addOnId, addOnView(link.addOn, link));
    }
    return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.unitAmountCents - b.unitAmountCents);
  }

  private amenitiesFor(service: ServiceRow, plan?: PlanRow) {
    const byId = new Map<string, ReturnType<typeof amenityView>>();
    for (const link of service.serviceAmenities ?? []) if (link.amenity?.active) byId.set(link.amenityId, amenityView(link.amenity));
    for (const link of plan?.planAmenities ?? []) if (link.amenity?.active) byId.set(link.amenityId, amenityView(link.amenity));
    return [...byId.values()];
  }

  private serviceSummary(service: ServiceRow) {
    const plans = (service.plans ?? []).filter(plan => plan.active && !plan.archivedAt);
    const prices = plans.map(plan => plan.unitAmountCents);
    return {
      slug: service.slug,
      name: service.name,
      description: service.description,
      categoryBadge: service.categoryBadge,
      iconName: service.iconName,
      heroImageUrl: service.heroImageUrl,
      displayOrder: service.displayOrder,
      flowType: service.flowType,
      customSteps: Array.isArray(service.customSteps) ? service.customSteps : [],
      planCount: plans.length,
      priceFromCents: prices.length ? Math.min(...prices) : null,
      currency: plans[0]?.currency ?? 'usd',
      addOnCount: (service.serviceAddOns ?? []).filter(link => link.addOn && isSellable(link.addOn)).length,
      metadata: service.metadata,
    };
  }

  serviceDetail(service: ServiceRow) {
    const plans = (service.plans ?? []).filter(plan => plan.active && !plan.archivedAt);
    const serviceAddOns = this.addOnsFor(service);
    const serviceAmenities = this.amenitiesFor(service);
    const planViews = plans.map(plan => planView(plan, {serviceSlug: service.slug, addOns: this.addOnsFor(service, plan), amenities: this.amenitiesFor(service, plan)}));
    return {
      ...this.serviceSummary(service),
      steps: flowSteps({
        flowType: service.flowType,
        customSteps: service.customSteps,
        hasAddOns: serviceAddOns.length > 0 || planViews.some(plan => plan.addOns.length > 0),
        hasAmenities: serviceAmenities.length > 0 || planViews.some(plan => plan.amenities.length > 0),
        needsSchedule: planViews.some(plan => plan.requiresSchedule),
      }),
      amenities: serviceAmenities,
      addOns: serviceAddOns,
      plans: planViews,
      termsVersion: BILLING_TERMS_VERSION,
    };
  }

  /* ── Legacy projection ──
     Keeps the public contract stable on a database whose catalog is not seeded
     yet: legacy plans are grouped by serviceType and shown in catalog shape. */

  private async legacyServices() {
    const plans = await this.db.plan.findMany({where: {active: true, archivedAt: null}, orderBy: [{serviceType: 'asc'}, {sortOrder: 'asc'}, {unitAmount: 'asc'}]});
    const groups = new Map<string, typeof plans>();
    const globalAddOns = plans.filter(plan => (plan.metadata as Record<string, unknown> | null)?.addOnGlobal === true);
    for (const plan of plans) {
      if ((plan.metadata as Record<string, unknown> | null)?.addOn) continue;
      const list = groups.get(plan.serviceType) ?? [];
      list.push(plan);
      groups.set(plan.serviceType, list);
    }
    return [...groups.entries()].map(([serviceType, servicePlans], index) => {
      const attached = [...plans.filter(plan => (plan.metadata as Record<string, unknown> | null)?.addOn && plan.serviceType === serviceType), ...globalAddOns];
      const unique = new Map(attached.map(plan => [plan.slug, plan]));
      const addOns: AddOnView[] = [...unique.values()].map((plan, order) => ({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        unitAmountCents: plan.unitAmount,
        listPriceCents: plan.unitAmount,
        hasOverride: false,
        currency: plan.currency,
        billingUnit: legacyBillingUnit(plan as never),
        unitLabel: billingUnitLabel(legacyBillingUnit(plan as never)),
        quantityBasis: quantityBasis(legacyBillingUnit(plan as never)),
        quantityNoun: quantityNoun(legacyBillingUnit(plan as never)),
        billingType: billingTypeFor(legacyBillingUnit(plan as never)),
        interval: intervalFor(legacyBillingUnit(plan as never)),
        minQuantity: 0,
        maxQuantity: Math.max(1, plan.maxQuantity),
        defaultQuantity: 1,
        imageUrl: null,
        isRequired: false,
        sortOrder: order,
      }));
      const planViews = servicePlans.map(plan => {
        const unit = legacyBillingUnit(plan as never);
        return {
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          serviceSlug: serviceType,
          unitAmountCents: plan.unitAmount,
          currency: plan.currency,
          billingUnit: unit,
          unitLabel: billingUnitLabel(unit),
          quantityBasis: quantityBasis(unit),
          quantityNoun: quantityNoun(unit),
          billingType: billingTypeFor(unit),
          interval: intervalFor(unit),
          intervalDescription: describeInterval(intervalFor(unit), plan.intervalCount),
          requiresSchedule: plan.requiresSchedule,
          durationMinutes: plan.durationMinutes,
          durationDays: null,
          minQuantity: plan.minQuantity,
          maxQuantity: plan.maxQuantity,
          capacityText: null,
          capacityMin: null,
          capacityMax: null,
          featured: false,
          sortOrder: plan.sortOrder,
          rulesNotice: null,
          governmentNotice: null,
          metadata: plan.metadata as Record<string, unknown>,
          addOns,
          amenities: [] as ReturnType<typeof amenityView>[],
        };
      });
      const flowType: BookingFlow = serviceType === 'memberships' ? 'MEMBERSHIP' : addOns.length ? 'STANDARD' : 'NO_EXTRAS';
      return {
        slug: serviceType,
        name: titleCase(serviceType),
        description: '',
        categoryBadge: null,
        iconName: 'Layers',
        heroImageUrl: null,
        displayOrder: index,
        flowType,
        customSteps: [] as string[],
        planCount: planViews.length,
        priceFromCents: planViews.length ? Math.min(...planViews.map(plan => plan.unitAmountCents)) : null,
        currency: planViews[0]?.currency ?? 'usd',
        addOnCount: addOns.length,
        metadata: {} as Record<string, unknown>,
        steps: flowSteps({flowType, customSteps: [], hasAddOns: addOns.length > 0, hasAmenities: false, needsSchedule: planViews.some(plan => plan.requiresSchedule)}),
        amenities: [] as ReturnType<typeof amenityView>[],
        addOns,
        plans: planViews,
        termsVersion: BILLING_TERMS_VERSION,
      };
    });
  }

  /** True when an administrator has published at least one catalog service. */
  async hasCatalog(): Promise<boolean> {
    return (await this.t.services.count({where: {active: true, archivedAt: null}})) > 0;
  }

  async publicServices() {
    return cached('services', async () => {
      const services = await this.activeServiceSummaries();
      if (services.length || await this.t.services.count() > 0) {
        return {source: 'CATALOG' as const, termsVersion: BILLING_TERMS_VERSION, items: services.map(service => this.serviceSummary(service))};
      }
      const legacy = await this.legacyServices();
      return {source: 'LEGACY' as const, termsVersion: BILLING_TERMS_VERSION, items: legacy.map(({steps, amenities, addOns, plans, termsVersion, ...summary}) => summary)};
    });
  }

  async publicService(slug: string) {
    return cached('service:' + slug, async () => {
      const service = await this.t.services.findFirst<ServiceRow>({
        where: {slug},
        include: {
          plans: {where: {active: true, archivedAt: null}, orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}], include: {planAddOns: {include: {addOn: true}, orderBy: {sortOrder: 'asc'}}, planAmenities: {include: {amenity: true}, orderBy: {sortOrder: 'asc'}}}},
          serviceAddOns: {include: {addOn: true}, orderBy: {sortOrder: 'asc'}},
          serviceAmenities: {include: {amenity: true}, orderBy: {sortOrder: 'asc'}},
        },
      });
      if (service) {
        if (!service.active || service.archivedAt) throw new NotFoundException('Unknown service');
        return this.serviceDetail(service);
      }
      const legacy = (await this.legacyServices()).find(entry => entry.slug === slug);
      if (!legacy) throw new NotFoundException('Unknown service');
      return legacy;
    });
  }

  async publicPlan(slug: string) {
    return cached('plan:' + slug, async () => {
      const plan = await this.t.plans.findFirst<PlanRow>({
        where: {slug},
        include: {
          service: {include: {serviceAddOns: {include: {addOn: true}, orderBy: {sortOrder: 'asc'}}, serviceAmenities: {include: {amenity: true}, orderBy: {sortOrder: 'asc'}}}},
          planAddOns: {include: {addOn: true}, orderBy: {sortOrder: 'asc'}},
          planAmenities: {include: {amenity: true}, orderBy: {sortOrder: 'asc'}},
        },
      });
      if (plan) {
        if (!isSellable(plan) || !plan.service?.active || plan.service.archivedAt) throw new NotFoundException('Unknown package');
        const service = plan.service;
        return {
          ...planView(plan, {serviceSlug: service.slug, addOns: this.addOnsFor(service, plan), amenities: this.amenitiesFor(service, plan)}),
          service: {slug: service.slug, name: service.name, flowType: service.flowType, iconName: service.iconName, categoryBadge: service.categoryBadge},
          termsVersion: BILLING_TERMS_VERSION,
        };
      }
      for (const service of await this.legacyServices()) {
        const legacy = service.plans.find(entry => entry.slug === slug);
        if (legacy) return {...legacy, service: {slug: service.slug, name: service.name, flowType: service.flowType, iconName: service.iconName, categoryBadge: null}, termsVersion: BILLING_TERMS_VERSION};
      }
      throw new NotFoundException('Unknown package');
    });
  }

  /* ── Server-authoritative pricing ── */

  private async resolvePlan(slug: string): Promise<{plan: ResolvedPlan; addOns: Map<string, AddOnView>}> {
    const row = await this.t.plans.findFirst<PlanRow>({
      where: {slug},
      include: {
        service: {include: {serviceAddOns: {include: {addOn: true}}, serviceAmenities: {include: {amenity: true}}}},
        planAddOns: {include: {addOn: true}},
      },
    });
    if (row?.service) {
      if (!isSellable(row) || !row.service.active || row.service.archivedAt) throw new BadRequestException(row.name + ' is not available for sale');
      const views = this.addOnsFor(row.service, row);
      return {
        plan: {
          source: 'CATALOG',
          legacyPlanId: null,
          planId: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          unitAmountCents: row.unitAmountCents,
          currency: row.currency,
          billingUnit: row.billingUnit,
          minQuantity: row.minQuantity,
          maxQuantity: row.maxQuantity,
          active: row.active,
          archivedAt: row.archivedAt,
          rulesNotice: row.rulesNotice,
          governmentNotice: row.governmentNotice,
          serviceSlug: row.service.slug,
          serviceName: row.service.name,
          flowType: row.service.flowType,
          intervalCount: 1,
          requiresSchedule: requiresSchedule(row.billingUnit),
          includedCredits: Array.isArray(row.metadata?.includedCredits) ? row.metadata.includedCredits : [],
        },
        addOns: new Map(views.map(view => [view.slug, view])),
      };
    }

    const legacy = await this.db.plan.findFirst({where: {slug, active: true, archivedAt: null}});
    if (!legacy) throw new BadRequestException('Unknown or unavailable package: ' + slug);
    const service = (await this.legacyServices()).find(entry => entry.plans.some(plan => plan.slug === slug));
    const unit = legacyBillingUnit(legacy as never);
    return {
      plan: {
        source: 'LEGACY',
        legacyPlanId: legacy.id,
        planId: null,
        slug: legacy.slug,
        name: legacy.name,
        description: legacy.description,
        unitAmountCents: legacy.unitAmount,
        currency: legacy.currency,
        billingUnit: unit,
        minQuantity: legacy.minQuantity,
        maxQuantity: legacy.maxQuantity,
        active: legacy.active,
        archivedAt: legacy.archivedAt,
        rulesNotice: null,
        governmentNotice: null,
        serviceSlug: service?.slug ?? legacy.serviceType,
        serviceName: service?.name ?? titleCase(legacy.serviceType),
        flowType: service?.flowType ?? 'STANDARD',
        intervalCount: legacy.intervalCount || 1,
        requiresSchedule: legacy.requiresSchedule,
        legacyPlan: legacy as PlanLike,
      },
      addOns: new Map((service?.addOns ?? []).map(view => [view.slug, view])),
    };
  }

  /** Legacy add-ons are themselves plan rows; catalog add-ons are not. */
  private async legacyAddOn(slug: string) {
    return this.db.plan.findFirst({where: {slug, active: true, archivedAt: null}});
  }

  /**
   * Turn a selection of catalog references into priced lines. Every amount is
   * read from the database here; nothing the client sent is trusted but the
   * slugs and the counts, and the counts are clamped to catalog bounds.
   */
  async priceSelection(dto: CatalogQuoteDto) {
    const {plan, addOns} = await this.resolvePlan(dto.planSlug);
    const errors: string[] = [];
    const lines: QuoteLine[] = [];

    try {
      const units = resolveUnits(
        {name: plan.name, unitAmountCents: plan.unitAmountCents, billingUnit: plan.billingUnit, minQuantity: plan.minQuantity, maxQuantity: plan.maxQuantity},
        {quantity: dto.quantity, durationHours: dto.durationHours, days: dto.days},
      );
      lines.push(buildQuoteLine({kind: 'PLAN', slug: plan.slug, name: plan.name, unitAmountCents: plan.unitAmountCents, currency: plan.currency, billingUnit: plan.billingUnit, units}));
    } catch (error) {
      errors.push(error instanceof PricingError ? error.message : 'This package cannot be priced');
    }

    const requested = new Map<string, number | undefined>();
    for (const entry of dto.addOns ?? []) {
      if (requested.has(entry.slug)) {
        errors.push('Duplicate add-on: ' + entry.slug);
        continue;
      }
      requested.set(entry.slug, entry.quantity);
    }
    /* Required add-ons are charged whether or not the browser asked for them. */
    for (const [slug, view] of addOns) if (view.isRequired && !requested.has(slug)) requested.set(slug, view.defaultQuantity || 1);

    for (const [slug, quantity] of requested) {
      const view = addOns.get(slug);
      if (!view) {
        errors.push('Add-on not available for this package: ' + slug);
        continue;
      }
      try {
        const units = resolveUnits(
          {name: view.name, unitAmountCents: view.unitAmountCents, billingUnit: view.billingUnit, minQuantity: Math.max(view.isRequired ? 1 : 0, view.minQuantity), maxQuantity: view.maxQuantity},
          {quantity: quantity ?? view.defaultQuantity},
          {allowZero: !view.isRequired},
        );
        if (units <= 0) continue;
        lines.push(buildQuoteLine({kind: 'ADDON', slug: view.slug, name: view.name, unitAmountCents: view.unitAmountCents, currency: view.currency, billingUnit: view.billingUnit, units}));
      } catch (error) {
        errors.push(error instanceof PricingError ? error.message : 'Invalid quantity for ' + view.name);
      }
    }
    if (errors.length) throw new BadRequestException(errors);

    const priced: PricedLine[] = [];
    const legacySelections: Array<{plan: PlanLike; quantity: number}> = [];
    for (const line of lines) {
      const legacy = plan.source === 'LEGACY' ? (line.kind === 'PLAN' ? plan.legacyPlan : await this.legacyAddOn(line.slug)) : undefined;
      if (plan.source === 'LEGACY' && !legacy) throw new BadRequestException('Unknown or unavailable package: ' + line.slug);
      const legacyId = legacy && 'id' in legacy ? String(legacy.id) : null;
      if (legacy) legacySelections.push({plan: legacy as PlanLike, quantity: line.units});
      priced.push({
        planId: legacyId,
        slug: line.slug,
        name: line.name,
        description: line.kind === 'PLAN' ? plan.description || plan.serviceName : line.description,
        currency: line.currency,
        unitAmount: line.unitAmountCents,
        quantity: line.units,
        amount: line.amount,
        billingType: line.billingType,
        interval: line.interval,
        intervalCount: legacy?.intervalCount || plan.intervalCount,
        metadata: {
          slug: line.slug, kind: line.kind, serviceType: plan.serviceSlug, billingUnit: line.billingUnit, units: line.units, source: plan.source,
          ...(plan.source === 'CATALOG' && line.kind === 'PLAN' ? {catalogPlan: {id: plan.planId, slug: plan.slug, name: plan.name, serviceType: plan.serviceSlug, includedCredits: plan.includedCredits ?? []}} : {}),
        },
      });
    }
    const bundle = await this.billing.totalsFor(priced, dto.couponCode);
    return {plan, lines, priced: bundle, legacySelections};
  }

  async quote(dto: CatalogQuoteDto) {
    const {plan, lines, priced} = await this.priceSelection(dto);
    return {
      planSlug: plan.slug,
      serviceSlug: plan.serviceSlug,
      currency: priced.currency,
      items: lines.map(line => ({kind: line.kind, slug: line.slug, name: line.name, unitAmountCents: line.unitAmountCents, units: line.units, amount: line.amount, billingUnit: line.billingUnit, unitLabel: line.unitLabel, description: line.description, billingType: line.billingType, interval: line.interval})),
      ...priced.totals,
      recurringDescription: priced.totals.recurringInterval ? describeInterval(priced.totals.recurringInterval, plan.intervalCount) : null,
      discountCode: priced.coupon?.discount.code ?? null,
      discountDuration: priced.coupon?.discount.duration ?? null,
      discountDurationInMonths: priced.coupon?.discount.durationInMonths ?? null,
      notices: {rulesNotice: plan.rulesNotice, governmentNotice: plan.governmentNotice},
      termsVersion: priced.hasRecurring ? BILLING_TERMS_VERSION : null,
    };
  }

  /** Checkout reuses the billing service, so orders, subscriptions, webhooks
      and the audit trail behave exactly as they do for legacy packages. */
  async checkout(dto: CatalogCheckoutDto) {
    if (dto.website) throw new BadRequestException('Invalid submission');
    const {plan, priced, legacySelections} = await this.priceSelection(dto);
    const schedule = plan.requiresSchedule;
    if (schedule && !dto.startAt) throw new BadRequestException(plan.name + ' requires a date and time');
    if (plan.source === 'LEGACY') {
      const errors = legacySelections.flatMap((selection, index) => selectionErrors(selection.plan, {
        quantity: selection.quantity,
        startAt: index === 0 || selection.plan.requiresSchedule ? dto.startAt : undefined,
        resourceId: dto.resourceId,
      }));
      if (errors.length) throw new BadRequestException(errors);
    }
    return this.billing.createCheckout(
      {
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        items: priced.lines.map((line, index) => ({planSlug: line.slug, quantity: line.quantity, ...(dto.startAt && (index === 0 || legacySelections[index]?.plan.requiresSchedule) ? {startAt: dto.startAt} : {}), ...(dto.resourceId ? {resourceId: dto.resourceId} : {})})),
        couponCode: dto.couponCode,
        acceptRecurringTerms: dto.acceptRecurringTerms,
        notes: dto.notes,
        membershipCircle: dto.membershipCircle,
        embedded: dto.embedded,
      },
      priced,
    );
  }
}

/* ───────────────────────────── Public API ─────────────────────────────
   Registered before PublicController so these literal routes are not
   swallowed by its `public/:resource/:slug` wildcard.
   ──────────────────────────────────────────────────────────────────── */

@ApiTags('Catalog') @Controller('public/catalog')
export class PublicCatalogController {
  constructor(@Inject(CatalogService) private catalog: CatalogService) {}

  @Get('services') @Throttle({default: {limit: 600, ttl: 60000}})
  services() {
    return this.catalog.publicServices();
  }

  @Get('services/:slug') @Throttle({default: {limit: 600, ttl: 60000}})
  service(@Param('slug') slug: string) {
    return this.catalog.publicService(slug.toLowerCase());
  }

  @Get('plans/:slug') @Throttle({default: {limit: 600, ttl: 60000}})
  plan(@Param('slug') slug: string) {
    return this.catalog.publicPlan(slug.toLowerCase());
  }

  /** Price preview. Same maths as checkout, no Stripe object created. */
  @Post('quote') @Throttle({default: {limit: 60, ttl: 60000}})
  quote(@ValidatedBody(CatalogQuoteDto) dto: CatalogQuoteDto) {
    return this.catalog.quote(dto);
  }

  @Post('checkout') @Throttle({default: {limit: 5, ttl: 60000}})
  checkout(@ValidatedBody(CatalogCheckoutDto) dto: CatalogCheckoutDto) {
    return this.catalog.checkout(dto);
  }
}

/* ───────────────────────────── Admin API ───────────────────────────── */

const money = (cents: number, currency = 'usd') => (cents / 100).toFixed(2) + ' ' + currency.toUpperCase();

@ApiBearerAuth() @UseGuards(AuthGuard) @ApiTags('Catalog admin') @Controller('admin/catalog')
export class CatalogAdminController {
  constructor(@Inject(Db) private db: Db, @Inject(CatalogService) private catalog: CatalogService) {}

  private get t() {
    return tables(this.db);
  }

  /** Every write invalidates the public read cache so the site updates at once. */
  private async touched(req: unknown, action: string, resource: string, id?: string) {
    clearCatalogCache();
    await audit(this.db, req as never, action, resource, id);
  }

  /* ── One call that powers the whole console ── */
  @Get('overview')
  async overview() {
    const [services, addOns, amenities] = await Promise.all([
      this.t.services.findMany<ServiceRow>({
        orderBy: [{displayOrder: 'asc'}, {name: 'asc'}],
        include: {
          plans: {orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}], include: {planAddOns: true, planAmenities: true}},
          serviceAddOns: true,
          serviceAmenities: true,
        },
      }),
      this.t.addOns.findMany<AddOnRow>({orderBy: [{name: 'asc'}], include: {serviceAddOns: true, planAddOns: true}}),
      this.t.amenities.findMany<AmenityRow>({orderBy: [{name: 'asc'}], include: {serviceAmenities: true, planAmenities: true}}),
    ]);
    return {
      services: services.map(service => ({
        ...service,
        planCount: (service.plans ?? []).length,
        activePlanCount: (service.plans ?? []).filter(plan => plan.active && !plan.archivedAt).length,
        status: service.archivedAt ? 'ARCHIVED' : service.active ? 'PUBLISHED' : 'DRAFT',
        plans: (service.plans ?? []).map(plan => ({
          ...plan,
          priceLabel: money(plan.unitAmountCents, plan.currency) + ' ' + billingUnitLabel(plan.billingUnit),
          status: plan.archivedAt ? 'ARCHIVED' : plan.active ? 'PUBLISHED' : 'DRAFT',
          addOnIds: (plan.planAddOns ?? []).map(link => link.addOnId),
          amenityIds: (plan.planAmenities ?? []).map(link => link.amenityId),
        })),
        addOnIds: (service.serviceAddOns ?? []).map(link => link.addOnId),
        amenityIds: (service.serviceAmenities ?? []).map(link => link.amenityId),
      })),
      addOns: addOns.map(addOn => ({
        ...addOn,
        priceLabel: money(addOn.unitAmountCents, addOn.currency) + ' ' + billingUnitLabel(addOn.billingUnit),
        serviceIds: (addOn.serviceAddOns ?? []).map(link => link.serviceId),
        planIds: (addOn.planAddOns ?? []).map(link => link.planId),
        assignments: [
          ...(addOn.serviceAddOns ?? []).map(link => ({scope: 'SERVICE' as const, id: link.serviceId, priceOverrideCents: link.priceOverrideCents, isRequired: link.isRequired})),
          ...(addOn.planAddOns ?? []).map(link => ({scope: 'PLAN' as const, id: link.planId, priceOverrideCents: link.priceOverrideCents, isRequired: link.isRequired})),
        ],
      })),
      amenities: amenities.map(amenity => ({
        ...amenity,
        serviceIds: (amenity.serviceAmenities ?? []).map(link => link.serviceId),
        planIds: (amenity.planAmenities ?? []).map(link => link.planId),
      })),
      billingUnits: BILLING_UNITS.map(unit => ({value: unit, label: billingUnitLabel(unit), basis: quantityBasis(unit), recurring: billingTypeFor(unit) === 'RECURRING'})),
      flowTypes: BOOKING_FLOWS,
    };
  }

  /* ── Services ── */

  @Get('services')
  async services() {
    const items = await this.t.services.findMany<ServiceRow>({orderBy: [{displayOrder: 'asc'}, {name: 'asc'}], include: {_count: {select: {plans: true, serviceAddOns: true, serviceAmenities: true}}}});
    return {
      items: items.map(service => ({...service, status: service.archivedAt ? 'ARCHIVED' : service.active ? 'PUBLISHED' : 'DRAFT', planCount: service._count?.plans ?? 0})),
      total: items.length,
    };
  }

  @Get('services/:id')
  async service(@Param('id') id: string) {
    const item = await this.t.services.findUnique<ServiceRow>({where: {id}, include: {plans: true, serviceAddOns: true, serviceAmenities: true}});
    if (!item) throw new NotFoundException();
    return item;
  }

  @Post('services') @Roles('ADMIN', 'EDITOR')
  async createService(@ValidatedBody(ServiceDto) dto: ServiceDto, @Req() req: unknown) {
    await this.assertFreeSlug('services', dto.slug);
    const item = await this.t.services.create<ServiceRow>({data: this.serviceData(dto, true)});
    await this.touched(req, 'CREATE', 'catalog/services', item.id);
    return item;
  }

  @Patch('services/:id') @Roles('ADMIN', 'EDITOR')
  async updateService(@Param('id') id: string, @ValidatedBody(ServiceUpdateDto) dto: ServiceUpdateDto, @Req() req: unknown) {
    const existing = await this.t.services.findUnique<ServiceRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    if (dto.slug && dto.slug !== existing.slug) await this.assertFreeSlug('services', dto.slug);
    const item = await this.t.services.update<ServiceRow>({where: {id}, data: this.serviceData(dto, false)});
    await this.touched(req, 'UPDATE', 'catalog/services', id);
    return item;
  }

  @Post('services/reorder') @Roles('ADMIN', 'EDITOR')
  async reorderServices(@ValidatedBody(ReorderDto) dto: ReorderDto, @Req() req: unknown) {
    for (const entry of dto.items) await this.t.services.update({where: {id: entry.id}, data: {displayOrder: entry.displayOrder}});
    await this.touched(req, 'REORDER', 'catalog/services');
    return {reordered: dto.items.length};
  }

  /** Archive, never destroy: packages and their order history stay intact. */
  @Delete('services/:id') @Roles('ADMIN')
  async archiveService(@Param('id') id: string, @Req() req: unknown) {
    const existing = await this.t.services.findUnique<ServiceRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    await this.t.services.update({where: {id}, data: {active: false, archivedAt: new Date()}});
    await this.touched(req, 'ARCHIVE', 'catalog/services', id);
    return {archived: true};
  }

  /* ── Plans ── */

  @Get('plans')
  async plans(@Query('serviceId') serviceId?: string) {
    const items = await this.t.plans.findMany<PlanRow>({
      where: {...(serviceId ? {serviceId} : {})},
      orderBy: [{sortOrder: 'asc'}, {unitAmountCents: 'asc'}],
      include: {service: {select: {slug: true, name: true}}, planAddOns: true, planAmenities: true},
    });
    return {
      items: items.map(plan => ({
        ...plan,
        priceDollars: (plan.unitAmountCents / 100).toFixed(2),
        priceLabel: money(plan.unitAmountCents, plan.currency) + ' ' + billingUnitLabel(plan.billingUnit),
        status: plan.archivedAt ? 'ARCHIVED' : plan.active ? 'PUBLISHED' : 'DRAFT',
      })),
      total: items.length,
    };
  }

  @Post('plans') @Roles('ADMIN', 'EDITOR')
  async createPlan(@ValidatedBody(PlanDto) dto: PlanDto, @Req() req: unknown) {
    await this.assertFreeSlug('plans', dto.slug);
    const service = await this.t.services.findUnique<ServiceRow>({where: {id: dto.serviceId}});
    if (!service) throw new BadRequestException('Choose an existing service for this package');
    const item = await this.t.plans.create<PlanRow>({data: this.planData(dto, true)});
    await this.touched(req, 'CREATE', 'catalog/plans', item.id);
    return item;
  }

  @Patch('plans/:id') @Roles('ADMIN', 'EDITOR')
  async updatePlan(@Param('id') id: string, @ValidatedBody(PlanUpdateDto) dto: PlanUpdateDto, @Req() req: unknown) {
    const existing = await this.t.plans.findUnique<PlanRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    if (dto.slug && dto.slug !== existing.slug) await this.assertFreeSlug('plans', dto.slug);
    const item = await this.t.plans.update<PlanRow>({where: {id}, data: this.planData(dto, false)});
    await this.touched(req, 'UPDATE', 'catalog/plans', id);
    return item;
  }

  @Delete('plans/:id') @Roles('ADMIN')
  async archivePlan(@Param('id') id: string, @Req() req: unknown) {
    const existing = await this.t.plans.findUnique<PlanRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    await this.t.plans.update({where: {id}, data: {active: false, archivedAt: new Date()}});
    await this.touched(req, 'ARCHIVE', 'catalog/plans', id);
    return {archived: true};
  }

  /* ── Add-on library ── */

  @Get('addons')
  async addons() {
    const items = await this.t.addOns.findMany<AddOnRow>({orderBy: [{name: 'asc'}], include: {serviceAddOns: true, planAddOns: true}});
    return {
      items: items.map(addOn => ({
        ...addOn,
        priceDollars: (addOn.unitAmountCents / 100).toFixed(2),
        priceLabel: money(addOn.unitAmountCents, addOn.currency) + ' ' + billingUnitLabel(addOn.billingUnit),
        serviceIds: (addOn.serviceAddOns ?? []).map(link => link.serviceId),
        planIds: (addOn.planAddOns ?? []).map(link => link.planId),
        status: addOn.archivedAt ? 'ARCHIVED' : addOn.active ? 'PUBLISHED' : 'DRAFT',
      })),
      total: items.length,
    };
  }

  @Post('addons') @Roles('ADMIN', 'EDITOR')
  async createAddOn(@ValidatedBody(AddOnDto) dto: AddOnDto, @Req() req: unknown) {
    await this.assertFreeSlug('addOns', dto.slug);
    const item = await this.t.addOns.create<AddOnRow>({data: this.addOnData(dto, true)});
    await this.touched(req, 'CREATE', 'catalog/addons', item.id);
    return item;
  }

  @Patch('addons/:id') @Roles('ADMIN', 'EDITOR')
  async updateAddOn(@Param('id') id: string, @ValidatedBody(AddOnUpdateDto) dto: AddOnUpdateDto, @Req() req: unknown) {
    const existing = await this.t.addOns.findUnique<AddOnRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    if (dto.slug && dto.slug !== existing.slug) await this.assertFreeSlug('addOns', dto.slug);
    const item = await this.t.addOns.update<AddOnRow>({where: {id}, data: this.addOnData(dto, false)});
    await this.touched(req, 'UPDATE', 'catalog/addons', id);
    return item;
  }

  @Delete('addons/:id') @Roles('ADMIN')
  async archiveAddOn(@Param('id') id: string, @Req() req: unknown) {
    const existing = await this.t.addOns.findUnique<AddOnRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    await this.t.addOns.update({where: {id}, data: {active: false, archivedAt: new Date()}});
    await this.touched(req, 'ARCHIVE', 'catalog/addons', id);
    return {archived: true};
  }

  @Post('addons/assign-service') @Roles('ADMIN', 'EDITOR')
  async assignAddOnToService(@ValidatedBody(AssignAddOnDto) dto: AssignAddOnDto, @Req() req: unknown) {
    if (!dto.serviceId) throw new BadRequestException('serviceId is required');
    await this.assertExists('services', dto.serviceId, 'service');
    await this.assertExists('addOns', dto.addOnId, 'add-on');
    const link = {priceOverrideCents: dto.priceOverrideCents ?? null, isRequired: dto.isRequired ?? false, sortOrder: dto.sortOrder ?? 0};
    const item = await this.t.serviceAddOns.upsert<ServiceAddOnRow>({
      where: {serviceId_addOnId: {serviceId: dto.serviceId, addOnId: dto.addOnId}},
      create: {serviceId: dto.serviceId, addOnId: dto.addOnId, ...link},
      update: link,
    });
    await this.touched(req, 'ASSIGN', 'catalog/addons', dto.addOnId);
    return item;
  }

  @Post('addons/assign-plan') @Roles('ADMIN', 'EDITOR')
  async assignAddOnToPlan(@ValidatedBody(AssignAddOnDto) dto: AssignAddOnDto, @Req() req: unknown) {
    if (!dto.planId) throw new BadRequestException('planId is required');
    await this.assertExists('plans', dto.planId, 'package');
    await this.assertExists('addOns', dto.addOnId, 'add-on');
    const link = {priceOverrideCents: dto.priceOverrideCents ?? null, isRequired: dto.isRequired ?? false, sortOrder: dto.sortOrder ?? 0};
    const item = await this.t.planAddOns.upsert<PlanAddOnRow>({
      where: {planId_addOnId: {planId: dto.planId, addOnId: dto.addOnId}},
      create: {planId: dto.planId, addOnId: dto.addOnId, ...link},
      update: link,
    });
    await this.touched(req, 'ASSIGN', 'catalog/addons', dto.addOnId);
    return item;
  }

  /** Detach an add-on from one service or one package. The library entry stays. */
  @Delete('addons/unassign') @Roles('ADMIN', 'EDITOR')
  async unassignAddOn(@ValidatedBody(AssignAddOnDto) dto: AssignAddOnDto, @Req() req: unknown) {
    if (!dto.serviceId && !dto.planId) throw new BadRequestException('Provide serviceId or planId');
    if (dto.serviceId) await this.t.serviceAddOns.deleteMany({where: {serviceId: dto.serviceId, addOnId: dto.addOnId}});
    if (dto.planId) await this.t.planAddOns.deleteMany({where: {planId: dto.planId, addOnId: dto.addOnId}});
    await this.touched(req, 'UNASSIGN', 'catalog/addons', dto.addOnId);
    return {unassigned: true};
  }

  /* ── Amenities ── */

  @Get('amenities')
  async amenities() {
    const items = await this.t.amenities.findMany<AmenityRow>({orderBy: [{name: 'asc'}], include: {serviceAmenities: true, planAmenities: true}});
    return {
      items: items.map(amenity => ({...amenity, serviceIds: (amenity.serviceAmenities ?? []).map(link => link.serviceId), planIds: (amenity.planAmenities ?? []).map(link => link.planId), status: amenity.active ? 'PUBLISHED' : 'DRAFT'})),
      total: items.length,
    };
  }

  @Post('amenities') @Roles('ADMIN', 'EDITOR')
  async createAmenity(@ValidatedBody(AmenityDto) dto: AmenityDto, @Req() req: unknown) {
    const slug = dto.slug || slugify(dto.name);
    await this.assertFreeSlug('amenities', slug);
    const item = await this.t.amenities.create<AmenityRow>({data: {slug, name: dto.name, description: dto.description ?? '', iconUrl: dto.iconUrl ?? null, iconName: dto.iconName ?? 'Check', active: dto.active ?? true}});
    await this.touched(req, 'CREATE', 'catalog/amenities', item.id);
    return item;
  }

  @Patch('amenities/:id') @Roles('ADMIN', 'EDITOR')
  async updateAmenity(@Param('id') id: string, @ValidatedBody(AmenityUpdateDto) dto: AmenityUpdateDto, @Req() req: unknown) {
    const existing = await this.t.amenities.findUnique<AmenityRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    if (dto.slug && dto.slug !== existing.slug) await this.assertFreeSlug('amenities', dto.slug);
    const item = await this.t.amenities.update<AmenityRow>({
      where: {id},
      data: {
        ...(dto.slug ? {slug: dto.slug} : {}),
        ...(dto.name ? {name: dto.name} : {}),
        ...(dto.description !== undefined ? {description: dto.description} : {}),
        ...(dto.iconUrl !== undefined ? {iconUrl: dto.iconUrl || null} : {}),
        ...(dto.iconName !== undefined ? {iconName: dto.iconName} : {}),
        ...(dto.active !== undefined ? {active: dto.active} : {}),
      },
    });
    await this.touched(req, 'UPDATE', 'catalog/amenities', id);
    return item;
  }

  @Post('amenities/assign') @Roles('ADMIN', 'EDITOR')
  async assignAmenity(@ValidatedBody(AssignAmenityDto) dto: AssignAmenityDto, @Req() req: unknown) {
    if (!dto.serviceId && !dto.planId) throw new BadRequestException('Provide serviceId or planId');
    await this.assertExists('amenities', dto.amenityId, 'amenity');
    if (dto.serviceId) {
      await this.assertExists('services', dto.serviceId, 'service');
      await this.t.serviceAmenities.upsert({where: {serviceId_amenityId: {serviceId: dto.serviceId, amenityId: dto.amenityId}}, create: {serviceId: dto.serviceId, amenityId: dto.amenityId, sortOrder: dto.sortOrder ?? 0}, update: {sortOrder: dto.sortOrder ?? 0}});
    }
    if (dto.planId) {
      await this.assertExists('plans', dto.planId, 'package');
      await this.t.planAmenities.upsert({where: {planId_amenityId: {planId: dto.planId, amenityId: dto.amenityId}}, create: {planId: dto.planId, amenityId: dto.amenityId, sortOrder: dto.sortOrder ?? 0}, update: {sortOrder: dto.sortOrder ?? 0}});
    }
    await this.touched(req, 'ASSIGN', 'catalog/amenities', dto.amenityId);
    return {assigned: true};
  }

  @Delete('amenities/unassign') @Roles('ADMIN', 'EDITOR')
  async unassignAmenity(@ValidatedBody(AssignAmenityDto) dto: AssignAmenityDto, @Req() req: unknown) {
    if (!dto.serviceId && !dto.planId) throw new BadRequestException('Provide serviceId or planId');
    if (dto.serviceId) await this.t.serviceAmenities.deleteMany({where: {serviceId: dto.serviceId, amenityId: dto.amenityId}});
    if (dto.planId) await this.t.planAmenities.deleteMany({where: {planId: dto.planId, amenityId: dto.amenityId}});
    await this.touched(req, 'UNASSIGN', 'catalog/amenities', dto.amenityId);
    return {unassigned: true};
  }

  @Delete('amenities/:id') @Roles('ADMIN')
  async deactivateAmenity(@Param('id') id: string, @Req() req: unknown) {
    const existing = await this.t.amenities.findUnique<AmenityRow>({where: {id}});
    if (!existing) throw new NotFoundException();
    await this.t.amenities.update({where: {id}, data: {active: false}});
    await this.touched(req, 'ARCHIVE', 'catalog/amenities', id);
    return {archived: true};
  }

  /* ── Shared helpers ── */

  private async assertFreeSlug(table: 'services' | 'plans' | 'addOns' | 'amenities', slug: string) {
    const existing = await this.t[table].findUnique<{id: string}>({where: {slug}, select: {id: true}});
    if (existing) throw new BadRequestException('That slug is already in use: ' + slug);
  }

  private async assertExists(table: 'services' | 'plans' | 'addOns' | 'amenities', id: string, label: string) {
    const existing = await this.t[table].findUnique<{id: string}>({where: {id}, select: {id: true}});
    if (!existing) throw new BadRequestException('Unknown ' + label);
  }

  private serviceData(dto: ServiceDto | ServiceUpdateDto, creating: boolean) {
    const steps = (dto.customSteps ?? []).map(step => String(step)).slice(0, 12);
    return {
      ...(dto.slug || creating ? {slug: dto.slug} : {}),
      ...(dto.name || creating ? {name: dto.name} : {}),
      ...(dto.description !== undefined || creating ? {description: dto.description ?? ''} : {}),
      ...(dto.categoryBadge !== undefined ? {categoryBadge: dto.categoryBadge || null} : {}),
      ...(dto.iconName !== undefined || creating ? {iconName: dto.iconName || 'Layers'} : {}),
      ...(dto.heroImageUrl !== undefined ? {heroImageUrl: dto.heroImageUrl || null} : {}),
      ...(dto.displayOrder !== undefined || creating ? {displayOrder: dto.displayOrder ?? 0} : {}),
      ...(dto.active !== undefined || creating ? {active: dto.active ?? true, ...(dto.active === true ? {archivedAt: null} : {})} : {}),
      ...(dto.flowType !== undefined || creating ? {flowType: dto.flowType ?? 'STANDARD'} : {}),
      ...(dto.customSteps !== undefined ? {customSteps: steps} : {}),
      ...(dto.metadata !== undefined ? {metadata: dto.metadata ?? {}} : {}),
    };
  }

  private planData(dto: PlanDto | PlanUpdateDto, creating: boolean) {
    if (dto.billingUnit !== undefined && !isBillingUnit(dto.billingUnit)) throw new BadRequestException('Unknown billing unit');
    const min = dto.minQuantity ?? (creating ? 1 : undefined);
    const max = dto.maxQuantity ?? (creating ? Math.max(1, min ?? 1) : undefined);
    if (min !== undefined && max !== undefined && min > max) throw new BadRequestException('Minimum quantity cannot exceed maximum quantity');
    if (dto.capacityMin !== undefined && dto.capacityMax !== undefined && dto.capacityMin > dto.capacityMax) throw new BadRequestException('Minimum capacity cannot exceed maximum capacity');
    return {
      ...(dto.slug || creating ? {slug: dto.slug} : {}),
      ...(dto.serviceId || creating ? {serviceId: dto.serviceId} : {}),
      ...(dto.name || creating ? {name: dto.name} : {}),
      ...(dto.description !== undefined || creating ? {description: dto.description ?? ''} : {}),
      ...(dto.unitAmountCents !== undefined || creating ? {unitAmountCents: dto.unitAmountCents} : {}),
      ...(dto.currency !== undefined || creating ? {currency: (dto.currency ?? 'usd').toLowerCase()} : {}),
      ...(dto.billingUnit !== undefined || creating ? {billingUnit: dto.billingUnit} : {}),
      ...(dto.durationMinutes !== undefined ? {durationMinutes: dto.durationMinutes || null} : {}),
      ...(dto.durationDays !== undefined ? {durationDays: dto.durationDays || null} : {}),
      ...(min !== undefined ? {minQuantity: Math.max(1, min)} : {}),
      ...(max !== undefined ? {maxQuantity: Math.max(1, max)} : {}),
      ...(dto.capacityText !== undefined ? {capacityText: dto.capacityText || null} : {}),
      ...(dto.capacityMin !== undefined ? {capacityMin: dto.capacityMin || null} : {}),
      ...(dto.capacityMax !== undefined ? {capacityMax: dto.capacityMax || null} : {}),
      ...(dto.featured !== undefined || creating ? {featured: dto.featured ?? false} : {}),
      ...(dto.active !== undefined || creating ? {active: dto.active ?? true, ...(dto.active === true ? {archivedAt: null} : {})} : {}),
      ...(dto.sortOrder !== undefined || creating ? {sortOrder: dto.sortOrder ?? 0} : {}),
      ...(dto.rulesNotice !== undefined ? {rulesNotice: dto.rulesNotice || null} : {}),
      ...(dto.governmentNotice !== undefined ? {governmentNotice: dto.governmentNotice || null} : {}),
      ...(dto.adminFlagNote !== undefined ? {adminFlagNote: dto.adminFlagNote || null} : {}),
      ...(dto.metadata !== undefined ? {metadata: dto.metadata ?? {}} : {}),
    };
  }

  private addOnData(dto: AddOnDto | AddOnUpdateDto, creating: boolean) {
    if (dto.billingUnit !== undefined && !isBillingUnit(dto.billingUnit)) throw new BadRequestException('Unknown billing unit');
    const min = dto.minQuantity ?? (creating ? 0 : undefined);
    const max = dto.maxQuantity ?? (creating ? 10 : undefined);
    if (min !== undefined && max !== undefined && min > max) throw new BadRequestException('Minimum quantity cannot exceed maximum quantity');
    return {
      ...(dto.slug || creating ? {slug: dto.slug} : {}),
      ...(dto.name || creating ? {name: dto.name} : {}),
      ...(dto.description !== undefined || creating ? {description: dto.description ?? ''} : {}),
      ...(dto.unitAmountCents !== undefined || creating ? {unitAmountCents: dto.unitAmountCents} : {}),
      ...(dto.currency !== undefined || creating ? {currency: (dto.currency ?? 'usd').toLowerCase()} : {}),
      ...(dto.billingUnit !== undefined || creating ? {billingUnit: dto.billingUnit} : {}),
      ...(min !== undefined ? {minQuantity: min} : {}),
      ...(max !== undefined ? {maxQuantity: Math.max(1, max)} : {}),
      ...(dto.defaultQuantity !== undefined || creating ? {defaultQuantity: dto.defaultQuantity ?? 1} : {}),
      ...(dto.imageUrl !== undefined ? {imageUrl: dto.imageUrl || null} : {}),
      ...(dto.active !== undefined || creating ? {active: dto.active ?? true, ...(dto.active === true ? {archivedAt: null} : {})} : {}),
      ...(dto.adminFlagNote !== undefined ? {adminFlagNote: dto.adminFlagNote || null} : {}),
      ...(dto.metadata !== undefined ? {metadata: dto.metadata ?? {}} : {}),
    };
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'item';
}

export type {FlowStep};
