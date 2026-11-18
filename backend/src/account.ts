/**
 * Customer account API. Every route sits behind CustomerGuard and every query
 * is scoped to the billing profiles the session's account owns. No route takes
 * a customer id from the browser as authority: ids in the URL only ever select
 * among rows already filtered by ownership, and a miss is a plain 404.
 */
import {BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Injectable, NotFoundException, Param, Patch, Post, Query, Req, Res, UseGuards} from '@nestjs/common';
import {ApiBearerAuth} from '@nestjs/swagger';
import {Throttle} from '@nestjs/throttler';
import {IsBoolean, IsIn, IsInt, IsISO8601, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested} from 'class-validator';
import {Transform, Type} from 'class-transformer';
import Stripe from 'stripe';
import {AuthGuard, Db, Roles, parsePagination} from './core';
import {ValidatedBody, ValidatedQuery} from './validation';
import {PaymentClient} from './payments';
import {BillingService, CancelDto} from './billing';
import {CardService, type Profile} from './account-cards';
import {PlanChangeService} from './account-plans';
import {CustomerGuard, type CustomerPrincipal} from './account-auth';
import {BUSINESS_TIMEZONE, businessTimeToUtc, cancellationPreview, creditGrantsFor, describeInterval, type BillingIntervalValue} from './billing-core';
import {bookingIcs, displayName, initials, isCardExpired, isCardExpiringSoon} from './account-core';

const LOCATION = 'Workspace Junction, 1S280 Summit Ave, Unit E2 Suite 1, Oakbrook Terrace, IL 60181';
const LIVE_ACCESS = ['PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED'] as const;
const trim = Transform(({value}) => (typeof value === 'string' ? value.trim() : value));
type Json = Record<string, unknown>;
const obj = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {});

/* ───────────────────────────── DTOs ───────────────────────────── */

export class AccountListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @IsString() @MaxLength(100) service?: string;
  @IsOptional() @IsISO8601() @MaxLength(40) from?: string;
  @IsOptional() @IsISO8601() @MaxLength(40) to?: string;
}

export class AddressDto {
  @IsOptional() @trim @IsString() @MaxLength(200) line1?: string;
  @IsOptional() @trim @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @trim @IsString() @MaxLength(100) city?: string;
  @IsOptional() @trim @IsString() @MaxLength(100) state?: string;
  @IsOptional() @trim @IsString() @MaxLength(20) postalCode?: string;
  /* A cleared field arrives as '' and means "not provided", like the other address lines. */
  @IsOptional() @Transform(({value}) => (typeof value === 'string' ? value.trim() || undefined : value)) @Matches(/^[A-Za-z]{2}$/, {message: 'Enter a two-letter country code, for example US.'}) country?: string;
}

export class ProfileDto {
  @trim @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @trim @IsString() @MaxLength(50) @Matches(/^[0-9+()\-.\s]*$/, {message: 'Enter a valid phone number'}) phone?: string;
  @IsOptional() @trim @IsString() @MaxLength(200) company?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AddressDto) billingAddress?: AddressDto;
}

export class PreferencesDto {
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
  @IsOptional() @IsBoolean() bookingReminders?: boolean;
  @IsOptional() @IsBoolean() renewalReminders?: boolean;
}

export class SupportDto {
  @IsIn(['SUPPORT', 'REFUND', 'RESCHEDULE', 'BOOKING_CANCELLATION', 'OTHER']) type!: string;
  @trim @IsString() @MinLength(3) @MaxLength(200) subject!: string;
  @trim @IsString() @MinLength(5) @MaxLength(4000) message!: string;
  @IsOptional() @trim @IsString() @MaxLength(80) reference?: string;
}

export class ClosureDto {
  @IsOptional() @trim @IsString() @MaxLength(2000) reason?: string;
}

export class SetupIntentDto {
  @IsOptional() @IsString() @MaxLength(80) profileId?: string;
  /** Saving a card for future charges needs the customer's explicit agreement. */
  @IsBoolean() consent!: boolean;
}

export class SetupCompleteDto {
  @IsString() @MinLength(5) @MaxLength(120) setupIntentId!: string;
  @IsOptional() @IsString() @MaxLength(80) profileId?: string;
  @IsOptional() @IsBoolean() makeDefault?: boolean;
}

export class CardActionDto {
  @IsOptional() @IsString() @MaxLength(80) profileId?: string;
  @IsOptional() @IsString() @MaxLength(80) replacementCardId?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(80) idempotencyKey?: string;
}

export class PlanPreviewDto {
  @IsString() @MinLength(1) @MaxLength(200) targetSlug!: string;
}

export class PlanConfirmDto extends PlanPreviewDto {
  @IsString() @MinLength(10) @MaxLength(2000) confirmToken!: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(80) idempotencyKey?: string;
}

export class AdminCardRemoveDto {
  @trim @IsString() @MinLength(5) @MaxLength(500) reason!: string;
  @IsOptional() @IsBoolean() allowLast?: boolean;
}

export class SupportStatusDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED']) status!: string;
}

/* ───────────────────────────── Service ───────────────────────────── */

@Injectable()
export class AccountService {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(PaymentClient) private payments: PaymentClient,
    @Inject(BillingService) private billing: BillingService,
    @Inject(CardService) private cards: CardService,
    @Inject(PlanChangeService) private plans: PlanChangeService,
  ) {}

  private ids(accountId: string) {
    return this.cards.ownedIds(accountId);
  }

  private planName(sub: {plan?: {name?: string} | null; metadata: unknown}) {
    const snapshot = obj(obj(sub.metadata).catalogPlan);
    return sub.plan?.name ?? (typeof snapshot.name === 'string' ? snapshot.name : 'Subscription');
  }

  private benefitsOf(sub: {plan?: {includedCredits?: unknown} | null; metadata: unknown}) {
    const snapshot = obj(obj(sub.metadata).catalogPlan);
    return creditGrantsFor({name: '', billingType: 'RECURRING', unitAmount: 0, includedCredits: sub.plan?.includedCredits ?? snapshot.includedCredits}).map(grant => ({kind: grant.kind, amount: grant.amount, unlimited: Boolean(grant.unlimited), resets: grant.resetInterval}));
  }

  /* ── Subscriptions ── */

  private subscriptionView(sub: Json & {plan?: {name?: string; serviceType?: string; includedCredits?: unknown} | null; metadata: unknown}, change: Parameters<PlanChangeService['changeView']>[0]) {
    const snapshot = obj(obj(sub.metadata).catalogPlan);
    const cancelScheduled = Boolean(sub.cancelAtPeriodEnd);
    const ended = sub.accessStatus === 'ENDED';
    return {
      id: sub.id,
      planName: this.planName(sub),
      serviceType: sub.plan?.serviceType ?? (typeof snapshot.serviceType === 'string' ? snapshot.serviceType : null),
      interval: sub.interval,
      intervalDescription: describeInterval(sub.interval as BillingIntervalValue, Number(sub.intervalCount ?? 1)),
      unitAmount: sub.unitAmount,
      quantity: sub.quantity,
      amount: Number(sub.unitAmount) * Number(sub.quantity),
      currency: sub.currency,
      accessStatus: sub.accessStatus,
      /* Stripe's own period boundaries: never assumed to be 30 days. */
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      renewsAt: cancelScheduled || ended ? null : sub.nextInvoiceAt ?? sub.currentPeriodEnd,
      renewal: ended ? 'ended' : cancelScheduled ? 'cancels_at_period_end' : 'renews',
      cancelAtPeriodEnd: cancelScheduled,
      cancellationRequestedAt: cancelScheduled ? sub.cancellationRequestedAt : null,
      cancelAt: sub.cancelAt,
      endedAt: sub.endedAt,
      graceEndsAt: sub.graceEndsAt,
      paymentState: sub.accessStatus === 'PAST_DUE' || sub.accessStatus === 'SUSPENDED' ? 'failed' : sub.pendingUpdate ? 'action_required' : 'ok',
      benefits: this.benefitsOf(sub),
      pendingChange: this.plans.changeView(change),
      startedAt: sub.createdAt,
    };
  }

  async subscriptions(accountId: string) {
    const ids = await this.ids(accountId);
    const rows = await this.db.subscription.findMany({where: {customerId: {in: ids}}, include: {plan: true}, orderBy: {createdAt: 'desc'}, take: 100});
    const changes = await this.db.subscriptionChange.findMany({where: {subscriptionId: {in: rows.map(row => row.id)}, status: {in: ['PENDING_PAYMENT', 'SCHEDULED']}}});
    return {items: rows.map(row => this.subscriptionView(row as never, changes.find(change => change.subscriptionId === row.id) ?? null))};
  }

  private async ownedSubscription(accountId: string, id: string) {
    const ids = await this.ids(accountId);
    const sub = await this.db.subscription.findUnique({where: {id}, include: {plan: true}});
    if (!sub || !ids.includes(sub.customerId)) throw new NotFoundException();
    return sub;
  }

  async subscription(accountId: string, id: string) {
    const sub = await this.ownedSubscription(accountId, id);
    const [change, invoices] = await Promise.all([
      this.db.subscriptionChange.findFirst({where: {subscriptionId: sub.id, status: {in: ['PENDING_PAYMENT', 'SCHEDULED']}}, orderBy: {createdAt: 'desc'}}),
      this.db.invoice.findMany({where: {subscriptionId: sub.id}, orderBy: {createdAt: 'desc'}, take: 12}),
    ]);
    return {...this.subscriptionView(sub as never, change), invoices: invoices.map(invoice => this.invoiceRow(invoice))};
  }

  /**
   * A package sold with a minimum term (the mailbox's 3 months) cannot have its renewal stopped
   * while the paid period would still end before that term is up. The term comes from the
   * checkout-time snapshot, so later catalog edits never change an existing agreement.
   */
  private minimumTerm(sub: {metadata: unknown; createdAt: Date; currentPeriodEnd: Date | null}) {
    const snapshot = obj(obj(sub.metadata).catalogPlan);
    const months = Number(snapshot.minimumTermMonths);
    if (!Number.isInteger(months) || months < 2) return null;
    const endsAt = new Date(sub.createdAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + months);
    /* Three days of slack: Stripe's period boundaries are not always the same clock time. */
    const blocked = !sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() + 3 * 86400000 < endsAt.getTime();
    return {months, endsAt, blocked};
  }

  async cancellationPreview(accountId: string, id: string) {
    const sub = await this.ownedSubscription(accountId, id);
    const preview = cancellationPreview(sub, 'PERIOD_END');
    const term = this.minimumTerm(sub);
    const scheduled = await this.db.subscriptionChange.findFirst({where: {subscriptionId: sub.id, status: 'SCHEDULED'}});
    return {
      ...preview,
      planName: this.planName(sub),
      benefits: this.benefitsOf(sub),
      effects: [
        'Your access and included benefits continue until the last day of the paid period.',
        'No further renewal is charged.',
        'No refund or proration is issued for the current period.',
        'Bookings you have already made are not cancelled by this; cancel a booking separately if you need to.',
        ...(scheduled ? ['The plan change you scheduled will be withdrawn.'] : []),
        ...(term?.blocked ? [this.minimumTermMessage(term)] : []),
      ],
      canUndoUntil: preview.effectiveAt,
      minimumTerm: term ? {months: term.months, endsAt: term.endsAt, blocked: term.blocked} : null,
    };
  }

  private minimumTermMessage(term: {months: number; endsAt: Date}) {
    return 'This plan has a ' + term.months + '-month minimum term that runs until ' + new Intl.DateTimeFormat('en-US', {dateStyle: 'medium', timeZone: BUSINESS_TIMEZONE}).format(term.endsAt) + '. You can stop renewal once your paid period reaches that date. Contact our team if you need help sooner.';
  }

  /** Customers can only stop renewal at period end. Immediate cancellation and refunds stay with staff. */
  async cancel(principal: CustomerPrincipal, id: string, reason?: string) {
    const sub = await this.ownedSubscription(principal.id, id);
    const term = this.minimumTerm(sub);
    if (term?.blocked) throw new BadRequestException(this.minimumTermMessage(term));
    await this.billing.cancelSubscription(id, 'PERIOD_END', {type: 'CUSTOMER', id: principal.id, label: principal.email}, reason);
    return this.subscription(principal.id, id);
  }

  async resume(principal: CustomerPrincipal, id: string) {
    await this.ownedSubscription(principal.id, id);
    await this.billing.withdrawCancellation(id, {type: 'CUSTOMER', id: principal.id, label: principal.email});
    return this.subscription(principal.id, id);
  }

  /* ── Orders ── */

  private orderRow(order: Json & {items: Array<Json>}) {
    const plan = order.items.find(item => obj(item.metadata).kind !== 'ADDON') ?? order.items[0];
    return {
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      mode: order.mode,
      currency: order.currency,
      totalAmount: order.totalAmount,
      dueNowAmount: order.dueNowAmount,
      recurringAmount: order.recurringAmount,
      recurringInterval: order.recurringInterval,
      paymentMethod: order.paymentMethod,
      title: plan ? String(plan.description) : 'Purchase',
      serviceType: plan ? (obj(plan.metadata).serviceType as string | undefined) ?? null : null,
      itemCount: order.items.length,
    };
  }

  async orders(accountId: string, query: AccountListDto) {
    const ids = await this.ids(accountId);
    const {page, limit, skip, take} = parsePagination(query, 10, 50);
    const statuses = ['PENDING', 'PAID', 'PARTIALLY_PAID', 'FAILED', 'EXPIRED', 'CANCELLED'];
    const where = {
      customerId: {in: ids},
      ...(query.status && statuses.includes(query.status) ? {status: query.status as never} : {}),
      ...(query.service ? {items: {some: {metadata: {path: ['serviceType'], equals: query.service}}}} : {}),
      ...(query.from || query.to ? {createdAt: {...(query.from ? {gte: new Date(query.from)} : {}), ...(query.to ? {lte: new Date(query.to)} : {})}} : {}),
    };
    const [rows, total] = await Promise.all([this.db.order.findMany({where, include: {items: true}, orderBy: {createdAt: 'desc'}, skip, take}), this.db.order.count({where})]);
    return {items: rows.map(row => this.orderRow(row as never)), total, page, limit};
  }

  async order(accountId: string, id: string) {
    const ids = await this.ids(accountId);
    const order = await this.db.order.findUnique({where: {id}, include: {items: true, subscriptions: true}});
    if (!order || !ids.includes(order.customerId)) throw new NotFoundException();
    const invoices = await this.db.invoice.findMany({where: {customerId: {in: ids}, OR: [{orderId: order.id}, {subscriptionId: {in: order.subscriptions.map(sub => sub.id)}}]}, orderBy: {createdAt: 'desc'}, take: 12});
    const meta = obj(order.metadata);
    const schedule = Array.isArray(meta.schedule) ? (meta.schedule as Array<{startAt?: string | null}>).find(entry => entry.startAt)?.startAt ?? null : null;
    const plan = order.items.find(item => obj(item.metadata).kind !== 'ADDON') ?? order.items[0];
    return {
      ...this.orderRow(order as never),
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      couponCode: order.couponCode,
      paidAt: order.paidAt,
      /* The amounts on a past order are its own snapshot; profile or catalog edits never rewrite them. */
      items: order.items.map(item => ({description: item.description, quantity: item.quantity, unitAmount: item.unitAmount, amount: item.amount, billingType: item.billingType, interval: item.interval, kind: obj(item.metadata).kind === 'ADDON' ? 'ADDON' : 'PLAN'})),
      scheduledFor: schedule,
      timezone: BUSINESS_TIMEZONE,
      subscriptionIds: order.subscriptions.map(sub => sub.id),
      invoices: invoices.map(invoice => this.invoiceRow(invoice)),
      /* Buy again re-enters the normal checkout, which rechecks availability and price. */
      buyAgainSlug: plan ? (obj(plan.metadata).slug as string | undefined) ?? null : null,
    };
  }

  /* ── Bookings ── */

  private legacyStart(date: string | null, time: string | null): Date | null {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec((time ?? '').trim());
    let clock = '09:00';
    if (match) {
      let hour = Number(match[1]);
      if (match[3]) hour = (hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
      clock = String(Math.min(23, hour)).padStart(2, '0') + ':' + match[2];
    }
    try {
      return businessTimeToUtc(date, clock);
    } catch {
      return null;
    }
  }

  async bookings(accountId: string, now = new Date()) {
    const ids = await this.ids(accountId);
    const [orders, legacy] = await Promise.all([
      this.db.order.findMany({where: {customerId: {in: ids}, status: 'PAID'}, include: {items: true}, orderBy: {createdAt: 'desc'}, take: 200}),
      this.db.booking.findMany({where: {customerId: {in: ids}}, orderBy: {createdAt: 'desc'}, take: 200}),
    ]);
    const events: Array<{id: string; source: 'ORDER' | 'LEGACY'; title: string; start: Date; minutes: number | null; guests: number | null; status: string; orderId: string | null}> = [];
    for (const order of orders) {
      const schedule = obj(order.metadata).schedule;
      const startAt = Array.isArray(schedule) ? (schedule as Array<{startAt?: string | null}>).find(entry => entry.startAt)?.startAt : null;
      if (!startAt || Number.isNaN(Date.parse(startAt))) continue;
      const plan = order.items.find(item => obj(item.metadata).kind !== 'ADDON') ?? order.items[0];
      const meta = obj(plan?.metadata);
      /* Duration comes from what was bought (hours or days), not from a label. */
      const minutes = meta.billingUnit === 'PER_HOUR' ? Number(meta.units ?? plan?.quantity ?? 1) * 60 : meta.billingUnit === 'PER_DAY' ? Number(meta.units ?? 1) * 24 * 60 : null;
      events.push({id: order.id, source: 'ORDER', title: plan?.description ?? 'Booking', start: new Date(startAt), minutes, guests: null, status: 'CONFIRMED', orderId: order.id});
    }
    for (const booking of legacy) {
      const start = this.legacyStart(booking.bookingDate, booking.bookingTime);
      if (!start) continue;
      events.push({id: 'legacy-' + booking.id, source: 'LEGACY', title: booking.serviceName, start, minutes: booking.duration ? booking.duration * 60 : null, guests: booking.guests, status: booking.status, orderId: null});
    }
    events.sort((a, b) => a.start.getTime() - b.start.getTime());
    const view = (event: (typeof events)[number]) => ({...event, timezone: BUSINESS_TIMEZONE, location: LOCATION, calendar: event.status === 'CONFIRMED' || event.status === 'COMPLETED'});
    return {
      timezone: BUSINESS_TIMEZONE,
      upcoming: events.filter(event => event.start.getTime() >= now.getTime() && event.status !== 'CANCELLED' && event.status !== 'REFUNDED').map(view),
      past: events.filter(event => event.start.getTime() < now.getTime() || event.status === 'CANCELLED' || event.status === 'REFUNDED').reverse().slice(0, 50).map(view),
      /* No live inventory or cancellation engine exists, so changes go to staff. Nothing here invents availability or a refund. */
      changePolicy: 'To reschedule or cancel a booking, send us a request and our team will confirm what is possible, including any fee or refund. Cancelling a subscription does not cancel a booking.',
    };
  }

  async bookingIcs(accountId: string, id: string) {
    const {upcoming, past} = await this.bookings(accountId);
    const event = [...upcoming, ...past].find(entry => entry.id === id);
    if (!event || !event.calendar) throw new NotFoundException();
    return bookingIcs({uid: event.id, title: event.title + ' at Workspace Junction', start: event.start, minutes: event.minutes ?? 60, location: LOCATION, description: 'Times are shown in your calendar\'s own time zone. Workspace Junction operates on Central Time (' + BUSINESS_TIMEZONE + ').'});
  }

  /* ── Benefits ── */

  /**
   * Balances are scoped to grants whose period is still open, so an expired
   * month's unused days never roll into the next one. There is no customer
   * redemption here: consumption is recorded by staff through the existing
   * ledger, which refuses a negative balance.
   */
  async benefits(accountId: string, now = new Date()) {
    const ids = await this.ids(accountId);
    const entries = await this.db.entitlementEntry.findMany({where: {customerId: {in: ids}}, orderBy: {createdAt: 'desc'}, take: 500});
    const kinds = new Map<string, {kind: string; available: number; granted: number; used: number; unlimited: boolean; expiresAt: Date | null; expired: number}>();
    for (const entry of entries) {
      const row = kinds.get(entry.kind) ?? {kind: entry.kind, available: 0, granted: 0, used: 0, unlimited: false, expiresAt: null as Date | null, expired: 0};
      const open = !entry.periodEnd || entry.periodEnd.getTime() > now.getTime();
      if (open) {
        row.available += entry.delta;
        if (entry.delta > 0) row.granted += entry.delta;
        if (entry.delta < 0) row.used += -entry.delta;
        if (entry.delta === 0 && /unlimited/i.test(entry.reason)) row.unlimited = true;
        if (entry.periodEnd && (!row.expiresAt || entry.periodEnd.getTime() < row.expiresAt.getTime())) row.expiresAt = entry.periodEnd;
      } else if (entry.delta > 0) row.expired += entry.delta;
      kinds.set(entry.kind, row);
    }
    return {
      balances: [...kinds.values()].map(row => ({...row, available: Math.max(0, row.available)})),
      recent: entries.slice(0, 20).map(entry => ({kind: entry.kind, delta: entry.delta, reason: entry.reason, createdAt: entry.createdAt, periodEnd: entry.periodEnd})),
      rules: 'Included benefits are granted for each paid period and expire when that period ends. Unused benefits do not roll over.',
    };
  }

  /* ── Invoices ── */

  private invoiceRow(invoice: Json) {
    return {
      id: invoice.id, number: invoice.number ?? null, createdAt: invoice.createdAt, status: invoice.status, currency: invoice.currency,
      total: Number(invoice.total) || Number(invoice.amountDue) || Number(invoice.amountPaid) || 0, amountPaid: invoice.amountPaid, amountDue: invoice.amountDue, amountRemaining: invoice.amountRemaining,
      taxAmount: invoice.taxAmount, discountAmount: invoice.discountAmount, periodStart: invoice.periodStart, periodEnd: invoice.periodEnd, dueDate: invoice.dueDate,
      payable: invoice.status === 'open' && Number(invoice.amountRemaining || invoice.amountDue) > 0, hasPdf: Boolean(invoice.pdfUrl), hasHostedPage: Boolean(invoice.hostedUrl),
    };
  }

  async invoices(accountId: string, query: AccountListDto) {
    const ids = await this.ids(accountId);
    const {page, limit, skip, take} = parsePagination(query, 10, 50);
    const statuses = ['draft', 'open', 'paid', 'uncollectible', 'void'];
    const where = {customerId: {in: ids}, ...(query.status && statuses.includes(query.status) ? {status: query.status} : {})};
    const [rows, total] = await Promise.all([this.db.invoice.findMany({where, orderBy: {createdAt: 'desc'}, skip, take}), this.db.invoice.count({where})]);
    return {items: rows.map(row => this.invoiceRow(row)), total, page, limit};
  }

  private async ownedInvoice(accountId: string, id: string) {
    const ids = await this.ids(accountId);
    const invoice = await this.db.invoice.findUnique({where: {id}});
    if (!invoice || !invoice.customerId || !ids.includes(invoice.customerId)) throw new NotFoundException();
    return invoice;
  }

  /** Hosted page and PDF links are handed only to the signed-in owner of the invoice. */
  async invoice(accountId: string, id: string) {
    const invoice = await this.ownedInvoice(accountId, id);
    return {...this.invoiceRow(invoice), subtotal: invoice.subtotal, lines: invoice.lines, hostedUrl: invoice.hostedUrl, pdfUrl: invoice.pdfUrl, subscriptionId: invoice.subscriptionId, orderId: invoice.orderId};
  }

  /**
   * Pay an outstanding invoice. Stripe is asked for the invoice's current state
   * first; only an open invoice is sent to Stripe's hosted page, which handles
   * the charge and any authentication exactly once. We never retry a payment blind.
   */
  async payInvoice(accountId: string, id: string) {
    const invoice = await this.ownedInvoice(accountId, id);
    let live: Stripe.Invoice;
    try {
      live = await this.payments.client().invoices.retrieve(invoice.stripeInvoiceId);
    } catch {
      throw new BadRequestException('We could not reach Stripe to check this invoice. Please try again.');
    }
    const profiles = await this.cards.ownedProfiles(accountId);
    const stripeCustomerId = typeof live.customer === 'string' ? live.customer : live.customer?.id;
    if (!profiles.some(profile => profile.stripeCustomerId && profile.stripeCustomerId === stripeCustomerId)) throw new NotFoundException();
    await this.billing.upsertInvoice(live);
    if (live.status !== 'open' || !live.hosted_invoice_url) return {status: live.status, url: null, message: live.status === 'paid' ? 'This invoice is already paid.' : 'This invoice cannot be paid online.'};
    return {status: 'open', url: live.hosted_invoice_url, message: null};
  }

  /** Upcoming charges. Always labelled as an estimate; the renewal date is Stripe's. */
  async upcoming(accountId: string) {
    const ids = await this.ids(accountId);
    const subs = await this.db.subscription.findMany({where: {customerId: {in: ids}, accessStatus: {in: ['ACTIVE', 'PAST_DUE']}, cancelAtPeriodEnd: false}, include: {plan: true}, orderBy: {currentPeriodEnd: 'asc'}, take: 6});
    const items = [];
    for (const sub of subs) {
      let amount = sub.unitAmount * sub.quantity;
      let source: 'stripe_preview' | 'plan_price' = 'plan_price';
      try {
        const preview = await this.payments.client().invoices.createPreview({customer: sub.stripeCustomerId, subscription: sub.stripeSubscriptionId});
        amount = preview.amount_due ?? amount;
        source = 'stripe_preview';
      } catch {
        /* Fall back to the agreed plan price; still clearly an estimate. */
      }
      items.push({subscriptionId: sub.id, planName: this.planName(sub), date: sub.nextInvoiceAt ?? sub.currentPeriodEnd, amount, currency: sub.currency, estimate: true, source});
    }
    return {items, note: 'Estimates only. The final amount is confirmed on the invoice, including any tax or discount.'};
  }

  /* ── Profile ── */

  async profile(accountId: string) {
    const customer = await this.db.customer.findUnique({where: {id: accountId}});
    if (!customer) throw new NotFoundException();
    const prefs = obj(customer.notificationPrefs);
    return {
      name: customer.name, email: customer.email, pendingEmail: customer.pendingEmail, emailVerified: Boolean(customer.emailVerifiedAt), phone: customer.phone, company: customer.company, billingAddress: obj(customer.billingAddress),
      preferences: {marketingOptIn: customer.marketingOptIn, bookingReminders: prefs.bookingReminders !== false, renewalReminders: prefs.renewalReminders !== false},
      /* Security and transactional notices are always sent and are not a preference. */
      essentialNotices: ['Receipts and invoices', 'Payment problems', 'Password, email and sign-in changes', 'Subscription changes you make'],
      memberSince: customer.createdAt, closureRequestedAt: customer.closureRequestedAt,
    };
  }

  async updateProfile(principal: CustomerPrincipal, dto: ProfileDto) {
    const address = dto.billingAddress ? Object.fromEntries(Object.entries(dto.billingAddress).filter(([, value]) => typeof value === 'string' && value.length)) : undefined;
    if (address?.country) address.country = String(address.country).toUpperCase();
    const customer = await this.db.customer.update({where: {id: principal.id}, data: {name: dto.name, phone: dto.phone || null, company: dto.company || null, ...(address ? {billingAddress: address as object} : {})}});
    /* Stripe is told after our own save. A failure is recorded for reconciliation, not hidden,
       and never rolls back the customer's edit. Past invoices and orders keep their snapshots. */
    if (customer.stripeCustomerId) {
      try {
        await this.payments.client().customers.update(customer.stripeCustomerId, {
          name: customer.name || undefined,
          phone: customer.phone || undefined,
          ...(address && address.line1 ? {address: {line1: String(address.line1), line2: address.line2 ? String(address.line2) : undefined, city: address.city ? String(address.city) : undefined, state: address.state ? String(address.state) : undefined, postal_code: address.postalCode ? String(address.postalCode) : undefined, country: address.country ? String(address.country) : undefined}} : {}),
        });
      } catch {
        await this.db.billingEvent.create({data: {customerId: customer.id, actorType: 'SYSTEM', action: 'STRIPE_PROFILE_SYNC_FAILED', note: 'Stripe customer profile is stale; reconcile from admin diagnostics.'}}).catch(() => undefined);
      }
    }
    const name = displayName(customer);
    return {...(await this.profile(principal.id)), displayName: name, initials: initials(name)};
  }

  async updatePreferences(accountId: string, dto: PreferencesDto, now = new Date()) {
    const customer = await this.db.customer.findUnique({where: {id: accountId}});
    if (!customer) throw new NotFoundException();
    const prefs = {...obj(customer.notificationPrefs), ...(dto.bookingReminders !== undefined ? {bookingReminders: dto.bookingReminders} : {}), ...(dto.renewalReminders !== undefined ? {renewalReminders: dto.renewalReminders} : {})};
    await this.db.customer.update({where: {id: accountId}, data: {notificationPrefs: prefs as object, ...(dto.marketingOptIn !== undefined ? {marketingOptIn: dto.marketingOptIn, marketingConsentAt: dto.marketingOptIn ? now : null} : {})}});
    return this.profile(accountId);
  }

  /* ── Support, closure ── */

  /** A reference is accepted only when it names something this account owns. */
  private async safeReference(accountId: string, reference?: string): Promise<string | null> {
    if (!reference) return null;
    const ids = await this.ids(accountId);
    const order = await this.db.order.findUnique({where: {id: reference}});
    if (order && ids.includes(order.customerId)) return 'order:' + order.id;
    const sub = await this.db.subscription.findUnique({where: {id: reference}});
    if (sub && ids.includes(sub.customerId)) return 'subscription:' + sub.id;
    const invoice = await this.db.invoice.findUnique({where: {id: reference}});
    if (invoice?.customerId && ids.includes(invoice.customerId)) return 'invoice:' + invoice.id;
    if (reference.startsWith('legacy-')) {
      const booking = await this.db.booking.findUnique({where: {id: reference.slice(7)}});
      if (booking?.customerId && ids.includes(booking.customerId)) return 'booking:' + booking.id;
    }
    return null;
  }

  async support(principal: CustomerPrincipal, dto: SupportDto) {
    const reference = await this.safeReference(principal.id, dto.reference);
    const request = await this.db.supportRequest.create({data: {customerId: principal.id, type: dto.type, subject: dto.subject, message: dto.message, reference}});
    await this.db.billingEvent.create({data: {customerId: principal.id, actorType: 'CUSTOMER', actorId: principal.id, actorLabel: principal.email, action: 'SUPPORT_REQUESTED', data: {type: dto.type, requestId: request.id}}});
    return {id: request.id, status: request.status, createdAt: request.createdAt, message: dto.type === 'REFUND' ? 'Your refund request was sent to our team for review. Refunds are not automatic; we will reply by email.' : 'Your request was sent. Our team will reply by email.'};
  }

  async supportRequests(accountId: string) {
    const rows = await this.db.supportRequest.findMany({where: {customerId: accountId}, orderBy: {createdAt: 'desc'}, take: 20});
    return {items: rows.map(row => ({id: row.id, type: row.type, subject: row.subject, status: row.status, createdAt: row.createdAt}))};
  }

  /** Closure is a request for staff. It cancels nothing and deletes nothing. */
  async requestClosure(principal: CustomerPrincipal, dto: ClosureDto) {
    const ids = await this.ids(principal.id);
    const active = await this.db.subscription.findMany({where: {customerId: {in: ids}, accessStatus: {in: [...LIVE_ACCESS]}}, include: {plan: true}});
    await this.db.customer.update({where: {id: principal.id}, data: {closureRequestedAt: new Date()}});
    const request = await this.db.supportRequest.create({data: {customerId: principal.id, type: 'CLOSURE', subject: 'Account closure request', message: dto.reason || 'Customer asked to close their account.'}});
    await this.db.billingEvent.create({data: {customerId: principal.id, actorType: 'CUSTOMER', actorId: principal.id, actorLabel: principal.email, action: 'CLOSURE_REQUESTED', data: {requestId: request.id, activeSubscriptions: active.length}}});
    return {
      requested: true,
      activeSubscriptions: active.map(sub => ({id: sub.id, planName: this.planName(sub), cancelAtPeriodEnd: sub.cancelAtPeriodEnd})),
      explanation: [
        'Our team will review your request and reply by email.',
        active.length ? 'Your active subscriptions are not cancelled by this request. Cancel each one from My subscriptions, or tell us to do it.' : 'You have no active subscriptions.',
        'Invoices, receipts and payment records are kept for as long as tax and accounting rules require, even after your account is closed.',
      ],
    };
  }

  /* ── Claims ── */

  private async account(accountId: string) {
    const account = await this.db.customer.findUnique({where: {id: accountId}});
    if (!account || !account.emailVerifiedAt || !account.emailKey) throw new NotFoundException();
    return account;
  }

  /**
   * Purchases made with this account's verified email while not signed in, and
   * legacy bookings under that email. Nothing is linked until the signed-in,
   * verified owner says so.
   */
  async claims(accountId: string) {
    const account = await this.account(accountId);
    const shadows = await this.db.customer.findMany({where: {email: account.emailKey!, emailKey: null, shadowState: 'PENDING_CLAIM', mergedIntoId: null}, include: {orders: {where: {status: 'PAID'}, include: {items: true}}}, take: 20});
    const bookings = await this.db.booking.count({where: {customerId: null, customerEmail: {equals: account.emailKey!, mode: 'insensitive'}}});
    return {
      purchases: shadows.filter(shadow => shadow.orders.length).map(shadow => ({id: shadow.id, createdAt: shadow.createdAt, orders: shadow.orders.map(order => ({createdAt: order.createdAt, title: order.items[0]?.description ?? 'Purchase', amount: order.dueNowAmount, currency: order.currency}))})),
      legacyBookings: bookings,
    };
  }

  async acceptClaim(principal: CustomerPrincipal, shadowId: string) {
    const account = await this.account(principal.id);
    /* Compare-and-set: the row must still be an unclaimed purchase under exactly this verified email. */
    const linked = await this.db.customer.updateMany({where: {id: shadowId, email: account.emailKey!, emailKey: null, shadowState: 'PENDING_CLAIM', mergedIntoId: null}, data: {shadowState: 'CLAIMED', mergedIntoId: account.id}});
    if (linked.count !== 1) throw new NotFoundException();
    await this.db.billingEvent.create({data: {customerId: account.id, actorType: 'CUSTOMER', actorId: account.id, actorLabel: account.email, action: 'PURCHASE_CLAIMED', data: {profileId: shadowId}}});
    return {claimed: true};
  }

  async declineClaim(principal: CustomerPrincipal, shadowId: string) {
    const account = await this.account(principal.id);
    const declined = await this.db.customer.updateMany({where: {id: shadowId, email: account.emailKey!, emailKey: null, shadowState: 'PENDING_CLAIM', mergedIntoId: null}, data: {shadowState: 'DECLINED'}});
    if (declined.count !== 1) throw new NotFoundException();
    await this.db.supportRequest.create({data: {customerId: account.id, type: 'CLAIM_DISPUTE', subject: 'Purchase not recognised', message: 'The account owner did not recognise a purchase made with their email address.', reference: 'profile:' + shadowId}});
    await this.db.billingEvent.create({data: {customerId: account.id, actorType: 'CUSTOMER', actorId: account.id, actorLabel: account.email, action: 'PURCHASE_CLAIM_DECLINED', data: {profileId: shadowId}}});
    return {declined: true};
  }

  async claimLegacyBookings(principal: CustomerPrincipal) {
    const account = await this.account(principal.id);
    const claimed = await this.db.booking.updateMany({where: {customerId: null, customerEmail: {equals: account.emailKey!, mode: 'insensitive'}}, data: {customerId: account.id, claimedAt: new Date()}});
    if (claimed.count) await this.db.billingEvent.create({data: {customerId: account.id, actorType: 'CUSTOMER', actorId: account.id, actorLabel: account.email, action: 'LEGACY_BOOKINGS_CLAIMED', data: {count: claimed.count}}});
    return {claimed: claimed.count};
  }

  /* ── Overview ── */

  /**
   * The dashboard normally reads the local card mirror. When it was never
   * reconciled, or not recently, Stripe is asked first. If Stripe cannot be
   * reached the card state is reported as unknown, never as missing.
   */
  private async freshCardState(accountId: string, now: Date): Promise<'fresh' | 'unknown'> {
    const profiles = await this.cards.ownedProfiles(accountId);
    const stale = profiles.filter(profile => {
      const checked = (profile as Profile & {cardCheckedAt?: Date | null}).cardCheckedAt;
      return profile.stripeCustomerId && (!checked || now.getTime() - new Date(checked).getTime() > 6 * 3600000);
    });
    try {
      for (const profile of stale) await this.cards.sync(profile, now);
      return 'fresh';
    } catch {
      return 'unknown';
    }
  }

  async overview(principal: CustomerPrincipal, now = new Date()) {
    const ids = await this.ids(principal.id);
    const cardState = await this.freshCardState(principal.id, now);
    const [account, subs, invoices, cards, bookings, benefits, claims, orderCount, changes] = await Promise.all([
      this.db.customer.findUnique({where: {id: principal.id}}),
      this.db.subscription.findMany({where: {customerId: {in: ids}, accessStatus: {in: [...LIVE_ACCESS]}}, include: {plan: true}, orderBy: {createdAt: 'desc'}, take: 20}),
      this.db.invoice.findMany({where: {customerId: {in: ids}, status: 'open'}, orderBy: {createdAt: 'desc'}, take: 10}),
      /* The local mirror: the dashboard never waits on Stripe. The cards page reconciles live. */
      this.db.customerCard.findMany({where: {customerId: {in: ids}, detachedAt: null}, orderBy: {createdAt: 'asc'}}),
      this.bookings(principal.id, now),
      this.benefits(principal.id, now),
      this.claims(principal.id),
      this.db.order.count({where: {customerId: {in: ids}, status: 'PAID'}}),
      this.db.subscriptionChange.findMany({where: {customerId: {in: ids}, status: {in: ['PENDING_PAYMENT', 'SCHEDULED']}}}),
    ]);
    if (!account) throw new NotFoundException();
    const defaultCard = cards.find(card => card.isDefault) ?? cards[0] ?? null;
    const cardHealth = !cards.length ? (cardState === 'unknown' ? 'unknown' : 'missing') : !defaultCard || isCardExpired(defaultCard, now) ? 'expired' : isCardExpiringSoon(defaultCard, now) ? 'expiring' : 'ok';
    const failing = subs.filter(sub => sub.accessStatus === 'PAST_DUE' || sub.accessStatus === 'SUSPENDED');
    const banners: Array<{type: string; tone: 'bad' | 'warn' | 'info'; title: string; detail: string; href: string; action: string}> = [];
    if (failing.length) banners.push({type: 'payment_failed', tone: 'bad', title: 'A payment did not go through', detail: 'Update your card or pay the outstanding invoice to keep ' + this.planName(failing[0]) + (failing.length > 1 ? ' and ' + (failing.length - 1) + ' more' : '') + ' active.', href: '/account/billing/', action: 'Review billing'});
    if (cardHealth === 'missing') banners.push({type: 'card_missing', tone: subs.length ? 'bad' : 'warn', title: 'Add a payment card', detail: 'Your account has no saved card. Anything you have already paid for is unaffected, but renewals and new purchases need a card on file.', href: '/account/payment-methods/', action: 'Add a card'});
    else if (cardHealth === 'expired') banners.push({type: 'card_expired', tone: 'bad', title: 'Your default card has expired', detail: 'Add a replacement card so your next renewal can be collected.', href: '/account/payment-methods/', action: 'Replace card'});
    else if (cardHealth === 'expiring') banners.push({type: 'card_expiring', tone: 'warn', title: 'Your default card expires soon', detail: 'Add a replacement before it expires to avoid a failed renewal.', href: '/account/payment-methods/', action: 'Review cards'});
    for (const change of changes.filter(entry => entry.status === 'PENDING_PAYMENT')) banners.push({type: 'plan_payment', tone: 'warn', title: 'Finish your plan upgrade', detail: 'Your upgrade is waiting for payment. Your current plan stays active until it is completed.', href: '/account/subscriptions/?sub=' + change.subscriptionId, action: 'Complete payment'});
    if (claims.purchases.length) banners.push({type: 'claim', tone: 'info', title: 'A purchase is waiting for your account', detail: 'A purchase was made with your email while signed out. Confirm it to add it to your account.', href: '/account/purchases/', action: 'Review purchase'});
    if (claims.legacyBookings) banners.push({type: 'legacy_bookings', tone: 'info', title: 'Earlier bookings found', detail: claims.legacyBookings + ' earlier booking' + (claims.legacyBookings === 1 ? '' : 's') + ' made with your verified email can be added to your account.', href: '/account/bookings/', action: 'Add them'});
    if (principal.method === 'LINK') banners.push({type: 'link_session', tone: 'info', title: 'Signed in with an email link', detail: 'To change your password or email you will be asked for your password.', href: '/account/security/', action: 'Security settings'});

    const renewing = subs.filter(sub => !sub.cancelAtPeriodEnd && sub.accessStatus !== 'SUSPENDED' && (sub.nextInvoiceAt ?? sub.currentPeriodEnd));
    /* Same estimate as Billing & invoices (Stripe's preview), so the two pages never disagree. Falls back to the plan price. */
    const previews = new Map<string, number>();
    if (renewing.length) {
      try {
        for (const item of (await this.upcoming(principal.id)).items) previews.set(item.subscriptionId, item.amount);
      } catch {
        /* Plan price below; still labelled as an estimate. */
      }
    }
    const name = displayName(account);
    return {
      customer: {displayName: name, initials: initials(name), email: account.email, emailVerified: Boolean(account.emailVerifiedAt), memberSince: account.createdAt},
      banners,
      subscriptions: subs.slice(0, 6).map(sub => this.subscriptionView(sub as never, changes.find(change => change.subscriptionId === sub.id) ?? null)),
      upcomingRenewals: renewing.map(sub => ({subscriptionId: sub.id, planName: this.planName(sub), date: sub.nextInvoiceAt ?? sub.currentPeriodEnd, amount: previews.get(sub.id) ?? sub.unitAmount * sub.quantity, currency: sub.currency})).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()).slice(0, 4),
      upcomingBookings: bookings.upcoming.slice(0, 3),
      outstandingInvoices: invoices.map(invoice => this.invoiceRow(invoice)).filter(invoice => invoice.payable),
      card: defaultCard ? {brand: defaultCard.brand, last4: defaultCard.last4, expMonth: defaultCard.expMonth, expYear: defaultCard.expYear, health: cardHealth, count: cards.length} : {health: cardHealth, count: 0},
      benefits: benefits.balances,
      counts: {subscriptions: subs.length, purchases: orderCount, upcomingBookings: bookings.upcoming.length},
    };
  }
}

/* ───────────────────────────── Controller ───────────────────────────── */

type Req = {customer: CustomerPrincipal};
const actorOf = (req: Req) => ({id: req.customer.id, label: req.customer.email});

@Controller('account') @UseGuards(CustomerGuard)
export class AccountController {
  constructor(@Inject(AccountService) private account: AccountService, @Inject(CardService) private cards: CardService, @Inject(PlanChangeService) private plans: PlanChangeService) {}

  @Get('overview') @Throttle({default: {limit: 120, ttl: 60000}})
  overview(@Req() req: Req) {
    return this.account.overview(req.customer);
  }

  /* Subscriptions */
  @Get('subscriptions') @Throttle({default: {limit: 120, ttl: 60000}})
  subscriptions(@Req() req: Req) {
    return this.account.subscriptions(req.customer.id);
  }

  @Get('subscriptions/:id') @Throttle({default: {limit: 120, ttl: 60000}})
  subscription(@Req() req: Req, @Param('id') id: string) {
    return this.account.subscription(req.customer.id, id);
  }

  @Get('subscriptions/:id/cancellation-preview') @Throttle({default: {limit: 60, ttl: 60000}})
  cancellationPreview(@Req() req: Req, @Param('id') id: string) {
    return this.account.cancellationPreview(req.customer.id, id);
  }

  @Post('subscriptions/:id/cancel') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  cancel(@Req() req: Req, @Param('id') id: string, @ValidatedBody(CancelDto) dto: CancelDto) {
    return this.account.cancel(req.customer, id, dto.reason);
  }

  @Post('subscriptions/:id/resume') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  resume(@Req() req: Req, @Param('id') id: string) {
    return this.account.resume(req.customer, id);
  }

  @Get('subscriptions/:id/change-options') @Throttle({default: {limit: 60, ttl: 60000}})
  changeOptions(@Req() req: Req, @Param('id') id: string) {
    return this.plans.options(req.customer.id, id);
  }

  @Post('subscriptions/:id/change-preview') @HttpCode(200) @Throttle({default: {limit: 20, ttl: 60000}})
  changePreview(@Req() req: Req, @Param('id') id: string, @ValidatedBody(PlanPreviewDto) dto: PlanPreviewDto) {
    return this.plans.preview(req.customer.id, id, dto.targetSlug);
  }

  @Post('subscriptions/:id/change') @HttpCode(200) @Throttle({default: {limit: 6, ttl: 60000}})
  change(@Req() req: Req, @Param('id') id: string, @ValidatedBody(PlanConfirmDto) dto: PlanConfirmDto) {
    return this.plans.confirm(req.customer.id, id, dto, actorOf(req));
  }

  @Post('subscriptions/:id/change/withdraw') @HttpCode(200) @Throttle({default: {limit: 6, ttl: 60000}})
  withdrawChange(@Req() req: Req, @Param('id') id: string) {
    return this.plans.withdraw(req.customer.id, id, actorOf(req));
  }

  /* Purchases and bookings */
  @Get('orders') @Throttle({default: {limit: 120, ttl: 60000}})
  orders(@Req() req: Req, @ValidatedQuery(AccountListDto) query: AccountListDto) {
    return this.account.orders(req.customer.id, query);
  }

  @Get('orders/:id') @Throttle({default: {limit: 120, ttl: 60000}})
  order(@Req() req: Req, @Param('id') id: string) {
    return this.account.order(req.customer.id, id);
  }

  @Get('bookings') @Throttle({default: {limit: 120, ttl: 60000}})
  bookings(@Req() req: Req) {
    return this.account.bookings(req.customer.id);
  }

  @Get('bookings/:id/calendar') @Throttle({default: {limit: 60, ttl: 60000}})
  async calendar(@Req() req: Req, @Param('id') id: string, @Res() res: {setHeader: (name: string, value: string) => void; send: (body: string) => void}) {
    const ics = await this.account.bookingIcs(req.customer.id, id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="workspace-junction-booking.ics"');
    res.send(ics);
  }

  @Get('benefits') @Throttle({default: {limit: 120, ttl: 60000}})
  benefits(@Req() req: Req) {
    return this.account.benefits(req.customer.id);
  }

  /* Billing */
  @Get('invoices') @Throttle({default: {limit: 120, ttl: 60000}})
  invoices(@Req() req: Req, @ValidatedQuery(AccountListDto) query: AccountListDto) {
    return this.account.invoices(req.customer.id, query);
  }

  @Get('invoices/upcoming') @Throttle({default: {limit: 30, ttl: 60000}})
  upcoming(@Req() req: Req) {
    return this.account.upcoming(req.customer.id);
  }

  @Get('invoices/:id') @Throttle({default: {limit: 120, ttl: 60000}})
  invoice(@Req() req: Req, @Param('id') id: string) {
    return this.account.invoice(req.customer.id, id);
  }

  @Post('invoices/:id/pay') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  pay(@Req() req: Req, @Param('id') id: string) {
    return this.account.payInvoice(req.customer.id, id);
  }

  /* Cards */
  @Get('payment-methods') @Throttle({default: {limit: 60, ttl: 60000}})
  paymentMethods(@Req() req: Req) {
    return this.cards.list(req.customer.id);
  }

  @Post('payment-methods/setup-intent') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  setupIntent(@Req() req: Req, @ValidatedBody(SetupIntentDto) dto: SetupIntentDto) {
    if (dto.consent !== true) throw new BadRequestException('Please confirm that this card may be saved for future payments.');
    return this.cards.createSetupIntent(req.customer.id, dto.profileId);
  }

  @Post('payment-methods/setup-complete') @HttpCode(200) @Throttle({default: {limit: 20, ttl: 60000}})
  setupComplete(@Req() req: Req, @ValidatedBody(SetupCompleteDto) dto: SetupCompleteDto) {
    return this.cards.completeSetup(req.customer.id, dto, actorOf(req));
  }

  @Post('payment-methods/:id/default') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  setDefault(@Req() req: Req, @Param('id') id: string, @ValidatedBody(CardActionDto) dto: CardActionDto) {
    return this.cards.setDefault(req.customer.id, id, dto, actorOf(req));
  }

  @Delete('payment-methods/:id') @Throttle({default: {limit: 10, ttl: 60000}})
  removeCard(@Req() req: Req, @Param('id') id: string, @ValidatedBody(CardActionDto) dto: CardActionDto) {
    return this.cards.remove(req.customer.id, id, dto, actorOf(req));
  }

  /* Profile */
  @Get('profile') @Throttle({default: {limit: 120, ttl: 60000}})
  profile(@Req() req: Req) {
    return this.account.profile(req.customer.id);
  }

  @Patch('profile') @Throttle({default: {limit: 20, ttl: 60000}})
  updateProfile(@Req() req: Req, @ValidatedBody(ProfileDto) dto: ProfileDto) {
    return this.account.updateProfile(req.customer, dto);
  }

  @Patch('preferences') @Throttle({default: {limit: 20, ttl: 60000}})
  preferences(@Req() req: Req, @ValidatedBody(PreferencesDto) dto: PreferencesDto) {
    return this.account.updatePreferences(req.customer.id, dto);
  }

  /* Support and closure */
  @Get('support') @Throttle({default: {limit: 60, ttl: 60000}})
  supportRequests(@Req() req: Req) {
    return this.account.supportRequests(req.customer.id);
  }

  @Post('support') @HttpCode(201) @Throttle({default: {limit: 5, ttl: 60000}})
  support(@Req() req: Req, @ValidatedBody(SupportDto) dto: SupportDto) {
    return this.account.support(req.customer, dto);
  }

  @Post('closure-request') @HttpCode(200) @Throttle({default: {limit: 3, ttl: 60000}})
  closure(@Req() req: Req, @ValidatedBody(ClosureDto) dto: ClosureDto) {
    return this.account.requestClosure(req.customer, dto);
  }

  /* Claims */
  @Get('claims') @Throttle({default: {limit: 60, ttl: 60000}})
  claims(@Req() req: Req) {
    return this.account.claims(req.customer.id);
  }

  @Post('claims/bookings') @HttpCode(200) @Throttle({default: {limit: 5, ttl: 60000}})
  claimBookings(@Req() req: Req, @Body() _body: unknown) {
    return this.account.claimLegacyBookings(req.customer);
  }

  @Post('claims/:id/accept') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  acceptClaim(@Req() req: Req, @Param('id') id: string) {
    return this.account.acceptClaim(req.customer, id);
  }

  @Post('claims/:id/decline') @HttpCode(200) @Throttle({default: {limit: 10, ttl: 60000}})
  declineClaim(@Req() req: Req, @Param('id') id: string) {
    return this.account.declineClaim(req.customer, id);
  }
}

/* ───────────────────────────── Staff: diagnostics and overrides ───────────────────────────── */

@ApiBearerAuth() @UseGuards(AuthGuard) @Controller('admin/accounts')
export class AccountAdminController {
  constructor(@Inject(Db) private db: Db, @Inject(CardService) private cards: CardService) {}

  /** Reconciliation view. Counts and ids only: no email bodies, tokens, card data or provider objects. */
  @Get('diagnostics') @Roles('ADMIN', 'EDITOR')
  async diagnostics() {
    const now = new Date();
    const stale = new Date(now.getTime() - 30 * 60000);
    const [missingCards, expiredCards, unknownCards, pendingSetup, undelivered, deadMail, pendingChanges, scheduledChanges, stuckOperations, pendingClaims, collisions, syncFailures, staleDefaults] = await Promise.all([
      this.db.customer.findMany({where: {accountStatus: 'ACTIVE', cardStatus: 'MISSING'}, select: {id: true, cardCheckedAt: true}, take: 100}),
      this.db.customer.count({where: {accountStatus: 'ACTIVE', cardStatus: 'EXPIRED'}}),
      this.db.customer.count({where: {accountStatus: {in: ['ACTIVE', 'PENDING_SETUP']}, cardStatus: 'UNKNOWN', stripeCustomerId: {not: null}}}),
      this.db.customer.findMany({where: {accountStatus: 'PENDING_SETUP'}, select: {id: true, updatedAt: true}, orderBy: {updatedAt: 'asc'}, take: 100}),
      this.db.emailOutbox.groupBy({by: ['template', 'status'], where: {status: {in: ['PENDING', 'FAILED', 'SENDING']}}, _count: {_all: true}}),
      this.db.emailOutbox.count({where: {status: 'DEAD'}}),
      this.db.subscriptionChange.findMany({where: {status: 'PENDING_PAYMENT'}, select: {id: true, subscriptionId: true, createdAt: true}, take: 100}),
      this.db.subscriptionChange.count({where: {status: 'SCHEDULED'}}),
      this.db.customerOperation.findMany({where: {status: 'STARTED', createdAt: {lt: stale}}, select: {id: true, customerId: true, kind: true, createdAt: true}, take: 100}),
      this.db.customer.count({where: {shadowState: 'PENDING_CLAIM'}}),
      this.db.customer.count({where: {shadowState: 'COLLISION'}}),
      this.db.billingEvent.count({where: {action: {in: ['STRIPE_EMAIL_SYNC_FAILED', 'STRIPE_PROFILE_SYNC_FAILED', 'CARD_INVARIANT_BROKEN']}, createdAt: {gte: new Date(now.getTime() - 30 * 24 * 3600000)}}}),
      /* Live subscriptions with no card of their own whose customer also has no default: nothing to charge. */
      this.db.subscription.count({where: {accessStatus: {in: ['ACTIVE', 'PAST_DUE']}, defaultPaymentMethodId: null, customer: {cardStatus: {in: ['MISSING', 'EXPIRED']}}}}),
    ]);
    return {
      generatedAt: now,
      cards: {activeAccountsWithoutCard: missingCards, activeAccountsWithExpiredCards: expiredCards, unreconciled: unknownCards, subscriptionsWithoutUsableCard: staleDefaults},
      accounts: {awaitingSetup: pendingSetup, purchasesAwaitingClaim: pendingClaims, emailCollisionsToResolve: collisions},
      email: {undelivered: undelivered.map(row => ({template: row.template, status: row.status, count: row._count._all})), dead: deadMail},
      planChanges: {awaitingPayment: pendingChanges, scheduled: scheduledChanges},
      operations: {stuck: stuckOperations},
      providerSyncFailuresLast30Days: syncFailures,
    };
  }

  @Get('support-requests') @Roles('ADMIN', 'EDITOR')
  async supportRequests(@Query('status') status?: string) {
    const rows = await this.db.supportRequest.findMany({where: status && ['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status) ? {status} : {}, orderBy: {createdAt: 'desc'}, take: 100});
    return {items: rows};
  }

  @Patch('support-requests/:id') @Roles('ADMIN', 'EDITOR')
  async updateSupport(@Param('id') id: string, @ValidatedBody(SupportStatusDto) dto: SupportStatusDto) {
    return this.db.supportRequest.update({where: {id}, data: {status: dto.status}});
  }

  /**
   * Intentional policy override: only an administrator, only with a written
   * reason, and always audited. This is the single way a last card can be
   * removed through this application.
   */
  @Post('customers/:customerId/cards/:cardId/remove') @HttpCode(200) @Roles('ADMIN')
  async removeCard(@Param('customerId') customerId: string, @Param('cardId') cardId: string, @ValidatedBody(AdminCardRemoveDto) dto: AdminCardRemoveDto, @Req() req: {user: {id: string; email: string}}) {
    const profile = (await this.db.customer.findUnique({where: {id: customerId}})) as Profile | null;
    if (!profile) throw new NotFoundException();
    const accountId = (profile as Profile & {mergedIntoId?: string | null}).mergedIntoId ?? profile.id;
    return this.cards.remove(accountId, cardId, {profileId: profile.id}, {type: 'ADMIN', id: req.user.id, label: req.user.email}, {allowLast: dto.allowLast === true, reason: dto.reason});
  }
}
