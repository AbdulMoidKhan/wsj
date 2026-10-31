'use client';
import {PUBLIC_API_URL} from '@/lib/public-api';
import {useEffect, useRef, useState} from 'react';
import Image from 'next/image';

type ApiContent = {
  id: string;
  slug: string;
  title: string;
  content?: unknown;
  excerpt?: string;
  metadata?: Record<string, unknown>;
};

function sid(): string {
  try {
    let s = sessionStorage.getItem('wsj_sid');
    if (!s) {s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('wsj_sid', s);}
    return s;
  } catch {return '';}
}

function shown(): Set<string> {
  try {return new Set(JSON.parse(sessionStorage.getItem('wsj_popups_shown') || '[]'));}
  catch {return new Set();}
}

function markShown(id: string) {
  try {
    const s = shown();
    s.add(id);
    sessionStorage.setItem('wsj_popups_shown', JSON.stringify([...s]));
  } catch {}
}

async function track(popupId: string, event: string, sessionId: string) {
  try {
    await fetch(PUBLIC_API_URL + '/popup-events', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({popupId, event, sessionId: sessionId || undefined}),
    });
  } catch {}
}

export function Popup({popups}: {popups: ApiContent[]}) {
  const [active, setActive] = useState<ApiContent | null>(null);
  const [visible, setVisible] = useState(false);
  const sessionId = useRef('');
  const dismissed = useRef(false);

  useEffect(() => {
    sessionId.current = sid();
    const alreadyShown = shown();
    const eligible = popups.filter(p => {
      const m = p.metadata || {};
      if (m.showOnce && alreadyShown.has(p.id)) return false;
      return true;
    });
    if (!eligible.length) return;
    const popup = eligible[0];
    const m = popup.metadata || {};
    const trigger = String(m.trigger || 'delay');

    const show = () => {
      if (dismissed.current) return;
      setActive(popup);
      setVisible(true);
      markShown(popup.id);
      track(popup.id, 'view', sessionId.current);
    };

    if (trigger === 'delay') {
      const ms = (Number(m.delay) || 5) * 1000;
      const t = setTimeout(show, ms);
      return () => clearTimeout(t);
    }

    if (trigger === 'exit') {
      const handler = (e: MouseEvent) => {if (e.clientY <= 0) show();};
      document.addEventListener('mouseleave', handler);
      return () => document.removeEventListener('mouseleave', handler);
    }

    if (trigger === 'scroll') {
      const pct = Number(m.scrollPct) || 50;
      const handler = () => {
        const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        if (scrolled >= pct) {show(); window.removeEventListener('scroll', handler);}
      };
      window.addEventListener('scroll', handler, {passive: true});
      return () => window.removeEventListener('scroll', handler);
    }

    if (trigger === 'click') {
      const sel = String(m.triggerSelector || '');
      if (!sel) return;
      const handler = (e: Event) => {if ((e.target as Element).closest(sel)) show();};
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [popups]);

  const close = () => {
    setVisible(false);
    dismissed.current = true;
    if (active) track(active.id, 'dismiss', sessionId.current);
    setTimeout(() => setActive(null), 350);
  };

  if (!active) return null;

  const m = active.metadata || {};
  const img = m.image ? String(m.image) : '';
  const ctaText = m.ctaText ? String(m.ctaText) : '';
  const ctaUrl = m.ctaUrl ? String(m.ctaUrl) : '';
  const body = active.excerpt || '';
  const content = typeof active.content === 'string' ? active.content : '';

  return (
    <div
      className={'popup-overlay' + (visible ? ' popup-visible' : '')}
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
      onClick={e => {if (e.target === e.currentTarget) close();}}
    >
      <div className="popup-box">
        <button className="popup-close" onClick={close} aria-label="Close">&#x2715;</button>
        {img && <div className="popup-img"><Image src={img} alt="" aria-hidden="true" width={1200} height={800} unoptimized/></div>}
        <div className="popup-body">
          <h2 className="popup-title">{active.title}</h2>
          {body && <p className="popup-excerpt">{body}</p>}
          {content && (
            <div className="popup-content" dangerouslySetInnerHTML={{__html: content}}/>
          )}
          {ctaText && ctaUrl && (
            <a
              href={ctaUrl}
              className="popup-cta btn btn-primary"
              onClick={() => track(active.id, 'click', sessionId.current)}
            >{ctaText}</a>
          )}
        </div>
      </div>
    </div>
  );
}
