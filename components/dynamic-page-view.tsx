'use client';

import React, {useEffect, useRef} from 'react';
import Image from '@/components/consistent-image';
import Link from 'next/link';
import {motion} from 'motion/react';
import {ArrowRight, Play, Check, Plus, type LucideIcon} from 'lucide-react';
import {ServicePricingSection} from './service-pricing-section';
import {DYNAMIC_PAGES} from '@/lib/dynamic-pages-config';
import {SectionMotif} from './decorative-visual';

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: {opacity: 0, y: 32},
  show: {opacity: 1, y: 0, transition: {duration: 0.7, ease}}
};

const stagger = {
  hidden: {},
  show: {transition: {staggerChildren: 0.09, delayChildren: 0.05}}
};

const cardIn = {
  hidden: {opacity: 0, y: 26, scale: 0.97},
  show: {opacity: 1, y: 0, scale: 1, transition: {duration: 0.55, ease}}
};

export interface GridItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  sage?: boolean;
}

export interface ValueItem {
  icon: LucideIcon;
  title: string;
  sub: string;
}

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  desc: string;
}

export interface MoreWayItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface DynamicPageConfig {
  pageId: string;
  pricingService: string;
  pricingTitle: string;
  hero: {
    eyebrow: string;
    title: React.ReactNode;
    desc: string;
    image: string;
    imageAlt: string;
    primaryLabel?: string;
    secondaryLabel?: string;
  };
  about?: {
    eyebrow: string;
    title: string;
    desc: string;
    image: string;
    imageAlt: string;
    values: ValueItem[];
  };
  works?: {
    eyebrow: string;
    title: string;
    desc: string;
    ctaLabel: string;
    topImage: string;
    topImageAlt: string;
    bottomImage: string;
    bottomImageAlt: string;
    features: FeatureItem[];
  };
  grid?: {
    eyebrow: string;
    title: string;
    sub: string;
    items: GridItem[];
  };
  benefits?: {
    eyebrow: string;
    title: string;
    desc: string;
    image: string;
    imageAlt: string;
    items: string[];
  };
  faq?: {
    eyebrow?: string;
    title: string;
    desc: string;
    ctaLabel?: string;
    ctaService?: string;
    items: FaqItem[];
  };
  banner: {
    eyebrow: string;
    title: string;
    desc: string;
    image: string;
    imageAlt: string;
    secondaryLabel?: string;
  };
  moreWays: MoreWayItem[];
}

const openBooking = (service: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wj:book', {detail: {service, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined}}));
  }
};

export function DynamicPageView({slug}: {slug: string}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const config = DYNAMIC_PAGES[slug];
  const pageId = config?.pageId || slug;
  const cx = (base: string) => `${pageId}-${base}`;

  useEffect(() => {
    let disposed = false;
    let teardown = () => {};
    const root = rootRef.current;
    if (!root || !config) return;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{gsap}, {ScrollTrigger}]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fine = window.matchMedia('(pointer: fine)').matches;
      const ctx = gsap.context(() => {
        if (!reduced) {
          const tl = gsap.timeline({defaults: {ease: 'expo.out'}});
          tl.from(`.${cx('hero-eyebrow')}`, {y: 18, autoAlpha: 0, duration: 0.6})
            .from(`.${cx('hero-title')}`, {y: 28, autoAlpha: 0, duration: 0.8}, '-=0.4')
            .from(`.${cx('hero-desc')}`, {y: 20, autoAlpha: 0, duration: 0.7}, '-=0.5')
            .from(`.${cx('hero-actions')}`, {y: 16, autoAlpha: 0, duration: 0.6}, '-=0.45')
            .from(`.${cx('hero-media')}`, {scale: 0.92, autoAlpha: 0, duration: 1}, '-=0.7');

          const heroImg = root.querySelector(`.${cx('hero-img')}`);
          if (heroImg) {
            gsap.to(heroImg, {
              yPercent: 10,
              scale: 1.06,
              ease: 'none',
              scrollTrigger: {trigger: `.${cx('hero')}`, start: 'top top', end: 'bottom top', scrub: true}
            });
          }

          gsap.utils.toArray<HTMLElement>(`.${cx('grid-icon')}`).forEach(icon => {
            gsap.from(icon, {
              rotate: -8,
              scale: 0.7,
              autoAlpha: 0,
              duration: 0.6,
              ease: 'back.out(1.8)',
              scrollTrigger: {trigger: icon, start: 'top 92%', once: true}
            });
          });
        }

        if (fine && !reduced) {
          root.querySelectorAll<HTMLElement>('.dp-magnetic').forEach(btn => {
            const xTo = gsap.quickTo(btn, 'x', {duration: 0.55, ease: 'elastic.out(1, 0.5)'});
            const yTo = gsap.quickTo(btn, 'y', {duration: 0.55, ease: 'elastic.out(1, 0.5)'});
            const move = (e: PointerEvent) => {
              const r = btn.getBoundingClientRect();
              xTo((e.clientX - r.left - r.width / 2) * 0.28);
              yTo((e.clientY - r.top - r.height / 2) * 0.34);
            };
            const leave = () => {xTo(0); yTo(0);};
            btn.addEventListener('pointermove', move);
            btn.addEventListener('pointerleave', leave);
          });
        }
      }, root);

      teardown = () => ctx.revert();
    }).catch(() => {/* static fallback, no animation */});

    return () => {disposed = true; teardown();};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!config) return null;
  const {hero, about, works, grid, benefits, banner, moreWays, faq, pricingService, pricingTitle} = config;

  return (
    <main id="main" className={`cn-page dp-page ${pageId}-root wj-decorated-page`} ref={rootRef}>
      <SectionMotif variant={pageId.includes('podcast') ? 'studio' : pageId.includes('meeting') ? 'meeting' : pageId.includes('mail') || pageId.includes('address') ? 'mail' : 'route'} className="wj-page-motif" />
      {/* ==================== Hero ==================== */}
      <section className={`cn-hero cn-container ${cx('hero')}`} aria-label={`${pricingTitle} Hero`}>
        <div className="cn-hero-content">
          <span className={`cn-eyebrow ${cx('hero-eyebrow')}`}>{hero.eyebrow}</span>
          <h1 className={`cn-title-serif cn-hero-title ${cx('hero-title')}`}>{hero.title}</h1>
          <p className={`cn-hero-desc ${cx('hero-desc')}`}>{hero.desc}</p>
          <div className={`cn-hero-actions ${cx('hero-actions')}`}>
            <button type="button" onClick={() => openBooking(pricingTitle)} className="cn-btn-gold dp-magnetic">
              {hero.primaryLabel || 'Book a Tour'} <ArrowRight size={17} aria-hidden="true" />
            </button>
            <a href={`#${cx('pricing')}`} className="cn-btn-text-play">
              {hero.secondaryLabel || 'View Pricing'}
              <span className="cn-play-icon" aria-hidden="true">
                <Play size={12} fill="currentColor" />
              </span>
            </a>
          </div>
        </div>
        <div className={`cn-hero-media ${cx('hero-media')}`}>
          <Image src={hero.image} alt={hero.imageAlt} width={580} height={430} preload className={`cn-hero-img ${cx('hero-img')}`} />
        </div>
      </section>

      {/* ==================== About ==================== */}
      {about && (
        <motion.section
          id={cx('about')}
          className="cn-about"
          aria-labelledby={cx('about-heading')}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{once: true, amount: 0.25}}
        >
          <div className="cn-container cn-about-grid">
            <motion.div className="cn-about-media" variants={fadeUp}>
              <Image src={about.image} alt={about.imageAlt} width={554} height={340} className="cn-about-img" />
            </motion.div>
            <div className="cn-about-content">
              <motion.span className="cn-eyebrow" variants={fadeUp}>{about.eyebrow}</motion.span>
              <motion.h2 id={cx('about-heading')} className="cn-title-serif cn-about-title" variants={fadeUp}>
                {about.title}
              </motion.h2>
              <motion.p className="cn-about-desc" variants={fadeUp}>{about.desc}</motion.p>
              {about.values.length > 0 && (
                <motion.div className="cn-values-row" variants={fadeUp}>
                  {about.values.map(v => (
                    <div className="cn-value-item" key={v.title}>
                      <v.icon className="cn-value-icon" aria-hidden="true" />
                      <span className="cn-value-title">{v.title}</span>
                      <span className="cn-value-sub">{v.sub}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>
      )}

      {/* ==================== Works (dark band) ==================== */}
      {works && (
        <section className="cn-works" aria-labelledby={cx('works-heading')}>
          <div className="cn-container">
            <motion.div className="cn-works-top" variants={stagger} initial="hidden" whileInView="show" viewport={{once: true, amount: 0.25}}>
              <motion.div variants={fadeUp}>
                <span className="cn-eyebrow cn-eyebrow-dark">{works.eyebrow}</span>
                <h2 id={cx('works-heading')} className="cn-title-serif cn-works-title">{works.title}</h2>
                <p className="cn-works-desc">{works.desc}</p>
                <a href={`#${cx(grid ? 'grid' : 'pricing')}`} className="cn-btn-gold dp-magnetic">
                  {works.ctaLabel} <ArrowRight size={17} aria-hidden="true" />
                </a>
              </motion.div>
              <motion.div variants={fadeUp}>
                <Image src={works.topImage} alt={works.topImageAlt} width={600} height={290} className="cn-works-top-img" />
              </motion.div>
            </motion.div>

            <motion.div className="cn-works-bottom" variants={stagger} initial="hidden" whileInView="show" viewport={{once: true, amount: 0.25}}>
              <motion.div variants={fadeUp}>
                <Image src={works.bottomImage} alt={works.bottomImageAlt} width={550} height={290} className="cn-works-bottom-img" />
              </motion.div>
              <motion.div className="cn-works-features" variants={fadeUp}>
                {works.features.map(f => (
                  <div className="cn-works-feature" key={f.title}>
                    <div className="cn-feature-icon-box" aria-hidden="true"><f.icon size={22} /></div>
                    <div>
                      <h3 className="cn-feature-title">{f.title}</h3>
                      <p className="cn-feature-desc">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ==================== Grid ==================== */}
      {grid && (
        <section id={cx('grid')} className="cn-circles" aria-labelledby={cx('circles-heading')}>
          <div className="cn-container">
            <motion.div
              className="cn-section-header-center"
              initial={{opacity: 0, y: 20}}
              whileInView={{opacity: 1, y: 0}}
              viewport={{once: true, amount: 0.4}}
              transition={{duration: 0.6}}
            >
              <span className="cn-eyebrow">{grid.eyebrow}</span>
              <h2 id={cx('circles-heading')} className="cn-title-serif">{grid.title}</h2>
              <p className="cn-section-sub">{grid.sub}</p>
            </motion.div>

            <motion.div className="cn-circles-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{once: true, amount: 0.15}}>
              {grid.items.map(item => (
                <motion.div key={item.title} className={'cn-circle-card' + (item.sage ? ' cn-circle-card-sage' : '')} variants={cardIn}>
                  <item.icon className={`cn-circle-icon ${cx('grid-icon')}`} aria-hidden="true" />
                  <h3 className="cn-circle-title">{item.title}</h3>
                  <p className="cn-circle-desc">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ==================== Benefits (dark band) ==================== */}
      {benefits && (
        <motion.section
          className="cn-benefits-wrap"
          aria-labelledby={cx('benefits-heading')}
          initial={{opacity: 0, y: 30}}
          whileInView={{opacity: 1, y: 0}}
          viewport={{once: true, amount: 0.2}}
          transition={{duration: 0.7}}
        >
          <div className="cn-container">
            <div className="cn-benefits">
              <div>
                <span className="cn-eyebrow cn-eyebrow-dark">{benefits.eyebrow}</span>
                <h2 id={cx('benefits-heading')} className="cn-title-serif cn-benefits-title">{benefits.title}</h2>
                <p className="cn-benefits-desc">{benefits.desc}</p>
                <ul className="cn-checklist">
                  {benefits.items.map(item => (
                    <li className="cn-check-item" key={item}>
                      <span className="cn-check-badge" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Image src={benefits.image} alt={benefits.imageAlt} width={550} height={310} loading="eager" className="cn-benefits-img" />
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ==================== Pricing ==================== */}
      <div id={cx('pricing')} className="cw-pricing-wrap">
        <ServicePricingSection service={pricingService} serviceTitle={pricingTitle} />
      </div>

      {/* ==================== CTA Banner ==================== */}
      <motion.section
        className="cn-banner-wrap"
        aria-labelledby={cx('banner-heading')}
        initial={{opacity: 0, y: 30}}
        whileInView={{opacity: 1, y: 0}}
        viewport={{once: true, amount: 0.25}}
        transition={{duration: 0.7}}
      >
        <div className="cn-container">
          <div className="cn-banner">
            <div>
              <span className="cn-eyebrow cn-eyebrow-dark">{banner.eyebrow}</span>
              <h2 id={cx('banner-heading')} className="cn-title-serif cn-banner-title">{banner.title}</h2>
              <p className="cn-banner-desc">{banner.desc}</p>
              <div className="cn-banner-actions">
                <button type="button" onClick={() => openBooking(pricingTitle)} className="cn-btn-gold dp-magnetic">
                  {hero.primaryLabel || 'Book a Tour'} <ArrowRight size={17} aria-hidden="true" />
                </button>
                <a href={`#${cx('pricing')}`} className="cn-btn-outline-dark">
                  {banner.secondaryLabel || 'View Pricing'}
                </a>
              </div>
            </div>
            <div>
              <Image src={banner.image} alt={banner.imageAlt} width={450} height={260} loading="eager" className="cn-banner-img" />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ==================== FAQ ==================== */}
      {faq && (
        <section className="cn-faq-sec" aria-labelledby={cx('faq-heading')}>
          <div className="cn-container">
            <div className="hp-faq-grid">
              <div>
                <span className="cn-eyebrow">{faq.eyebrow || 'FAQ'}</span>
                <h2 id={cx('faq-heading')} className="cn-title-serif">{faq.title}</h2>
                <p className="cn-section-sub">{faq.desc}</p>
                {faq.ctaLabel && (
                  <button
                    type="button"
                    onClick={() => openBooking(faq.ctaService || pricingTitle)}
                    className="cn-btn-gold dp-magnetic"
                    style={{marginTop: '28px'}}
                  >
                    {faq.ctaLabel} <ArrowRight size={17} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="hp-faq-list">
                {faq.items.map((item, idx) => (
                  <details key={idx}>
                    <summary>
                      <span>{item.q}</span>
                      <Plus size={18} aria-hidden="true" />
                    </summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== More Ways ==================== */}
      <section className="cn-more-ways" aria-labelledby={cx('more-heading')}>
        <div className="cn-container">
          <div className="cn-more-header">
            <span className="cn-eyebrow">EXPLORE MORE</span>
            <h2 id={cx('more-heading')} className="cn-title-serif">More ways to move forward.</h2>
          </div>

          <motion.div className="cn-more-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{once: true, amount: 0.2}}>
            {moreWays.map(item => (
              <motion.div key={item.title} variants={cardIn}>
                <Link prefetch={false} href={item.href} className="cn-more-card">
                  <item.icon className="cn-more-icon" aria-hidden="true" />
                  <h3 className="cn-more-title">{item.title}</h3>
                  <p className="cn-more-desc">{item.desc}</p>
                  <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
