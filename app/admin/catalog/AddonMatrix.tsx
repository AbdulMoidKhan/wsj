'use client';
/**
 * Add-Ons Library and the service × add-on assignment matrix.
 *
 * An add-on is defined once and attached anywhere. Each attachment can carry
 * its own price override, so the same "Co-Working Space" entry can sell at $50
 * a month with one service and as a $30 pass with another.
 */
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {AlertTriangle, Check, Pencil, Plus, Trash2, X} from 'lucide-react';
import {request} from '../api';
import {BILLING_UNIT_OPTIONS, centsFromDollars, dollarsFromCents, money, slugify, type BillingUnit, type CatalogAddOn, type CatalogService} from './types';

type Draft = Partial<CatalogAddOn> & {priceDollars?: string};

export default function AddonMatrix({services, addOns, canWrite, canManage, onChanged, onError}: {services: CatalogService[]; addOns: CatalogAddOn[]; canWrite: boolean; canManage: boolean; onChanged: (message: string) => void; onError: (error: unknown) => void}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [override, setOverride] = useState<{addOn: CatalogAddOn; service: CatalogService} | null>(null);
  const [busy, setBusy] = useState('');
  const flagged = useMemo(() => addOns.filter(addOn => addOn.adminFlagNote), [addOns]);
  const sortedServices = useMemo(() => [...services].sort((a, b) => a.displayOrder - b.displayOrder), [services]);

  async function toggleAssignment(addOn: CatalogAddOn, service: CatalogService) {
    const key = addOn.id + ':' + service.id;
    setBusy(key);
    try {
      if (addOn.serviceIds.includes(service.id)) {
        await request('/admin/catalog/addons/unassign', {method: 'DELETE', body: JSON.stringify({serviceId: service.id, addOnId: addOn.id})});
        onChanged('Detached “' + addOn.name + '” from ' + service.name + '.');
      } else {
        await request('/admin/catalog/addons/assign-service', {method: 'POST', body: JSON.stringify({serviceId: service.id, addOnId: addOn.id})});
        onChanged('Attached “' + addOn.name + '” to ' + service.name + '.');
      }
    } catch (error) {
      onError(error);
    } finally {
      setBusy('');
    }
  }

  const assignmentFor = (addOn: CatalogAddOn, serviceId: string) => addOn.assignments.find(entry => entry.scope === 'SERVICE' && entry.id === serviceId);

  return (
    <section className="adm-table-card cat-card" aria-label="Add-ons library">
      <header className="cat-head">
        <div>
          <h2>Add-Ons Library</h2>
          <p>{addOns.length} reusable add-ons. Define once, attach to any service or package, override the price where needed.</p>
        </div>
        {canWrite && (
          <button className="adm-button adm-primary" onClick={() => setEditing({billingUnit: 'ONE_TIME', active: true, minQuantity: 0, maxQuantity: 1, defaultQuantity: 1, currency: 'usd', priceDollars: '0.00'})}>
            <Plus size={17} />
            New add-on
          </button>
        )}
      </header>

      {flagged.length > 0 && (
        <div className="cat-flag" role="status">
          <AlertTriangle size={18} />
          <div>
            <strong>Admin review flag</strong>
            {flagged.map(addOn => (
              <p key={addOn.id}>
                <button type="button" className="adm-text-button" onClick={() => setEditing({...addOn, priceDollars: dollarsFromCents(addOn.unitAmountCents)})}>
                  {addOn.name}
                </button>{' '}
                — {addOn.adminFlagNote} Click the name to confirm or adjust the rate.
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="cat-grid">
        {addOns.map(addOn => (
          <article key={addOn.id} className={'cat-addon' + (addOn.active ? '' : ' is-off')}>
            <header>
              <strong>{addOn.name}</strong>
              <span className="cat-price">{money(addOn.unitAmountCents, addOn.currency)}</span>
            </header>
            <p>{addOn.description || 'No description yet.'}</p>
            <footer>
              <span className="cat-flow">{BILLING_UNIT_OPTIONS.find(entry => entry.value === addOn.billingUnit)?.label ?? addOn.billingUnit}</span>
              <span className="cat-meta">
                {addOn.serviceIds.length} service{addOn.serviceIds.length === 1 ? '' : 's'} · {addOn.planIds.length} package{addOn.planIds.length === 1 ? '' : 's'}
              </span>
              {canWrite && (
                <button className="adm-icon" aria-label={'Edit ' + addOn.name} onClick={() => setEditing({...addOn, priceDollars: dollarsFromCents(addOn.unitAmountCents)})}>
                  <Pencil size={15} />
                </button>
              )}
            </footer>
            {addOn.adminFlagNote && (
              <p className="cat-flag-inline">
                <AlertTriangle size={13} /> Needs review
              </p>
            )}
          </article>
        ))}
        {addOns.length === 0 && (
          <div className="adm-empty">
            <strong>No add-ons yet</strong>
            <p>Create a reusable add-on, then attach it to services in the matrix below.</p>
          </div>
        )}
      </div>

      <div className="cat-head cat-subhead">
        <div>
          <h3>Assignment matrix</h3>
          <p>Tick a cell to offer that add-on with that service. The customer sees it in the Extras step straight away.</p>
        </div>
      </div>
      <div className="adm-table-scroll cat-matrix-scroll" tabIndex={0} role="region" aria-label="Add-on assignment matrix">
        <table className="adm-table cat-matrix">
          <thead>
            <tr>
              <th scope="col">Service</th>
              {addOns.map(addOn => (
                <th key={addOn.id} scope="col">
                  <span className="cat-matrix-label">{addOn.name}</span>
                  <small>{money(addOn.unitAmountCents, addOn.currency)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedServices.map(service => (
              <tr key={service.id}>
                <th scope="row">
                  <strong>{service.name}</strong>
                  <small>{service.slug}</small>
                </th>
                {addOns.map(addOn => {
                  const on = addOn.serviceIds.includes(service.id);
                  const link = assignmentFor(addOn, service.id);
                  const key = addOn.id + ':' + service.id;
                  return (
                    <td key={addOn.id} className={on ? 'is-on' : ''}>
                      <button
                        type="button"
                        className={'cat-cell' + (on ? ' is-on' : '')}
                        role="checkbox"
                        aria-checked={on}
                        aria-label={(on ? 'Detach ' : 'Attach ') + addOn.name + ' ' + (on ? 'from ' : 'to ') + service.name}
                        disabled={!canWrite || busy === key}
                        onClick={() => void toggleAssignment(addOn, service)}
                      >
                        {on && <Check size={13} strokeWidth={3} />}
                      </button>
                      {on && (
                        <button type="button" className="cat-override" disabled={!canWrite} onClick={() => setOverride({addOn, service})}>
                          {link?.priceOverrideCents != null ? money(link.priceOverrideCents, addOn.currency) : 'list'}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <AddOnDialog draft={editing} canManage={canManage} onClose={() => setEditing(null)} onSaved={message => {setEditing(null); onChanged(message);}} onError={onError} />}
      {override && (
        <OverrideDialog
          addOn={override.addOn}
          service={override.service}
          current={assignmentFor(override.addOn, override.service.id) ?? null}
          onClose={() => setOverride(null)}
          onSaved={message => {
            setOverride(null);
            onChanged(message);
          }}
          onError={onError}
        />
      )}
    </section>
  );
}

function OverrideDialog({
  addOn,
  service,
  current,
  onClose,
  onSaved,
  onError,
}: {
  addOn: CatalogAddOn;
  service: CatalogService;
  current: {priceOverrideCents: number | null; isRequired: boolean} | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [useOverride, setUseOverride] = useState(current?.priceOverrideCents != null);
  const [price, setPrice] = useState(dollarsFromCents(current?.priceOverrideCents ?? addOn.unitAmountCents));
  const [required, setRequired] = useState(current?.isRequired === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await request('/admin/catalog/addons/assign-service', {
        method: 'POST',
        body: JSON.stringify({serviceId: service.id, addOnId: addOn.id, isRequired: required, ...(useOverride ? {priceOverrideCents: centsFromDollars(price)} : {})}),
      });
      onSaved('Updated “' + addOn.name + '” for ' + service.name + '.');
    } catch (saveError) {
      onError(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this assignment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-overlay" onClick={event => {if (event.target === event.currentTarget && !saving) onClose();}}>
      <section className="adm-dialog cat-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="cat-override-title">
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">ASSIGNMENT</span>
            <h2 id="cat-override-title">
              {addOn.name} · {service.name}
            </h2>
          </div>
          <button className="adm-icon" aria-label="Close" disabled={saving} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form onSubmit={save} className="adm-edit-form">
          <div className="adm-form-grid">
            <p className="adm-span adm-help">
              Library price is {money(addOn.unitAmountCents, addOn.currency)} {BILLING_UNIT_OPTIONS.find(entry => entry.value === addOn.billingUnit)?.label}. An override applies only to {service.name}.
            </p>
            <label className="adm-field">
              <span>Use a custom price here</span>
              <input type="checkbox" checked={useOverride} onChange={event => setUseOverride(event.target.checked)} />
            </label>
            {useOverride && (
              <label className="adm-field">
                <span>Custom price (dollars)</span>
                <input type="number" step="0.01" min="0" value={price} onChange={event => setPrice(event.target.value)} />
              </label>
            )}
            <label className="adm-field">
              <span>Always included (required)</span>
              <input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} />
            </label>
            {!useOverride && current?.priceOverrideCents != null && <p className="adm-span adm-help">Saving now clears the existing override and falls back to the library price.</p>}
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
              {saving ? 'Saving…' : 'Save assignment'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AddOnDialog({draft: initial, canManage, onClose, onSaved, onError}: {draft: Draft; canManage: boolean; onClose: () => void; onSaved: (message: string) => void; onError: (error: unknown) => void}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial.id);
  const change = (key: keyof Draft, value: unknown) => setDraft(current => ({...current, [key]: value}));
  const unit = (draft.billingUnit || 'ONE_TIME') as BillingUnit;
  const option = BILLING_UNIT_OPTIONS.find(entry => entry.value === unit);

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
      setError('Enter a name so a slug can be generated.');
      return;
    }
    if (!Number.isInteger(cents) || cents < 0) {
      setError('Enter a valid unit price.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug,
        name: String(draft.name || '').trim(),
        description: String(draft.description || ''),
        unitAmountCents: cents,
        currency: String(draft.currency || 'usd').toLowerCase(),
        billingUnit: unit,
        minQuantity: Math.max(0, Number(draft.minQuantity ?? 0)),
        maxQuantity: Math.max(1, Number(draft.maxQuantity ?? 1)),
        defaultQuantity: Math.max(0, Number(draft.defaultQuantity ?? 1)),
        imageUrl: String(draft.imageUrl || ''),
        active: draft.active !== false,
        adminFlagNote: String(draft.adminFlagNote || ''),
      };
      await request('/admin/catalog/addons' + (editing ? '/' + initial.id : ''), {method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload)});
      onSaved(editing ? 'Saved “' + payload.name + '”.' : 'Created “' + payload.name + '”. Attach it to a service in the matrix.');
    } catch (saveError) {
      onError(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this add-on.');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    setSaving(true);
    try {
      await request('/admin/catalog/addons/' + initial.id, {method: 'DELETE'});
      onSaved('Archived “' + initial.name + '”. Existing orders keep their price.');
    } catch (archiveError) {
      onError(archiveError);
      setError(archiveError instanceof Error ? archiveError.message : 'Could not archive this add-on.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-overlay" onClick={event => {if (event.target === event.currentTarget && !saving) onClose();}}>
      <section className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="cat-addon-title">
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">ADD-ONS LIBRARY</span>
            <h2 id="cat-addon-title">{editing ? 'Edit add-on' : 'New add-on'}</h2>
          </div>
          <button className="adm-icon" aria-label="Close editor" disabled={saving} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form onSubmit={save} className="adm-edit-form">
          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Add-on name</span>
              <input required value={String(draft.name || '')} onChange={event => change('name', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Slug</span>
              <input required value={String(draft.slug || '')} placeholder={slugify(String(draft.name || ''))} onChange={event => change('slug', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Unit price (dollars)</span>
              <input type="number" step="0.01" min="0" required value={String(draft.priceDollars ?? '')} onChange={event => change('priceDollars', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Billing type</span>
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
            <label className="adm-field">
              <span>Available for sale</span>
              <input type="checkbox" checked={draft.active !== false} onChange={event => change('active', event.target.checked)} />
            </label>
            <p className="adm-span adm-help">{option?.hint}</p>
            <label className="adm-field">
              <span>Minimum quantity</span>
              <input type="number" min={0} value={Number(draft.minQuantity ?? 0)} onChange={event => change('minQuantity', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Maximum quantity</span>
              <input type="number" min={1} value={Number(draft.maxQuantity ?? 1)} onChange={event => change('maxQuantity', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Default quantity</span>
              <input type="number" min={0} value={Number(draft.defaultQuantity ?? 1)} onChange={event => change('defaultQuantity', Number(event.target.value))} />
            </label>
            <div className="adm-span">
              <label className="adm-field">
                <span>Description</span>
                <textarea rows={2} value={String(draft.description || '')} onChange={event => change('description', event.target.value)} />
              </label>
            </div>
            <div className="adm-span">
              <label className="adm-field">
                <span>Admin review flag (never shown publicly)</span>
                <input value={String(draft.adminFlagNote || '')} placeholder="Conflicting rate documented; confirm before promoting." onChange={event => change('adminFlagNote', event.target.value)} />
              </label>
              <small className="adm-help">Any text here raises the yellow attention banner on this screen until you clear it.</small>
            </div>
          </div>
          {error && (
            <div role="alert" className="adm-alert">
              {error}
            </div>
          )}
          <footer className="adm-dialog-foot">
            {editing && canManage && (
              <button type="button" className="adm-button adm-delete cat-foot-left" disabled={saving} onClick={() => void archive()}>
                <Trash2 size={15} />
                Archive
              </button>
            )}
            <button type="button" className="adm-button adm-secondary" disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button className="adm-button adm-primary" disabled={saving}>
              {saving ? 'Saving…' : (<><Check size={16} />Save add-on</>)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
