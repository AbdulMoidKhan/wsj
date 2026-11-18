/**
 * Pure customer-account rules. No database, no Stripe, no environment access
 * beyond what a caller passes in, so every rule here is directly unit-testable.
 *
 * Principal model: a Customer is a separate principal from the staff User. It
 * has no role, never passes the staff AuthGuard, and its session cookie has a
 * different name, format (opaque, server-stored) and guard.
 */
import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

/** Bumped whenever the account + saved-card terms shown at checkout change. */
export const ACCOUNT_TERMS_VERSION = '2026-11-account-v1';

/** HttpOnly cookie holding the opaque session token. Scoped to /api, so only API requests carry it. */
export const SESSION_COOKIE = 'wsj_customer';
export const SESSION_COOKIE_PATH = '/api';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
/** Sensitive changes need a password check this recent. */
export const REAUTH_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_LOGINS = 8;
export const LOCKOUT_MS = 15 * 60 * 1000;

export type TokenPurpose = 'ACCOUNT_SETUP' | 'PASSWORD_RESET' | 'EMAIL_CHANGE' | 'LOGIN_LINK';
export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  ACCOUNT_SETUP: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
  EMAIL_CHANGE: 60 * 60 * 1000,
  LOGIN_LINK: 15 * 60 * 1000,
};

/** 256 bits of entropy; only the SHA-256 digest is ever persisted. */
export function newToken(): {token: string; hash: string} {
  const token = randomBytes(32).toString('base64url');
  return {token, hash: hashToken(token)};
}

export function hashToken(token: string): string {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

const COMMON_PASSWORDS = new Set(['password', 'password1', 'password123', 'qwertyuiop', '1234567890', '12345678910', 'letmein123', 'iloveyou123', 'welcome123', 'workspace123', 'changeme123', 'administrator']);

/**
 * Length-first policy (NIST 800-63B style): 10+ characters, not a common
 * password, not the customer's own email or name. bcrypt only reads 72 bytes,
 * so anything longer is refused instead of being silently truncated.
 */
export function passwordProblems(password: unknown, context: {email?: string | null; name?: string | null} = {}): string[] {
  const value = typeof password === 'string' ? password : '';
  const problems: string[] = [];
  if (value.length < 10) problems.push('Use at least 10 characters.');
  if (Buffer.byteLength(value, 'utf8') > 72) problems.push('Use at most 72 characters.');
  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(value)) problems.push('That password is too common. Choose something harder to guess.');
  const email = normalizeEmail(context.email);
  const local = email.split('@')[0];
  if (email && (lower === email || (local.length >= 4 && lower.includes(local)))) problems.push('Do not use your email address in your password.');
  const name = String(context.name ?? '').trim().toLowerCase();
  if (name.length >= 4 && lower.includes(name.replace(/\s+/g, ''))) problems.push('Do not use your name in your password.');
  return problems;
}

/** Customer-entered display data. Never an authorization input. */
export function displayName(customer: {name?: string | null; email?: string | null}): string {
  const name = String(customer.name ?? '').trim();
  const email = normalizeEmail(customer.email);
  if (name && name.toLowerCase() !== email) return name.slice(0, 80);
  return email ? email.split('@')[0].slice(0, 40) : 'Your account';
}

export function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  const letters = (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '').slice(0, 2)).toUpperCase();
  return /^[\p{L}\p{N}]{1,2}$/u.test(letters) ? letters : 'WJ';
}

/** Coarse network hint for the session list; a full IP is never stored. */
export function ipHint(ip: unknown): string | null {
  const value = String(ip ?? '').replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return value.split('.').slice(0, 2).join('.') + '.x.x';
  if (value.includes(':')) return value.split(':').slice(0, 2).join(':') + '::';
  return null;
}

export function deviceLabel(userAgent: unknown): string {
  const ua = String(userAgent ?? '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
  return browser + ' on ' + os;
}

/* ───────────────────────────── Cards ───────────────────────────── */

export interface CardLike {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** A card expires at the end of its expiry month. */
export function isCardExpired(card: {expMonth: number; expYear: number}, now = new Date()): boolean {
  if (!card.expMonth || !card.expYear) return false;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return card.expYear < year || (card.expYear === year && card.expMonth < month);
}

export function isCardExpiringSoon(card: {expMonth: number; expYear: number}, now = new Date()): boolean {
  if (isCardExpired(card, now) || !card.expMonth || !card.expYear) return false;
  const months = (card.expYear - now.getUTCFullYear()) * 12 + (card.expMonth - (now.getUTCMonth() + 1));
  return months <= 1;
}

export type CardStatus = 'OK' | 'MISSING' | 'EXPIRED' | 'UNKNOWN';

/** Health of the minimum-one-card invariant for one billing profile. */
export function cardStatusFor(cards: Array<{expMonth: number; expYear: number}>, now = new Date()): CardStatus {
  if (!cards.length) return 'MISSING';
  return cards.every(card => isCardExpired(card, now)) ? 'EXPIRED' : 'OK';
}

/* ───────────────────────────── Plan changes ───────────────────────────── */

export type PlanChangeKind = 'UPGRADE' | 'DOWNGRADE' | 'INTERVAL_CHANGE' | 'SAME';

export interface PlanTerms {
  unitAmount: number;
  interval: 'MONTH' | 'YEAR';
  intervalCount: number;
}

/**
 * Classification only decides WHEN a change applies; every amount shown to the
 * customer comes from Stripe's invoice preview, never from arithmetic here.
 * Default policy (documented assumption): a same-interval price increase is an
 * upgrade applied immediately once payment succeeds; a same-interval decrease
 * and any billing-interval change take effect at the end of the paid period.
 */
export function classifyPlanChange(current: PlanTerms, target: PlanTerms): PlanChangeKind {
  if (current.interval !== target.interval || (current.intervalCount || 1) !== (target.intervalCount || 1)) return 'INTERVAL_CHANGE';
  if (target.unitAmount > current.unitAmount) return 'UPGRADE';
  if (target.unitAmount < current.unitAmount) return 'DOWNGRADE';
  return 'SAME';
}

/* ───────────────────────────── Scoped proofs ───────────────────────────── */

/**
 * Compact HMAC proof bound to one purpose. Used for the order-scoped receipt
 * proof and for plan-change preview confirmation. It is never a session and
 * grants nothing beyond the payload it carries.
 */
export function signProof(purpose: string, payload: Record<string, unknown>, secret: string, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({...payload, p: purpose, exp: now + ttlMs})).toString('base64url');
  const mac = createHmac('sha256', secret).update(purpose + '.' + body).digest('base64url');
  return body + '.' + mac;
}

export function verifyProof<T extends Record<string, unknown>>(purpose: string, proof: unknown, secret: string, now = Date.now()): T | null {
  if (typeof proof !== 'string' || proof.length > 2000) return null;
  const [body, mac] = proof.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(purpose + '.' + body).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & {p?: string; exp?: number};
    if (payload.p !== purpose || typeof payload.exp !== 'number' || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ───────────────────────────── Calendar ───────────────────────────── */

const icsEscape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const icsStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

/** One VEVENT in UTC; the calendar app renders it in the viewer's zone. */
export function bookingIcs(event: {uid: string; title: string; start: Date; minutes: number; location?: string | null; description?: string | null}, now = new Date()): string {
  const end = new Date(event.start.getTime() + Math.max(15, event.minutes) * 60000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workspace Junction//Account//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + icsEscape(event.uid) + '@workspacejunction.com',
    'DTSTAMP:' + icsStamp(now),
    'DTSTART:' + icsStamp(event.start),
    'DTEND:' + icsStamp(end),
    'SUMMARY:' + icsEscape(event.title),
    ...(event.location ? ['LOCATION:' + icsEscape(event.location)] : []),
    ...(event.description ? ['DESCRIPTION:' + icsEscape(event.description)] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Same-site relative paths only; anything else falls back to the account home. */
export function safeReturnPath(value: unknown, fallback = '/account/'): string {
  const path = typeof value === 'string' ? value : '';
  if (!/^\/(?![/\\])[\w\-./?=&%#~+:@,;]*$/.test(path) || path.includes('//') || path.includes('\\') || /^\/(api|admin)(\/|$)/i.test(path)) return fallback;
  return path;
}
