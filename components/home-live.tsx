'use client';

import Image from 'next/image';
import {useEffect, useState, useRef} from 'react';
import {ArrowUpRight, Sparkles, ShieldCheck, Clock, MapPin, ChevronLeft, ChevronRight} from 'lucide-react';
import {BookingButton} from './booking';

/* Content in this file is taken from the live workspacejunction.com homepage (Oct 2026). */

const SLIDES = [
  {
    src: '/media/3675f6dc28-slide-1.png',
    alt: 'Team meeting in the Workspace Junction boardroom with a video call on screen',
    badge: 'Executive Suites & Private Boardrooms',
    title: 'Where Leaders Work.',
    sub: 'Your premier business headquarters in Oakbrook Terrace — from executive boardroom strategy sessions to high-impact broadcasts.',
    tags: ['High-Speed Fiber', 'Dual 4K Displays', 'Full AV Support'],
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
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (paused || hovered || focused) return;
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
  }, [paused, hovered, focused]);

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
      {SLIDES.map((s, i) => (
        <figure key={s.src} className={'lv-slide' + (i === index ? ' is-active' : '')} aria-hidden={i !== index}>
          <Image src={s.src} alt={s.alt} fill priority={i === 0} sizes="100vw" className="lv-slide-img" />
        </figure>
      ))}

      <div className="lv-hero-shade" aria-hidden="true" />
      <div className="lv-hero-radial-glow" aria-hidden="true" />

      <div className="lv-hero-copy">
        <h1 id="hp-title" className="lv-sr">{SLIDES[0].title}</h1>

        <div className="lv-hero-content-wrap">
          <div className="lv-hero-badge-row">
            <span className="lv-hero-badge">
              <Sparkles size={13} className="lv-badge-icon" aria-hidden="true" />
              <span>{slide.badge}</span>
            </span>
          </div>

          <div className="lv-hero-titles" aria-live="off">
            {SLIDES.map((s, i) => (
              <div key={s.title} className={'lv-hero-title' + (i === index ? ' is-active' : '')} aria-hidden={i !== index}>
                <p className="lv-h1" aria-hidden={i === 0 ? true : undefined}>{s.title}</p>
                <p className="lv-hero-sub">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="lv-hero-tags" aria-label="Key features">
            {slide.tags.map(tag => (
              <span key={tag} className="lv-hero-tag">
                <span className="lv-tag-dot" aria-hidden="true" />
                {tag}
              </span>
            ))}
          </div>

          <div className="lv-hero-actions">
            <BookingButton className="btn btn-primary lv-pill lv-hero-primary-cta" service={slide.ctaService}>
              {slide.ctaLabel} <ArrowUpRight size={17} aria-hidden="true" />
            </BookingButton>
            <a href="#pricing" className="lv-pill lv-pill-ghost lv-hero-secondary-cta">
              Plans &amp; Pricing <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="lv-hero-bottom-bar">
          <div className="lv-hero-meta-strip">
            <span className="lv-meta-item">
              <MapPin size={14} className="lv-meta-icon" aria-hidden="true" />
              <span>Oakbrook Terrace, IL</span>
            </span>
            <span className="lv-meta-divider" aria-hidden="true">/</span>
            <span className="lv-meta-item">
              <Clock size={14} className="lv-meta-icon" aria-hidden="true" />
              <span>24/7 Access</span>
            </span>
            <span className="lv-meta-divider" aria-hidden="true">/</span>
            <span className="lv-meta-item">
              <ShieldCheck size={14} className="lv-meta-icon" aria-hidden="true" />
              <span>Verified Enterprise Standard</span>
            </span>
          </div>

          <div className="lv-controls-cluster">
            <div className="lv-arrow-nav">
              <button
                type="button"
                className="lv-nav-arrow"
                aria-label="Previous slide"
                onClick={() => {
                  setIndex((index - 1 + SLIDES.length) % SLIDES.length);
                  setPaused(true);
                }}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="lv-nav-arrow"
                aria-label="Next slide"
                onClick={() => {
                  setIndex((index + 1) % SLIDES.length);
                  setPaused(true);
                }}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="lv-dots" role="group" aria-label="Choose slide">
              {SLIDES.map((s, i) => (
                <button
                  key={s.title}
                  className={'lv-slide-dot' + (i === index ? ' is-active' : '')}
                  type="button"
                  aria-label={`Show slide ${i + 1}: ${s.title}`}
                  aria-pressed={i === index}
                  onClick={() => {
                    setIndex(i);
                    setPaused(true);
                  }}
                />
              ))}
            </div>

            <button
              className="lv-slide-pause"
              type="button"
              aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
              onClick={() => setPaused(v => !v)}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tier = {name: string; duration: string; includes: string[]; price: string};
type Studio = {name: string; blurb: string; capacity: string; tiers: Tier[]};
export const STUDIOS: Studio[] = [
  {name: 'Solo Creator Studio', blurb: 'Perfect for solo podcasters, content creators, and short-form recordings.', capacity: '1–2 people', tiers: [
    {name: 'Starter Podcast Session', duration: '1 Hour', includes: ['Professional microphone', '1 camera video recording', 'Studio lighting', 'Audio recording', 'Raw audio and video files'], price: '$75/hour'},
    {name: 'Standard Podcast Session', duration: '2 Hour', includes: ['1 camera video recording', 'Professional audio recording', 'Studio lighting', 'Raw audio and video files'], price: '$140 for 2 hours'},
    {name: 'Premium Podcast Production', duration: '3 Hour', includes: ['Audio cleanup', '1 edited video episode', 'Social media clip (1 highlight)'], price: '$260 for 3 hours'},
  ]},
  {name: 'Interview Studio', blurb: 'Ideal for interview-style podcasts and two-host shows.', capacity: '2–3 people', tiers: [
    {name: 'Starter Podcast Session', duration: '1 Hour', includes: ['2 Professional microphone', '2 camera video recording', 'Studio lighting', 'Audio recording'], price: '$95/hour'},
    {name: 'Standard Podcast Session', duration: '2 Hour', includes: ['Multi-camera recording', 'Professional audio recording', 'Studio lighting', 'Raw audio and video files'], price: '$180/hour'},
    {name: 'Premium Podcast Production', duration: '3 Hour', includes: ['Audio cleanup', '1 edited video episode', 'Social media clip (1 highlight)', 'Multi-camera recording'], price: '$320/hour'},
  ]},
  {name: 'Panel Podcast Studio', blurb: 'Designed for multi-host podcasts and panel discussions.', capacity: 'Up to 4 people', tiers: [
    {name: 'Starter Podcast Session', duration: '1 Hour', includes: ['3–4 microphones', 'Multi-camera recording', 'Studio lighting', 'Audio recording'], price: '$120/hour'},
    {name: 'Standard Podcast Session', duration: '2 Hour', includes: ['Multi-camera production', 'Professional audio mixing', 'Raw audio and video files'], price: '$220/hour'},
    {name: 'Premium Podcast Production', duration: '3 Hour', includes: ['Audio cleanup', '1 edited podcast episode', 'Social media clip (1 highlight)', 'Multi-camera recording'], price: '$380/hour'},
  ]},
  {name: 'Premium Video Podcast Studio', blurb: 'Our flagship studio for high-end video podcasts and professional shows.', capacity: 'Up to 4–5 people', tiers: [
    {name: 'Starter Podcast Session', duration: '1 Hour', includes: ['Professional podcast microphones', '3 camera video production', 'Professional lighting setup', 'Studio operator'], price: '$150/hour'},
    {name: 'Standard Podcast Session', duration: '2 Hour', includes: ['Multi-camera production', 'Audio recording and mixing', 'Professional lighting setup', 'Raw files included'], price: '$280/hour'},
    {name: 'Premium Podcast Production', duration: '3 Hour', includes: ['Full multi-camera production', 'Audio mastering', '1 fully edited episode', '3 Social media clip'], price: '$480/hour'},
  ]},
];

export function StudioTabs() {
  const [active, setActive] = useState(0);
  const studio = STUDIOS[active];
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
                <BookingButton className="btn btn-primary lv-pill lv-tier-cta" service={`${studio.name}: ${t.name}`}>
                  {t.price}
                </BookingButton>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
