'use client';

import {useEffect} from 'react';

/*
  GSAP motion engine for the public site.

  One loop: Lenis smooth scroll is driven by gsap.ticker and feeds ScrollTrigger,
  so smooth scrolling, scroll-linked animation and the WebGL scene all advance on
  the same frame. Native scroll stays the source of truth (scrollbar, keyboard,
  find-in-page, anchors). Touch devices keep native momentum scrolling.

  Choreography (all transform/opacity/clip-path; nothing animates layout):
  - scroll progress hairline
  - masked line-rise headings (SplitText), eyebrow slide-ins
  - 3D batch reveals for cards, lists and copy blocks
  - clip-path image openings + scrubbed parallax inside every photo frame
  - pinned "deal" of the service cards on desktop (cards fan out from a stack)
  - hero parallax, closing-panel scale-in, velocity skew on photos
  - magnetic primary buttons, footer wordmark character rise
  Content is visible by default; initial states are applied only to elements
  below the first screen and only once GSAP is running. prefers-reduced-motion
  gets no smooth scrolling and no animation.
*/
export function GsapMotion() {
  useEffect(() => {
    let disposed = false;
    let teardown = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText'), import('@studio-freight/lenis')]).then(([{gsap}, {ScrollTrigger}, {SplitText}, {default: Lenis}]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      const root = document.querySelector<HTMLElement>('.wj-platform');
      if (!root) return;
      const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const fine = window.matchMedia('(pointer: fine)').matches;

      /* ---------- Lenis <-> GSAP ---------- */
      let lenis: InstanceType<typeof Lenis> | null = null;
      const lenisTick = (time: number) => lenis?.raf(time * 1000);
      let lockObserver: MutationObserver | null = null;
      let bodyLockObserver: MutationObserver | null = null;
      const onAnchor = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
        const href = a?.getAttribute('href');
        if (!a || !href || href === '#' || a.classList.contains('wj-skip')) return;
        let target: Element | null = null;
        try {target = document.getElementById(decodeURIComponent(href.slice(1)));} catch {return;}
        if (!target || !lenis || lenis.isStopped) return;
        e.preventDefault();
        lenis.scrollTo(target as HTMLElement, {offset: -110, duration: 1.4});
        history.pushState(null, '', href);
      };
      if (!reducedQuery.matches && fine) {
        lenis = new Lenis({lerp: 0.085, smoothWheel: true, wheelMultiplier: 1, syncTouch: false});
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(lenisTick);
        gsap.ticker.lagSmoothing(0);
        const syncLock = () => {
          const locked = document.body.style.overflow === 'hidden' || !!document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([data-state="closed"])');
          if (locked && !lenis?.isStopped) lenis?.stop();
          else if (!locked && lenis?.isStopped) lenis?.start();
        };
        lockObserver = new MutationObserver(syncLock);
        // Do not watch descendant style changes: GSAP writes transforms every frame.
        lockObserver.observe(document.body, {attributes: true, attributeFilter: ['aria-modal', 'data-state', 'open'], childList: true, subtree: true});
        bodyLockObserver = new MutationObserver(syncLock);
        bodyLockObserver.observe(document.body, {attributes: true, attributeFilter: ['style']});
        syncLock();
        document.addEventListener('click', onAnchor);
      }

      const ctx = gsap.context(() => {}, root);
      const mm = gsap.matchMedia();
      const splits: Array<{revert: () => void}> = [];
      // Scroll-scrubbed effects that repaint large photos every frame; dropped in lite mode.
      const heavy: Array<{kill: () => void}> = [];
      const goLite = () => {heavy.splice(0).forEach(h => h.kill()); gsap.set(root.querySelectorAll('.hp-place-photo, .hp-creative-photo, .hp-journal-photo, .journal-image'), {skewY: 0});};
      window.addEventListener('wj:perf-lite', goLite);
      const lite = () => document.documentElement.dataset.perf === 'lite' || (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as Navigator & {connection?: {saveData?: boolean}}).connection?.saveData ?? false);
      if (lite()) document.documentElement.dataset.perf = 'lite';
      const fold = () => window.innerHeight * 0.92;
      const below = (el: Element) => el.getBoundingClientRect().top > fold();
      const $ = <E extends Element = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<E>(sel));

      mm.add({motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 1024px)'}, context => {
        const {motion, desktop} = context.conditions as {motion: boolean; desktop: boolean};
        if (!motion) return;

        /* progress hairline */
        const bar = root.querySelector('.gx-progress');
        if (bar) gsap.fromTo(bar, {scaleX: 0}, {scaleX: 1, ease: 'none', scrollTrigger: {trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.3}});

        /* hero parallax (homepage + inner heroes) */
        const heroImg = root.querySelector('.hp-hero-visual img, .ip-hero-media img');
        const heroFrame = heroImg?.parentElement;
        if (heroImg && heroFrame) heavy.push(gsap.to(heroImg, {yPercent: 10, scale: 1.08, ease: 'none', scrollTrigger: {trigger: heroFrame, start: 'top top+=100', end: 'bottom top', scrub: true}}));
        const heroIntro = root.querySelector('.hp-hero-intro');
        if (heroIntro) gsap.to(heroIntro, {y: -50, autoAlpha: 0.25, ease: 'none', scrollTrigger: {trigger: heroIntro, start: 'top top+=110', end: 'bottom top', scrub: true}});
        const heroAside = root.querySelector('.hp-hero-aside');
        if (heroAside && desktop) gsap.to(heroAside, {y: -60, ease: 'none', scrollTrigger: {trigger: heroAside, start: 'top 60%', end: 'bottom top', scrub: true}});

        /* masked line-rise headings */
        $('.hp-heading, .lx-sec .lx-h.lx-h2:not(.lx-subtitle), .ip-page h2, .ip-archive h2, .wj-closing h2, .hp-pricing h2, .hp-journal-head h3').filter(el => below(el) && !el.closest('.prose, .migrated-content, .ip-article-body')).forEach(el => {
          const accessibleLabel = el.getAttribute('aria-label');
          const split = SplitText.create(el, {type: 'lines', mask: 'lines', linesClass: 'gx-line', autoSplit: true,
            onSplit: self => gsap.from(self.lines, {yPercent: 115, rotate: 2.5, duration: 1.15, ease: 'expo.out', stagger: 0.09, scrollTrigger: {trigger: el, start: 'top 88%', once: true}})});
          if (accessibleLabel) el.setAttribute('aria-label', accessibleLabel);
          splits.push(split);
        });

        /* eyebrows slide in with their hairline */
        $('.hp-eyebrow, .ip-eyebrow, .eyebrow').filter(below).forEach(el => {
          gsap.from(el, {x: -24, autoAlpha: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: {trigger: el, start: 'top 92%', once: true}});
        });

        /* pinned card deal: service cards fan out from a stack (desktop) */
        const discovery = root.querySelector<HTMLElement>('.hp-discovery');
        const dealCards = discovery ? Array.from(discovery.querySelectorAll<HTMLElement>('.hp-service-card')) : [];
        const dealGrid = discovery?.querySelector<HTMLElement>('.hp-service-grid');
        const canPin = desktop && dealGrid && dealCards.length > 1 && dealGrid.offsetHeight < window.innerHeight - 160;
        if (canPin && dealGrid && discovery) {
          const g = dealGrid.getBoundingClientRect();
          const tl = gsap.timeline({scrollTrigger: {trigger: dealGrid, start: 'center 54%', end: '+=80%', pin: true, scrub: 0.8, anticipatePin: 1}});
          dealCards.forEach((card, i) => {
            const r = card.getBoundingClientRect();
            const dx = g.left + g.width / 2 - (r.left + r.width / 2);
            tl.fromTo(card, {x: dx, y: 70 + i * 10, rotation: (i - (dealCards.length - 1) / 2) * 7, rotationY: -18, z: -120 * i, scale: 0.86, transformPerspective: 1400}, {x: 0, y: 0, rotation: 0, rotationY: 0, z: 0, scale: 1, transformPerspective: 1400, ease: 'power3.out', duration: 1, immediateRender: true}, i * 0.08);
          });
          tl.fromTo(discovery.querySelectorAll('.hp-service-card ul li'), {autoAlpha: 0, x: -16}, {autoAlpha: 1, x: 0, stagger: 0.02, duration: 0.4}, 0.55);
        }

        /* 3D batch reveals */
        const batchSel = ['.hp-service-card', '.price-card', '.hp-journal-card', '.journal-card', '.ip-service-card', '.ip-feature-card', '.ip-topic', '.directory-card', '.hp-benefits>div', '.hp-faq-list details', '.hp-creative-links>a', '.wj-footer-links>div', '.wj-footer-top>div', '.contact-detail', '.hp-section-head>p', '.hp-place-copy>p', '.hp-creative-copy>p', '.hp-community-top>p', '.hp-faq-grid>div>p', '.hp-actions', '.hp-all-services', '.pricing-filters', '.ip-lead', '.wj-closing-actions', '.hp-ending-actions', '.lv-service', '.lv-stats>div', '.lv-copy>p:not(.eyebrow)', '.lv-copy .hp-actions', '.lv-faq-side>p:not(.eyebrow)', '.lv-tabs', '.lv-think', '.lv-lead', '.lx-card-col', '.lx-testimonial-card', '.lx-stat', '.lx-quote', '.lx-table-wrap', '.lx-faq details']
          .join(',');
        const batchEls = $(batchSel).filter(el => below(el) && !(canPin && el.classList.contains('hp-service-card')));
        if (batchEls.length) {
          gsap.set(batchEls, {autoAlpha: 0, y: 48, rotationX: -10, transformPerspective: 1000, transformOrigin: '50% 100%'});
          ScrollTrigger.batch(batchEls, {start: 'top 90%', once: true, onEnter: batch => gsap.to(batch, {autoAlpha: 1, y: 0, rotationX: 0, duration: 1.05, ease: 'expo.out', stagger: 0.085, overwrite: true, clearProps: 'transform,opacity,visibility'})});
        }

        /* photo frames: clip-path opening once, then scrubbed parallax inside */
        $('.hp-place-photo, .hp-creative-photo, .hp-journal-photo, .ip-gallery-photo, .ip-page figure, .journal-image, .lv-photo:not(.lv-photo-free)').filter(frame => !frame.closest('.prose, .migrated-content, .ip-article-body')).forEach(frame => {
          const img = frame.querySelector('img');
          if (below(frame)) gsap.fromTo(frame, {clipPath: 'inset(14% 8% 14% 8% round 18px)'}, {clipPath: 'inset(0% 0% 0% 0% round 12px)', duration: 1.4, ease: 'expo.inOut', scrollTrigger: {trigger: frame, start: 'top 85%', once: true}, clearProps: 'clipPath'});
          if (img && !lite()) heavy.push(gsap.fromTo(img, {yPercent: -7, scale: 1.15}, {yPercent: 7, scale: 1.15, ease: 'none', scrollTrigger: {trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true}}));
        });

        /* velocity skew on photo frames (desktop) */
        if (desktop && !lite()) {
          const frames = $('.hp-place-photo, .hp-creative-photo, .hp-journal-photo, .journal-image');
          if (frames.length) {
            const skew = gsap.quickTo(frames, 'skewY', {duration: 0.5, ease: 'power3.out'});
            heavy.push(ScrollTrigger.create({start: 0, end: 'max', onUpdate: self => skew(gsap.utils.clamp(-3, 3, self.getVelocity() / -450))}));
          }
        }

        /* closing panels scale into place */
        $('.hp-ending, .wj-closing-inner').filter(below).forEach(el => {
          gsap.from(el, {scale: 0.92, y: 60, borderRadius: 40, ease: 'none', scrollTrigger: {trigger: el, start: 'top bottom', end: 'top 55%', scrub: true}});
        });

        /* footer wordmark: characters rise */
        const brand = root.querySelector<HTMLElement>('.wj-footer-brand');
        if (brand && brand.firstChild) {
          const split = SplitText.create(brand, {type: 'words,chars', mask: 'chars', autoSplit: true,
            onSplit: self => gsap.from(self.chars, {yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.025, scrollTrigger: {trigger: brand, start: 'top 95%', once: true}})});
          splits.push(split);
        }

        /* magnetic primary buttons */
        const magnets: Array<() => void> = [];
        if (fine) {
          $('.hp-button, .btn-primary, .wj-header-book, .ip-button-primary').forEach(btn => {
            const xTo = gsap.quickTo(btn, 'x', {duration: 0.6, ease: 'elastic.out(1, 0.5)'});
            const yTo = gsap.quickTo(btn, 'y', {duration: 0.6, ease: 'elastic.out(1, 0.5)'});
            const move = (e: PointerEvent) => {const r = btn.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * 0.28); yTo((e.clientY - r.top - r.height / 2) * 0.35);};
            const leave = () => {xTo(0); yTo(0);};
            btn.addEventListener('pointermove', move);
            btn.addEventListener('pointerleave', leave);
            magnets.push(() => {btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerleave', leave);});
          });
        }
        return () => magnets.forEach(off => off());
      });

      // Recalculate trigger positions once images/fonts settle.
      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener('load', refresh);
      document.fonts?.ready.then(() => {if (!disposed) ScrollTrigger.refresh();});

      teardown = () => {
        window.removeEventListener('load', refresh);
        window.removeEventListener('wj:perf-lite', goLite);
        document.removeEventListener('click', onAnchor);
        lockObserver?.disconnect();
        bodyLockObserver?.disconnect();
        splits.forEach(s => s.revert());
        mm.revert();
        ctx.revert();
        gsap.ticker.remove(lenisTick);
        lenis?.destroy();
        lenis = null;
      };
    }).catch(() => {/* native scrolling, static content */});

    return () => {disposed = true; teardown();};
  }, []);

  return <div className="gx-progress" aria-hidden="true"/>;
}
