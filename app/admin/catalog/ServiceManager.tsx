'use client';
/**
 * Services & Categories. Create a service, reorder it, switch its booking flow
 * and publish or hide it from the public site. Nothing here is hardcoded in the
 * website: the public catalog endpoints read exactly these rows.
 */
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {ArrowDown, ArrowUp, Check, EyeOff, Globe, Image as ImageIcon, Pencil, Plus, Trash2, Upload, X} from 'lucide-react';
import {API, request} from '../api';
import {CUSTOM_STEP_OPTIONS, FLOW_OPTIONS, slugify, type CatalogService, type FlowType} from './types';

type Draft = Partial<CatalogService> & {customStepList?: string[]};

const absolute = (url: string) => (url.startsWith('/') && typeof window !== 'undefined' ? new URL(API, window.location.origin).origin + url : url);

export default function ServiceManager({services, canWrite, canManage, onChanged, onError}: {services: CatalogService[]; canWrite: boolean; canManage: boolean; onChanged: (message: string) => void; onError: (error: unknown) => void}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<CatalogService | null>(null);
  const ordered = useMemo(() => [...services].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)), [services]);

  async function move(service: CatalogService, direction: -1 | 1) {
    const index = ordered.findIndex(entry => entry.id === service.id);
    const swapWith = ordered[index + direction];
    if (!swapWith) return;
    setBusy(true);
    try {
      await request('/admin/catalog/services/reorder', {
        method: 'POST',
        body: JSON.stringify({items: [{id: service.id, displayOrder: swapWith.displayOrder}, {id: swapWith.id, displayOrder: service.displayOrder}]}),
      });
      onChanged('Reordered. The public service list follows this order.');
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(service: CatalogService) {
    setBusy(true);
    try {
      await request('/admin/catalog/services/' + service.id, {method: 'PATCH', body: JSON.stringify({active: !service.active})});
      onChanged(service.active ? '“' + service.name + '” is now hidden from the website.' : '“' + service.name + '” is live on the website now.');
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
      await request('/admin/catalog/services/' + confirming.id, {method: 'DELETE'});
      setConfirming(null);
      onChanged('Archived “' + confirming.name + '”. Its packages and order history are kept.');
    } catch (error) {
      onError(error);
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adm-table-card cat-card" aria-label="Services and categories">
      <header className="cat-head">
        <div>
          <h2>Services &amp; Categories</h2>
          <p>{ordered.length} services drive the public site, the booking wizard and every quote.</p>
        </div>
        {canWrite && (
          <button className="adm-button adm-primary" onClick={() => setEditing({flowType: 'STANDARD', active: true, displayOrder: (ordered.at(-1)?.displayOrder ?? 0) + 1, iconName: 'Layers'})}>
            <Plus size={17} />
            New service
          </button>
        )}
      </header>
      <div className="adm-table-scroll" tabIndex={0} role="region" aria-label="Services table">
        <table className="adm-table cat-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Service</th>
              <th>Booking flow</th>
              <th>Packages</th>
              <th>Status</th>
              <th>
                <span className="adm-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="adm-empty">
                    <strong>No services yet</strong>
                    <p>Create your first service, or run the catalog seed to load the 13 published services.</p>
                  </div>
                </td>
              </tr>
            ) : (
              ordered.map((service, index) => (
                <tr key={service.id}>
                  <td>
                    <div className="cat-order">
                      <button className="adm-icon" aria-label={'Move ' + service.name + ' up'} disabled={busy || index === 0 || !canWrite} onClick={() => void move(service, -1)}>
                        <ArrowUp size={15} />
                      </button>
                      <span>{service.displayOrder}</span>
                      <button className="adm-icon" aria-label={'Move ' + service.name + ' down'} disabled={busy || index === ordered.length - 1 || !canWrite} onClick={() => void move(service, 1)}>
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="adm-row-name">
                      {service.heroImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img className="cat-thumb" src={absolute(service.heroImageUrl)} alt="" />
                      ) : (
                        <span className="adm-row-avatar">{service.name.charAt(0)}</span>
                      )}
                      <div>
                        <strong>
                          {service.name}
                          {service.categoryBadge ? <span className="cat-chip">{service.categoryBadge}</span> : null}
                        </strong>
                        <small>
                          {service.slug} · icon {service.iconName}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="cat-flow">{FLOW_OPTIONS.find(option => option.value === service.flowType)?.label ?? service.flowType}</span>
                  </td>
                  <td>
                    {service.activePlanCount} active
                    {service.planCount !== service.activePlanCount ? <small> / {service.planCount} total</small> : null}
                  </td>
                  <td>
                    <span className={'adm-badge adm-badge-' + (service.archivedAt ? 'archived' : service.active ? 'published' : 'draft')}>{service.status}</span>
                  </td>
                  <td>
                    <div className="adm-row-actions">
                      {canWrite && (
                        <>
                          <button className={'adm-icon' + (service.active ? '' : ' adm-publish')} disabled={busy} title={service.active ? 'Hide from the website' : 'Show on the website'} aria-label={(service.active ? 'Hide ' : 'Publish ') + service.name} onClick={() => void toggleActive(service)}>
                            {service.active ? <EyeOff size={16} /> : <Globe size={16} />}
                          </button>
                          <button className="adm-icon" aria-label={'Edit ' + service.name} onClick={() => setEditing({...service, customStepList: Array.isArray(service.customSteps) ? (service.customSteps as string[]) : []})}>
                            <Pencil size={16} />
                          </button>
                        </>
                      )}
                      {canManage && (
                        <button className="adm-icon adm-danger" aria-label={'Archive ' + service.name} disabled={busy} onClick={() => setConfirming(service)}>
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

      {editing && <ServiceDialog draft={editing} onClose={() => setEditing(null)} onSaved={message => {setEditing(null); onChanged(message);}} onError={onError} />}

      {confirming && (
        <div className="adm-overlay">
          <section className="adm-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cat-archive-title">
            <span className="adm-delete-icon">
              <Trash2 size={24} />
            </span>
            <h2 id="cat-archive-title">Archive this service?</h2>
            <p>“{confirming.name}” disappears from the website and the booking wizard. Its packages, prices and past orders are kept, and you can re-publish it at any time.</p>
            <div className="adm-actions">
              <button className="adm-button adm-secondary" disabled={busy} onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button autoFocus className="adm-button adm-delete" disabled={busy} onClick={() => void archive()}>
                {busy ? 'Archiving…' : 'Archive service'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function ServiceDialog({draft: initial, onClose, onSaved, onError}: {draft: Draft; onClose: () => void; onSaved: (message: string) => void; onError: (error: unknown) => void}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const editing = Boolean(initial.id);
  const change = (key: keyof Draft, value: unknown) => setDraft(current => ({...current, [key]: value}));

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

  async function upload(file: File) {
    setUploading(true);
    setError('');
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Maximum upload size is 5 MB.');
      const body = new FormData();
      body.append('file', file);
      const media = await request<{url: string}>('/admin/media', {method: 'POST', body});
      change('heroImageUrl', media.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const slug = slugify(String(draft.slug || draft.name || ''));
    if (!slug) {
      setError('Enter a name so a URL slug can be generated.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug,
        name: String(draft.name || '').trim(),
        description: String(draft.description || ''),
        categoryBadge: String(draft.categoryBadge || ''),
        iconName: String(draft.iconName || 'Layers'),
        heroImageUrl: String(draft.heroImageUrl || ''),
        displayOrder: Number(draft.displayOrder || 0),
        active: draft.active !== false,
        flowType: (draft.flowType || 'STANDARD') as FlowType,
        customSteps: draft.flowType === 'CUSTOM' ? draft.customStepList ?? [] : [],
      };
      await request('/admin/catalog/services' + (editing ? '/' + initial.id : ''), {method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload)});
      onSaved(editing ? 'Saved “' + payload.name + '”. The website is updated.' : 'Created “' + payload.name + '”. It is live on the website now.');
    } catch (saveError) {
      onError(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this service.');
    } finally {
      setSaving(false);
    }
  }

  const steps = draft.customStepList ?? [];

  return (
    <div className="adm-overlay" onClick={event => {if (event.target === event.currentTarget && !saving) onClose();}}>
      <section className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="cat-service-title">
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">SERVICE CATALOG</span>
            <h2 id="cat-service-title">{editing ? 'Edit service' : 'New service'}</h2>
          </div>
          <button className="adm-icon" aria-label="Close editor" disabled={saving} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form onSubmit={save} className="adm-edit-form">
          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Service name</span>
              <input required value={String(draft.name || '')} onChange={event => change('name', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>URL slug</span>
              <input required value={String(draft.slug || '')} placeholder={slugify(String(draft.name || ''))} onChange={event => change('slug', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Badge (optional)</span>
              <input value={String(draft.categoryBadge || '')} placeholder="Most popular" onChange={event => change('categoryBadge', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Lucide icon name</span>
              <input value={String(draft.iconName || '')} placeholder="Layers" onChange={event => change('iconName', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Display order</span>
              <input type="number" min={0} value={Number(draft.displayOrder || 0)} onChange={event => change('displayOrder', Number(event.target.value))} />
            </label>
            <label className="adm-field">
              <span>Visible on the website</span>
              <input type="checkbox" checked={draft.active !== false} onChange={event => change('active', event.target.checked)} />
            </label>
            <div className="adm-span">
              <label className="adm-field">
                <span>Description</span>
                <textarea rows={3} value={String(draft.description || '')} onChange={event => change('description', event.target.value)} />
              </label>
            </div>
            <div className="adm-span cat-flow-field">
              <span className="cat-label">Booking flow</span>
              <div className="cat-flow-group" role="radiogroup" aria-label="Booking flow">
                {FLOW_OPTIONS.map(option => (
                  <button type="button" key={option.value} role="radio" aria-checked={draft.flowType === option.value} className={'cat-flow-option' + (draft.flowType === option.value ? ' is-on' : '')} onClick={() => change('flowType', option.value)}>
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </button>
                ))}
              </div>
            </div>
            {draft.flowType === 'CUSTOM' && (
              <div className="adm-span">
                <span className="cat-label">Custom steps</span>
                <div className="cat-steps">
                  {CUSTOM_STEP_OPTIONS.map(step => {
                    const on = steps.includes(step);
                    return (
                      <button type="button" key={step} className={'cat-pill' + (on ? ' is-on' : '')} aria-pressed={on} onClick={() => change('customStepList', on ? steps.filter(entry => entry !== step) : [...steps, step])}>
                        {on && <Check size={13} />}
                        {step}
                      </button>
                    );
                  })}
                </div>
                <small className="adm-help">Steps run in the order you select them. Checkout is always added last.</small>
              </div>
            )}
            <div className="adm-span cat-hero">
              <label className="adm-field">
                <span>Hero image URL</span>
                <input value={String(draft.heroImageUrl || '')} placeholder="/uploads/hero.webp" onChange={event => change('heroImageUrl', event.target.value)} />
              </label>
              <label className="adm-button adm-secondary cat-upload" role="button" tabIndex={0}>
                {uploading ? <Upload size={16} className="adm-spin" /> : <ImageIcon size={16} />}
                {uploading ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={uploading} onChange={event => {if (event.target.files?.[0]) void upload(event.target.files[0]); event.target.value = '';}} />
              </label>
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
              {saving ? 'Saving…' : (<><Check size={16} />Save service</>)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
