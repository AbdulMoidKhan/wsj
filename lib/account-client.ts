'use client';
/**
 * Browser-side customer account client.
 *
 * - Every call is same-origin through the /api rewrite, so the HttpOnly
 *   `wsj_customer` cookie (Path=/api) rides along and nothing else can read it.
 * - Every call carries the X-WSJ-CSRF header the API requires for writes and is
 *   never cached by the browser.
 * - Session state is a tiny external store shared by the navbar, the account
 *   area and checkout. Login, logout, activation and profile edits publish to
 *   it, and a BroadcastChannel (with a storage-event fallback) keeps other tabs
 *   in step. The store holds display data only; it is never authorization.
 */
import {useSyncExternalStore} from 'react';
import {PUBLIC_API_URL} from '@/lib/public-api';

export type SessionView =
  | {status: 'loading'}
  | {status: 'anonymous'}
  | {status: 'authenticated'; customer: {displayName: string; initials: string; email: string}; method: string};

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown> | null) {
    super(message);
  }
  get code(): string | undefined {
    return typeof this.body?.code === 'string' ? this.body.code : undefined;
  }
}

function messageOf(body: Record<string, unknown> | null, fallback: string): string {
  const message = body?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string' && message) return message;
  return fallback;
}

export async function accountFetch<T = Record<string, unknown>>(path: string, init: RequestInit & {json?: unknown} = {}): Promise<T> {
  const {json, headers, ...rest} = init;
  const response = await fetch(PUBLIC_API_URL + path, {
    ...rest,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {'X-WSJ-CSRF': '1', ...(json !== undefined ? {'Content-Type': 'application/json'} : {}), ...(headers as Record<string, string> | undefined)},
    ...(json !== undefined ? {body: JSON.stringify(json)} : {}),
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.status === 401 && path.startsWith('/account/') && !path.startsWith('/account/auth/')) {
    /* The session ended (expired, revoked, logged out elsewhere): drop any stale identity. */
    publish({status: 'anonymous'});
  }
  if (!response.ok) throw new ApiError(messageOf(body, response.status === 429 ? 'Too many attempts. Please wait a minute and try again.' : 'Something went wrong. Please try again.'), response.status, body);
  return body as T;
}

/* ───────────────────────────── Session store ───────────────────────────── */

let state: SessionView = {status: 'loading'};
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const CHANNEL = 'wsj-customer-session';
let channel: BroadcastChannel | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: SessionView) {
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  emit();
}

/** Apply locally and tell other tabs to re-check with the server. */
export function publish(next: SessionView) {
  setState(next);
  try {
    channel?.postMessage('changed');
    localStorage.setItem(CHANNEL, String(Date.now()));
  } catch {
    /* Private mode or blocked storage: this tab is still correct. */
  }
}

export function refreshSession(): Promise<void> {
  if (inflight) return inflight;
  inflight = accountFetch<{authenticated: boolean; customer?: {displayName: string; initials: string; email: string}; session?: {method: string}}>('/account/auth/session')
    .then(view => setState(view.authenticated && view.customer ? {status: 'authenticated', customer: view.customer, method: view.session?.method ?? 'PASSWORD'} : {status: 'anonymous'}))
    .catch(() => setState({status: 'anonymous'}))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void refreshSession();
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => void refreshSession();
  } catch {
    channel = null;
  }
  window.addEventListener('storage', event => {
    if (event.key === CHANNEL) void refreshSession();
  });
  /* A tab left open re-checks when it comes back, so an expired session never lingers. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshSession();
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot: SessionView = {status: 'loading'};

export function useCustomerSession(): SessionView {
  return useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
}

/** After a successful login/activation response the server already set the cookie. */
export function signedIn(view: {authenticated?: boolean; customer?: {displayName: string; initials: string; email: string}; session?: {method: string}}) {
  if (view.authenticated && view.customer) publish({status: 'authenticated', customer: view.customer, method: view.session?.method ?? 'PASSWORD'});
}

export async function logout(all = false) {
  try {
    await accountFetch(all ? '/account/auth/logout-all' : '/account/auth/logout', {method: 'POST', json: {}});
  } finally {
    publish({status: 'anonymous'});
  }
}

/** Read a single-use token from the URL fragment, then remove it from the address bar and history. */
export function takeFragmentToken(): string {
  if (typeof window === 'undefined') return '';
  const match = /(?:^#|&)token=([\w-]{20,200})/.exec(window.location.hash);
  if (match) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return match?.[1] ?? '';
}

/** Same-site relative paths only; mirrors safeReturnPath on the server. */
export function safeNext(value: string | null | undefined, fallback = '/account/'): string {
  const path = value ?? '';
  if (!/^\/(?![/\\])[\w\-./?=&%#~+:@,;]*$/.test(path) || path.includes('//') || path.includes('\\') || /^\/(api|admin)(\/|$)/i.test(path)) return fallback;
  return path;
}

export const money = (minor: unknown, currency: unknown = 'usd') => new Intl.NumberFormat('en-US', {style: 'currency', currency: String(currency || 'usd').toUpperCase()}).format(Number(minor || 0) / 100);
export const shortDate = (value: unknown) => (value ? new Intl.DateTimeFormat('en-US', {dateStyle: 'medium'}).format(new Date(String(value))) : '—');
/** Bookings are shown in the business's own timezone, and say so. */
/* dateStyle/timeStyle cannot be combined with timeZoneName, so the components are spelled out. */
export const businessDateTime = (value: unknown, timeZone = 'America/Chicago') => (value ? new Intl.DateTimeFormat('en-US', {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short'}).format(new Date(String(value))) : '—');
