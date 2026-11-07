'use client';
import {useEffect} from 'react';
import {X, Calendar, User, Tag, DollarSign} from 'lucide-react';

type Json = Record<string, unknown>;

function money(minor: unknown, currency: unknown = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
  }).format(Number(minor || 0) / 100);
}

function formatDate(iso: unknown) {
  if (!iso) return '—';
  try {
    return new Date(String(iso)).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

export function OrderDetailModal({item, onClose}: {item: Json; onClose: () => void}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = oldOverflow;
    };
  }, [onClose]);

  const items = Array.isArray(item.items) ? (item.items as Json[]) : [];
  const meta = (item.metadata || {}) as Json;
  const schedule = Array.isArray(meta.schedule) ? (meta.schedule as Json[]) : [];
  const circle = String(meta.membershipCircle || item.membershipCircle || '');

  return (
    <div className="adm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <section className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title" style={{maxWidth: 780}}>
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">ORDER &amp; RESERVATION INSPECTOR</span>
            <h2 id="order-dialog-title">Order #{String(item.id).slice(0, 8)}</h2>
          </div>
          <button className="adm-icon" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="adm-content" style={{padding: '24px 28px', maxHeight: '78vh', overflowY: 'auto'}}>
          {/* Status & Highlights */}
          <div style={{display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap'}}>
            <span className={`adm-badge adm-badge-${String(item.status || '').toLowerCase()}`} style={{fontSize: 13, padding: '6px 14px'}}>
              {String(item.status || 'PENDING')}
            </span>
            <span className="adm-badge" style={{fontSize: 13, padding: '6px 14px', background: 'var(--bk-sand)'}}>
              {item.mode === 'SUBSCRIPTION' ? 'Recurring Subscription' : 'One-Time Payment'}
            </span>
            {Boolean(item.paymentMethod) && (
              <span className="adm-badge" style={{fontSize: 13, padding: '6px 14px', background: '#eef1ea'}}>
                Method: {String(item.paymentMethod)}
              </span>
            )}
            <span style={{fontSize: 13, color: 'var(--adm-muted)', marginLeft: 'auto'}}>
              Placed: {formatDate(item.createdAt)}
            </span>
          </div>

          {/* Customer Card */}
          <div className="adm-card" style={{padding: '18px 20px', background: '#fff', border: '1px solid var(--adm-border)', borderRadius: 5, marginBottom: 20}}>
            <h3 style={{fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--adm-green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8}}>
              <User size={16} /> Customer Details
            </h3>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
              <div>
                <small style={{color: 'var(--adm-muted)', display: 'block', fontSize: 12}}>Full Name</small>
                <strong style={{fontSize: 15}}>{String(item.customerName || item.title || 'Guest')}</strong>
              </div>
              <div>
                <small style={{color: 'var(--adm-muted)', display: 'block', fontSize: 12}}>Email Address</small>
                <strong style={{fontSize: 15}}>{String(item.customerEmail || item.email || '—')}</strong>
              </div>
            </div>
            {circle && (
              <div style={{marginTop: 12, paddingTop: 10, borderTop: '1px solid #eeeadd'}}>
                <small style={{color: 'var(--adm-muted)', display: 'block', fontSize: 12}}>Industry Membership Circle</small>
                <strong style={{fontSize: 14, color: '#d9910b'}}>{circle}</strong>
              </div>
            )}
          </div>

          {/* Purchased Line Items */}
          <div className="adm-card" style={{padding: '18px 20px', background: '#fff', border: '1px solid var(--adm-border)', borderRadius: 5, marginBottom: 20}}>
            <h3 style={{fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--adm-green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8}}>
              <Tag size={16} /> Purchased Services &amp; Packages
            </h3>
            {items.length === 0 ? (
              <p style={{margin: 0, color: 'var(--adm-muted)', fontSize: 14}}>{String(item.excerpt || 'No line items recorded.')}</p>
            ) : (
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 14}}>
                <thead>
                  <tr style={{borderBottom: '1px solid var(--adm-border)', textAlign: 'left', color: 'var(--adm-muted)'}}>
                    <th style={{padding: '6px 0'}}>Item</th>
                    <th style={{padding: '6px 8px', textAlign: 'center'}}>Qty</th>
                    <th style={{padding: '6px 0', textAlign: 'right'}}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((line, idx) => (
                    <tr key={idx} style={{borderBottom: '1px solid #f2ede4'}}>
                      <td style={{padding: '10px 0'}}>
                        <strong>{String(line.description || line.name || 'Service')}</strong>
                        {line.billingType === 'RECURRING' && (
                          <small style={{display: 'block', color: 'var(--adm-muted)'}}>Renews every {String(line.interval || 'month').toLowerCase()}</small>
                        )}
                      </td>
                      <td style={{padding: '10px 8px', textAlign: 'center'}}>{String(line.quantity || 1)}</td>
                      <td style={{padding: '10px 0', textAlign: 'right', fontWeight: 600}}>
                        {money(line.amount || line.unitAmount, line.currency || item.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Schedule & Timing */}
          {schedule.length > 0 && (
            <div className="adm-card" style={{padding: '18px 20px', background: '#fff', border: '1px solid var(--adm-border)', borderRadius: 5, marginBottom: 20}}>
              <h3 style={{fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--adm-green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8}}>
                <Calendar size={16} /> Scheduled Reservation Window
              </h3>
              {schedule.map((slot, sIdx) => (
                <div key={sIdx} style={{display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0'}}>
                  <span>{String(slot.planSlug)}</span>
                  <strong>{formatDate(slot.startAt)}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Pricing Breakdown */}
          <div className="adm-card" style={{padding: '18px 20px', background: 'var(--bk-canvas)', border: '1px solid var(--adm-border)', borderRadius: 5, marginBottom: 20}}>
            <h3 style={{fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--adm-green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8}}>
              <DollarSign size={16} /> Financial Breakdown
            </h3>
            <div style={{display: 'grid', gap: 8, fontSize: 14}}>
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <span style={{color: 'var(--adm-muted)'}}>Subtotal</span>
                <span>{money(item.subtotalAmount || item.totalPrice || item.dueNowAmount, item.currency)}</span>
              </div>
              {Number(item.discountAmount) > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', color: '#214d3e'}}>
                  <span>Discount ({String(item.couponCode || 'PROMO')})</span>
                  <span>−{money(item.discountAmount, item.currency)}</span>
                </div>
              )}
              <div style={{display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--adm-border)', fontSize: 17, fontWeight: 700}}>
                <span>Total Due Now</span>
                <span style={{color: '#193c32'}}>{money(item.dueNowAmount || item.totalAmount || item.totalPrice, item.currency)}</span>
              </div>
              {Number(item.recurringAmount) > 0 && (
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--adm-muted)', marginTop: 2}}>
                  <span>Recurring Commitment</span>
                  <span>{money(item.recurringAmount, item.currency)} / {String(item.recurringInterval || 'month').toLowerCase()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stripe Identifiers */}
          <div className="adm-card" style={{padding: '16px 20px', background: '#fff', border: '1px dashed var(--adm-border)', borderRadius: 5, fontSize: 13}}>
            <h4 style={{margin: '0 0 8px', fontSize: 12, textTransform: 'uppercase', color: 'var(--adm-muted)'}}>Stripe &amp; Gateway References</h4>
            <div style={{display: 'grid', gap: 4, wordBreak: 'break-all', fontFamily: 'monospace', color: '#333'}}>
              {Boolean(item.stripeCheckoutSessionId) && <div>Session: {String(item.stripeCheckoutSessionId)}</div>}
              {Boolean(item.stripePaymentIntentId) && <div>PaymentIntent: {String(item.stripePaymentIntentId)}</div>}
              {Boolean(item.stripeSubscriptionId) && <div>Subscription: {String(item.stripeSubscriptionId)}</div>}
              {Boolean(item.customerId) && <div>Internal Customer ID: {String(item.customerId)}</div>}
            </div>
          </div>
        </div>

        <footer className="adm-dialog-foot" style={{padding: '16px 28px', borderTop: '1px solid var(--adm-border)', display: 'flex', justifyContent: 'flex-end', gap: 10}}>
          <button type="button" className="adm-button adm-primary" onClick={onClose}>
            Close Inspector
          </button>
        </footer>
      </section>
    </div>
  );
}
