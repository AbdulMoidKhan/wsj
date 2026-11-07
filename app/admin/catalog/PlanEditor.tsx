'use client';
/**
 * Packages & Pricing. A dollar input is converted to integer cents before it is
 * sent, the billing duration decides how the amount is multiplied at checkout,
 * and the two notice fields are rendered verbatim on the public booking dialog.
 *
 * Changing a price here only affects new purchases: existing orders keep their
 * own amount snapshot and live subscriptions keep the price Stripe agreed to.
 */
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {AlertTriangle, Check, EyeOff, Globe, Pencil, Plus, Star, Trash2, X} from 'lucide-react';
import {request} from '../api';
import {BILLING_UNIT_OPTIONS, centsFromDollars, dollarsFromCents, money, slugify, unitBasis, type BillingUnit, type CatalogAddOn, type CatalogAmenity, type CatalogPlan, type CatalogService} from './types';

type Draft = Partial<CatalogPlan> & {priceDollars?: string};

export default function PlanEditor({
  services,
  addOns,
  amenities,
  canWrite,
  canManage,
  onChanged,
  onError,
}: {
  services: CatalogService[];
  addOns: CatalogAddOn[];
  amenities: CatalogAmenity[];
  canWrite: boolean;
  canManage: boolean;
  onChanged: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [serviceId, setServiceId] = useState('');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState<CatalogPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const list = services
      .filter(service => !serviceId || service.id === serviceId)
      .flatMap(service => service.plans.map(plan => ({plan, service})));
    return list.sort((a, b) => a.service.displayOrder - b.service.displayOrder || a.plan.sortOrder - b.plan.sortOrder || a.plan.unitAmountCents - b.plan.unitAmountCents);
  }, [services, serviceId]);

  async function toggleActive(plan: CatalogPlan) {
    setBusy(true);
    try {
      await request('/admin/catalog/plans/' + plan.id, {method: 'PATCH', body: JSON.stringify({active: !plan.active})});
      onChanged(plan.active ? '“' + plan.name + '” is hidden from the website.' : '“' + plan.name + '” is on sale now.');
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!confirming) return;
    setBusy(true);
    try {
      await request('/admin/catalog/plans/' + confirming.id, {method: 'DELETE'});
      setConfirming(null);
      onChanged('Archived “' + confirming.name + '”. Past orders and active subscriptions are untouched.');
    } catch (error) {
      onError(error);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adm-table-card cat-card" aria-label="Packages and pricing">
      <header className="cat-head">
        <div>
          <h2>Packages &amp; Pricing</h2>
          <p>{rows.length} packages. Prices are stored in whole cents and recomputed by the server at checkout.</p>
        </div>
        <div className="cat-head-actions">
          <select aria-label="Filter by service" value={serviceId} onChange={event => setServiceId(event.target.value)}>
            <option value="">All services</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          {canWrite && services.length > 0 && (
            <button className="adm-button adm-primary" onClick={() => setEditing({serviceId: serviceId || services[0].id, billingUnit: 'PER_MONTH', active: true, minQuantity: 1, maxQuantity: 1, priceDollars: '0.00', currency: 'usd'})}>
              <Plus size={17} />
              New package
            </button>
          )}
        </div>
      </header>
      <div className="adm-table-scroll" tabIndex={0} role="region" aria-label="Packages table">
        <table className="adm-table cat-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Service</th>
              <th>Price</th>
              <th>Billing</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>
                <span className="adm-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="adm-empty">
                    <strong>No packages for this filter</strong>
                    <p>Create a package to make this service bookable. Services with no packages show as “pricing on request”.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(({plan, service}) => (
                <tr key={plan.id}>
                  <td>
                    <div className="adm-row-name">
                      <span className="adm-row-avatar">{plan.name.charAt(0)}</span>
                      <div>
                        <strong>
                          {plan.name}
                          {plan.featured && (
                            <span className="cat-chip">
                              <Star size={11} /> Featured
                            </span>
                          )}
                        </strong>
                        <small>{plan.slug}</small>
                      </div>
                    </div>
                    {plan.adminFlagNote && (
                      <p className="cat-flag-inline">
                        <AlertTriangle size={13} /> {plan.adminFlagNote}
                      </p>
                    )}
                  </td>
                  <td>{service.name}</td>
                  <td className="cat-price">{money(plan.unitAmountCents, plan.currency)}</td>
                  <td>
                    <span className="cat-flow">{BILLING_UNIT_OPTIONS.find(option => option.value === plan.billingUnit)?.label ?? plan.billingUnit}</span>
                    {plan.maxQuantity > 1 && <small> ×1–{plan.maxQuantity}</small>}
                  </td>
                  <td>{plan.capacityText || '—'}</td>
                  <td>
                    <span className={'adm-badge adm-badge-' + (plan.archivedAt ? 'archived' : plan.active ? 'published' : 'draft')}>{plan.status}</span>
                  </td>
                  <td>
                    <div className="adm-row-actions">
                      {canWrite && (
                        <>
                          <button className={'adm-icon' + (plan.active ? '' : ' adm-publish')} disabled={busy} title={plan.active ? 'Take off sale' : 'Put on sale'} aria-label={(plan.active ? 'Hide ' : 'Publish ') + plan.name} onClick={() => void toggleActive(plan)}>
                            {plan.active ? <EyeOff size={16} /> : <Globe size={16} />}
                          </button>
                          <button className="adm-icon" aria-label={'Edit ' + plan.name} onClick={() => setEditing({...plan, priceDollars: dollarsFromCents(plan.unitAmountCents)})}>
                            <Pencil size={16} />
                          </button>
                        </>
                      )}
                      {canManage && (
                        <button className="adm-icon adm-danger" aria-label={'Archive ' + plan.name} disabled={busy} onClick={() => setConfirming(plan)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <PlanDialog
          draft={editing}
          services={services}
          addOns={addOns}
          amenities={amenities}
          onClose={() => setEditing(null)}
          onSaved={message => {
            setEditing(null);
            onChanged(message);
          }}
          onError={onError}
        />
      )}

      {confirming && (
        <div className="adm-overlay">
          <section className="adm-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cat-plan-archive">
            <span className="adm-delete-icon">
              <Trash2 size={24} />
            </span>
            <h2 id="cat-plan-archive">Archive this package?</h2>
            <p>“{confirming.name}” can no longer be bought. Past orders keep their price and any active subscription keeps billing at the price it was created with.</p>
            <div className="adm-actions">
              <button className="adm-button adm-secondary" disabled={busy} onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button autoFocus className="adm-button adm-delete" disabled={busy} onClick={() => void archive()}>
                {busy ? 'Archiving…' : 'Archive package'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function PlanDialog({
  draft: initial,
  services,
  addOns,
  amenities,
  onClose,
  onSaved,
  onError,
}: {
  draft: Draft;
  services: CatalogService[];
  addOns: CatalogAddOn[];
  amenities: CatalogAmenity[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial.id);
  const change = (key: keyof Draft, value: unknown) => setDraft(current => ({...current, [key]: value}));
  const unit = (draft.billingUnit || 'ONE_TIME') as BillingUnit;
  const basis = unitBasis(unit);
  const option = BILLING_UNIT_OPTIONS.find(entry => entry.value === unit);
  const service = services.find(entry => entry.id === draft.serviceId);

  /* Assignments are stored per package, so they are edited after the row exists. */
  const [planAddOns, setPlanAddOns] = useState<string[]>(initial.addOnIds ?? []);
  const [planAmenities, setPlanAmenities] = useState<string[]>(initial.amenityIds ?? []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, saving]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const slug = slugify(String(draft.slug || draft.name || ''));
    const cents = centsFromDollars(draft.priceDollars);
    if (!slug) {
      setError('Enter a package name so a URL slug can be generated.');
      return;
    }
    if (!draft.serviceId) {
      setError('Choose the service this package belongs to.');
      return;
    }
    if (!Number.isInteger(cents) || cents < 0) {
      setError('Enter a valid price, for example 150.00');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug,
        serviceId: draft.serviceId,
        name: String(draft.name || '').trim(),
        description: String(draft.description || ''),
        unitAmountCents: cents,
        currency: String(draft.currency || 'usd').toLowerCase(),
        billingUnit: unit,
        durationMinutes: Number(draft.durationMinutes || 0),
        durationDays: Number(draft.durationDays || 0),
        minQuantity: Math.max(1, Number(draft.minQuantity || 1)),
        maxQuantity: Math.max(1, Number(draft.maxQuantity || draft.minQuantity || 1)),
        capacityText: String(draft.capacityText || ''),
        capacityMin: Number(draft.capacityMin || 0),
        capacityMax: Number(draft.capacityMax || 0),
        featured: draft.featured === true,
        active: draft.active !== false,
        sortOrder: Number(draft.sortOrder || 0),
        rulesNotice: String(draft.rulesNotice || ''),
        governmentNotice: String(draft.governmentNotice || ''),
        adminFlagNote: String(draft.adminFlagNote || ''),
      };
      const saved = await request<{id: string}>('/admin/catalog/plans' + (editing ? '/' + initial.id : ''), {method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload)});
      const planId = saved?.id || initial.id;

      /* Reconcile package-level add-on and amenity attachments. */
      if (planId) {
        const beforeAddOns = initial.addOnIds ?? [];
        for (const addOnId of planAddOns.filter(id => !beforeAddOns.includes(id))) await request('/admin/catalog/addons/assign-plan', {method: 'POST', body: JSON.stringify({planId, addOnId})});
        for (const addOnId of beforeAddOns.filter(id => !planAddOns.includes(id))) await request('/admin/catalog/addons/unassign', {method: 'DELETE', body: JSON.stringify({planId, addOnId})});
        const beforeAmenities = initial.amenityIds ?? [];
        for (const amenityId of planAmenities.filter(id => !beforeAmenities.includes(id))) await request('/admin/catalog/amenities/assign', {method: 'POST', body: JSON.stringify({planId, amenityId})});
        for (const amenityId of beforeAmenities.filter(id => !planAmenities.includes(id))) await request('/admin/catalog/amenities/unassign', {method: 'DELETE', body: JSON.stringify({planId, amenityId})});
      }
      onSaved(editing ? 'Saved “' + payload.name + '”. New purchases use this price immediately.' : 'Created “' + payload.name + '”. It is on sale now.');
    } catch (saveError) {
      onError(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this package.');
    } finally {
      setSaving(false);
    }
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(entry => entry !== id) : [...list, id]);
  const preview = money(centsFromDollars(draft.priceDollars), String(draft.currency || 'usd'));

  return (
    <div className="adm-overlay" onClick={event => {if (event.target === event.currentTarget && !saving) onClose();}}>
      <section className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="cat-plan-title">
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">PACKAGES &amp; PRICING</span>
            <h2 id="cat-plan-title">{editing ? 'Edit package' : 'New package'}</h2>
          </div>
          <button className="adm-icon" aria-label="Close editor" disabled={saving} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form onSubmit={save} className="adm-edit-form">
          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Package name</span>
              <input required value={String(draft.name || '')} onChange={event => change('name', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>URL slug</span>
              <input required value={String(draft.slug || '')} placeholder={slugify(String(draft.name || ''))} onChange={event => change('slug', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Service category</span>
              <select value={String(draft.serviceId || '')} onChange={event => change('serviceId', event.target.value)}>
                {services.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>Price (dollars)</span>
              <input type="number" step="0.01" min="0" required value={String(draft.priceDollars ?? '')} onChange={event => change('priceDollars', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Billing duration</span>
              <select value={unit} onChange={event => change('billingUnit', event.target.value)}>
                {BILLING_UNIT_OPTIONS.map(entry => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>Currency</span>
              <input value={String(draft.currency || 'usd')} maxLength={3} onChange={event => change('currency', event.target.value)} />
            </label>
            <p className="adm-span adm-help cat-price-preview">
              Charged as <strong>{preview}</strong> {option?.label}. {option?.hint}
              {basis === 'HOURS' && ' The customer picks the hours and the server multiplies this amount.'}
              {basis === 'FLAT' && unit !== 'PER_MONTH' && unit !== 'PER_YEAR' && ' Quantity above 1 is only offered when you raise the maximum below.'}
            </p>
            <label className="adm-field">
              <span>{basis === 'HOURS' ? 'Minimum hours' : basis === 'DAYS' ? 'Minimum days' : 'Minimum quantity'}</span>
              <input type="number" min={1} value={Number(draft.minQuantity || 1)} onChange={event => change('minQuantity', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>{basis === 'HOURS' ? 'Maximum hours (1–24)' : basis === 'DAYS' ? 'Maximum days' : 'Maximum quantity'}</span>
              <input type="number" min={1} max={basis === 'HOURS' ? 24 : 500} value={Number(draft.maxQuantity || 1)} onChange={event => change('maxQuantity', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Reservation length (minutes)</span>
              <input type="number" min={0} value={Number(draft.durationMinutes || 0)} onChange={event => change('durationMinutes', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Validity (days)</span>
              <input type="number" min={0} value={Number(draft.durationDays || 0)} onChange={event => change('durationDays', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Capacity label</span>
              <input value={String(draft.capacityText || '')} placeholder="Up to 6 people" onChange={event => change('capacityText', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Attendees from</span>
              <input type="number" min={0} value={Number(draft.capacityMin || 0)} onChange={event => change('capacityMin', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Attendees up to</span>
              <input type="number" min={0} value={Number(draft.capacityMax || 0)} onChange={event => change('capacityMax', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Sort order</span>
              <input type="number" value={Number(draft.sortOrder || 0)} onChange={event => change('sortOrder', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Highlight as featured</span>
              <input type="checkbox" checked={draft.featured === true} onChange={event => change('featured', event.target.checked)} />
            </label>
            <label className="adm-field">
              <span>Available for sale</span>
              <input type="checkbox" checked={draft.active !== false} onChange={event => change('active', event.target.checked)} />
            </label>
            <div className="adm-span">
              <label className="adm-field">
                <span>Description</span>
                <textarea rows={2} value={String(draft.description || '')} onChange={event => change('description', event.target.value)} />
              </label>
            </div>
            <div className="adm-span">
              <label className="adm-field">
                <span>Usage &amp; validity rule</span>
                <textarea rows={2} placeholder="Unused days expire at the end of the monthly validity period and do not roll over." value={String(draft.rulesNotice || '')} onChange={event => change('rulesNotice', event.target.value)} />
              </label>
              <small className="adm-help">Shown as a rule pill under the packages of this service.</small>
            </div>
            <div className="adm-span">
              <label className="adm-field">
                <span>Government &amp; state fee disclosure</span>
                <textarea rows={2} placeholder="The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state." value={String(draft.governmentNotice || '')} onChange={event => change('governmentNotice', event.target.value)} />
              </label>
              <small className="adm-help">Rendered directly under the price whenever this package is selected.</small>
            </div>
            <div className="adm-span">
              <label className="adm-field">
                <span>Internal review note (never shown publicly)</span>
                <input value={String(draft.adminFlagNote || '')} onChange={event => change('adminFlagNote', event.target.value)} />
              </label>
            </div>

            <div className="adm-span cat-assign">
              <span className="cat-label">Package add-ons</span>
              <p className="adm-help">
                {service ? 'Add-ons already attached to ' + service.name + ' are offered automatically. Tick an extra one to attach it to this package only.' : 'Attach add-ons to this package only.'}
              </p>
              <div className="cat-check-grid">
                {addOns.filter(addOn => addOn.active).map(addOn => {
                  const inherited = service?.addOnIds.includes(addOn.id) ?? false;
                  const on = planAddOns.includes(addOn.id);
                  return (
                    <button type="button" key={addOn.id} className={'cat-check' + (on ? ' is-on' : '') + (inherited ? ' is-inherited' : '')} aria-pressed={on} onClick={() => setPlanAddOns(current => toggle(current, addOn.id))}>
                      <span className="cat-check-box">{on && <Check size={12} strokeWidth={3} />}</span>
                      <span>
                        <strong>{addOn.name}</strong>
                        <small>
                          {money(addOn.unitAmountCents, addOn.currency)} {BILLING_UNIT_OPTIONS.find(entry => entry.value === addOn.billingUnit)?.label}
                          {inherited ? ' · from service' : ''}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="adm-span cat-assign">
              <span className="cat-label">Package amenities</span>
              <div className="cat-check-grid">
                {amenities.filter(amenity => amenity.active).map(amenity => {
                  const inherited = service?.amenityIds.includes(amenity.id) ?? false;
                  const on = planAmenities.includes(amenity.id);
                  return (
                    <button type="button" key={amenity.id} className={'cat-check' + (on ? ' is-on' : '') + (inherited ? ' is-inherited' : '')} aria-pressed={on} onClick={() => setPlanAmenities(current => toggle(current, amenity.id))}>
                      <span className="cat-check-box">{on && <Check size={12} strokeWidth={3} />}</span>
                      <span>
                        <strong>{amenity.name}</strong>
                        {inherited ? <small>from service</small> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {error && (
            <div role="alert" className="adm-alert">
              {error}
            </div>
          )}
          <footer className="adm-dialog-foot">
            <button type="button" className="adm-button adm-secondary" disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button className="adm-button adm-primary" disabled={saving}>
              {saving ? 'Saving…' : (<><Check size={16} />Save package</>)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
