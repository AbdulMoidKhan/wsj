'use client';

import Image from '@/components/consistent-image';
import {useEffect, useMemo, useState, useRef} from 'react';
import {ArrowUpRight, ArrowRight, ArrowLeft, Pause, Play} from 'lucide-react';
import {useReducedMotion} from '@/lib/use-reduced-motion';
import {BookingButton} from './booking';

/* Content in this file is taken from the live workspacejunction.com homepage (Oct 2026). */

const SLIDES = [
  {
    src: '/media/dfcf491571-image.png',
    alt: 'Four professionals meeting around a table at Workspace Junction',
    badge: 'Executive Suites & Private Boardrooms',
    title: 'Where Leaders Work.',
    sub: 'Your premier business headquarters in Oakbrook Terrace — from executive boardroom strategy sessions to high-impact broadcasts.',
    tags: ['24/7 Access Option', 'Curated Member Network', 'Private Phone Booths'],
    ctaService: 'Meeting rooms',
    ctaLabel: 'Book a Private Tour',
  },
  {
    src: '/media/ec32287da6-slide-2.png',
    alt: 'Two hosts recording in the Chicagoland Podcast Studio',
    badge: 'Broadcasting & Creative Media',
    title: 'Cowork. Meet. Create.',
    sub: 'Work smarter, connect deeper, and produce bigger. Dedicated creator studios with broadcast-grade acoustics and multi-cam video.',
    tags: ['Acoustic Isolation', 'Shure SM7B Setup', 'Auto-Tracking 4K'],
    ctaService: 'Podcast studio',
    ctaLabel: 'Reserve Studio Time',
  },
  {
    src: '/media/48d393a566-slide-3.png',
    alt: 'Panel podcast recording with four guests around a studio table',
    badge: 'Dynamic Community & Events',
    title: 'Power Meets Purpose.',
    sub: 'Where visionaries convene. Flexible coworking desks, masterclasses, and executive networks built for measurable momentum.',
    tags: ['24/7 Access Option', 'Curated Member Network', 'Private Phone Booths'],
    ctaService: 'Coworking',
    ctaLabel: 'Explore Memberships',
  },
];

export function HeroSlides() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [paused, setPaused] = useState(false);
  // Slides 2-3 are fetched only after the first slide (the LCP image) has had the network.
  const [warm, setWarm] = useState(false);
  const reduced = useReducedMotion();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const swipeRef = useRef<{x: number; y: number} | null>(null);
  const autoplay = !paused && !reduced;

  useEffect(() => {
    const t = window.setTimeout(() => setWarm(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!autoplay || hovered || focused) return;
    timerRef.current = setInterval(() => {
      if (!document.hidden) setIndex(i => (i + 1) % SLIDES.length);
    }, 7000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoplay, hovered, focused]);

  const go = (next: number) => {setWarm(true); setIndex((next + SLIDES.length) % SLIDES.length);};
  const slide = SLIDES[index];

  return (
    <div
      className="lv-hero-stage"
      role="region"
      aria-roledescription="carousel"
      aria-label="Workspace highlights"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onPointerDown={event => {
        if (event.pointerType !== 'mouse') swipeRef.current = {x: event.clientX, y: event.clientY};
      }}
      onPointerUp={event => {
        const start = swipeRef.current;
        swipeRef.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        // Horizontal swipes only; vertical drags keep scrolling the page.
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(event.clientY - start.y) * 1.5) go(index + (dx < 0 ? 1 : -1));
      }}
      onPointerCancel={() => {swipeRef.current = null;}}
    >
      <div className="lv-hero-copy">
        <div className="lv-hero-content-wrap">
          <p className="lv-hero-badge">{slide.badge}</p>
          <h1 id="hp-title" className="lv-h1">{slide.title}</h1>
          <p className="lv-hero-sub">{slide.sub}</p>
          <div className="lv-hero-tags" aria-label="Key features">
            {slide.tags.map(tag => (
              <span key={tag} className="lv-hero-tag">• {tag}</span>
            ))}
          </div>
          <div className="lv-hero-actions">
            <BookingButton className="btn btn-primary lv-pill lv-hero-primary-cta" service={slide.ctaService}>
              {slide.ctaLabel} <ArrowUpRight size={17} aria-hidden="true" />
            </BookingButton>
            <a className="lv-pill lv-pill-ghost lv-hero-secondary-cta" href="#home-pricing">
              Plans &amp; Pricing <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <p className="lv-hero-location">Oakbrook Terrace, IL <span>·</span> 24/7 Access</p>
        </div>
      </div>
      <div className="lv-hero-media">
        {SLIDES.map((s, i) => (
          <figure key={s.src} className={'lv-slide' + (i === index ? ' is-active' : '')} aria-hidden={i !== index}>
            {(i === 0 || warm || i === index) && <Image src={s.src} alt={s.alt} fill preload={i === 0} fetchPriority={i === 0 ? 'high' : 'low'} sizes="(max-width: 767px) 100vw, 50vw" className="lv-slide-img" />}
          </figure>
        ))}
      </div>
      <div className="lv-hero-bottom-bar">
        <span className="lv-hero-motto">WORK. CONNECT. GROW.</span>
        <p>Flexible spaces for every way of working.</p>
        <div className="lv-controls-cluster">
          {/* Announce slide changes only when the user drives them, never on autoplay. */}
          <span aria-live={autoplay ? 'off' : 'polite'} aria-atomic="true">
            <span className="sr-only">Slide </span>{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>
          <div className="lv-slide-dots" role="group" aria-label="Choose slide">
            {SLIDES.map((s, i) => (
              <button key={s.src} type="button" className="lv-slide-dot" aria-label={`Show slide ${i + 1}: ${s.title}`} aria-current={i === index ? 'true' : undefined} onClick={() => go(i)}><span aria-hidden="true"/></button>
            ))}
          </div>
          <button type="button" className="lv-nav-arrow" aria-label="Previous slide" onClick={() => go(index - 1)}>
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" className="lv-nav-arrow" aria-label="Next slide" onClick={() => go(index + 1)}>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {!reduced && (
            <button type="button" className="lv-nav-arrow lv-autoplay-toggle" aria-pressed={paused} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} onClick={() => setPaused(p => !p)}>
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Studio tabs: the copy below is marketing only. Studio names, capacity and
   every amount are read from the podcast-studio service in the dynamic catalog
   and passed in by the page, so a rate change in the admin portal appears here
   immediately. Session prices are the catalog hourly rate multiplied by the
   session length, which is why they can never disagree with checkout. */
type Tier = {name: string; duration: string; hours: number; includes: string[]};

const SESSION_TIERS: Tier[][] = [
  [
    {name: 'Starter Podcast Session', duration: '1 Hour', hours: 1, includes: ['Professional microphone', '1 camera video recording', 'Studio lighting', 'Audio recording', 'Raw audio and video files']},
    {name: 'Standard Podcast Session', duration: '2 Hour', hours: 2, includes: ['1 camera video recording', 'Professional audio recording', 'Studio lighting', 'Raw audio and video files']},
    {name: 'Premium Podcast Production', duration: '3 Hour', hours: 3, includes: ['Audio cleanup', '1 edited video episode', 'Social media clip (1 highlight)']},
  ],
  [
    {name: 'Starter Podcast Session', duration: '1 Hour', hours: 1, includes: ['2 Professional microphone', '2 camera video recording', 'Studio lighting', 'Audio recording']},
    {name: 'Standard Podcast Session', duration: '2 Hour', hours: 2, includes: ['Multi-camera recording', 'Professional audio recording', 'Studio lighting', 'Raw audio and video files']},
    {name: 'Premium Podcast Production', duration: '3 Hour', hours: 3, includes: ['Audio cleanup', '1 edited video episode', 'Social media clip (1 highlight)', 'Multi-camera recording']},
  ],
  [
    {name: 'Starter Podcast Session', duration: '1 Hour', hours: 1, includes: ['3–4 microphones', 'Multi-camera recording', 'Studio lighting', 'Audio recording']},
    {name: 'Standard Podcast Session', duration: '2 Hour', hours: 2, includes: ['Multi-camera production', 'Professional audio mixing', 'Raw audio and video files']},
    {name: 'Premium Podcast Production', duration: '3 Hour', hours: 3, includes: ['Audio cleanup', '1 edited podcast episode', 'Social media clip (1 highlight)', 'Multi-camera recording']},
  ],
  [
    {name: 'Starter Podcast Session', duration: '1 Hour', hours: 1, includes: ['Professional podcast microphones', '3 camera video production', 'Professional lighting setup', 'Studio operator']},
    {name: 'Standard Podcast Session', duration: '2 Hour', hours: 2, includes: ['Multi-camera production', 'Audio recording and mixing', 'Professional lighting setup', 'Raw files included']},
    {name: 'Premium Podcast Production', duration: '3 Hour', hours: 3, includes: ['Full multi-camera production', 'Audio mastering', '1 fully edited episode', '3 Social media clip']},
  ],
];
const STUDIO_BLURBS = [
  'Perfect for solo podcasters, content creators, and short-form recordings.',
  'Ideal for interview-style podcasts and two-host shows.',
  'Designed for multi-host podcasts and panel discussions.',
  'Our flagship studio for high-end video podcasts and professional shows.',
];

export interface StudioRate {
  slug: string;
  name: string;
  capacityText: string | null;
  unitAmountCents: number;
  currency: string;
  description: string;
  durationMinutes?: number | null;
}

type TierKind = 0 | 1 | 2; // starter (per hour), standard session, premium production
type StudioTier = {kind: TierKind; name: string; hours: number; price: string; planSlug: string; includes: string[]};
type StudioGroup = {name: string; blurb: string; capacity: string; tiers: StudioTier[]};

/* The catalog lists each studio's sessions as separate packages, e.g. "Solo Creator Studio"
   (starter, per hour), "Solo Creator Studio — Standard Session" and "… — Premium Production".
   Group them by studio and keep every price exactly as published in the catalog. */
const tierOf = (name: string): TierKind => /premium\s+(podcast\s+)?production/i.test(name) ? 2 : /standard/i.test(name) ? 1 : 0;
const studioOf = (name: string) => name
  .replace(/(starter|standard|premium)\s+podcast\s+(session|production)/gi, '')
  .replace(/standard\s+session|premium\s+production/gi, '')
  .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, '')
  .trim();
const contentIndex = (studio: string, fallback: number) => {
  const s = studio.toLowerCase();
  return s.includes('solo') ? 0 : s.includes('interview') ? 1 : s.includes('panel') ? 2 : s.includes('premium') || s.includes('video') ? 3 : Math.min(fallback, 3);
};
const money = (cents: number, currency: string) => (cents / 100).toLocaleString('en-US', {style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 ? 2 : 0});

/** Build studio tabs from catalog packages, keeping the published marketing copy. */
export function studiosFromCatalog(rates: StudioRate[]): StudioGroup[] {
  const groups = new Map<string, StudioRate[]>();
  for (const rate of rates) {
    const studio = studioOf(rate.name);
    if (!studio) continue;
    groups.set(studio, [...(groups.get(studio) || []), rate]);
  }
  return [...groups.entries()].map(([name, plans], index) => {
    const content = contentIndex(name, index);
    const tiers = plans
      .map(plan => {
        const kind = tierOf(plan.name);
        const copy = (SESSION_TIERS[content] || SESSION_TIERS[0])[kind];
        return {kind, name: copy.name, hours: plan.durationMinutes ? Math.max(1, Math.round(plan.durationMinutes / 60)) : copy.hours, price: money(plan.unitAmountCents, plan.currency), planSlug: plan.slug, includes: copy.includes};
      })
      .sort((a, b) => a.kind - b.kind)
      .filter((tier, i, all) => all.findIndex(t => t.kind === tier.kind) === i);
    const starter = plans.find(plan => tierOf(plan.name) === 0) || plans[0];
    return {name, blurb: STUDIO_BLURBS[content] || starter.description, capacity: starter.capacityText || plans.find(p => p.capacityText)?.capacityText || 'Confirmed by our team', tiers};
  }).filter(group => group.tiers.length);
}

export function StudioTabs({rates = []}: {rates?: StudioRate[]}) {
  const [active, setActive] = useState(0);
  const studios = useMemo(() => studiosFromCatalog(rates), [rates]);
  const studio = studios[active];
  if (!studio) {
    return (
      <div className="st st-empty">
        <p>Studio sessions are confirmed by our team. Ask us about availability and current session rates.</p>
      </div>
    );
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const n = studios.length;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (active + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    setActive(next);
    document.getElementById(`st-tab-${next}`)?.focus();
  };
  return (
    <div className="st">
      <div className="st-studios" role="tablist" aria-label="Podcast studios" onKeyDown={onKey}>
        {studios.map((s, i) => (
          <button
            key={s.name}
            id={`st-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls="st-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className="st-studio wj-control"
          >
            <span className="st-studio-name">{s.name}</span>
            <span className="st-studio-cap">{s.capacity}</span>
          </button>
        ))}
      </div>

      <div id="st-panel" role="tabpanel" tabIndex={0} aria-labelledby={`st-tab-${active}`} className="st-panel" key={studio.name}>
        <p className="st-blurb">{studio.blurb}</p>
        <ol className="st-tiers">
          {studio.tiers.map(t => (
            <li key={t.planSlug} className={'st-tier st-tier-' + t.kind}>
              <div className="st-tier-head">
                <h4>{t.name}</h4>
                <p className="st-tier-dur">{t.hours} hour{t.hours === 1 ? '' : 's'} in studio</p>
              </div>
              <p className="st-price"><span>{t.price}</span> <small>/ {t.hours} hour{t.hours === 1 ? '' : 's'}</small></p>
              <ul className="st-includes">
                {t.includes.map(x => <li key={x}>{x}</li>)}
              </ul>
              <BookingButton className="st-book wj-control" service="podcast-studio" plan={t.planSlug}>
                Book {t.name.replace(/ podcast/i, '').toLowerCase()} <ArrowUpRight size={16} aria-hidden="true" />
              </BookingButton>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
