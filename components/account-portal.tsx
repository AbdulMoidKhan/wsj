'use client';
/**
 * Customer self-service portal. Authenticated by the short-lived management
 * token issued after a confirmed payment or emailed on request. Everything it
 * shows comes from the backend, and a cancellation is only reported once Stripe
 * has confirmed it.
 */
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {AlertTriangle, ArrowUpRight, CreditCard, Loader2, RefreshCw} from 'lucide-react';
import {PUBLIC_API_URL} from '@/lib/public-api';
import './account-portal.css';

type Json = Record<string, unknown>;
const text = (value: unknown) => (value == null ? '' : String(value));
const money = (minor: unknown, currency: unknown = 'usd') => new Intl.NumberFormat('en-US', {style: 'currency', currency: String(currency || 'usd').toUpperCase()}).format(Number(minor || 0) / 100);
const when = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString(undefined, {dateStyle: 'medium'}) : '—');

const ACCESS_COPY: Record<string, {label: string; tone: string; detail: string}> = {
  PENDING: {label: 'Awaiting payment', tone: 'warn', detail: 'We are waiting for your first payment to be confirmed.'},
  ACTIVE: {label: 'Active', tone: 'ok', detail: 'Your subscription is active and renews automatically.'},
  PAST_DUE: {label: 'Payment problem', tone: 'warn', detail: 'The last payment failed. Update your payment method to keep your access.'},
  SUSPENDED: {label: 'Suspended', tone: 'bad', detail: 'Access is suspended until a payment succeeds.'},
  ENDED: {label: 'Ended', tone: 'bad', detail: 'This subscription has ended. Start a new purchase to use the service again.'},
};

export function AccountPortal() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [data, setData] = useState<Json | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState<Json | null>(null);
  const [preview, setPreview] = useState<Json | null>(null);
  const [email, setEmail] = useState('');
  const [linkRequested, setLinkRequested] = useState(false);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch(PUBLIC_API_URL + '/billing/portal' + path, {...init, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token}, cache: 'no-store'});
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'Request failed');
      return body;
    },
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await call(''));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your account');
    } finally {
      setLoading(false);
    }
  }, [call, token]);

  useEffect(() => {
    /* Deferred so the first paint is not blocked by a synchronous state update. */
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function openCancel(subscription: Json) {
    setBusy('preview');
    setError('');
    try {
      setPreview(await call('/subscriptions/' + encodeURIComponent(text(subscription.id)) + '/cancellation-preview?mode=PERIOD_END'));
      setConfirming(subscription);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to prepare the cancellation');
    } finally {
      setBusy('');
    }
  }

  async function act(subscriptionId: string, action: 'cancel' | 'resume') {
    if (busy) return;
    setBusy(action);
    setError('');
    try {
      await call('/subscriptions/' + encodeURIComponent(subscriptionId) + '/' + action, {method: 'POST', body: JSON.stringify({})});
      setConfirming(null);
      setNotice(action === 'cancel' ? 'Stripe confirmed it: automatic renewal is stopped. You keep access until the end of your paid period.' : 'Your subscription will renew normally again.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not complete that. Nothing was changed.');
    } finally {
      setBusy('');
    }
  }

  async function openStripePortal() {
    setBusy('portal');
    try {
      const body = await call('/stripe-session', {method: 'POST', body: JSON.stringify({})});
      /* Stripe Billing Portal is an external destination, so a full navigation is correct. */
      window.location.assign(String(body.url));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open the billing portal');
      setBusy('');
    }
  }

  async function requestLink(event: React.FormEvent) {
    event.preventDefault();
    setBusy('link');
    try {
      await fetch(PUBLIC_API_URL + '/billing/portal/request-link', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email})});
    } finally {
      setLinkRequested(true);
      setBusy('');
    }
  }

  if (!token) {
    return (
      <section className="ap-wrap ap-empty">
        <h2>Manage your membership</h2>
        <p>Enter the email you used at checkout and we will send you a secure management link.</p>
        {linkRequested ? (
          <p className="ap-notice" role="status">If that email has an account with us, a management link is on its way. The link stays valid for two hours.</p>
        ) : (
          <form className="ap-link-form" onSubmit={requestLink}>
            <label>
              <span>Email address</span>
              <input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" />
            </label>
            <button className="wj-button wj-button-yellow" disabled={busy === 'link'}>{busy === 'link' ? 'Sending…' : 'Send my link'}</button>
          </form>
        )}
        <p className="ap-hint">Prefer to talk to someone? <Link href="/contact-us/">Contact our team</Link> and we can cancel or change your plan for you.</p>
      </section>
    );
  }

  const subscriptions = (data?.subscriptions ?? []) as Json[];
  const invoices = (data?.invoices ?? []) as Json[];
  const orders = (data?.orders ?? []) as Json[];
  const balances = ((data?.entitlements as Json)?.balances ?? []) as Json[];

  return (
    <section className="ap-wrap">
      {loading && <p className="ap-status" role="status"><Loader2 size={16} className="ap-spin" /> Loading your account…</p>}
      {error && <p className="ap-error" role="alert">{error} <button className="ap-text-button" onClick={() => void load()}>Try again</button></p>}
      {notice && <p className="ap-notice" role="status">{notice}</p>}

      {data && (
        <>
          <header className="ap-head">
            <div>
              <span className="ap-eyebrow">YOUR ACCOUNT</span>
              <h2>{text((data.customer as Json).name) || text((data.customer as Json).email)}</h2>
              <p>{text((data.customer as Json).email)}</p>
            </div>
            <button className="ap-secondary" disabled={Boolean(busy)} onClick={() => void openStripePortal()}>
              <CreditCard size={16} /> {busy === 'portal' ? 'Opening…' : 'Update payment method'}
            </button>
          </header>

          <h3 className="ap-section-title">Subscriptions</h3>
          {subscriptions.length === 0 && <p className="ap-hint">You have no subscriptions yet.</p>}
          <div className="ap-cards">
            {subscriptions.map(subscription => {
              const access = ACCESS_COPY[text(subscription.accessStatus)] ?? {label: text(subscription.accessStatus), tone: 'warn', detail: ''};
              const scheduled = subscription.cancelAtPeriodEnd === true;
              const ended = subscription.accessStatus === 'ENDED';
              return (
                <article className="ap-card" key={text(subscription.id)}>
                  <div className="ap-card-head">
                    <div>
                      <strong>{text(subscription.planName)}</strong>
                      <span className="ap-price">{money(subscription.unitAmount, subscription.currency)} {text(subscription.intervalDescription)}</span>
                    </div>
                    <span className={'ap-badge ap-' + access.tone}>{scheduled && !ended ? 'Cancellation scheduled' : access.label}</span>
                  </div>
                  <p className="ap-detail">{scheduled && !ended ? 'Your plan will not renew again. You keep access until ' + when(subscription.currentPeriodEnd) + '.' : access.detail}</p>
                  <dl className="ap-meta">
                    <div><dt>Current period</dt><dd>{when(subscription.currentPeriodStart)} → {when(subscription.currentPeriodEnd)}</dd></div>
                    <div><dt>Next renewal</dt><dd>{scheduled || ended ? 'None' : when(subscription.renewsAt)}</dd></div>
                    {Boolean(subscription.graceEndsAt) && <div><dt>Please pay by</dt><dd>{when(subscription.graceEndsAt)}</dd></div>}
                  </dl>
                  {subscription.accessStatus === 'PAST_DUE' && Boolean(subscription.latestInvoiceUrl) && (
                    <a className="wj-button wj-button-yellow ap-pay" href={text(subscription.latestInvoiceUrl)} target="_blank" rel="noreferrer">Pay the outstanding invoice <ArrowUpRight size={15} /></a>
                  )}
                  <div className="ap-card-actions">
                    {!ended && !scheduled && <button className="ap-secondary" disabled={Boolean(busy)} onClick={() => void openCancel(subscription)}>Cancel automatic renewal</button>}
                    {!ended && scheduled && <button className="ap-secondary" disabled={Boolean(busy)} onClick={() => void act(text(subscription.id), 'resume')}>{busy === 'resume' ? 'Working…' : 'Keep my subscription'}</button>}
                    <Link className="ap-text-button" href="/contact-us/">Ask our team for help</Link>
                  </div>
                </article>
              );
            })}
          </div>

          {confirming && preview && (
            <div className="ap-overlay" role="alertdialog" aria-modal="true" aria-label="Confirm cancellation">
              <div className="ap-confirm">
                <h3><AlertTriangle size={18} /> Stop automatic renewal?</h3>
                <ul>
                  <li>Last day of access: <strong>{when(preview.lastAccessDate)}</strong></li>
                  <li>Will it renew again: <strong>{preview.willRenewAgain ? 'Yes' : 'No'}</strong></li>
                  <li>Refund for the current period: <strong>{preview.refundIssued ? 'Yes' : 'No'}</strong></li>
                  <li>Reservations and included credits stop at the end of the paid period.</li>
                </ul>
                <p className="ap-hint">You can undo this any time before it takes effect.</p>
                <div className="ap-confirm-actions">
                  <button className="ap-secondary" disabled={Boolean(busy)} onClick={() => setConfirming(null)}>Keep my subscription</button>
                  <button className="wj-button wj-button-yellow" disabled={Boolean(busy)} onClick={() => void act(text(confirming.id), 'cancel')}>{busy === 'cancel' ? 'Contacting Stripe…' : 'Confirm cancellation'}</button>
                </div>
              </div>
            </div>
          )}

          {balances.length > 0 && (
            <>
              <h3 className="ap-section-title">Included credits</h3>
              <ul className="ap-list">{balances.map(balance => <li key={text(balance.kind)}><span>{text(balance.kind).replaceAll('_', ' ').toLowerCase()}</span><strong>{text(balance.balance)}</strong></li>)}</ul>
            </>
          )}

          <h3 className="ap-section-title">Invoices</h3>
          {invoices.length === 0 ? <p className="ap-hint">No invoices yet.</p> : (
            <ul className="ap-list">
              {invoices.map(invoice => (
                <li key={text(invoice.id)}>
                  <span>{when(invoice.createdAt)} · {text(invoice.status)}</span>
                  <strong>{money(invoice.amountPaid, invoice.currency)}</strong>
                  {Boolean(invoice.hostedUrl) && <a href={text(invoice.hostedUrl)} target="_blank" rel="noreferrer">View <ArrowUpRight size={14} /></a>}
                </li>
              ))}
            </ul>
          )}

          <h3 className="ap-section-title">Purchases</h3>
          <ul className="ap-list">
            {orders.map(order => (
              <li key={text(order.id)}>
                <span>{when(order.createdAt)} · {text(order.status).toLowerCase()}</span>
                <strong>{money(order.dueNowAmount, order.currency)}</strong>
              </li>
            ))}
          </ul>

          <button className="ap-text-button" disabled={loading} onClick={() => void load()}><RefreshCw size={14} className={loading ? 'ap-spin' : ''} /> Refresh</button>
        </>
      )}
    </section>
  );
}
