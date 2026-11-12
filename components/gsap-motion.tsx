'use client';

import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {MOTION_TOKENS} from '@/lib/motion-tokens';
import {splitText} from '@/lib/split-text';
import {canRunRichEffects, useReducedMotion} from '@/lib/use-reduced-motion';

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollTrigger);

/*
  One motion orchestrator for every public page.

  Contract:
  - Server HTML is always fully visible. JS only adds temporary "pending" states to content
    that is BELOW the first viewport, so the hero, H1 and LCP image are never hidden.
  - Lenis (desktop, fine pointer, capable device, no reduced motion) shares gsap.ticker with
    ScrollTrigger and the WebGL backdrop: a single animation loop.
  - Per-route work lives in one gsap.context(), reverted on navigation, so timelines,
    ScrollTriggers and inline styles never leak between routes.
  - Reduced motion is observed live; switching it on reveals everything and stops Lenis.
*/

interface LenisInstance {
  on(event: string, handler: (payload: never) => void): void;
  off(event: string, handler: (payload: never) => void): void;
  raf(time: number): void;
  stop(): void;
  start(): void;
  resize(): void;
  destroy(): void;
  scrollTo(target: Element | string | number, options?: {offset?: number; duration?: number; immediate?: boolean; force?: boolean}): void;
  isStopped: boolean;
}

const REVEAL_SELECTOR = [
  '[data-reveal]',
  '.hp-section-head > *', '.hp-heading', '.hp-actions', '.hp-service-card', '.lv-service',
  '.price-card', '.pricing-filters', '.lx-card-col', '.lx-testimonial-card', '.lx-stat',
  '.lx-quote', '.lx-table-wrap', '.lx-faq details', '.ip-service-card', '.ip-feature-card',
  '.ip-topic', '.directory-card', '.journal-card', '.ip-journal-card', '.contact-detail',
  '.cn-circle-card', '.cn-membership-card', '.sv-card', '.mem-plan-card', '.uc-card',
  '.visit-contact > *', '.hp-faq-list details', '.ap-card', '.lx-sec .lx-h', '.lx-sec .lx-text',
  '.lx-sec .lx-img', '.ip-section-heading > *', '.archive-intro > *', '.visit-hero-copy > *',
  '.cn-section-head > *', '.sv-section-head > *', '.mem-section-head > *', '.uc-section-head > *'
].join(',');

const SKIP_SCOPE = '[data-mo-static], dialog, [role="dialog"], .wj-header, .wj-footer';
const COUNT_SELECTOR = '.lv-stats dd,[data-mo-count],[data-anim="counter"]';
const MAGNETIC_SELECTOR = '[data-magnetic]:is(.wj-button,.btn,.ip-button,.lv-pill,.cn-btn-gold)';

/* PublicLayout renders inside each page, so this component remounts on every navigation.
   Session-wide state therefore lives at module level: the first path seen (to tell the
   initial document load from client navigations) and a single Lenis instance whose teardown
   is deferred and cancelled by the next mount. */
let initialPath: string | null = null;
let sharedLenis: {lenis: LenisInstance; destroy: () => void} | null = null;
let lenisDisposeTimer: number | undefined;
const disposeLenis = () => {sharedLenis?.destroy(); sharedLenis = null;};

/** Element starts inside (or just below) the first viewport: render it as-is, never hide it. */
const inFirstView = (el: Element) => el.getBoundingClientRect().top < window.innerHeight * 0.98;

export function GsapMotion() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const lenisRef = useRef<LenisInstance | null>(null);

  /* Route entrance is a CSS animation keyed off this flag, so the very first document load
     paints instantly and only client-side navigations get the short fade-rise. */
  useEffect(() => {
    if (initialPath === null) initialPath = pathname;
    else if (pathname !== initialPath) document.documentElement.dataset.navigated = '';
  }, [pathname]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'enhanced';
  }, [reduced]);

  /* ---- Smooth scroll: created once per preference, survives navigations. ---- */
  useEffect(() => {
    window.clearTimeout(lenisDisposeTimer);
    if (reduced || !canRunRichEffects()) {
      disposeLenis();
      return;
    }
    const scheduleDispose = () => {lenisRef.current = null; lenisDisposeTimer = window.setTimeout(disposeLenis, 4000);};
    if (sharedLenis) {
      lenisRef.current = sharedLenis.lenis;
      return scheduleDispose;
    }
    let disposed = false;
    import('@studio-freight/lenis').then(({default: Lenis}) => {
      if (disposed || sharedLenis) return;
      const lenis = new Lenis({lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, syncTouch: false}) as unknown as LenisInstance;
      lenisRef.current = lenis;
      document.documentElement.classList.add('has-lenis');
      lenis.on('scroll', ScrollTrigger.update as never);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // Scroll locks (booking dialog, mobile menu) write inline overflow on <body>/<html>.
      // Watching only those two elements avoids reacting to GSAP's per-frame style writes.
      const sync = () => {
        const locked = [document.body, document.documentElement].some(node => node.style.overflow === 'hidden' || node.style.position === 'fixed');
        if (locked) lenis.stop(); else lenis.start();
      };
      const observer = new MutationObserver(sync);
      observer.observe(document.body, {attributes: true, attributeFilter: ['style']});
      observer.observe(document.documentElement, {attributes: true, attributeFilter: ['style']});
      sync();

      sharedLenis = {lenis, destroy: () => {
        observer.disconnect();
        gsap.ticker.remove(tick);
        lenis.destroy();
        document.documentElement.classList.remove('has-lenis');
      }};
    }).catch(() => {/* native scrolling remains */});
    return () => {disposed = true; scheduleDispose();};
  }, [reduced]);

  /* ---- Header: elevation + direction-aware retract. Persistent across routes. ---- */
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.wj-platform .wj-header');
    if (!header) return;
    let lastY = window.scrollY;
    let travel = 0;
    let frame = 0;
    const holdOpen = () => header.matches(':focus-within, :hover') || Boolean(header.querySelector('[aria-expanded="true"]'));
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      header.classList.toggle('is-elevated', y > 80);
      const delta = y - lastY;
      lastY = y;
      if (reduced || y < 320 || holdOpen()) {
        travel = 0;
        header.classList.remove('is-retracted');
        return;
      }
      // Accumulate travel in one direction so small jitters never flicker the header.
      travel = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
      if (travel > 56) header.classList.add('is-retracted');
      else if (travel < -28) header.classList.remove('is-retracted');
    };
    const onScroll = () => {if (!frame) frame = requestAnimationFrame(update);};
    const reveal = () => header.classList.remove('is-retracted');
    window.addEventListener('scroll', onScroll, {passive: true});
    header.addEventListener('focusin', reveal);
    update();

    // Mobile service pills: edge fades follow the scroll position and the current page's pill
    // starts in view (scrollLeft only, never scrolling the page itself).
    const strip = header.querySelector<HTMLElement>('.lv-strip ul');
    let stripObserver: ResizeObserver | undefined;
    const edges = () => {
      if (!strip) return;
      const max = strip.scrollWidth - strip.clientWidth;
      strip.dataset.scroll = max <= 2 ? 'none' : strip.scrollLeft <= 2 ? 'start' : strip.scrollLeft >= max - 2 ? 'end' : 'middle';
    };
    if (strip) {
      const current = strip.querySelector<HTMLElement>('[aria-current="page"]');
      if (current && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
      strip.addEventListener('scroll', edges, {passive: true});
      stripObserver = new ResizeObserver(edges);
      stripObserver.observe(strip);
      edges();
    }
    return () => {
      strip?.removeEventListener('scroll', edges);
      stripObserver?.disconnect();
      window.removeEventListener('scroll', onScroll);
      header.removeEventListener('focusin', reveal);
      cancelAnimationFrame(frame);
      header.classList.remove('is-retracted');
    };
    // The header remounts with each route's shell, so rebind on navigation.
  }, [reduced, pathname]);

  /* ---- Per-route choreography. ---- */
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.wj-platform');
    if (!root) return;
    const timers: number[] = [];
    const cleanups: Array<() => void> = [];
    const splits: Array<{revert: () => void}> = [];

    const revealAll = () => {
      root.querySelectorAll<HTMLElement>('[data-mo-pending]').forEach(el => {
        el.classList.add('is-revealed');
        el.removeAttribute('data-mo-pending');
      });
    };

    // A navigation keeps the same Lenis instance; resync its target with the new document.
    const lenis = lenisRef.current;
    if (lenis) requestAnimationFrame(() => {lenis.resize(); lenis.scrollTo(window.scrollY, {immediate: true, force: true});});

    if (reduced) {
      revealAll();
      return revealAll;
    }

    const rich = canRunRichEffects();
    const desktop = window.matchMedia('(min-width: 1024px)').matches;

    // In-page anchors glide with Lenis, offset by the live header height.
    const onAnchorClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const href = anchor?.getAttribute('href');
      if (!anchor || !href || href === '#' || anchor.classList.contains('wj-skip')) return;
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      const active = lenisRef.current;
      if (!target || !active || active.isStopped) return;
      event.preventDefault();
      history.pushState(null, '', href);
      const headerHeight = document.querySelector<HTMLElement>('.wj-header')?.offsetHeight ?? 90;
      active.scrollTo(target, {offset: -(headerHeight + 12), duration: 0.9});
    };
    document.addEventListener('click', onAnchorClick);
    cleanups.push(() => document.removeEventListener('click', onAnchorClick));

    const ctx = gsap.context(() => {
      // Reading progress (thin amber bar).
      const progressBar = root.querySelector<HTMLElement>('.gx-progress');
      if (progressBar) {
        const setProgress = gsap.quickSetter(progressBar, 'scaleX');
        ScrollTrigger.create({start: 'top top', end: 'max', onUpdate: self => setProgress(self.progress)});
      }

      // 1. Declarative [data-anim] reveals - below the first viewport only.
      root.querySelectorAll<HTMLElement>('[data-anim]').forEach(el => {
        if (el.closest(SKIP_SCOPE) || inFirstView(el)) return;
        const type = el.dataset.anim || 'fade-up';
        if (type === 'counter') return;
        const delay = Math.min(parseFloat(el.dataset.animDelay || '0'), 0.3);
        const scrollTrigger = {trigger: el, start: el.dataset.animStart || 'top 88%', once: true};
        const enter = {duration: MOTION_TOKENS.duration.reveal, ease: MOTION_TOKENS.ease.enter, delay, scrollTrigger};

        if (type === 'split-lines' || type === 'split-chars') {
          const split = splitText(el, type === 'split-chars' ? {chars: true, lines: false} : {lines: true});
          splits.push(split);
          const parts = type === 'split-chars' ? split.chars : split.lines;
          if (!parts.length) return;
          gsap.fromTo(parts, {yPercent: type === 'split-chars' ? 40 : 100, autoAlpha: 0}, {
            yPercent: 0, autoAlpha: 1, stagger: type === 'split-chars' ? 0.015 : MOTION_TOKENS.stagger.base,
            ...enter, clearProps: 'transform,opacity,visibility,willChange',
          });
        } else if (type === 'clip-up') {
          gsap.fromTo(el, {clipPath: 'inset(100% 0 0 0)', y: MOTION_TOKENS.distance.xs}, {clipPath: 'inset(0% 0 0 0)', y: 0, ...enter, clearProps: 'clipPath,transform'});
        } else if (type === 'mask-reveal') {
          const media = el.querySelector<HTMLElement>('img, .lv-contain, .hp-photo');
          const tl = gsap.timeline({scrollTrigger, delay});
          tl.fromTo(el, {clipPath: 'inset(100% 0 0 0)'}, {clipPath: 'inset(0% 0 0 0)', duration: MOTION_TOKENS.duration.cinematic, ease: MOTION_TOKENS.ease.cinematic, clearProps: 'clipPath'});
          if (media) tl.fromTo(media, {scale: 1.06}, {scale: 1, duration: MOTION_TOKENS.duration.cinematic, ease: MOTION_TOKENS.ease.smooth, clearProps: 'transform'}, 0);
        } else if (type === 'scale-in') {
          gsap.fromTo(el, {scale: 0.96, autoAlpha: 0}, {scale: 1, autoAlpha: 1, ...enter, clearProps: 'transform,opacity,visibility'});
        } else if (type === 'fade') {
          gsap.fromTo(el, {autoAlpha: 0}, {autoAlpha: 1, ...enter, ease: MOTION_TOKENS.ease.state, clearProps: 'opacity,visibility'});
        } else {
          gsap.fromTo(el, {y: MOTION_TOKENS.distance.sm, autoAlpha: 0}, {y: 0, autoAlpha: 1, ...enter, clearProps: 'transform,opacity,visibility'});
        }
      });

      // 2. Staggered groups.
      root.querySelectorAll<HTMLElement>('[data-anim-stagger-group]').forEach(container => {
        if (container.closest(SKIP_SCOPE) || inFirstView(container)) return;
        const items = Array.from(container.children) as HTMLElement[];
        if (!items.length) return;
        const stagger = Math.min(parseFloat(container.dataset.animStagger || '0.06'), MOTION_TOKENS.stagger.cap / items.length);
        gsap.fromTo(items, {y: MOTION_TOKENS.distance.sm, autoAlpha: 0}, {
          y: 0, autoAlpha: 1, duration: MOTION_TOKENS.duration.slow, ease: MOTION_TOKENS.ease.enter, stagger,
          scrollTrigger: {trigger: container, start: 'top 88%', once: true}, clearProps: 'transform,opacity,visibility',
        });
      });

      // 3. Parallax on selected media - capable desktops only, small displacement.
      if (rich) {
        root.querySelectorAll<HTMLElement>('[data-parallax]').forEach(el => {
          const offset = Math.min(parseFloat(el.dataset.parallax || '0.06'), 0.1) * 120;
          gsap.fromTo(el, {y: -offset}, {y: offset, ease: 'none', scrollTrigger: {trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true}});
        });
      }

      // 4. Number counters (below the fold; the server text stays until the trigger fires).
      root.querySelectorAll<HTMLElement>(COUNT_SELECTOR).forEach(el => {
        if (inFirstView(el)) return;
        const match = (el.textContent || '').trim().match(/^(\$?)(\d[\d,]*)(.*)$/);
        if (!match) return;
        const [, prefix = '', digits, suffix = ''] = match;
        const target = Number(digits.replaceAll(',', ''));
        if (target <= 1 && !suffix) return;
        const counter = {value: 0};
        gsap.to(counter, {
          value: target, duration: 1.1, ease: 'power3.out',
          scrollTrigger: {trigger: el, start: 'top 88%', once: true},
          onUpdate: () => {el.textContent = prefix + Math.round(counter.value).toLocaleString('en-US') + suffix;},
        });
      });

      // 5. Pinned storytelling (desktop only).
      if (desktop && rich) {
        root.querySelectorAll<HTMLElement>('[data-pin="section"]').forEach(section => {
          ScrollTrigger.create({trigger: section, pin: section.querySelector<HTMLElement>('.lv-pin-inner') || section, start: 'top 80px', end: '+=100%', pinSpacing: true, anticipatePin: 1});
        });
      }

      // 6. Restrained 3D tilt - explicit [data-tilt] decorative cards only, capped at 3deg.
      if (rich) {
        root.querySelectorAll<HTMLElement>('[data-tilt]').forEach(card => {
          if (card.closest('form, dialog')) return;
          const max = Math.min(parseFloat(card.dataset.tilt || '3'), MOTION_TOKENS.tilt.maxDeg);
          gsap.set(card, {transformPerspective: MOTION_TOKENS.tilt.perspective});
          const rx = gsap.quickTo(card, 'rotateX', {duration: 0.4, ease: 'power2.out'});
          const ry = gsap.quickTo(card, 'rotateY', {duration: 0.4, ease: 'power2.out'});
          const move = (e: PointerEvent) => {
            const r = card.getBoundingClientRect();
            ry(((e.clientX - r.left) / r.width - 0.5) * 2 * max);
            rx(-((e.clientY - r.top) / r.height - 0.5) * 2 * max);
          };
          const leave = () => {rx(0); ry(0);};
          card.addEventListener('pointermove', move);
          card.addEventListener('pointerleave', leave);
          cleanups.push(() => {card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave);});
        });
      }

      // 7. Magnetic primary CTAs. Writes CSS custom properties consumed by the `translate`
      //    property, so it composes with the shared hover lift instead of fighting it.
      if (rich) {
        root.querySelectorAll<HTMLElement>(MAGNETIC_SELECTOR).forEach(btn => {
          if (btn.closest('form, dialog, [role="dialog"]')) return;
          const factor = Math.min(parseFloat(btn.dataset.magnetic || '0.2'), 0.3);
          const max = MOTION_TOKENS.magnetic.maxOffsetPx;
          let frame = 0;
          const move = (e: PointerEvent) => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              const r = btn.getBoundingClientRect();
              const clamp = (v: number) => Math.max(-max, Math.min(max, v));
              btn.style.setProperty('--mag-x', clamp((e.clientX - r.left - r.width / 2) * factor).toFixed(1) + 'px');
              btn.style.setProperty('--mag-y', clamp((e.clientY - r.top - r.height / 2) * factor).toFixed(1) + 'px');
            });
          };
          const leave = () => {cancelAnimationFrame(frame); frame = 0; btn.style.removeProperty('--mag-x'); btn.style.removeProperty('--mag-y');};
          btn.dataset.magneticActive = '';
          btn.addEventListener('pointermove', move);
          btn.addEventListener('pointerleave', leave);
          cleanups.push(() => {leave(); delete btn.dataset.magneticActive; btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerleave', leave);});
        });
      }
    }, root);

    // 8. Shared CSS reveal contract for card grids and section heads (IntersectionObserver).
    const siblingIndex = new Map<Element, number>();
    const pending: HTMLElement[] = [];
    root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach(el => {
      if (el.dataset.anim || el.closest(SKIP_SCOPE) || el.parentElement?.closest('[data-mo-reveal]')) return;
      el.dataset.moReveal = '';
      if (inFirstView(el)) {el.classList.add('is-revealed'); return;}
      const parent = el.parentElement || root;
      const index = siblingIndex.get(parent) || 0;
      siblingIndex.set(parent, index + 1);
      el.style.setProperty('--mo-delay', Math.min(index * 60, 360) + 'ms');
      el.dataset.moPending = '';
      pending.push(el);
    });
    if (pending.length) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const target = entry.target as HTMLElement;
          target.classList.add('is-revealed');
          target.removeAttribute('data-mo-pending');
          observer.unobserve(target);
        }
      }, {rootMargin: '0px 0px 8% 0px', threshold: 0.01});
      pending.forEach(el => observer.observe(el));
      timers.push(window.setTimeout(revealAll, 4000)); // never leave content hidden
      cleanups.push(() => observer.disconnect());
    }

    // 9. Below-fold images fade in once decoded; the LCP/eager images are never touched.
    root.querySelectorAll<HTMLImageElement>('main img:not([data-mo-static]):not([loading="eager"]):not([fetchpriority="high"])').forEach(img => {
      if (img.complete || inFirstView(img)) return;
      img.dataset.moImage = '';
      const ready = () => img.classList.add('is-mo-loaded');
      img.addEventListener('load', ready, {once: true});
      img.addEventListener('error', ready, {once: true});
      timers.push(window.setTimeout(ready, 2000));
    });

    // Layout settles after fonts/images: one refresh, not one per trigger.
    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState === 'complete') requestAnimationFrame(refresh);
    else window.addEventListener('load', refresh, {once: true});
    cleanups.push(() => window.removeEventListener('load', refresh));

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      cleanups.reverse().forEach(clean => clean());
      splits.forEach(split => split.revert());
      ctx.revert();
      revealAll();
    };
  }, [pathname, reduced]);

  return <div className="gx-progress" aria-hidden="true" />;
}
