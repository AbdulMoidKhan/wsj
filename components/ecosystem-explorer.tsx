'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent} from 'react';
import {ArrowUpRight} from 'lucide-react';
import type {ChapterId} from '@/lib/ecosystem';

export interface ExplorerChapter {
  id: ChapterId;
  verb: string;
  promise: string;
  title: string;
  text: string;
  image: {src: string; alt: string};
  routes: Array<{label: string; href: string}>;
}

/* The homepage's one live thing: six verbs a business moves through.

   Desktop (>= 1100px): scroll-driven. The explorer is a tall track whose inner panel sticks
   to the viewport; as you scroll through the track the chapters advance Start -> Connect, and
   a progress rail fills beside the verbs. This is plain document scroll (position: sticky), not
   scroll hijacking: the wheel, keyboard and scrollbar behave normally, and nothing is pinned
   by script. Clicking a verb or using the arrow keys scrolls to that chapter's position, so
   scroll and selection never disagree.

   Phones and tablets, and anyone who prefers reduced motion: the same tabs, switched by tap,
   click or keys, with no tall track.

   ARIA tabs with roving tabindex throughout. */

const SCROLL_QUERY = '(min-width: 1100px) and (prefers-reduced-motion: no-preference)';

export function EcosystemExplorer({chapters}: {chapters: ExplorerChapter[]}) {
  const [active, setActive] = useState(0);
  const [scrollDriven, setScrollDriven] = useState(false);
  // Photographs mount the first time their chapter opens (then stay, so the wipe can replay).
  const [opened, setOpened] = useState<ReadonlySet<number>>(() => new Set([0]));
  const track = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const lock = useRef<number | null>(null);
  const unlockTimer = useRef(0);
  const activeRef = useRef(0);
  const count = chapters.length;

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => () => window.clearTimeout(unlockTimer.current), []);

  const warmAll = useCallback(() => setOpened(prev => prev.size === count ? prev : new Set(Array.from({length: count}, (_, i) => i))), [count]);

  /* Desktop scroll mode: follow the document scroll through the track. */
  useEffect(() => {
    const query = window.matchMedia(SCROLL_QUERY);
    const sync = () => setScrollDriven(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!scrollDriven || !el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const distance = el.offsetHeight - window.innerHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 0;
      el.style.setProperty('--jx-progress', progress.toFixed(4));
      // While a click/key-driven smooth scroll is in flight, keep the chosen tab selected
      // instead of flickering through every chapter the scroll passes.
      if (lock.current !== null) return;
      const index = Math.min(count - 1, Math.floor(progress * count));
      setActive(prev => (prev === index ? prev : index));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    // Warm every photograph once the track approaches, so no wipe ever reveals an empty frame.
    const near = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { warmAll(); near.disconnect(); } }, {rootMargin: '600px 0px'});
    near.observe(el);
    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll, {passive: true});
    update();
    return () => {
      near.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
      el.style.removeProperty('--jx-progress');
    };
  }, [scrollDriven, count, warmAll]);

  const select = useCallback((index: number, focus = false) => {
    const next = (index + count) % count;
    const el = track.current;
    if (scrollDriven && el) {
      // Scroll to the middle of the chapter's slice of the track; the scroll listener selects it.
      const distance = el.offsetHeight - window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY + distance * ((next + 0.5) / count);
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      lock.current = next;
      window.clearTimeout(unlockTimer.current);
      const unlock = () => {
        window.removeEventListener('scrollend', unlock);
        window.clearTimeout(unlockTimer.current);
        lock.current = null;
      };
      window.addEventListener('scrollend', unlock, {once: true});
      unlockTimer.current = window.setTimeout(unlock, 1200); // browsers without scrollend
      window.scrollTo({top, behavior: smooth ? 'smooth' : 'auto'});
    }
    activeRef.current = next;
    setActive(next);
    if (focus) tabs.current[next]?.focus({preventScroll: true});
  }, [count, scrollDriven]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const current = lock.current ?? activeRef.current;
    const keys: Record<string, number> = {ArrowDown: current + 1, ArrowRight: current + 1, ArrowUp: current - 1, ArrowLeft: current - 1, Home: 0, End: count - 1};
    if (!(event.key in keys)) return;
    event.preventDefault();
    select(keys[event.key], true);
  };

  if (!count) return null;
  const chapter = chapters[active];

  return (
    <div ref={track} className={'jx-track' + (scrollDriven ? ' is-scroll-driven' : '')} style={{'--jx-steps': count} as CSSProperties}>
      <div className="jx-sticky" data-header-yield>
        <div className="jx-explorer" data-chapter={chapter.id}>
          <div className="jx-verbs-wrap">
            <div className="jx-rail" aria-hidden="true"><span /></div>
            <div className="jx-verbs" role="tablist" aria-label="The Workspace Junction ecosystem" aria-orientation="vertical"
              onPointerEnter={warmAll} onFocus={warmAll}>
              {chapters.map((item, index) => (
                <button
                  key={item.id}
                  ref={node => { tabs.current[index] = node; }}
                  type="button"
                  role="tab"
                  id={'jx-tab-' + item.id}
                  aria-selected={index === active}
                  aria-controls={'jx-panel-' + item.id}
                  tabIndex={index === active ? 0 : -1}
                  className="jx-verb wj-control"
                  onClick={() => select(index)}
                  onKeyDown={onKey}
                >
                  <span className="jx-verb-word">{item.verb}</span>
                  <span className="jx-verb-promise" aria-hidden="true">{item.promise}</span>
                </button>
              ))}
            </div>
            {scrollDriven && <p className="jx-hint" aria-hidden="true"><span>{String(active + 1).padStart(2, '0')}</span> / {String(count).padStart(2, '0')} · scroll to move through the journey</p>}
          </div>

          <div className="jx-stage">
            {/* Only the active chapter's photograph is exposed to assistive tech, with its own alt. */}
            <div className="jx-frames">
              {chapters.map((item, index) => (
                <div key={item.id} className={'jx-frame' + (index === active ? ' is-active' : '')} aria-hidden={index !== active}>
                  {(opened.has(index) || index === active) && <Image src={item.image.src} alt={item.image.alt} fill sizes="(max-width: 1100px) 100vw, 56vw" loading={opened.size > 1 ? 'eager' : 'lazy'} />}
                </div>
              ))}
            </div>
            {chapters.map((item, index) => (
              <div
                key={item.id}
                id={'jx-panel-' + item.id}
                role="tabpanel"
                aria-labelledby={'jx-tab-' + item.id}
                hidden={index !== active}
                className="jx-panel"
              >
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <ul className="jx-routes">
                  {item.routes.map(route => (
                    <li key={route.href}><Link href={route.href}>{route.label}<ArrowUpRight size={18} aria-hidden="true" /></Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
