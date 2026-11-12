'use client';
/**
 * Customer account area. Everything here is fetched from the API with the
 * customer's session cookie after the page loads; the server-rendered HTML
 * never contains account data, so nothing account-specific can be cached or
 * leak between customers. Each section has loading, empty, error and retry
 * states, and every mutation disables itself while in flight.
 */
import Link from 'next/link';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import {useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle, ArrowUpRight, CalendarPlus, CheckCircle2, CreditCard, Loader2, LogOut, RefreshCw, ShieldCheck} from 'lucide-react';
import {ApiError, accountFetch, businessDateTime, logout, money, publish, refreshSession, shortDate, useCustomerSession} from '@/lib/account-client';
import {PUBLIC_API_URL} from '@/lib/public-api';
import './account-area.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API bodies are rendered as display text only; the server is the source of truth and authorisation.
type Json = Record<string, any>;
const NAV = [
  {key: 'overview', href: '/account/', label: 'Dashboard'},
  {key: 'subscriptions', href: '/account/subscriptions/', label: 'My subscriptions'},
  {key: 'purchases', href: '/account/purchases/', label: 'Purchases'},
  {key: 'bookings', href: '/account/bookings/', label: 'Bookings'},
  {key: 'payment-methods', href: '/account/payment-methods/', label: 'Payment methods'},
  {key: 'billing', href: '/account/billing/', label: 'Billing & invoices'},
  {key: 'profile', href: '/account/profile/', label: 'Profile'},
  {key: 'security', href: '/account/security/', label: 'Security'},
] as const;
export type AccountSection = (typeof NAV)[number]['key'];
export const ACCOUNT_SECTIONS = NAV.map(item => item.key);

const KIND_LABEL: Record<string, string> = {COWORKING_DAY: 'Coworking days', MEETING_ROOM_HOUR: 'Meeting room hours', STUDIO_HOUR: 'Studio hours', CREDIT: 'Credits'};
const ACCESS: Record<string, {label: string; tone: string}> = {
  PENDING: {label: 'Awaiting payment', tone: 'warn'},
  ACTIVE: {label: 'Active', tone: 'ok'},
  PAST_DUE: {label: 'Payment problem', tone: 'bad'},
  SUSPENDED: {label: 'Suspended', tone: 'bad'},
  ENDED: {label: 'Ended', tone: 'muted'},
};
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const errorText = (caught: unknown, fallback = 'Something went wrong. Please try again.') => (caught instanceof Error ? caught.message : fallback);

/* ───────────────────────────── Shared pieces ───────────────────────────── */

function useLoad<T = Json>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      setData(await accountFetch<T>(path));
    } catch (caught) {
      setError(errorText(caught, 'We could not load this section.'));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  return {data, error, loading, reload: load, setData};
}

function Skeleton({rows = 3}: {rows?: number}) {
  return (
    <div className="aa-skeleton" role="status" aria-label="Loading">
      {Array.from({length: rows}, (_, index) => <span key={index} />)}
    </div>
  );
}

function LoadError({message, retry}: {message: string; retry: () => void}) {
  return (
    <div className="aa-alert aa-alert-bad" role="alert">
      <span>{message}</span>
      <button type="button" className="wj-control aa-text-button" onClick={retry}><RefreshCw size={14} aria-hidden="true" /> Try again</button>
    </div>
  );
}

function Empty({title, children}: {title: string; children?: ReactNode}) {
  return (
    <div className="aa-empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

function Badge({tone, children}: {tone: string; children: ReactNode}) {
  return <span className={'aa-badge aa-badge-' + tone}>{children}</span>;
}

function SectionHead({title, intro, action}: {title: string; intro?: ReactNode; action?: ReactNode}) {
  return (
    <header className="aa-section-head">
      <div>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {action}
    </header>
  );
}

function Notice({message, tone = 'ok', onClose}: {message: string; tone?: 'ok' | 'bad' | 'warn'; onClose?: () => void}) {
  if (!message) return null;
  return (
    <div className={'aa-alert aa-alert-' + tone} role={tone === 'bad' ? 'alert' : 'status'}>
      <span>{message}</span>
      {onClose && <button type="button" className="wj-control aa-text-button" onClick={onClose}>Dismiss</button>}
    </div>
  );
}

/** Accessible modal: focus moves in, Tab is trapped, Escape and the backdrop close, focus returns. */
function Dialog({title, onClose, children, busy}: {title: string; onClose: () => void; children: ReactNode; busy?: boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.querySelector<HTMLElement>('button,[href],input,select,textarea')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select,textarea'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = body;
      previous?.focus?.();
    };
  }, [onClose, busy]);
  /* Portaled to the platform root: the animated route stage creates its own stacking
     context, which would otherwise keep the overlay under the sticky header. */
  const host = typeof document !== 'undefined' ? document.querySelector('.wj-platform') ?? document.body : null;
  const overlay = (
    <div className="aa-overlay" data-lenis-prevent onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
      <div className="aa-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
  return host ? createPortal(overlay, host) : overlay;
}

function openBooking(service?: string, plan?: string) {
  window.dispatchEvent(new CustomEvent('wj:book', {detail: {service, plan}}));
}

/* ───────────────────────────── Layout ───────────────────────────── */

export function AccountArea({section}: {section: AccountSection}) {
  const session = useCustomerSession();
  const router = useRouter();
  const pathname = usePathname();

  /* Retire the old ?token= management links: remember that one was used (to explain why it
     no longer works), then drop it from the URL straight away. It is never sent anywhere. */
  const params = useSearchParams();
  const [legacyToken] = useState(() => params.get('token') !== null);
  useEffect(() => {
    if (legacyToken) window.history.replaceState(null, '', window.location.pathname);
  }, [legacyToken]);

  useEffect(() => {
    if (session.status === 'anonymous' && !legacyToken) router.replace('/login/?next=' + encodeURIComponent(pathname || '/account/'));
  }, [session.status, router, pathname, legacyToken]);

  if (session.status !== 'authenticated') {
    return (
      <div className="aa-layout aa-container">
        {legacyToken ? (
          <div className="aa-auth-card">
            <h1 className="aa-auth-title">Management links have changed</h1>
            <p>For your security, older account links no longer work. Sign in, or ask for a one-time sign-in link sent to the email you used at checkout.</p>
            <Link className="wj-button wj-button-yellow" href="/login/">Sign in</Link>
          </div>
        ) : (
          <Skeleton rows={4} />
        )}
      </div>
    );
  }

  return (
    <div className="aa-layout aa-container">
      <aside className="aa-side">
        <div className="aa-who">
          <span className="aa-avatar" aria-hidden="true">{session.customer.initials}</span>
          <div>
            <strong>{session.customer.displayName}</strong>
            <span>{session.customer.email}</span>
          </div>
        </div>
        <nav aria-label="Account sections" className="aa-nav">
          {NAV.map(item => (
            <Link key={item.key} prefetch={false} href={item.href} aria-current={item.key === section ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <button type="button" className="wj-button wj-button-yellow aa-buy" onClick={() => openBooking()}>Book now</button>
        <button
          type="button"
          className="wj-control aa-text-button aa-signout"
          onClick={async () => {
            await logout().catch(() => undefined);
            router.push('/');
          }}
        >
          <LogOut size={15} aria-hidden="true" /> Logout
        </button>
      </aside>
      <div className="aa-main" id="account-main">
        {section === 'overview' && <Overview />}
        {section === 'subscriptions' && <Subscriptions />}
        {section === 'purchases' && <Purchases />}
        {section === 'bookings' && <Bookings />}
        {section === 'payment-methods' && <PaymentMethods />}
        {section === 'billing' && <Billing />}
        {section === 'profile' && <Profile />}
        {section === 'security' && <Security />}
      </div>
    </div>
  );
}

/* ───────────────────────────── Overview ───────────────────────────── */

function Overview() {
  const {data, error, loading, reload} = useLoad('/account/overview');
  const params = useSearchParams();
  const welcome = params.get('welcome') === '1';
  if (loading && !data) return <><SectionHead title="Dashboard" /><Skeleton rows={6} /></>;
  if (error) return <><SectionHead title="Dashboard" /><LoadError message={error} retry={reload} /></>;
  if (!data) return null;
  const subs = data.subscriptions as Json[];
  return (
    <>
      <SectionHead title={'Welcome, ' + data.customer.displayName} intro={'Member since ' + shortDate(data.customer.memberSince)} action={<button className="wj-button wj-button-yellow" type="button" onClick={() => openBooking()}>Buy more</button>} />
      {welcome && <Notice message="Your account is ready. Everything you buy from now on appears here." />}
      {(data.banners as Json[]).map(banner => (
        <div key={banner.type} className={'aa-banner aa-banner-' + banner.tone} role={banner.tone === 'bad' ? 'alert' : 'status'}>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{banner.title}</strong>
            <p>{banner.detail}</p>
          </div>
          <Link className="aa-banner-action" href={banner.href}>{banner.action}</Link>
        </div>
      ))}
      <div className="aa-stats">
        <Link href="/account/subscriptions/" className="aa-stat"><span>Active subscriptions</span><strong>{data.counts.subscriptions}</strong></Link>
        <Link href="/account/bookings/" className="aa-stat"><span>Upcoming bookings</span><strong>{data.counts.upcomingBookings}</strong></Link>
        <Link href="/account/purchases/" className="aa-stat"><span>Purchases</span><strong>{data.counts.purchases}</strong></Link>
        <Link href="/account/payment-methods/" className="aa-stat">
          <span>Default card</span>
          <strong className="aa-stat-small">{data.card.last4 ? data.card.brand.toUpperCase() + ' •••• ' + data.card.last4 : 'None saved'}</strong>
          {data.card.health !== 'ok' && data.card.health !== 'unknown' && <Badge tone={data.card.health === 'expiring' ? 'warn' : 'bad'}>{data.card.health === 'missing' ? 'Add a card' : data.card.health === 'expired' ? 'Expired' : 'Expires soon'}</Badge>}
        </Link>
      </div>
      <div className="aa-grid-2">
        <section className="aa-panel" aria-labelledby="ov-services">
          <h2 id="ov-services">Active services</h2>
          {subs.length === 0 ? (
            <Empty title="No active subscriptions">
              <p>Memberships and monthly services you buy will appear here.</p>
              <button type="button" className="wj-control aa-text-button" onClick={() => openBooking()}>Browse services</button>
            </Empty>
          ) : (
            <ul className="aa-list">
              {subs.map(sub => (
                <li key={sub.id}>
                  <div>
                    <strong>{sub.planName}</strong>
                    <span>{money(sub.amount, sub.currency)} {sub.intervalDescription}</span>
                  </div>
                  <Badge tone={sub.cancelAtPeriodEnd ? 'warn' : ACCESS[sub.accessStatus]?.tone ?? 'muted'}>{sub.cancelAtPeriodEnd ? 'Ends ' + shortDate(sub.currentPeriodEnd) : ACCESS[sub.accessStatus]?.label ?? sub.accessStatus}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="aa-panel" aria-labelledby="ov-renewals">
          <h2 id="ov-renewals">Upcoming renewals</h2>
          {(data.upcomingRenewals as Json[]).length === 0 ? <Empty title="Nothing scheduled" /> : (
            <ul className="aa-list">
              {(data.upcomingRenewals as Json[]).map(item => (
                <li key={item.subscriptionId}>
                  <div><strong>{item.planName}</strong><span>{shortDate(item.date)}</span></div>
                  <span className="aa-amount">{money(item.amount, item.currency)}<small> est.</small></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="aa-panel" aria-labelledby="ov-bookings">
          <h2 id="ov-bookings">Upcoming bookings</h2>
          {(data.upcomingBookings as Json[]).length === 0 ? <Empty title="No upcoming bookings"><button type="button" className="wj-control aa-text-button" onClick={() => openBooking()}>Book a space</button></Empty> : (
            <ul className="aa-list">
              {(data.upcomingBookings as Json[]).map(item => (
                <li key={item.id}><div><strong>{item.title}</strong><span>{businessDateTime(item.start, item.timezone)}</span></div></li>
              ))}
            </ul>
          )}
        </section>
        <section className="aa-panel" aria-labelledby="ov-benefits">
          <h2 id="ov-benefits">Included benefits</h2>
          {(data.benefits as Json[]).length === 0 ? <Empty title="No benefits to show" /> : <Benefits rows={data.benefits as Json[]} />}
        </section>
      </div>
      {(data.outstandingInvoices as Json[]).length > 0 && (
        <section className="aa-panel" aria-labelledby="ov-invoices">
          <h2 id="ov-invoices">Outstanding invoices</h2>
          <ul className="aa-list">
            {(data.outstandingInvoices as Json[]).map(invoice => (
              <li key={invoice.id}><div><strong>{invoice.number || 'Invoice'}</strong><span>{shortDate(invoice.createdAt)}</span></div><Link href="/account/billing/" className="wj-control aa-text-button">{money(invoice.amountRemaining || invoice.amountDue, invoice.currency)} due</Link></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Benefits({rows}: {rows: Json[]}) {
  return (
    <ul className="aa-list">
      {rows.map(row => (
        <li key={row.kind}>
          <div>
            <strong>{KIND_LABEL[row.kind] ?? row.kind}</strong>
            <span>{row.expiresAt ? 'Expires ' + shortDate(row.expiresAt) : 'For the current period'}{row.used ? ' · ' + row.used + ' used' : ''}</span>
          </div>
          <span className="aa-amount">{row.unlimited ? 'Unlimited' : row.available + ' left'}</span>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────────── Subscriptions ───────────────────────────── */

function Subscriptions() {
  const {data, error, loading, reload} = useLoad('/account/subscriptions');
  const [notice, setNotice] = useState('');
  const [cancelFor, setCancelFor] = useState<Json | null>(null);
  const [changeFor, setChangeFor] = useState<Json | null>(null);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  async function resume(sub: Json) {
    setBusy(sub.id);
    setActionError('');
    try {
      await accountFetch('/account/subscriptions/' + encodeURIComponent(sub.id) + '/resume', {method: 'POST', json: {}});
      setNotice(sub.planName + ' will renew as normal again.');
      await reload();
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  async function withdraw(sub: Json) {
    setBusy(sub.id);
    setActionError('');
    try {
      const result = await accountFetch<Json>('/account/subscriptions/' + encodeURIComponent(sub.id) + '/change/withdraw', {method: 'POST', json: {}});
      setNotice(result.message);
      await reload();
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  const subs = (data?.items ?? []) as Json[];
  return (
    <>
      <SectionHead title="My subscriptions" intro="Each subscription renews and is billed on its own. Cancelling a subscription does not cancel bookings you have already made." action={<button type="button" className="wj-button wj-button-yellow" onClick={() => openBooking()}>Add a service</button>} />
      <Notice message={notice} onClose={() => setNotice('')} />
      <Notice message={actionError} tone="bad" onClose={() => setActionError('')} />
      {loading && !data ? <Skeleton /> : error ? <LoadError message={error} retry={reload} /> : subs.length === 0 ? (
        <Empty title="You have no subscriptions yet"><p>Memberships, desks, virtual offices and other monthly services appear here.</p><button type="button" className="wj-control aa-text-button" onClick={() => openBooking()}>Browse services</button></Empty>
      ) : (
        <div className="aa-cards">
          {subs.map(sub => {
            const ended = sub.accessStatus === 'ENDED';
            const access = ACCESS[sub.accessStatus] ?? {label: sub.accessStatus, tone: 'muted'};
            const pending = sub.pendingChange as Json | null;
            return (
              <article key={sub.id} className="aa-card" aria-labelledby={'sub-' + sub.id}>
                <div className="aa-card-head">
                  <div>
                    <h2 id={'sub-' + sub.id}>{sub.planName}</h2>
                    <p className="aa-price">{money(sub.unitAmount, sub.currency)} {sub.intervalDescription}{sub.quantity > 1 ? ' × ' + sub.quantity : ''}</p>
                  </div>
                  <Badge tone={sub.cancelAtPeriodEnd && !ended ? 'warn' : access.tone}>{sub.cancelAtPeriodEnd && !ended ? 'Cancellation scheduled' : access.label}</Badge>
                </div>
                <dl className="aa-meta">
                  <div><dt>Current period</dt><dd>{shortDate(sub.currentPeriodStart)} – {shortDate(sub.currentPeriodEnd)}</dd></div>
                  <div><dt>{sub.cancelAtPeriodEnd ? 'Access ends' : 'Next renewal'}</dt><dd>{ended ? 'Ended ' + shortDate(sub.endedAt) : sub.cancelAtPeriodEnd ? shortDate(sub.currentPeriodEnd) : shortDate(sub.renewsAt)}</dd></div>
                  <div><dt>Billing</dt><dd>{money(sub.amount, sub.currency)} {sub.intervalDescription} · {String(sub.currency).toUpperCase()}</dd></div>
                  {sub.graceEndsAt && <div><dt>Pay by</dt><dd>{shortDate(sub.graceEndsAt)}</dd></div>}
                </dl>
                {(sub.benefits as Json[]).length > 0 && (
                  <p className="aa-small">Includes: {(sub.benefits as Json[]).map(benefit => (benefit.unlimited ? 'unlimited ' : benefit.amount + ' ') + (KIND_LABEL[benefit.kind] ?? benefit.kind).toLowerCase() + (benefit.resets === 'MONTH' ? ' a month' : ' a year')).join(', ')}. Unused benefits do not roll over.</p>
                )}
                {pending && (
                  <div className="aa-alert aa-alert-warn">
                    <span>
                      {pending.status === 'PENDING_PAYMENT'
                        ? 'Your change to ' + pending.targetName + ' is waiting for payment. Your current plan stays in force until then.'
                        : 'Changes to ' + pending.targetName + ' on ' + shortDate(pending.effectiveAt) + '. Your current plan continues until then.'}
                    </span>
                    {pending.canWithdraw && <button type="button" className="wj-control aa-text-button" disabled={busy === sub.id} onClick={() => void withdraw(sub)}>Withdraw change</button>}
                  </div>
                )}
                {sub.paymentState === 'failed' && <div className="aa-alert aa-alert-bad"><span>The last payment failed. Update your card or pay the open invoice to keep access.</span><Link className="wj-control aa-text-button" href="/account/billing/">Go to billing</Link></div>}
                <div className="aa-card-actions">
                  {!ended && !sub.cancelAtPeriodEnd && !pending && sub.accessStatus === 'ACTIVE' && <button type="button" className="wj-control aa-secondary" disabled={Boolean(busy)} onClick={() => setChangeFor(sub)}>Change plan</button>}
                  {!ended && !sub.cancelAtPeriodEnd && <button type="button" className="wj-control aa-secondary" disabled={Boolean(busy)} onClick={() => setCancelFor(sub)}>Cancel renewal</button>}
                  {!ended && sub.cancelAtPeriodEnd && <button type="button" className="wj-control aa-secondary" disabled={busy === sub.id} onClick={() => void resume(sub)}>{busy === sub.id ? 'Working…' : 'Keep my subscription'}</button>}
                  {ended && <button type="button" className="wj-control aa-secondary" onClick={() => openBooking(sub.serviceType ?? undefined)}>Buy again</button>}
                  <SupportLink reference={sub.id} subject={'Question about ' + sub.planName} />
                </div>
              </article>
            );
          })}
        </div>
      )}
      {cancelFor && <CancelDialog sub={cancelFor} onClose={() => setCancelFor(null)} onDone={async message => { setCancelFor(null); setNotice(message); await reload(); }} />}
      {changeFor && <ChangePlanDialog sub={changeFor} onClose={() => setChangeFor(null)} onDone={async message => { setChangeFor(null); setNotice(message); await reload(); }} />}
    </>
  );
}

function CancelDialog({sub, onClose, onDone}: {sub: Json; onClose: () => void; onDone: (message: string) => void}) {
  const {data, error, loading, reload} = useLoad('/account/subscriptions/' + encodeURIComponent(sub.id) + '/cancellation-preview');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const reasonId = useId();
  async function confirm() {
    setBusy(true);
    setFailure('');
    try {
      await accountFetch('/account/subscriptions/' + encodeURIComponent(sub.id) + '/cancel', {method: 'POST', json: reason ? {reason} : {}});
      onDone('Automatic renewal for ' + sub.planName + ' is stopped. You keep access until ' + shortDate(data?.lastAccessDate) + '.');
    } catch (caught) {
      setFailure(errorText(caught, 'Stripe did not confirm the change. Nothing was changed.'));
      setBusy(false);
    }
  }
  return (
    <Dialog title={'Stop renewing ' + sub.planName + '?'} onClose={onClose} busy={busy}>
      {loading ? <Skeleton rows={2} /> : error ? <LoadError message={error} retry={reload} /> : data && (
        <>
          <dl className="aa-meta">
            <div><dt>Last day of access</dt><dd>{shortDate(data.lastAccessDate)}</dd></div>
            <div><dt>Another renewal</dt><dd>No</dd></div>
            <div><dt>Refund for this period</dt><dd>No</dd></div>
          </dl>
          <ul className="aa-bullets">{(data.effects as string[]).map(effect => <li key={effect}>{effect}</li>)}</ul>
          <div className="aa-field">
            <label htmlFor={reasonId}>Anything we could do better? (optional)</label>
            <textarea id={reasonId} maxLength={500} rows={2} value={reason} onChange={event => setReason(event.target.value)} />
          </div>
          <p className="aa-small">You can undo this any time before {shortDate(data.canUndoUntil)}.</p>
        </>
      )}
      <Notice message={failure} tone="bad" />
      <div className="aa-dialog-actions">
        <button type="button" className="wj-control aa-secondary" disabled={busy} onClick={onClose}>Keep subscription</button>
        <button type="button" className="wj-button wj-button-yellow" disabled={busy || loading || Boolean(error)} onClick={() => void confirm()}>{busy ? 'Contacting Stripe…' : 'Stop renewal'}</button>
      </div>
    </Dialog>
  );
}

function ChangePlanDialog({sub, onClose, onDone}: {sub: Json; onClose: () => void; onDone: (message: string) => void}) {
  const {data, error, loading, reload} = useLoad('/account/subscriptions/' + encodeURIComponent(sub.id) + '/change-options');
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState<Json | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [key] = useState(newKey);

  async function loadPreview(slug: string) {
    setTarget(slug);
    setPreview(null);
    setFailure('');
    setBusy(true);
    try {
      setPreview(await accountFetch<Json>('/account/subscriptions/' + encodeURIComponent(sub.id) + '/change-preview', {method: 'POST', json: {targetSlug: slug}}));
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setFailure('');
    try {
      const result = await accountFetch<Json>('/account/subscriptions/' + encodeURIComponent(sub.id) + '/change', {method: 'POST', json: {targetSlug: target, confirmToken: preview.confirmToken, idempotencyKey: key}});
      if (result.status === 'PENDING_PAYMENT' && result.paymentUrl) {
        /* Stripe's hosted invoice page completes the payment and any bank authentication. */
        window.location.assign(result.paymentUrl);
        return;
      }
      onDone(result.message);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'PREVIEW_CHANGED' && caught.body?.preview) {
        setPreview(caught.body.preview as Json);
        setFailure('The price changed since you opened this. Please review the updated amounts and confirm again.');
      } else if (caught instanceof ApiError && caught.code === 'PREVIEW_EXPIRED') {
        await loadPreview(target);
        setFailure('That preview expired, so we fetched a fresh one. Please review and confirm again.');
      } else setFailure(errorText(caught));
      setBusy(false);
    }
  }

  return (
    <Dialog title={'Change ' + sub.planName} onClose={onClose} busy={busy}>
      {loading ? <Skeleton rows={3} /> : error ? <LoadError message={error} retry={reload} /> : data && (
        <>
          {data.blocked ? <p className="aa-alert aa-alert-warn">{data.blocked}</p> : (data.targets as Json[]).length === 0 ? (
            <p className="aa-muted">There are no other plans for this service right now. To add a different service, use Add a service instead.</p>
          ) : (
            <fieldset className="aa-choices">
              <legend>Choose a plan</legend>
              {(data.targets as Json[]).map(option => (
                <label key={option.slug} className={'aa-choice' + (target === option.slug ? ' is-selected' : '')}>
                  <input type="radio" name="plan-target" value={option.slug} checked={target === option.slug} disabled={busy} onChange={() => void loadPreview(option.slug)} />
                  <span>
                    <strong>{option.name}</strong>
                    <span>{money(option.unitAmount, option.currency)} {option.intervalDescription} · {option.kind === 'UPGRADE' ? 'Upgrade, starts after payment' : option.kind === 'DOWNGRADE' ? 'Downgrade, starts at renewal' : 'Billing change, starts at renewal'}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <p className="aa-small">{data.policy}</p>
        </>
      )}
      {busy && !preview && target && <p className="aa-muted" role="status"><Loader2 size={15} className="aa-spin" aria-hidden="true" /> Getting a price from Stripe…</p>}
      {preview && (
        <div className="aa-preview" aria-live="polite">
          <h3>What happens</h3>
          <dl className="aa-meta">
            <div><dt>From</dt><dd>{preview.current.name} · {money(preview.current.unitAmount, preview.currency)} {preview.current.intervalDescription}</dd></div>
            <div><dt>To</dt><dd>{preview.target.name} · {money(preview.target.unitAmount, preview.currency)} {preview.target.intervalDescription}</dd></div>
            <div><dt>Starts</dt><dd>{preview.effective === 'IMMEDIATE' ? 'As soon as payment succeeds' : shortDate(preview.effectiveAt)}</dd></div>
            <div><dt>Due now</dt><dd>{money(preview.amountDueNow, preview.currency)}</dd></div>
            {preview.prorationCredit < 0 && <div><dt>Credit for unused time</dt><dd>{money(preview.prorationCredit, preview.currency)}</dd></div>}
            {preview.taxAmount > 0 && <div><dt>Tax</dt><dd>{money(preview.taxAmount, preview.currency)}</dd></div>}
            <div><dt>Then</dt><dd>{money(preview.nextRenewalTotal, preview.currency)} {preview.target.intervalDescription} (estimate)</dd></div>
          </dl>
          {(preview.benefitChanges as Json[]).length > 0 && <p className="aa-small">Benefits: {(preview.benefitChanges as Json[]).map(change => (KIND_LABEL[change.kind] ?? change.kind) + ' ' + change.from + ' → ' + change.to).join('; ')}.</p>}
          <ul className="aa-bullets">{(preview.notes as string[]).map(note => <li key={note}>{note}</li>)}</ul>
        </div>
      )}
      <Notice message={failure} tone="bad" />
      <div className="aa-dialog-actions">
        <button type="button" className="wj-control aa-secondary" disabled={busy} onClick={onClose}>Close</button>
        <button type="button" className="wj-button wj-button-yellow" disabled={busy || !preview} onClick={() => void confirm()}>{busy && preview ? 'Confirming…' : preview?.effective === 'IMMEDIATE' ? 'Confirm and pay ' + money(preview.amountDueNow, preview.currency) : 'Confirm change'}</button>
      </div>
    </Dialog>
  );
}

/* ───────────────────────────── Purchases ───────────────────────────── */

function Purchases() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);
  const query = '/account/orders?limit=10&page=' + page + (status ? '&status=' + status : '');
  const {data, error, loading, reload} = useLoad(query);
  const claims = useLoad('/account/claims');
  const [claimBusy, setClaimBusy] = useState('');
  const [notice, setNotice] = useState('');

  async function claim(id: string, accept: boolean) {
    setClaimBusy(id);
    try {
      await accountFetch('/account/claims/' + encodeURIComponent(id) + (accept ? '/accept' : '/decline'), {method: 'POST', json: {}});
      setNotice(accept ? 'The purchase was added to your account.' : 'Thanks. We have flagged that purchase for our team to review.');
      await Promise.all([claims.reload(), reload()]);
    } catch (caught) {
      setNotice(errorText(caught));
    } finally {
      setClaimBusy('');
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <>
      <SectionHead title="Purchases" intro="Every order with its items, add-ons, totals and receipts." action={<button type="button" className="wj-button wj-button-yellow" onClick={() => openBooking()}>Browse services</button>} />
      <Notice message={notice} onClose={() => setNotice('')} />
      {(claims.data?.purchases as Json[] | undefined)?.map(entry => (
        <div key={entry.id} className="aa-banner aa-banner-info">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>A purchase made with your email while signed out</strong>
            <p>{(entry.orders as Json[]).map(order => order.title + ' · ' + money(order.amount, order.currency) + ' · ' + shortDate(order.createdAt)).join('; ')}. Is this yours?</p>
          </div>
          <div className="aa-banner-buttons">
            <button type="button" className="wj-control aa-secondary" disabled={Boolean(claimBusy)} onClick={() => void claim(entry.id, true)}>Yes, add it</button>
            <button type="button" className="wj-control aa-text-button" disabled={Boolean(claimBusy)} onClick={() => void claim(entry.id, false)}>Not mine</button>
          </div>
        </div>
      ))}
      <div className="aa-filters">
        <label>
          <span>Status</span>
          <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Processing</option>
            <option value="FAILED">Failed</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </label>
      </div>
      {loading && !data ? <Skeleton /> : error ? <LoadError message={error} retry={reload} /> : !data?.items.length ? (
        <Empty title="No purchases to show"><p>{status ? 'Try another filter.' : 'Your orders will appear here.'}</p></Empty>
      ) : (
        <>
          <ul className="aa-rows">
            {(data.items as Json[]).map(order => (
              <li key={order.id}>
                <button type="button" className="wj-control aa-row" onClick={() => setDetail(order.id)}>
                  <span className="aa-row-main"><strong>{order.title}</strong><span>{shortDate(order.createdAt)}{order.itemCount > 1 ? ' · ' + order.itemCount + ' items' : ''}</span></span>
                  <Badge tone={order.status === 'PAID' ? 'ok' : order.status === 'PENDING' ? 'warn' : 'muted'}>{order.status === 'PENDING' ? 'Processing' : order.status.toLowerCase()}</Badge>
                  <span className="aa-amount">{money(order.dueNowAmount, order.currency)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pager page={page} pages={pages} onPage={setPage} />
        </>
      )}
      {detail && <OrderDialog id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Pager({page, pages, onPage}: {page: number; pages: number; onPage: (page: number) => void}) {
  if (pages <= 1) return null;
  return (
    <nav className="aa-pager" aria-label="Pages">
      <button type="button" className="wj-control aa-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" className="wj-control aa-secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}

function OrderDialog({id, onClose}: {id: string; onClose: () => void}) {
  const {data, error, loading, reload} = useLoad('/account/orders/' + encodeURIComponent(id));
  return (
    <Dialog title="Order details" onClose={onClose}>
      {loading ? <Skeleton rows={4} /> : error ? <LoadError message={error} retry={reload} /> : data && (
        <>
          <p className="aa-muted">{shortDate(data.createdAt)} · Reference <code>{data.id.slice(0, 8)}</code></p>
          {data.scheduledFor && <p><strong>Booked for</strong> {businessDateTime(data.scheduledFor, data.timezone)}</p>}
          <table className="aa-table">
            <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col" className="aa-num">Amount</th></tr></thead>
            <tbody>
              {(data.items as Json[]).map((item, index) => (
                <tr key={index}><td>{item.description}{item.kind === 'ADDON' && <span className="aa-small"> · add-on</span>}{item.billingType === 'RECURRING' && <span className="aa-small"> · recurring</span>}</td><td>{item.quantity}</td><td className="aa-num">{money(item.amount, data.currency)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              {data.discountAmount > 0 && <tr><td colSpan={2}>Discount{data.couponCode ? ' (' + data.couponCode + ')' : ''}</td><td className="aa-num">−{money(data.discountAmount, data.currency)}</td></tr>}
              {data.taxAmount > 0 && <tr><td colSpan={2}>Tax</td><td className="aa-num">{money(data.taxAmount, data.currency)}</td></tr>}
              <tr><th scope="row" colSpan={2}>Paid</th><td className="aa-num"><strong>{money(data.dueNowAmount, data.currency)}</strong></td></tr>
            </tfoot>
          </table>
          {data.recurringAmount > 0 && <p className="aa-small">Then {money(data.recurringAmount, data.currency)} {data.recurringInterval === 'YEAR' ? 'every year' : 'every month'} until cancelled.</p>}
          {(data.invoices as Json[]).length > 0 && <p><Link href="/account/billing/" className="wj-control aa-text-button">View receipts and invoices</Link></p>}
          <div className="aa-dialog-actions">
            <SupportLink reference={data.id} subject="Question about an order" />
            {data.buyAgainSlug && <button type="button" className="wj-button wj-button-yellow" onClick={() => { onClose(); openBooking(data.serviceType ?? undefined, data.buyAgainSlug); }}>Buy again</button>}
          </div>
          {data.buyAgainSlug && <p className="aa-small">Buying again uses today&apos;s price and availability.</p>}
        </>
      )}
    </Dialog>
  );
}

/* ───────────────────────────── Bookings ───────────────────────────── */

function Bookings() {
  const {data, error, loading, reload} = useLoad('/account/bookings');
  const claims = useLoad('/account/claims');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function claimLegacy() {
    setBusy(true);
    try {
      const result = await accountFetch<Json>('/account/claims/bookings', {method: 'POST', json: {}});
      setNotice(result.claimed + ' earlier booking' + (result.claimed === 1 ? ' was' : 's were') + ' added to your account.');
      await Promise.all([reload(), claims.reload()]);
    } catch (caught) {
      setNotice(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const row = (item: Json) => (
    <li key={item.id} className="aa-booking">
      <div className="aa-row-main">
        <strong>{item.title}</strong>
        <span>{businessDateTime(item.start, item.timezone)}{item.minutes ? ' · ' + (item.minutes >= 1440 ? item.minutes / 1440 + ' day(s)' : item.minutes / 60 + ' hour(s)') : ''}{item.guests ? ' · ' + item.guests + ' guest(s)' : ''}</span>
        <span className="aa-small">{item.location}</span>
      </div>
      <div className="aa-booking-actions">
        {item.calendar && <a className="wj-control aa-secondary" href={PUBLIC_API_URL + '/account/bookings/' + encodeURIComponent(item.id) + '/calendar'} download><CalendarPlus size={15} aria-hidden="true" /> Add to calendar</a>}
        <SupportLink reference={item.id} subject={'Change a booking: ' + item.title} type="RESCHEDULE" label="Reschedule or cancel" />
      </div>
    </li>
  );

  return (
    <>
      <SectionHead title="Bookings" intro={data ? 'Times are shown in Central Time, where Workspace Junction is located.' : undefined} action={<button type="button" className="wj-button wj-button-yellow" onClick={() => openBooking()}>Book now</button>} />
      <Notice message={notice} onClose={() => setNotice('')} />
      {Number(claims.data?.legacyBookings) > 0 && (
        <div className="aa-banner aa-banner-info">
          <AlertTriangle size={18} aria-hidden="true" />
          <div><strong>Earlier bookings found</strong><p>{claims.data!.legacyBookings} booking(s) made with your verified email can be added to your account.</p></div>
          <button type="button" className="wj-control aa-secondary" disabled={busy} onClick={() => void claimLegacy()}>Add them</button>
        </div>
      )}
      {loading && !data ? <Skeleton /> : error ? <LoadError message={error} retry={reload} /> : data && (
        <>
          <h2 className="aa-subhead">Upcoming</h2>
          {(data.upcoming as Json[]).length ? <ul className="aa-rows">{(data.upcoming as Json[]).map(row)}</ul> : <Empty title="No upcoming bookings"><button type="button" className="wj-control aa-text-button" onClick={() => openBooking()}>Book a space</button></Empty>}
          <h2 className="aa-subhead">Past</h2>
          {(data.past as Json[]).length ? <ul className="aa-rows">{(data.past as Json[]).map(row)}</ul> : <Empty title="No past bookings" />}
          <p className="aa-small">{data.changePolicy}</p>
        </>
      )}
    </>
  );
}

/* ───────────────────────────── Support link ───────────────────────────── */

function SupportLink({reference, subject, type = 'SUPPORT', label = 'Ask for help'}: {reference: string; subject: string; type?: string; label?: string}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="wj-control aa-text-button" onClick={() => setOpen(true)}>{label}</button>
      {open && <SupportDialog reference={reference} subject={subject} type={type} onClose={() => setOpen(false)} />}
    </>
  );
}

function SupportDialog({reference, subject: initialSubject, type: initialType, onClose}: {reference?: string; subject?: string; type?: string; onClose: () => void}) {
  const [type, setType] = useState(initialType ?? 'SUPPORT');
  const [subject, setSubject] = useState(initialSubject ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [failure, setFailure] = useState('');
  const ids = {type: useId(), subject: useId(), message: useId()};
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFailure('');
    try {
      const result = await accountFetch<Json>('/account/support', {method: 'POST', json: {type, subject, message, ...(reference ? {reference} : {})}});
      setDone(result.message);
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Contact our team" onClose={onClose} busy={busy}>
      {done ? (
        <>
          <p className="aa-alert aa-alert-ok" role="status">{done}</p>
          <div className="aa-dialog-actions"><button type="button" className="wj-button wj-button-yellow" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <form className="aa-form" onSubmit={submit}>
          <div className="aa-field">
            <label htmlFor={ids.type}>What is it about?</label>
            <select id={ids.type} value={type} onChange={event => setType(event.target.value)}>
              <option value="SUPPORT">A question</option>
              <option value="RESCHEDULE">Reschedule a booking</option>
              <option value="BOOKING_CANCELLATION">Cancel a booking</option>
              <option value="REFUND">Request a refund</option>
              <option value="OTHER">Something else</option>
            </select>
          </div>
          <div className="aa-field"><label htmlFor={ids.subject}>Subject</label><input id={ids.subject} required minLength={3} maxLength={200} value={subject} onChange={event => setSubject(event.target.value)} /></div>
          <div className="aa-field"><label htmlFor={ids.message}>Message</label><textarea id={ids.message} required minLength={5} maxLength={4000} rows={4} value={message} onChange={event => setMessage(event.target.value)} /></div>
          {type === 'REFUND' && <p className="aa-small">Refunds are reviewed by our team and are not automatic.</p>}
          {(type === 'RESCHEDULE' || type === 'BOOKING_CANCELLATION') && <p className="aa-small">We will confirm availability and any fee or refund before anything changes.</p>}
          <Notice message={failure} tone="bad" />
          <div className="aa-dialog-actions">
            <button type="button" className="wj-control aa-secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="wj-button wj-button-yellow" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/* ───────────────────────────── Payment methods ───────────────────────────── */

type StripeLike = {
  elements: (options: Record<string, unknown>) => {create: (type: string, options?: Record<string, unknown>) => {mount: (node: HTMLElement) => void; destroy: () => void; on: (event: string, handler: (event: {complete?: boolean}) => void) => void}};
  confirmSetup: (options: Record<string, unknown>) => Promise<{error?: {message?: string}; setupIntent?: {id: string; status: string}}>;
};

let stripeScript: Promise<((key: string) => StripeLike) | null> | null = null;
/** Stripe.js loads only when a customer adds a card, never on other account screens. */
function loadStripe(): Promise<((key: string) => StripeLike) | null> {
  if (!stripeScript) {
    stripeScript = new Promise(resolve => {
      const existing = (window as unknown as {Stripe?: (key: string) => StripeLike}).Stripe;
      if (existing) return resolve(existing);
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => resolve((window as unknown as {Stripe?: (key: string) => StripeLike}).Stripe ?? null);
      script.onerror = () => {
        stripeScript = null;
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }
  return stripeScript;
}

function PaymentMethods() {
  const {data, error, loading, reload, setData} = useLoad('/account/payment-methods');
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{profileId: string; card: Json; others: Json[]} | null>(null);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState('');

  async function makeDefault(profileId: string, card: Json) {
    setBusy(card.id);
    setFailure('');
    try {
      const result = await accountFetch<Json>('/account/payment-methods/' + encodeURIComponent(card.id) + '/default', {method: 'POST', json: {profileId, idempotencyKey: newKey()}});
      setNotice(card.brand.toUpperCase() + ' •••• ' + card.last4 + ' is now your default card' + (result.affectedSubscriptions ? ' for future purchases and ' + result.affectedSubscriptions + ' subscription renewal(s).' : ' for future purchases.'));
      await reload();
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <SectionHead title="Payment methods" intro="Cards are stored securely by Stripe. We only ever see the brand, last four digits and expiry." />
      <Notice message={notice} onClose={() => setNotice('')} />
      <Notice message={failure} tone="bad" onClose={() => setFailure('')} />
      {loading && !data ? <Skeleton /> : error ? <LoadError message={error} retry={reload} /> : data && (data.profiles as Json[]).map(profile => (
        <section key={profile.profileId} className="aa-panel" aria-label={profile.primary ? 'Your cards' : 'Cards on a claimed purchase'}>
          {!profile.primary && <h2>Cards on a purchase you claimed</h2>}
          {profile.status === 'MISSING' && (
            <div className="aa-banner aa-banner-warn">
              <AlertTriangle size={18} aria-hidden="true" />
              <div><strong>No card on file</strong><p>Anything already paid for is unaffected, but renewals and new purchases need a card. Adding a card does not charge it.</p></div>
            </div>
          )}
          {profile.status === 'EXPIRED' && <p className="aa-alert aa-alert-bad">Every saved card has expired. Add a new card so renewals can be collected.</p>}
          <ul className="aa-cardlist">
            {(profile.cards as Json[]).map(card => (
              <li key={card.id} className="aa-cardrow">
                <CreditCard size={22} aria-hidden="true" />
                <div className="aa-row-main">
                  <strong>{card.brand.toUpperCase()} •••• {card.last4}</strong>
                  <span>Expires {String(card.expMonth).padStart(2, '0')}/{card.expYear}{card.expired ? ' · expired: cannot be charged' : card.expiringSoon ? ' · expires soon' : ''}</span>
                </div>
                {card.isDefault ? <Badge tone="ok">Default</Badge> : <button type="button" className="wj-control aa-secondary" aria-label={'Make ' + card.brand + ' ending ' + card.last4 + ' the default card'} disabled={Boolean(busy) || card.expired} onClick={() => void makeDefault(profile.profileId, card)}>{busy === card.id ? 'Saving…' : 'Make default'}</button>}
                <button
                  type="button"
                  className="wj-control aa-text-button"
                  aria-label={((profile.cards as Json[]).length === 1 ? 'Replace ' : 'Remove ') + card.brand + ' ending ' + card.last4}
                  disabled={Boolean(busy)}
                  aria-describedby={(profile.cards as Json[]).length === 1 ? 'last-card-' + card.id : undefined}
                  onClick={() => setRemoving({profileId: profile.profileId, card, others: (profile.cards as Json[]).filter(other => other.id !== card.id)})}
                >
                  {(profile.cards as Json[]).length === 1 ? 'Replace' : 'Remove'}
                </button>
                {(profile.cards as Json[]).length === 1 && <span id={'last-card-' + card.id} className="wj-sr-only">{data.minimumCardMessage}</span>}
              </li>
            ))}
          </ul>
          {(profile.cards as Json[]).length === 1 && <p className="aa-small">{data.minimumCardMessage} Your account always keeps at least one card.</p>}
          {(profile.affectedSubscriptions as Json[]).length > 0 && <p className="aa-small">Your default card is used for future purchases and for: {(profile.affectedSubscriptions as Json[]).map(sub => sub.planName).join(', ')}.</p>}
          <button type="button" className="wj-button wj-button-yellow" onClick={() => setAdding(profile.profileId)}>Add a card</button>
        </section>
      ))}
      {adding && <AddCardDialog profileId={adding} onClose={() => setAdding(null)} onDone={async message => { setAdding(null); setNotice(message); await reload(); }} />}
      {removing && <RemoveCardDialog {...removing} minimumMessage={data?.minimumCardMessage} onClose={() => setRemoving(null)} onAdd={() => { setAdding(removing.profileId); setRemoving(null); }} onDone={async (message, cards) => { setRemoving(null); setNotice(message); if (cards) setData(null); await reload(); }} />}
    </>
  );
}

function AddCardDialog({profileId, onClose, onDone}: {profileId: string; onClose: () => void; onDone: (message: string) => void}) {
  const mount = useRef<HTMLDivElement>(null);
  const stripeRef = useRef<{stripe: StripeLike; elements: ReturnType<StripeLike['elements']>; setupIntentId: string} | null>(null);
  const [consent, setConsent] = useState(false);
  const [makeDefault, setMakeDefault] = useState(false);
  const [phase, setPhase] = useState<'consent' | 'loading' | 'form' | 'saving'>('consent');
  const [failure, setFailure] = useState('');
  const consentId = useId();

  async function start() {
    setPhase('loading');
    setFailure('');
    try {
      const intent = await accountFetch<Json>('/account/payment-methods/setup-intent', {method: 'POST', json: {profileId, consent: true}});
      if (!intent.publishableKey) throw new Error('Card payments are not configured yet. Please contact our team.');
      const Stripe = await loadStripe();
      if (!Stripe) throw new Error('The secure card form could not load. Check your connection and try again.');
      const stripe = Stripe(intent.publishableKey);
      const elements = stripe.elements({clientSecret: intent.clientSecret, appearance: {theme: 'stripe', variables: {colorPrimary: '#193c32', fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '8px'}}});
      stripeRef.current = {stripe, elements, setupIntentId: intent.setupIntentId};
      setPhase('form');
      requestAnimationFrame(() => {
        if (mount.current) elements.create('payment', {layout: 'tabs'}).mount(mount.current);
      });
    } catch (caught) {
      setFailure(errorText(caught));
      setPhase('consent');
    }
  }

  async function save() {
    const current = stripeRef.current;
    if (!current) return;
    setPhase('saving');
    setFailure('');
    /* Stripe collects the card and runs any bank authentication (3-D Secure) in place. */
    const result = await current.stripe.confirmSetup({elements: current.elements, redirect: 'if_required', confirmParams: {return_url: window.location.origin + '/account/payment-methods/'}});
    if (result.error) {
      setFailure(result.error.message || 'Your card could not be saved.');
      setPhase('form');
      return;
    }
    try {
      const saved = await accountFetch<Json>('/account/payment-methods/setup-complete', {method: 'POST', json: {setupIntentId: current.setupIntentId, profileId, makeDefault}});
      if (!saved.added) {
        setFailure(saved.status === 'processing' ? 'Your bank is still confirming this card. It will appear here shortly.' : 'Your card still needs to be confirmed. Please try again.');
        setPhase('form');
        return;
      }
      onDone('Your card was saved. It was not charged.');
    } catch (caught) {
      setFailure(errorText(caught));
      setPhase('form');
    }
  }

  return (
    <Dialog title="Add a card" onClose={onClose} busy={phase === 'saving'}>
      {phase === 'consent' || phase === 'loading' ? (
        <>
          <label className="aa-check" htmlFor={consentId}>
            <input id={consentId} type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
            <span>I agree that Workspace Junction may save this card with Stripe and charge it for my renewals and for purchases I make. Adding the card does not charge it.</span>
          </label>
          <label className="aa-check">
            <input type="checkbox" checked={makeDefault} onChange={event => setMakeDefault(event.target.checked)} />
            <span>Make this my default card for renewals</span>
          </label>
          <Notice message={failure} tone="bad" />
          <div className="aa-dialog-actions">
            <button type="button" className="wj-control aa-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="wj-button wj-button-yellow" disabled={!consent || phase === 'loading'} onClick={() => void start()}>{phase === 'loading' ? 'Opening secure form…' : 'Continue'}</button>
          </div>
        </>
      ) : (
        <>
          <div ref={mount} className="aa-stripe-mount" />
          <p className="aa-small"><ShieldCheck size={14} aria-hidden="true" /> Card details go straight to Stripe and never touch our servers.</p>
          <Notice message={failure} tone="bad" />
          <div className="aa-dialog-actions">
            <button type="button" className="wj-control aa-secondary" disabled={phase === 'saving'} onClick={onClose}>Cancel</button>
            <button type="button" className="wj-button wj-button-yellow" disabled={phase === 'saving'} onClick={() => void save()}>{phase === 'saving' ? 'Saving…' : 'Save card'}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function RemoveCardDialog({profileId, card, others, minimumMessage, onClose, onAdd, onDone}: {profileId: string; card: Json; others: Json[]; minimumMessage?: string; onClose: () => void; onAdd: () => void; onDone: (message: string, changed?: boolean) => void}) {
  const usable = others.filter(other => !other.expired);
  const [replacement, setReplacement] = useState<string>(usable[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [key] = useState(newKey);
  const needsReplacement = card.isDefault && others.length > 0;

  async function confirm() {
    setBusy(true);
    setFailure('');
    try {
      await accountFetch('/account/payment-methods/' + encodeURIComponent(card.id), {method: 'DELETE', json: {profileId, idempotencyKey: key, ...(needsReplacement ? {replacementCardId: replacement} : {})}});
      onDone(card.brand.toUpperCase() + ' •••• ' + card.last4 + ' was removed.', true);
    } catch (caught) {
      setFailure(errorText(caught));
      setBusy(false);
    }
  }

  if (!others.length) {
    return (
      <Dialog title="Replace this card" onClose={onClose}>
        <p>{minimumMessage ?? 'Add a replacement card before removing this one.'}</p>
        <p className="aa-small">Your account always keeps at least one card. Once the new card is saved, you can remove this one.</p>
        <div className="aa-dialog-actions">
          <button type="button" className="wj-control aa-secondary" onClick={onClose}>Close</button>
          <button type="button" className="wj-button wj-button-yellow" onClick={onAdd}>Add a replacement card</button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog title={'Remove ' + card.brand.toUpperCase() + ' •••• ' + card.last4 + '?'} onClose={onClose} busy={busy}>
      {needsReplacement && (
        <fieldset className="aa-choices">
          <legend>This is your default card. Which card should replace it for future purchases and renewals?</legend>
          {others.map(other => (
            <label key={other.id} className={'aa-choice' + (replacement === other.id ? ' is-selected' : '')}>
              <input type="radio" name="replacement" value={other.id} checked={replacement === other.id} disabled={other.expired} onChange={() => setReplacement(other.id)} />
              <span><strong>{other.brand.toUpperCase()} •••• {other.last4}</strong><span>Expires {String(other.expMonth).padStart(2, '0')}/{other.expYear}{other.expired ? ' · expired' : ''}</span></span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="aa-small">The replacement is set with Stripe first. If that does not go through, this card stays saved.</p>
      <Notice message={failure} tone="bad" />
      <div className="aa-dialog-actions">
        <button type="button" className="wj-control aa-secondary" disabled={busy} onClick={onClose}>Keep card</button>
        <button type="button" className="wj-button wj-button-yellow" disabled={busy || (needsReplacement && !replacement)} onClick={() => void confirm()}>{busy ? 'Removing…' : 'Remove card'}</button>
      </div>
    </Dialog>
  );
}

/* ───────────────────────────── Billing ───────────────────────────── */

function Billing() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useLoad('/account/invoices?limit=10&page=' + page + (status ? '&status=' + status : ''));
  const upcoming = useLoad('/account/invoices/upcoming');
  const [detail, setDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [failure, setFailure] = useState('');

  async function pay(id: string) {
    setBusy(id);
    setFailure('');
    try {
      const result = await accountFetch<Json>('/account/invoices/' + encodeURIComponent(id) + '/pay', {method: 'POST', json: {}});
      if (result.url) window.location.assign(result.url);
      else {
        setFailure(result.message);
        await list.reload();
      }
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;
  return (
    <>
      <SectionHead title="Billing & invoices" intro="Invoices, receipts and upcoming charges. Amounts are shown in the currency you were billed in." />
      <Notice message={failure} tone="bad" onClose={() => setFailure('')} />
      <section className="aa-panel" aria-labelledby="bl-upcoming">
        <h2 id="bl-upcoming">Upcoming charges</h2>
        {upcoming.loading && !upcoming.data ? <Skeleton rows={2} /> : upcoming.error ? <LoadError message={upcoming.error} retry={upcoming.reload} /> : !(upcoming.data?.items as Json[] | undefined)?.length ? <Empty title="No upcoming charges" /> : (
          <>
            <ul className="aa-list">
              {(upcoming.data!.items as Json[]).map(item => (
                <li key={item.subscriptionId}><div><strong>{item.planName}</strong><span>{shortDate(item.date)}</span></div><span className="aa-amount">{money(item.amount, item.currency)}<small> estimate</small></span></li>
              ))}
            </ul>
            <p className="aa-small">{upcoming.data!.note}</p>
          </>
        )}
      </section>
      <div className="aa-filters">
        <label>
          <span>Status</span>
          <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="paid">Paid</option>
            <option value="open">Due</option>
            <option value="void">Void</option>
            <option value="uncollectible">Uncollectible</option>
          </select>
        </label>
      </div>
      {list.loading && !list.data ? <Skeleton /> : list.error ? <LoadError message={list.error} retry={list.reload} /> : !list.data?.items.length ? <Empty title="No invoices to show" /> : (
        <>
          <ul className="aa-rows">
            {(list.data.items as Json[]).map(invoice => (
              <li key={invoice.id} className="aa-invoice">
                <button type="button" className="wj-control aa-row" onClick={() => setDetail(invoice.id)}>
                  <span className="aa-row-main"><strong>{invoice.number || 'Invoice'}</strong><span>{shortDate(invoice.createdAt)}</span></span>
                  <Badge tone={invoice.status === 'paid' ? 'ok' : invoice.status === 'open' ? 'warn' : 'muted'}>{invoice.status === 'open' ? 'Due' : invoice.status}</Badge>
                  <span className="aa-amount">{money(invoice.total, invoice.currency)}</span>
                </button>
                {invoice.payable && <button type="button" className="wj-button wj-button-yellow aa-pay" disabled={busy === invoice.id} onClick={() => void pay(invoice.id)}>{busy === invoice.id ? 'Opening…' : 'Pay ' + money(invoice.amountRemaining || invoice.amountDue, invoice.currency)}</button>}
              </li>
            ))}
          </ul>
          <Pager page={page} pages={pages} onPage={setPage} />
        </>
      )}
      <p className="aa-small">Need a refund or think something is wrong? <SupportLink reference="" subject="Billing question" type="REFUND" label="Ask our team to review it" /> Refunds are never automatic.</p>
      {detail && <InvoiceDialog id={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function InvoiceDialog({id, onClose}: {id: string; onClose: () => void}) {
  const {data, error, loading, reload} = useLoad('/account/invoices/' + encodeURIComponent(id));
  return (
    <Dialog title={data?.number ? 'Invoice ' + data.number : 'Invoice'} onClose={onClose}>
      {loading ? <Skeleton rows={4} /> : error ? <LoadError message={error} retry={reload} /> : data && (
        <>
          <p className="aa-muted">{shortDate(data.createdAt)}{data.periodStart ? ' · Service ' + shortDate(data.periodStart) + ' – ' + shortDate(data.periodEnd) : ''}</p>
          {(data.lines as Json[]).length > 0 && (
            <table className="aa-table">
              <thead><tr><th scope="col">Description</th><th scope="col" className="aa-num">Amount</th></tr></thead>
              <tbody>{(data.lines as Json[]).map((line, index) => <tr key={index}><td>{line.description || 'Item'}</td><td className="aa-num">{money(line.amount, data.currency)}</td></tr>)}</tbody>
            </table>
          )}
          <dl className="aa-meta">
            {data.discountAmount > 0 && <div><dt>Discounts</dt><dd>−{money(data.discountAmount, data.currency)}</dd></div>}
            {data.taxAmount > 0 && <div><dt>Tax</dt><dd>{money(data.taxAmount, data.currency)}</dd></div>}
            <div><dt>Total</dt><dd>{money(data.total, data.currency)}</dd></div>
            <div><dt>Paid</dt><dd>{money(data.amountPaid, data.currency)}</dd></div>
            {data.amountRemaining > 0 && <div><dt>Still due</dt><dd>{money(data.amountRemaining, data.currency)}</dd></div>}
          </dl>
          <div className="aa-dialog-actions">
            {data.pdfUrl && <a className="wj-control aa-secondary" href={data.pdfUrl} target="_blank" rel="noopener noreferrer">Download PDF <ArrowUpRight size={14} aria-hidden="true" /></a>}
            {data.hostedUrl && <a className="wj-control aa-secondary" href={data.hostedUrl} target="_blank" rel="noopener noreferrer">View on Stripe <ArrowUpRight size={14} aria-hidden="true" /></a>}
          </div>
        </>
      )}
    </Dialog>
  );
}

/* ───────────────────────────── Profile ───────────────────────────── */

function Profile() {
  const {data, error, loading, reload, setData} = useLoad('/account/profile');
  /* Only the customer's unsaved edits live in state; everything else comes from the loaded profile. */
  const [edits, setEdits] = useState<Json | null>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [closing, setClosing] = useState(false);
  const ids = {name: useId(), phone: useId(), company: useId(), line1: useId(), line2: useId(), city: useId(), state: useId(), postal: useId(), country: useId()};
  const loaded: Json | null = data ? {name: data.name ?? '', phone: data.phone ?? '', company: data.company ?? '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US', ...data.billingAddress} : null;
  const form: Json | null = loaded ? {...loaded, ...edits} : null;
  const setForm = (update: (current: Json | null) => Json) => setEdits(current => update({...loaded, ...current}));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setBusy('profile');
    setFailure('');
    try {
      const {name, phone, company, line1, line2, city, state, postalCode, country} = form;
      const updated = await accountFetch<Json>('/account/profile', {method: 'PATCH', json: {name, phone, company, billingAddress: {line1, line2, city, state, postalCode, country}}});
      setData(updated);
      setEdits(null);
      setNotice('Your details were saved. Past invoices and receipts keep the details they were issued with.');
      /* The navbar shows the new name immediately, in this tab and others. */
      publish({status: 'authenticated', customer: {displayName: updated.displayName, initials: updated.initials, email: updated.email}, method: 'PASSWORD'});
      void refreshSession();
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  async function savePrefs(patch: Json) {
    setBusy('prefs');
    setFailure('');
    try {
      setData(await accountFetch<Json>('/account/preferences', {method: 'PATCH', json: patch}));
      setNotice('Your notification preferences were saved.');
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  const set = (key: string) => (event: {target: {value: string}}) => setForm(current => ({...current, [key]: event.target.value}));
  return (
    <>
      <SectionHead title="Profile" intro="Your contact and billing details. Changing them never changes past orders or invoices." />
      <Notice message={notice} onClose={() => setNotice('')} />
      <Notice message={failure} tone="bad" onClose={() => setFailure('')} />
      {loading && !data ? <Skeleton rows={5} /> : error ? <LoadError message={error} retry={reload} /> : data && form && (
        <>
          <form className="aa-panel aa-form" onSubmit={save}>
            <h2>Contact details</h2>
            <div className="aa-form-grid">
              <div className="aa-field"><label htmlFor={ids.name}>Name</label><input id={ids.name} required maxLength={200} autoComplete="name" value={form.name} onChange={set('name')} /></div>
              <div className="aa-field"><label htmlFor={ids.phone}>Phone</label><input id={ids.phone} type="tel" maxLength={50} autoComplete="tel" value={form.phone} onChange={set('phone')} /></div>
              <div className="aa-field"><label htmlFor={ids.company}>Company (optional)</label><input id={ids.company} maxLength={200} autoComplete="organization" value={form.company} onChange={set('company')} /></div>
              <div className="aa-field"><span className="aa-label">Email</span><p className="aa-static">{data.email} <Link className="wj-control aa-text-button" href="/account/security/">Change</Link></p></div>
            </div>
            <h2>Billing address</h2>
            <div className="aa-form-grid">
              <div className="aa-field aa-span-2"><label htmlFor={ids.line1}>Address line 1</label><input id={ids.line1} maxLength={200} autoComplete="address-line1" value={form.line1} onChange={set('line1')} /></div>
              <div className="aa-field aa-span-2"><label htmlFor={ids.line2}>Address line 2</label><input id={ids.line2} maxLength={200} autoComplete="address-line2" value={form.line2} onChange={set('line2')} /></div>
              <div className="aa-field"><label htmlFor={ids.city}>City</label><input id={ids.city} maxLength={100} autoComplete="address-level2" value={form.city} onChange={set('city')} /></div>
              <div className="aa-field"><label htmlFor={ids.state}>State</label><input id={ids.state} maxLength={100} autoComplete="address-level1" value={form.state} onChange={set('state')} /></div>
              <div className="aa-field"><label htmlFor={ids.postal}>ZIP / postal code</label><input id={ids.postal} maxLength={20} autoComplete="postal-code" value={form.postalCode} onChange={set('postalCode')} /></div>
              <div className="aa-field"><label htmlFor={ids.country}>Country code</label><input id={ids.country} maxLength={2} pattern="[A-Za-z]{2}" autoComplete="country" value={form.country} onChange={set('country')} /></div>
            </div>
            <button className="wj-button wj-button-yellow aa-submit" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save details'}</button>
          </form>
          <section className="aa-panel" aria-labelledby="pf-prefs">
            <h2 id="pf-prefs">Notifications</h2>
            <label className="aa-check"><input type="checkbox" disabled={busy === 'prefs'} checked={data.preferences.bookingReminders} onChange={event => void savePrefs({bookingReminders: event.target.checked})} /><span>Booking reminders</span></label>
            <label className="aa-check"><input type="checkbox" disabled={busy === 'prefs'} checked={data.preferences.renewalReminders} onChange={event => void savePrefs({renewalReminders: event.target.checked})} /><span>Renewal reminders</span></label>
            <label className="aa-check"><input type="checkbox" disabled={busy === 'prefs'} checked={data.preferences.marketingOptIn} onChange={event => void savePrefs({marketingOptIn: event.target.checked})} /><span>News and offers (marketing)</span></label>
            <p className="aa-small">Always sent, because they are part of your account: {(data.essentialNotices as string[]).join(', ').toLowerCase()}.</p>
          </section>
          <section className="aa-panel" aria-labelledby="pf-help">
            <h2 id="pf-help">Help and privacy</h2>
            <p>Questions about your account? <SupportLink reference="" subject="Account question" /></p>
            {data.closureRequestedAt ? <p className="aa-alert aa-alert-warn">You asked to close your account on {shortDate(data.closureRequestedAt)}. Our team will be in touch.</p> : <button type="button" className="wj-control aa-text-button" onClick={() => setClosing(true)}>Request account closure</button>}
          </section>
        </>
      )}
      {closing && <ClosureDialog onClose={() => setClosing(false)} onDone={async () => { setClosing(false); await reload(); }} />}
    </>
  );
}

function ClosureDialog({onClose, onDone}: {onClose: () => void; onDone: () => void}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Json | null>(null);
  const [failure, setFailure] = useState('');
  const id = useId();
  async function confirm() {
    setBusy(true);
    setFailure('');
    try {
      setResult(await accountFetch<Json>('/account/closure-request', {method: 'POST', json: reason ? {reason} : {}}));
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Request account closure" onClose={result ? onDone : onClose} busy={busy}>
      {result ? (
        <>
          <ul className="aa-bullets">{(result.explanation as string[]).map(line => <li key={line}>{line}</li>)}</ul>
          <div className="aa-dialog-actions"><button type="button" className="wj-button wj-button-yellow" onClick={onDone}>Done</button></div>
        </>
      ) : (
        <>
          <ul className="aa-bullets">
            <li>Our team reviews closure requests and replies by email.</li>
            <li>This request does not cancel any subscription. Cancel them from My subscriptions, or ask us to.</li>
            <li>Invoices and payment records are kept for as long as tax and accounting rules require.</li>
          </ul>
          <div className="aa-field"><label htmlFor={id}>Anything you would like us to know? (optional)</label><textarea id={id} rows={3} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></div>
          <Notice message={failure} tone="bad" />
          <div className="aa-dialog-actions">
            <button type="button" className="wj-control aa-secondary" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="wj-button wj-button-yellow" disabled={busy} onClick={() => void confirm()}>{busy ? 'Sending…' : 'Send request'}</button>
          </div>
        </>
      )}
    </Dialog>
  );
}

/* ───────────────────────────── Security ───────────────────────────── */

function Security() {
  const session = useCustomerSession();
  const router = useRouter();
  const sessions = useLoad('/account/auth/sessions');
  const profile = useLoad('/account/profile');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState('');
  const [pw, setPw] = useState({current: '', next: '', confirm: ''});
  const [email, setEmail] = useState({next: '', password: ''});
  const ids = {current: useId(), next: useId(), confirm: useId(), email: useId(), emailPassword: useId()};

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (pw.next !== pw.confirm) return setFailure('The two new passwords do not match.');
    setBusy('password');
    setFailure('');
    try {
      await accountFetch('/account/auth/password/change', {method: 'POST', json: {currentPassword: pw.current, newPassword: pw.next}});
      setPw({current: '', next: '', confirm: ''});
      setNotice('Your password was changed. Every other device was signed out and we emailed you a confirmation.');
      await sessions.reload();
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    setBusy('email');
    setFailure('');
    try {
      await accountFetch('/account/auth/email/change', {method: 'POST', json: {newEmail: email.next, password: email.password}});
      setEmail({next: '', password: ''});
      setNotice('Check the new address for a confirmation link. Your current email stays in place until you confirm, and we let your current address know.');
      await profile.reload();
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  async function revoke(id: string) {
    setBusy(id);
    try {
      await accountFetch('/account/auth/sessions/' + encodeURIComponent(id), {method: 'DELETE', json: {}});
      await sessions.reload();
    } catch (caught) {
      setFailure(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <SectionHead title="Security" intro="Your password, sign-in email and the devices signed in to your account." />
      <Notice message={notice} onClose={() => setNotice('')} />
      <Notice message={failure} tone="bad" onClose={() => setFailure('')} />
      {session.status === 'authenticated' && session.method === 'LINK' && <p className="aa-alert aa-alert-warn">You signed in with an email link. Changing your password or email needs your current password.</p>}
      <form className="aa-panel aa-form" onSubmit={changePassword}>
        <h2>Change password</h2>
        <div className="aa-form-grid">
          <div className="aa-field aa-span-2"><label htmlFor={ids.current}>Current password</label><input id={ids.current} type="password" required autoComplete="current-password" maxLength={72} value={pw.current} onChange={event => setPw({...pw, current: event.target.value})} /></div>
          <div className="aa-field"><label htmlFor={ids.next}>New password</label><input id={ids.next} type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={pw.next} onChange={event => setPw({...pw, next: event.target.value})} aria-describedby={ids.next + '-hint'} /><p className="aa-hint" id={ids.next + '-hint'}>At least 10 characters.</p></div>
          <div className="aa-field"><label htmlFor={ids.confirm}>Confirm new password</label><input id={ids.confirm} type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={pw.confirm} onChange={event => setPw({...pw, confirm: event.target.value})} /></div>
        </div>
        <button className="wj-button wj-button-yellow aa-submit" disabled={busy === 'password'}>{busy === 'password' ? 'Saving…' : 'Change password'}</button>
      </form>
      <form className="aa-panel aa-form" onSubmit={changeEmail}>
        <h2>Sign-in email</h2>
        <p className="aa-muted">Currently {profile.data?.email ?? '…'}{profile.data?.pendingEmail ? ' · waiting for confirmation of ' + profile.data.pendingEmail : ''}</p>
        <div className="aa-form-grid">
          <div className="aa-field"><label htmlFor={ids.email}>New email</label><input id={ids.email} type="email" required maxLength={254} autoComplete="email" value={email.next} onChange={event => setEmail({...email, next: event.target.value})} /></div>
          <div className="aa-field"><label htmlFor={ids.emailPassword}>Current password</label><input id={ids.emailPassword} type="password" required maxLength={72} autoComplete="current-password" value={email.password} onChange={event => setEmail({...email, password: event.target.value})} /></div>
        </div>
        <button className="wj-button wj-button-yellow aa-submit" disabled={busy === 'email'}>{busy === 'email' ? 'Sending…' : 'Send confirmation link'}</button>
      </form>
      <section className="aa-panel" aria-labelledby="sec-sessions">
        <h2 id="sec-sessions">Signed-in devices</h2>
        {sessions.loading && !sessions.data ? <Skeleton rows={2} /> : sessions.error ? <LoadError message={sessions.error} retry={sessions.reload} /> : (
          <ul className="aa-list">
            {(sessions.data?.items as Json[] | undefined)?.map(item => (
              <li key={item.id}>
                <div><strong>{item.device}{item.current && <Badge tone="ok">This device</Badge>}</strong><span>{item.network ? item.network + ' · ' : ''}Last active {shortDate(item.lastSeenAt)} · signed in {item.method === 'LINK' ? 'with an email link' : 'with a password'}</span></div>
                {!item.current && <button type="button" className="wj-control aa-text-button" disabled={busy === item.id} onClick={() => void revoke(item.id)}>Sign out</button>}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="wj-control aa-secondary"
          onClick={async () => {
            await logout(true).catch(() => undefined);
            router.push('/login/');
          }}
        >
          <CheckCircle2 size={15} aria-hidden="true" /> Sign out of all devices
        </button>
      </section>
    </>
  );
}
