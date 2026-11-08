/**
 * Pure helpers for the custom (non Stripe Checkout) payment flow.
 *
 * Everything here is deterministic and free of Nest, Prisma and Stripe, so the
 * rules that decide what a customer is enrolled in, what they can read back and
 * what an error discloses are unit-testable without a network or a database.
 *
 * Two rules shape this file:
 *  1. Automatic renewal is never implied. A purchase renews only when the buyer
 *     explicitly asked for it, which is why `renewalDecision` takes the consent
 *     as a separate input from the catalogue's billing configuration.
 *  2. Nothing the browser sends decides money or access. The fingerprint below
 *     exists so a replayed idempotency key cannot quietly buy something else.
 */
import {createHash, timingSafeEqual} from 'node:crypto';
import type {BillingUnit} from './catalog-core';

/** The opaque capability a browser keeps for its own checkout attempt. */
export const CHECKOUT_TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function isValidCheckoutToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_PATTERN.test(value);
}

/** Only the hash is stored, so a database copy cannot read back an order. */
export function hashCheckoutToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time compare of two hex digests of equal length. */
export function tokenMatches(token: unknown, storedHash: string | null | undefined): boolean {
  if (!storedHash || !isValidCheckoutToken(token)) return false;
  const presented = Buffer.from(hashCheckoutToken(token), 'hex');
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }
  if (presented.length !== stored.length || stored.length === 0) return false;
  return timingSafeEqual(presented, stored);
}

/** Idempotency keys are client-supplied, so their shape is checked first. */
export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(value);
}

/**
 * A stable digest of everything that decides what is bought and charged. A
 * repeated idempotency key must describe the same purchase or it is rejected,
 * so a key cannot be reused to pay for one thing and receive another.
 */
export function requestFingerprint(input: {
  planSlug: string;
  quantity?: number | null;
  durationHours?: number | null;
  days?: number | null;
  addOns?: Array<{slug: string; quantity?: number | null}> | null;
  couponCode?: string | null;
  customerEmail: string;
  autoRenew: boolean;
  startAt?: string | null;
}): string {
  const canonical = JSON.stringify({
    planSlug: input.planSlug.trim().toLowerCase(),
    quantity: input.quantity ?? null,
    durationHours: input.durationHours ?? null,
    days: input.days ?? null,
    addOns: [...(input.addOns ?? [])]
      .map(entry => ({slug: entry.slug.trim().toLowerCase(), quantity: entry.quantity ?? null}))
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
    couponCode: input.couponCode?.trim() || null,
    customerEmail: input.customerEmail.trim().toLowerCase(),
    autoRenew: input.autoRenew === true,
    startAt: input.startAt ?? null,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/* ───────────────────────────── Renewal decision ───────────────────────────── */

export type PurchaseMode = 'SUBSCRIPTION' | 'ONE_TIME';

/**
 * The only place that turns a catalogue configuration plus an explicit consent
 * into a purchase mode. An absent or false consent can never produce
 * SUBSCRIPTION, which is what keeps the renewal checkbox meaningful.
 */
export function renewalDecision(input: {hasRecurring: boolean; autoRenew: unknown; acceptRecurringTerms?: unknown}): {mode: PurchaseMode; autoRenew: boolean; error: string | null} {
  const wantsRenewal = input.autoRenew === true;
  if (wantsRenewal && !input.hasRecurring) {
    return {mode: 'ONE_TIME', autoRenew: false, error: 'This package is not sold as a renewing subscription.'};
  }
  if (wantsRenewal && input.acceptRecurringTerms !== true) {
    return {mode: 'ONE_TIME', autoRenew: false, error: 'You must accept the automatic renewal terms to continue.'};
  }
  if (wantsRenewal) return {mode: 'SUBSCRIPTION', autoRenew: true, error: null};
  return {mode: 'ONE_TIME', autoRenew: false, error: null};
}

/* ───────────────────────────── Paid term ───────────────────────────── */

const DEFAULT_TERM_DAYS: Partial<Record<BillingUnit, number>> = {PER_MONTH: 30, PER_YEAR: 365};

/**
 * How long a single, non-renewing purchase stays usable. A term exists only
 * where the catalogue sells a period of access; an hourly room booking has a
 * reservation instead and returns null.
 */
export function termDaysFor(billingUnit: BillingUnit, configuredDays: number | null | undefined, units: number): number | null {
  const safeUnits = Number.isFinite(units) && units > 0 ? Math.floor(units) : 1;
  if (billingUnit === 'PER_DAY') return (configuredDays && configuredDays > 0 ? configuredDays : 1) * safeUnits;
  const base = configuredDays && configuredDays > 0 ? configuredDays : DEFAULT_TERM_DAYS[billingUnit];
  if (!base) return null;
  return base * safeUnits;
}

export function termEndFor(start: Date, days: number | null): Date | null {
  if (!days || days <= 0) return null;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

/** A paid, non-renewing term is active until the day it was paid through. */
export function finiteAccessStatus(paidThrough: Date | null | undefined, now = new Date()): 'ACTIVE' | 'ENDED' {
  if (!paidThrough) return 'ACTIVE';
  return paidThrough.getTime() > now.getTime() ? 'ACTIVE' : 'ENDED';
}

/* ───────────────────────────── API envelope ───────────────────────────── */

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  error?: {code: string; retryable?: boolean};
}

export function apiSuccess<T>(message: string, data: T): ApiEnvelope<T> {
  return {success: true, message, data};
}

export function apiFailure(message: string, code: string, retryable = false): ApiEnvelope<never> {
  return {success: false, message, data: null, error: {code, retryable}};
}

/* ───────────────────────────── Provider errors ───────────────────────────── */

export interface SafeProviderError {
  status: number;
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * Translate a provider failure into something safe to show a customer.
 *
 * The provider's own text can name internal configuration, account state or
 * API versions, so only the decline reason is mapped and nothing else is
 * echoed back. Operators still get the raw type in the server log.
 */
export function describeProviderError(error: unknown): SafeProviderError {
  const record = (error ?? {}) as {type?: unknown; code?: unknown; decline_code?: unknown};
  const type = typeof record.type === 'string' ? record.type : '';
  const code = typeof record.code === 'string' ? record.code : '';

  if (code === 'card_declined') return {status: 402, code: 'card_declined', message: 'Your card was declined. Try another card or contact your bank.', retryable: true};
  if (code === 'expired_card') return {status: 402, code: 'expired_card', message: 'That card has expired. Please use a different card.', retryable: true};
  if (code === 'incorrect_cvc' || code === 'invalid_cvc') return {status: 402, code: 'invalid_cvc', message: 'The security code did not match. Please check it and try again.', retryable: true};
  if (code === 'incorrect_number' || code === 'invalid_number') return {status: 402, code: 'invalid_card', message: 'That card number is not valid. Please check it and try again.', retryable: true};
  if (code === 'insufficient_funds') return {status: 402, code: 'insufficient_funds', message: 'The payment was declined for insufficient funds.', retryable: true};
  if (code === 'processing_error') return {status: 503, code: 'processing_error', message: 'The payment could not be processed just now. Please try again.', retryable: true};
  if (type === 'StripeCardError') return {status: 402, code: 'card_error', message: 'Your card could not be charged. Please try another payment method.', retryable: true};
  if (type === 'StripeConnectionError' || type === 'StripeAPIError') return {status: 503, code: 'provider_unavailable', message: 'Our payment provider is not responding. Please try again in a moment.', retryable: true};
  if (type === 'StripeRateLimitError') return {status: 503, code: 'provider_busy', message: 'Too many attempts right now. Please wait a moment and try again.', retryable: true};
  if (type === 'StripeIdempotencyError') return {status: 409, code: 'duplicate_request', message: 'This payment attempt was already started. Refresh and try again.', retryable: false};
  return {status: 502, code: 'payment_failed', message: 'We could not start this payment. Please try again.', retryable: true};
}

/** Provider type/code only: never a message, which can carry account detail. */
export function providerErrorLogLabel(error: unknown): string {
  const record = (error ?? {}) as {type?: unknown; code?: unknown};
  const type = typeof record.type === 'string' ? record.type : 'unknown_error';
  const code = typeof record.code === 'string' ? record.code : 'none';
  return type + '/' + code;
}
