'use client';

import Image from '@/components/consistent-image';
import {useEffect, useMemo, useState, useRef} from 'react';
import {ArrowUpRight, ArrowRight} from 'lucide-react';
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (hovered || focused) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;

    timerRef.current = setInterval(() => {
      if (!document.hidden && document.documentElement.dataset.ambient !== 'paused') {
        setIndex(i => (i + 1) % SLIDES.length);
      }
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hovered, focused]);

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
            <Image src={s.src} alt={s.alt} fill preload={i === 0} fetchPriority={i === 0 ? 'high' : 'low'} sizes="(max-width: 767px) 100vw, 50vw" className="lv-slide-img" />
          </figure>
        ))}
      </div>
      <div className="lv-hero-bottom-bar">
        <span className="lv-hero-motto">WORK. CONNECT. GROW.</span>
        <p>Flexible spaces for every way of working.</p>
        <div className="lv-controls-cluster">
          <span>{String(index + 1).padStart(2, '0')} / 03</span>
          <button
            type="button"
            className="lv-nav-arrow"
            aria-label="Next slide"
            onClick={() => {
              setIndex((index + 1) % SLIDES.length);
            }}
          >
            <ArrowRight size={18} aria-hidden="true" />
          </button>
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
type Studio = {slug?: string; name: string; blurb: string; capacity: string; tiers: Tier[]};

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
}

/** Build the tab data from catalog packages, keeping the marketing copy. */
export function studiosFromCatalog(rates: StudioRate[]): Studio[] {
  return rates.map((rate, index) => ({
    slug: rate.slug,
    name: rate.name,
    blurb: rate.description || STUDIO_BLURBS[index] || STUDIO_BLURBS[0],
    capacity: rate.capacityText || 'Capacity confirmed by our team',
    tiers: SESSION_TIERS[index] || SESSION_TIERS[0],
  }));
}

export function StudioTabs({rates = []}: {rates?: StudioRate[]}) {
  const [active, setActive] = useState(0);
  const STUDIOS = useMemo(() => studiosFromCatalog(rates), [rates]);
  const studio = STUDIOS[active] as Studio | undefined;
  const rate = rates[active];
  const sessionPrice = (hours: number) => (rate ? (rate.unitAmountCents * hours / 100).toLocaleString('en-US', {style: 'currency', currency: rate.currency.toUpperCase(), maximumFractionDigits: 0}) : 'On request');
  if (!studio) {
    return (
      <div className="lv-studios">
        <p className="lv-studio-empty">Studio packages are confirmed by our team. Ask us about availability and current session rates.</p>
      </div>
    );
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? STUDIOS.length - 1 : (active + (e.key === 'ArrowRight' ? 1 : STUDIOS.length - 1)) % STUDIOS.length;
    setActive(next);
    document.getElementById(`lv-studio-tab-${next}`)?.focus();
  };
  return (
    <div className="lv-studios">
      <div className="lv-tabs" role="tablist" aria-label="Podcast studios" onKeyDown={onKey}>
        {STUDIOS.map((s, i) => (
          <button
            key={s.name}
            id={`lv-studio-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={i === active}
            aria-controls="lv-studio-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className="lv-studio-tab-btn"
          >
            <span className="lv-tab-title">{s.name}</span>
          </button>
        ))}
      </div>

      <div id="lv-studio-panel" role="tabpanel" tabIndex={0} aria-labelledby={`lv-studio-tab-${active}`} className="lv-studio-panel" key={studio.name}>
        <div className="lv-studio-head">
          <div className="lv-studio-head-left">
            <h3>{studio.name}</h3>
            <p>{studio.blurb}</p>
          </div>
          <div className="lv-studio-capacity-pill">
            <span className="lv-capacity-dot" aria-hidden="true" />
            <span>Capacity: <strong>{studio.capacity}</strong></span>
          </div>
        </div>

        <div className="lv-tier-grid">
          {studio.tiers.map((t, i) => (
            <article key={t.name} className={'lv-tier' + (i === 1 ? ' is-mid' : '')}>
              {i === 1 && (
                <div className="lv-value-badge">
                  <Image src="/media/aa00b61c5b-value.png" alt="Best value for your money" width={84} height={84} className="lv-value" />
                </div>
              )}
              <div className="lv-tier-header">
                <h4>{t.name}</h4>
                <p className="lv-tier-dur">Duration: {t.duration}</p>
              </div>

              <div className="lv-tier-features">
                <p className="lv-tier-inc">Includes:</p>
                <ul>
                  {t.includes.map(x => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="lv-tier-footer">
                <BookingButton className="btn btn-primary lv-pill lv-tier-cta" service="podcast-studio" plan={studio.slug}>
                  {sessionPrice(t.hours)}
                  <span className="lv-tier-hours"> / {t.hours} hour{t.hours === 1 ? '' : 's'}</span>
                </BookingButton>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
