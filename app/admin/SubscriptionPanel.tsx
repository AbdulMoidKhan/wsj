'use client';
import {useCallback, useEffect, useState} from 'react';
import {AlertTriangle, ArrowUpRight, Check, ExternalLink, RefreshCw, X} from 'lucide-react';
import {ApiError, request} from './api';

type Json = Record<string, unknown>;
const text = (value: unknown) => (value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));
const money = (minor: unknown, currency: unknown) => new Intl.NumberFormat('en-US', {style: 'currency', currency: String(currency || 'usd').toUpperCase()}).format(Number(minor || 0) / 100);
const when = (value: unknown) => (value ? new Date(String(value)).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}) : '—');
const errorText = (error: unknown) => (error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Something went wrong. Please try again.');

/** Human label for the normalised access status, kept separate from the Stripe status. */
const ACCESS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting first payment',
  ACTIVE: 'Active',
  PAST_DUE: 'Payment failed (in grace period)',
  SUSPENDED: 'Suspended',
  ENDED: 'Ended',
};

export default function SubscriptionPanel({id, onClose, onChanged, onUnauthorized, canCancelImmediately}: {id: string; onClose: () => void; onChanged: (notice: string) => void; onUnauthorized: () => void; canCancelImmediately: boolean}) {
  const [data, setData] = useState<Json | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<'PERIOD_END' | 'IMMEDIATE' | null>(null);
  const [preview, setPreview] = useState<Json | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [credit, setCredit] = useState({kind: 'MEETING_ROOM_HOUR', delta: '', reason: ''});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await request<Json>('/admin/billing/subscriptions/' + encodeURIComponent(id)));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) onUnauthorized();
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, [id, onUnauthorized]);

  useEffect(() => {
    /* Deferred so the first paint is not blocked by a synchronous state update. */
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', listener);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', listener);
      document.body.style.overflow = previous;
    };
  }, [busy, onClose]);

  /** Always show the consequences from the server before a cancellation is confirmed. */
  async function openConfirm(mode: 'PERIOD_END' | 'IMMEDIATE') {
    setError('');
    setBusy('preview');
    try {
      setPreview(await request<Json>('/admin/billing/subscriptions/' + encodeURIComponent(id) + '/cancellation-preview?mode=' + mode));
      setConfirm(mode);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  async function act(action: string, body?: Json, notice?: string) {
    if (busy) return; /* repeated clicks must never create a second billing action */
    setBusy(action);
    setError('');
    try {
      await request('/admin/billing/subscriptions/' + encodeURIComponent(id) + '/' + action, {method: 'POST', body: JSON.stringify(body ?? {})});
      setConfirm(null);
      await load();
      onChanged(notice ?? 'Subscription updated.');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) onUnauthorized();
      setError(errorText(caught));
    } finally {
      setBusy('');
    }
  }

  const customer = (data?.customer ?? {}) as Json;
  const events = (data?.events ?? []) as Json[];
  const invoices = (data?.invoices ?? []) as Json[];
  const balances = ((data?.entitlements as Json)?.balances ?? []) as Json[];
  const scheduled = data?.cancelAtPeriodEnd === true;
  const ended = data?.accessStatus === 'ENDED';

  return (
    <div className="adm-overlay" onClick={event => {if (event.target === event.currentTarget && !busy) onClose();}}>
      <section className="adm-dialog adm-sub-panel" role="dialog" aria-modal="true" aria-labelledby="adm-sub-title">
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">SUBSCRIPTION</span>
            <h2 id="adm-sub-title">{text(data?.planName) || 'Subscription'}</h2>
          </div>
          <button className="adm-icon" aria-label="Close subscription" disabled={Boolean(busy)} onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="adm-sub-body">
          {loading && (
            <div className="adm-empty" role="status">
              <RefreshCw className="adm-spin" size={22} />
              <strong>Loading subscription…</strong>
            </div>
          )}
          {error && (
            <div className="adm-alert" role="alert">
              {error}
              <button className="adm-text-button" onClick={() => void load()}>Try again</button>
            </div>
          )}

          {data && !loading && (
            <>
              <dl className="adm-sub-grid">
                <div><dt>Customer</dt><dd>{text(customer.name) || text(customer.email)}<br /><small>{text(customer.email)}</small></dd></div>
                <div><dt>Service</dt><dd>{text(data.serviceType) || '—'}</dd></div>
                <div><dt>Billing</dt><dd>{money(data.unitAmount, data.currency)} {text(data.intervalDescription)}</dd></div>
                <div><dt>Access status</dt><dd><span className={'adm-badge adm-badge-' + text(data.accessStatus).toLowerCase()}>{ACCESS_LABEL[text(data.accessStatus)] ?? text(data.accessStatus)}</span></dd></div>
                <div><dt>Stripe status</dt><dd>{text(data.stripeStatus)}</dd></div>
                <div><dt>Current period</dt><dd>{when(data.currentPeriodStart)} → {when(data.currentPeriodEnd)}</dd></div>
                <div><dt>Renews</dt><dd>{scheduled ? 'No further renewal' : when(data.renewsAt)}</dd></div>
                <div><dt>Cancellation</dt><dd>{ended ? 'Ended ' + when(data.endedAt) : scheduled ? 'Scheduled for ' + when(data.cancelAt ?? data.currentPeriodEnd) : data.cancellationRequestedAt ? 'Requested ' + when(data.cancellationRequestedAt) : 'None'}</dd></div>
                {Boolean(data.graceEndsAt) && <div><dt>Grace period ends</dt><dd>{when(data.graceEndsAt)}</dd></div>}
                {Boolean(data.cancelReason) && <div><dt>Reason</dt><dd>{text(data.cancelReason)}</dd></div>}
              </dl>

              <div className="adm-sub-actions">
                {!ended && !scheduled && (
                  <button className="adm-button adm-secondary" disabled={Boolean(busy)} onClick={() => void openConfirm('PERIOD_END')}>
                    {busy === 'preview' ? 'Checking…' : 'Cancel at period end'}
                  </button>
                )}
                {!ended && scheduled && (
                  <button className="adm-button adm-secondary" disabled={Boolean(busy)} onClick={() => void act('resume', {}, 'Scheduled cancellation withdrawn. The subscription will renew normally.')}>
                    {busy === 'resume' ? 'Working…' : 'Withdraw scheduled cancellation'}
                  </button>
                )}
                {!ended && canCancelImmediately && (
                  <button className="adm-button adm-delete" disabled={Boolean(busy)} onClick={() => void openConfirm('IMMEDIATE')}>
                    Cancel immediately
                  </button>
                )}
                <button className="adm-button adm-secondary" disabled={Boolean(busy)} onClick={() => void act('reconcile', {}, 'Reconciled with Stripe.')}>
                  <RefreshCw size={15} className={busy === 'reconcile' ? 'adm-spin' : ''} /> Reconcile with Stripe
                </button>
                {Boolean(data.stripeSubscriptionId) && (
                  <a className="adm-button adm-secondary" href={text(data.stripeDashboardUrl)} target="_blank" rel="noreferrer">
                    Open in Stripe <ExternalLink size={14} />
                  </a>
                )}
              </div>

              {confirm && preview && (
                <div className="adm-sub-confirm" role="alertdialog" aria-label="Confirm cancellation">
                  <h3><AlertTriangle size={18} /> {confirm === 'IMMEDIATE' ? 'Cancel immediately?' : 'Stop automatic renewal?'}</h3>
                  <ul>
                    <li><strong>Effective:</strong> {when(preview.effectiveAt)}</li>
                    <li><strong>Last day of access:</strong> {when(preview.lastAccessDate)}</li>
                    <li><strong>Renews again:</strong> {preview.willRenewAgain ? 'Yes' : 'No'}</li>
                    <li><strong>Refund:</strong> {preview.refundIssued ? 'Yes' : 'None. Refunds are issued separately and explicitly.'}</li>
                    <li><strong>Stripe proration:</strong> {text(preview.prorationBehavior)} · invoice now: {preview.invoiceNow ? 'yes' : 'no'}</li>
                    <li><strong>Access:</strong> {text(preview.accessConsequence)}</li>
                  </ul>
                  <label className="adm-field"><span>Reason (recorded in the audit trail)</span><input value={reason} onChange={event => setReason(event.target.value)} /></label>
                  <label className="adm-field"><span>Internal note</span><input value={note} onChange={event => setNote(event.target.value)} /></label>
                  <div className="adm-actions">
                    <button className="adm-button adm-secondary" disabled={Boolean(busy)} onClick={() => setConfirm(null)}>Keep subscription</button>
                    <button
                      className={'adm-button ' + (confirm === 'IMMEDIATE' ? 'adm-delete' : 'adm-primary')}
                      disabled={Boolean(busy)}
                      onClick={() => void act('cancel', {mode: confirm, reason: reason || undefined, note: note || undefined}, confirm === 'IMMEDIATE' ? 'Cancelled in Stripe. Access has ended.' : 'Stripe confirmed: renewal stopped at the end of the paid period.')}
                    >
                      {busy === 'cancel' ? 'Contacting Stripe…' : <><Check size={15} /> Confirm with Stripe</>}
                    </button>
                  </div>
                </div>
              )}

              <section className="adm-sub-section">
                <h3>Included credits</h3>
                {balances.length === 0 ? <p className="adm-help">No entitlements recorded for this customer.</p> : (
                  <ul className="adm-sub-list">{balances.map(balance => <li key={text(balance.kind)}><span>{text(balance.kind).replaceAll('_', ' ').toLowerCase()}</span><strong>{text(balance.balance)}</strong></li>)}</ul>
                )}
                <div className="adm-sub-inline">
                  <select aria-label="Credit type" value={credit.kind} onChange={event => setCredit({...credit, kind: event.target.value})}>
                    {['MEETING_ROOM_HOUR', 'COWORKING_DAY', 'STUDIO_HOUR', 'CREDIT'].map(kind => <option key={kind} value={kind}>{kind.replaceAll('_', ' ').toLowerCase()}</option>)}
                  </select>
                  <input aria-label="Adjustment" type="number" placeholder="+/- amount" value={credit.delta} onChange={event => setCredit({...credit, delta: event.target.value})} />
                  <input aria-label="Adjustment reason" placeholder="Reason" value={credit.reason} onChange={event => setCredit({...credit, reason: event.target.value})} />
                  <button
                    className="adm-button adm-secondary"
                    disabled={Boolean(busy) || !credit.delta || !credit.reason}
                    onClick={() => void act('entitlements', {kind: credit.kind, delta: Number(credit.delta), reason: credit.reason}, 'Credit balance adjusted and recorded.').then(() => setCredit({...credit, delta: '', reason: ''}))}
                  >
                    {busy === 'entitlements' ? 'Saving…' : 'Adjust'}
                  </button>
                </div>
              </section>

              <section className="adm-sub-section">
                <h3>Invoices</h3>
                {invoices.length === 0 ? <p className="adm-help">No invoices recorded yet.</p> : (
                  <ul className="adm-sub-list">
                    {invoices.map(invoice => (
                      <li key={text(invoice.id)}>
                        <span>{when(invoice.createdAt)} · {text(invoice.status)}</span>
                        <strong>{money(invoice.amountPaid, invoice.currency)}</strong>
                        {Boolean(invoice.hostedUrl) && <a href={text(invoice.hostedUrl)} target="_blank" rel="noreferrer" aria-label="Open invoice"><ArrowUpRight size={15} /></a>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="adm-sub-section">
                <h3>Audit trail</h3>
                <ul className="adm-sub-timeline">
                  {events.map(event => (
                    <li key={text(event.id)}>
                      <strong>{text(event.action).replaceAll('_', ' ').toLowerCase()}</strong>
                      <span>{when(event.createdAt)} · {text(event.actorType).toLowerCase()}{event.actorLabel ? ' · ' + text(event.actorLabel) : ''}</span>
                      {Boolean(event.fromState || event.toState) && <span>{text(event.fromState) || '—'} → {text(event.toState) || '—'}</span>}
                      {Boolean(event.reason) && <span>Reason: {text(event.reason)}</span>}
                      {Boolean(event.note) && <span>Note: {text(event.note)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <footer className="adm-dialog-foot">
          <button className="adm-button adm-secondary" disabled={Boolean(busy)} onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
