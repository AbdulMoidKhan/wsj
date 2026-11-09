'use client';
import {PUBLIC_API_URL} from '@/lib/public-api';
import {useCallback, useEffect, useRef, useState} from 'react';
import Image from '@/components/consistent-image';

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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

  const close = useCallback(() => {
    if (closeTimerRef.current) return;
    setVisible(false);
    dismissed.current = true;
    if (active) track(active.id, 'dismiss', sessionId.current);
    closeTimerRef.current = setTimeout(() => {
      setActive(null);
      closeTimerRef.current = null;
      requestAnimationFrame(() => triggerRef.current?.isConnected && triggerRef.current.focus({preventScroll:true}));
    }, 160);
  }, [active]);

  useEffect(() => {
    if (!visible || !active) return;
    const overlay = overlayRef.current;
    const body = document.body;
    const root = document.documentElement;
    const scrollX = window.scrollX, scrollY = window.scrollY;
    const saved = {overflow:body.style.overflow,position:body.style.position,top:body.style.top,left:body.style.left,width:body.style.width,rootOverflow:root.style.overflow};
    Object.assign(body.style,{overflow:'hidden',position:'fixed',top:-scrollY+'px',left:-scrollX+'px',width:'100%'});
    root.style.overflow='hidden';
    requestAnimationFrame(() => overlay?.querySelector<HTMLButtonElement>('.popup-close')?.focus({preventScroll:true}));
    const keydown = (event:KeyboardEvent) => {
      if (event.key === 'Escape') {event.preventDefault(); close(); return;}
      if (event.key !== 'Tab' || !overlay) return;
      const targets = Array.from(overlay.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')).filter(el => el.getClientRects().length > 0);
      const first=targets[0], last=targets[targets.length-1];
      if (!first) {event.preventDefault(); overlay.focus(); return;}
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    };
    document.addEventListener('keydown',keydown);
    return () => {
      document.removeEventListener('keydown',keydown);
      Object.assign(body.style,{overflow:saved.overflow,position:saved.position,top:saved.top,left:saved.left,width:saved.width});
      root.style.overflow=saved.rootOverflow;
      const behavior=root.style.scrollBehavior;root.style.scrollBehavior='auto';window.scrollTo(scrollX,scrollY);root.style.scrollBehavior=behavior;
    };
  }, [visible, active, close]);

  useEffect(() => () => {if (closeTimerRef.current) clearTimeout(closeTimerRef.current);}, []);

  if (!active) return null;

  const m = active.metadata || {};
  const img = m.image ? String(m.image) : '';
  const ctaText = m.ctaText ? String(m.ctaText) : '';
  const ctaUrl = m.ctaUrl ? String(m.ctaUrl) : '';
  const body = active.excerpt || '';
  const content = typeof active.content === 'string' ? active.content : '';

  return (
    <div
      ref={overlayRef}
      className={'popup-overlay' + (visible ? ' popup-visible' : '')}
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
      tabIndex={-1}
      data-lenis-prevent
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
