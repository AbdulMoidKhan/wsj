'use client';
/**
 * Amenities & Deliverables. The "what's included" checklist shown with every
 * package. Defined once, attached to services here and to single packages from
 * the package editor.
 */
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {Check, Pencil, Plus, Trash2, X} from 'lucide-react';
import {request} from '../api';
import {slugify, type CatalogAmenity, type CatalogService} from './types';

type Draft = Partial<CatalogAmenity>;

export default function AmenityManager({services, amenities, canWrite, canManage, onChanged, onError}: {services: CatalogService[]; amenities: CatalogAmenity[]; canWrite: boolean; canManage: boolean; onChanged: (message: string) => void; onError: (error: unknown) => void}) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState('');
  const sortedServices = useMemo(() => [...services].sort((a, b) => a.displayOrder - b.displayOrder), [services]);

  async function toggleAssignment(amenity: CatalogAmenity, service: CatalogService) {
    const key = amenity.id + ':' + service.id;
    setBusy(key);
    try {
      if (amenity.serviceIds.includes(service.id)) {
        await request('/admin/catalog/amenities/unassign', {method: 'DELETE', body: JSON.stringify({serviceId: service.id, amenityId: amenity.id})});
        onChanged('Removed “' + amenity.name + '” from ' + service.name + '.');
      } else {
        await request('/admin/catalog/amenities/assign', {method: 'POST', body: JSON.stringify({serviceId: service.id, amenityId: amenity.id})});
        onChanged('Added “' + amenity.name + '” to ' + service.name + '.');
      }
    } catch (error) {
      onError(error);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="adm-table-card cat-card" aria-label="Amenities and deliverables">
      <header className="cat-head">
        <div>
          <h2>Amenities &amp; Deliverables</h2>
          <p>{amenities.length} items. These replace the old hardcoded “what’s included” list in the booking wizard.</p>
        </div>
        {canWrite && (
          <button className="adm-button adm-primary" onClick={() => setEditing({active: true, iconName: 'Check'})}>
            <Plus size={17} />
            New amenity
          </button>
        )}
      </header>

      <div className="adm-table-scroll cat-matrix-scroll" tabIndex={0} role="region" aria-label="Amenity assignment matrix">
        <table className="adm-table cat-matrix">
          <thead>
            <tr>
              <th scope="col">Amenity</th>
              {sortedServices.map(service => (
                <th key={service.id} scope="col">
                  <span className="cat-matrix-label">{service.name}</span>
                </th>
              ))}
              <th>
                <span className="adm-sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {amenities.length === 0 ? (
              <tr>
                <td colSpan={sortedServices.length + 2}>
                  <div className="adm-empty">
                    <strong>No amenities yet</strong>
                    <p>Create an amenity, then tick the services that include it.</p>
                  </div>
                </td>
              </tr>
            ) : (
              amenities.map(amenity => (
                <tr key={amenity.id} className={amenity.active ? '' : 'is-off'}>
                  <th scope="row">
                    <strong>{amenity.name}</strong>
                    <small>
                      {amenity.slug}
                      {amenity.active ? '' : ' · hidden'}
                    </small>
                  </th>
                  {sortedServices.map(service => {
                    const on = amenity.serviceIds.includes(service.id);
                    const key = amenity.id + ':' + service.id;
                    return (
                      <td key={service.id} className={on ? 'is-on' : ''}>
                        <button
                          type="button"
                          className={'cat-cell' + (on ? ' is-on' : '')}
                          role="checkbox"
                          aria-checked={on}
                          aria-label={(on ? 'Remove ' : 'Add ') + amenity.name + ' ' + (on ? 'from ' : 'to ') + service.name}
                          disabled={!canWrite || busy === key}
                          onClick={() => void toggleAssignment(amenity, service)}
                        >
                          {on && <Check size={13} strokeWidth={3} />}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <div className="adm-row-actions">
                      {canWrite && (
                        <button className="adm-icon" aria-label={'Edit ' + amenity.name} onClick={() => setEditing(amenity)}>
                          <Pencil size={16} />
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

      {editing && <AmenityDialog draft={editing} canManage={canManage} onClose={() => setEditing(null)} onSaved={message => {setEditing(null); onChanged(message);}} onError={onError} />}
    </section>
  );
}

function AmenityDialog({draft: initial, canManage, onClose, onSaved, onError}: {draft: Draft; canManage: boolean; onClose: () => void; onSaved: (message: string) => void; onError: (error: unknown) => void}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    const name = String(draft.name || '').trim();
    if (!name) {
      setError('Enter a name.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: slugify(String(draft.slug || name)),
        name,
        description: String(draft.description || ''),
        iconName: String(draft.iconName || 'Check'),
        iconUrl: String(draft.iconUrl || ''),
        active: draft.active !== false,
      };
      await request('/admin/catalog/amenities' + (editing ? '/' + initial.id : ''), {method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload)});
      onSaved(editing ? 'Saved “' + name + '”.' : 'Created “' + name + '”. Tick the services that include it.');
    } catch (saveError) {
      onError(saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save this amenity.');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    setSaving(true);
    try {
      await request('/admin/catalog/amenities/' + initial.id, {method: 'DELETE'});
      onSaved('Hid “' + initial.name + '” from the website.');
    } catch (deleteError) {
      onError(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not hide this amenity.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-overlay" onClick={event => {if (event.target === event.currentTarget && !saving) onClose();}}>
      <section className="adm-dialog cat-dialog-sm" role="dialog" aria-modal="true" aria-labelledby="cat-amenity-title">
        <header className="adm-dialog-head">
          <div>
            <span className="adm-eyebrow">AMENITIES</span>
            <h2 id="cat-amenity-title">{editing ? 'Edit amenity' : 'New amenity'}</h2>
          </div>
          <button className="adm-icon" aria-label="Close editor" disabled={saving} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <form onSubmit={save} className="adm-edit-form">
          <div className="adm-form-grid">
            <label className="adm-field">
              <span>Name</span>
              <input required value={String(draft.name || '')} onChange={event => change('name', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Slug</span>
              <input value={String(draft.slug || '')} placeholder={slugify(String(draft.name || ''))} onChange={event => change('slug', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Lucide icon name</span>
              <input value={String(draft.iconName || '')} placeholder="Wifi" onChange={event => change('iconName', event.target.value)} />
            </label>
            <label className="adm-field">
              <span>Visible</span>
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
                <span>Custom icon URL (optional)</span>
                <input value={String(draft.iconUrl || '')} onChange={event => change('iconUrl', event.target.value)} />
              </label>
            </div>
          </div>
          {error && (
            <div role="alert" className="adm-alert">
              {error}
            </div>
          )}
          <footer className="adm-dialog-foot">
            {editing && canManage && (
              <button type="button" className="adm-button adm-delete cat-foot-left" disabled={saving} onClick={() => void deactivate()}>
                <Trash2 size={15} />
                Hide
              </button>
            )}
            <button type="button" className="adm-button adm-secondary" disabled={saving} onClick={onClose}>
              Cancel
            </button>
            <button className="adm-button adm-primary" disabled={saving}>
              {saving ? 'Saving…' : (<><Check size={16} />Save amenity</>)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
