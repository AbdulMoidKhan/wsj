'use client';
/**
 * Catalog Management Console. One overview request feeds all four screens, and
 * every write refreshes it, so an administrator sees the exact state the public
 * endpoints will serve.
 */
import {useCallback, useEffect, useState} from 'react';
import {Check, RefreshCw, X} from 'lucide-react';
import {ApiError, request, revalidatePublic} from '../api';
import ServiceManager from './ServiceManager';
import PlanEditor from './PlanEditor';
import AddonMatrix from './AddonMatrix';
import AmenityManager from './AmenityManager';
import type {CatalogOverview} from './types';
import './catalog.css';

export type CatalogView = 'services' | 'plans' | 'addons' | 'amenities';

const EMPTY: CatalogOverview = {services: [], addOns: [], amenities: [], billingUnits: [], flowTypes: []};

export default function CatalogConsole({view, canWrite, canManage, onUnauthorized}: {view: CatalogView; canWrite: boolean; canManage: boolean; onUnauthorized: () => void}) {
  const [data, setData] = useState<CatalogOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /* Every reload is a bump of this counter, so the fetch lives in one effect
     and no state is written synchronously while rendering. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overview = await request<CatalogOverview>('/admin/catalog/overview');
        if (cancelled) return;
        setData({services: overview.services ?? [], addOns: overview.addOns ?? [], amenities: overview.amenities ?? [], billingUnits: overview.billingUnits ?? [], flowTypes: overview.flowTypes ?? []});
        setError('');
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiError && loadError.status === 401) onUnauthorized();
        setError(loadError instanceof Error ? loadError.message : 'Could not load the catalog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, onUnauthorized]);

  const load = useCallback(() => {
    setLoading(true);
    setReloadKey(key => key + 1);
  }, []);

  const handleError = useCallback(
    (thrown: unknown) => {
      if (thrown instanceof ApiError && thrown.status === 401) onUnauthorized();
      setError(thrown instanceof Error ? thrown.message : 'Something went wrong.');
    },
    [onUnauthorized],
  );

  /* A catalog write is immediately visible on the public site: the API clears
     its own read cache, and this also purges the Next.js page cache. */
  const handleChanged = useCallback(
    async (message: string) => {
      setNotice(message);
      setError('');
      await revalidatePublic().catch(() => undefined);
      load();
    },
    [load],
  );

  const shared = {canWrite, canManage, onChanged: (message: string) => void handleChanged(message), onError: handleError};

  return (
    <div className="cat-console">
      <div className="cat-toolbar">
        <p className="cat-summary">
          {data.services.length} services · {data.services.reduce((sum, service) => sum + service.planCount, 0)} packages · {data.addOns.length} add-ons · {data.amenities.length} amenities
        </p>
        <button className="adm-button adm-secondary" disabled={loading} onClick={load}>
          <RefreshCw size={16} className={loading ? 'adm-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="adm-alert" role="alert">
          {error}
          <button className="adm-text-button" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {notice && (
        <div className="adm-success" role="status">
          <Check size={17} />
          {notice}
          <button className="adm-icon" aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {loading && data.services.length === 0 ? (
        <div className="adm-empty" role="status">
          <RefreshCw className="adm-spin" size={22} />
          <strong>Loading the catalog…</strong>
        </div>
      ) : view === 'services' ? (
        <ServiceManager services={data.services} {...shared} />
      ) : view === 'plans' ? (
        <PlanEditor services={data.services} addOns={data.addOns} amenities={data.amenities} {...shared} />
      ) : view === 'addons' ? (
        <AddonMatrix services={data.services} addOns={data.addOns} {...shared} />
      ) : (
        <AmenityManager services={data.services} amenities={data.amenities} {...shared} />
      )}
    </div>
  );
}
