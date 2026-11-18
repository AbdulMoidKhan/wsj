'use client';

import {useEffect} from 'react';

/*
  Homepage choreography (GSAP). One signature move per section:
  - hero: photographs drift at two speeds and the copy eases away as you leave;
  - statement: words light up one by one as you read down (scrubbed);
  - spaces: the section pins on desktop and the rail of rooms slides sideways (scrubbed);
  - explorer, price sheet, studio sessions, index rows: once-only entrances;
  - growth index: a photograph follows the cursor and swaps per row;
  - studio, FAQ, visit: photographs zoom / drift with scroll.

  Contract (shared with components/gsap-motion.tsx):
  - Server HTML is complete and visible. Only elements below the viewport ever get a start state.
  - Loaded lazily (components/deferred-motion.tsx); GSAP and ScrollTrigger are dynamic imports.
  - prefers-reduced-motion gets nothing. Everything is reverted on unmount.
*/

type Gsap = typeof import('gsap').default;
type Tween = ReturnType<Gsap['from']>;

export function JunctionMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('#main.junction-home');
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    import('gsap').then(({default: gsap}) => {
      if (disposed) return;
      const q = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel));
      const one = (sel: string) => root.querySelector<HTMLElement>(sel);
      const desktop = window.matchMedia('(min-width: 1024px)').matches;
      const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      const ease = 'expo.out';
      const tweens: Tween[] = [];

      /* Once-only entrances: the first observer report says whether a trigger is below the
         viewport; only those receive a start state and play when they enter. */
      const pending = new Map<Element, () => Tween>();
      const armed = new Map<Element, Tween>();
      const seen = new Set<Element>();
      const io = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const target = entry.target;
          if (!seen.has(target)) {
            seen.add(target);
            const below = !entry.isIntersecting && entry.boundingClientRect.top > 0;
            const make = pending.get(target);
            pending.delete(target);
            if (!below || !make) { io.unobserve(target); continue; }
            const tween = make();
            tweens.push(tween);
            armed.set(target, tween);
            continue;
          }
          if (entry.isIntersecting) {
            armed.get(target)?.play();
            armed.delete(target);
            io.unobserve(target);
          }
        }
      }, {rootMargin: '0px 0px -10% 0px'});
      const enter = (trigger: Element | null, make: () => Tween) => {
        if (!trigger) return;
        pending.set(trigger, make);
        io.observe(trigger);
      };
      cleanups.push(() => io.disconnect());
      let settleTimer = 0;
      const settle = () => {
        const limit = window.innerHeight * 0.92;
        for (const [el, tween] of [...armed]) {
          if (el.getBoundingClientRect().top >= limit) continue;
          tween.play(); armed.delete(el); io.unobserve(el);
        }
      };
      const onScroll = () => { window.clearTimeout(settleTimer); settleTimer = window.setTimeout(settle, 140); };
      window.addEventListener('scroll', onScroll, {passive: true});
      cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.clearTimeout(settleTimer); });

      const rise = (targets: Element | Element[] | null, vars: Record<string, unknown> = {}) => gsap.from(targets || [], {y: 48, autoAlpha: 0, duration: 1.1, ease, paused: true, clearProps: 'transform,opacity,visibility', ...vars});
      const clipIn = (el: HTMLElement | null) => gsap.timeline({paused: true})
        .fromTo(el, {clipPath: 'inset(100% 0% 0% 0% round 22px)'}, {clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath'})
        .from(el?.querySelector('img') || [], {scale: 1.25, duration: 1.8, ease, clearProps: 'transform'}, 0) as unknown as Tween;

      enter(one('.h-intro-side'), () => rise(q('.h-intro-side > *'), {stagger: 0.1}));
      enter(one('.h-spaces-head'), () => rise(q('.h-spaces-head > div'), {stagger: 0.12}));
      if (!desktop) enter(one('.h-rail'), () => gsap.from(q('.h-rail > li'), {y: 36, autoAlpha: 0, duration: 1.1, ease, stagger: 0.08, paused: true, clearProps: 'transform,opacity,visibility'}));
      enter(one('.jx-verbs'), () => gsap.from(q('.jx-verb'), {yPercent: 60, autoAlpha: 0, duration: 0.9, ease, stagger: 0.07, paused: true, clearProps: 'transform,opacity,visibility'}));
      enter(one('.jx-stage'), () => rise(one('.jx-stage'), {y: 70}));
      enter(one('.j-foundation-figure'), () => clipIn(one('.j-foundation-figure')));
      const sheet = one('.j-sheet');
      enter(sheet, () => gsap.timeline({paused: true})
        .from(sheet, {y: 110, rotation: desktop ? -2 : 0, autoAlpha: 0, transformOrigin: '20% 100%', duration: 1.2, ease, clearProps: 'transform,opacity,visibility'})
        .from(q('.j-sheet-group li'), {y: 18, autoAlpha: 0, duration: 0.7, ease, stagger: 0.05, clearProps: 'transform,opacity,visibility'}, 0.35) as unknown as Tween);
      enter(one('.j-index'), () => gsap.from(q('.j-index > li'), {y: 40, autoAlpha: 0, duration: 1, ease, stagger: 0.07, paused: true, clearProps: 'transform,opacity,visibility'}));
      enter(one('.st-studios'), () => rise(q('.st-studio'), {y: 28, stagger: 0.08}));
      enter(one('.st-tiers'), () => rise(q('.st-tier'), {y: 60, stagger: 0.1}));
      enter(one('.j-studio-second'), () => clipIn(one('.j-studio-second')));
      enter(one('.j-community-figure'), () => gsap.fromTo(one('.j-community-figure'), {clipPath: 'inset(0% 100% 0% 0% round 32px)'}, {clipPath: 'inset(0% 0% 0% 0% round 32px)', duration: 1.4, ease: 'expo.inOut', paused: true, clearProps: 'clipPath'}));
      enter(one('.j-community-copy'), () => rise(q('.j-community-copy > *'), {stagger: 0.08}));
      enter(one('.j-audiences ul'), () => gsap.from(q('.j-audiences li'), {y: 24, scale: 0.94, autoAlpha: 0, duration: 0.8, ease, stagger: 0.05, paused: true, clearProps: 'transform,opacity,visibility'}));
      enter(one('.j-faq-list'), () => rise(q('.j-faq-list details'), {y: 24, stagger: 0.06}));
      enter(one('.j-faq-tall'), () => clipIn(one('.j-faq-tall')));
      enter(one('.j-visit-card'), () => rise(one('.j-visit-card'), {y: 90}));
      cleanups.push(() => tweens.forEach(t => t.revert()));

      /* Growth index: one photograph follows the pointer and swaps to the hovered row's image. */
      const cursor = one('.h-cursor-img');
      const index = one('.j-index');
      if (cursor && index && finePointer && desktop) {
        const images = Array.from(cursor.querySelectorAll('img'));
        const rows = q('.j-index > li');
        gsap.set(cursor, {xPercent: -50, yPercent: -50, scale: 0.6});
        const x = gsap.quickTo(cursor, 'x', {duration: 0.6, ease: 'power3'});
        const y = gsap.quickTo(cursor, 'y', {duration: 0.6, ease: 'power3'});
        const rot = gsap.quickTo(cursor, 'rotation', {duration: 0.8, ease: 'power3'});
        let lastX = 0;
        const move = (e: PointerEvent) => { x(e.clientX); y(e.clientY); rot(Math.max(-8, Math.min(8, (e.clientX - lastX) * 0.4))); lastX = e.clientX; };
        const show = () => gsap.to(cursor, {autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power3.out', overwrite: 'auto'});
        const hide = () => gsap.to(cursor, {autoAlpha: 0, scale: 0.6, duration: 0.4, ease: 'power3.in', overwrite: 'auto'});
        const swap = (i: number) => images.forEach((img, k) => img.classList.toggle('is-on', k === i));
        const rowHandlers = rows.map((row, i) => { const h = () => swap(i); row.addEventListener('pointerenter', h); return () => row.removeEventListener('pointerenter', h); });
        index.addEventListener('pointermove', move);
        index.addEventListener('pointerenter', show);
        index.addEventListener('pointerleave', hide);
        cleanups.push(() => {
          rowHandlers.forEach(off => off());
          index.removeEventListener('pointermove', move);
          index.removeEventListener('pointerenter', show);
          index.removeEventListener('pointerleave', hide);
          gsap.set(cursor, {clearProps: 'all'});
        });
      }

      /* Statement: wrap words once so they can be lit in sequence. Each text node React rendered
         is swapped for word spans and kept; cleanup puts those same node objects back, so React's
         references stay valid and no markup React owns is ever rewritten from a string. */
      const statement = one('.h-statement');
      const words: HTMLElement[] = [];
      const swapped: Array<{text: Text; parts: Node[]}> = [];
      if (statement) {
        const wrap = (node: Node) => {
          for (const child of Array.from(node.childNodes)) {
            if (child instanceof Text) {
              const parts: Node[] = [];
              (child.data || '').split(/(\s+)/).forEach(part => {
                if (!part) return;
                if (/^\s+$/.test(part)) { parts.push(document.createTextNode(part)); return; }
                const span = document.createElement('span');
                span.className = 'h-word';
                span.textContent = part;
                words.push(span);
                parts.push(span);
              });
              if (!parts.length) continue;
              child.replaceWith(...parts);
              swapped.push({text: child, parts});
            } else if (child.nodeType === Node.ELEMENT_NODE) wrap(child);
          }
        };
        wrap(statement);
        cleanups.push(() => {
          for (const {text, parts} of swapped.reverse()) {
            const first = parts[0];
            if (first.parentNode) first.parentNode.insertBefore(text, first);
            parts.forEach(part => part.parentNode?.removeChild(part));
          }
          swapped.length = 0;
        });
      }

      /* Scrubbed scenes, created together after the next idle period. */
      const idle = (fn: () => void) => typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, {timeout: 1500}) : window.setTimeout(fn, 300);
      const idleHandle = idle(() => { if (!disposed) void import('gsap/ScrollTrigger').then(({ScrollTrigger}) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ignoreMobileResize: true});
        const spaces = one('.h-spaces');
        const ctx = gsap.context(() => {
          const scrub = (trigger: Element | null, start: string, end: string, amount: number | boolean = true) => ({trigger, start, end, scrub: amount});

          if (statement && words.length) {
            gsap.fromTo(words, {opacity: 0.16}, {opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: scrub(statement, 'top 85%', 'bottom 45%', 0.4)});
          }

          const visit = one('.j-visit');
          const visitImg = visit?.querySelector('.j-visit-photo img');
          if (visit && visitImg) gsap.fromTo(visitImg, {scale: 1.3}, {scale: 1, ease: 'none', scrollTrigger: scrub(visit, 'top bottom', 'bottom top', 0.4)});

          const hero = one('.h-hero');
          if (hero) {
            gsap.to(one('.h-hero-main'), {yPercent: desktop ? -8 : -4, ease: 'none', scrollTrigger: scrub(hero, 'top top', 'bottom top')});
            gsap.to(one('.h-hero-side'), {yPercent: desktop ? -28 : -12, ease: 'none', scrollTrigger: scrub(hero, 'top top', 'bottom top')});
            gsap.to(one('.h-hero-img'), {scale: 1.1, ease: 'none', scrollTrigger: scrub(hero, 'top top', 'bottom top')});
          }

          const frame = one('.j-studio-frame');
          if (frame) gsap.fromTo(frame.querySelector('img'), {scale: 1.25}, {scale: 1, ease: 'none', scrollTrigger: scrub(frame, 'top bottom', 'bottom 60%')});

          const mm = gsap.matchMedia(root);
          mm.add('(min-width: 1024px) and (min-height: 600px)', () => {
            if (hero) gsap.to(one('.h-hero-copy'), {y: -90, autoAlpha: 0.25, ease: 'none', scrollTrigger: scrub(hero, 'top top', 'bottom top')});

            /* Spaces: pin and slide the rail by its overflow. */
            const rail = one('.h-rail');
            if (spaces && rail) {
              spaces.classList.add('is-pinned');
              /* Slide until the last card ends one gutter (the rail's own inline padding) from the
                 right edge. Measured with layout properties so it is invariant to transform. */
              const distance = () => {
                const last = rail.lastElementChild as HTMLElement | null;
                if (!last) return 0;
                const pad = parseFloat(getComputedStyle(rail).paddingRight) || 0;
                return Math.max(0, Math.ceil(last.offsetLeft + last.offsetWidth + pad - document.documentElement.clientWidth));
              };
              /* The slide maps 1:1 to scroll; a short hold after it lets the scrubbed rail settle on
                 the last card before the section releases, even on a fast scroll. */
              const HOLD = 0.08;
              const tl = gsap.timeline({
                scrollTrigger: {
                  trigger: spaces,
                  start: 'top top',
                  end: () => '+=' + Math.round(distance() * (1 + HOLD)),
                  pin: true,
                  scrub: 0.3,
                  invalidateOnRefresh: true,
                  anticipatePin: 1,
                },
              })
                .to(rail, {x: () => -distance(), ease: 'none', duration: 1})
                .to({}, {duration: HOLD});

              /* Allow horizontal wheel / trackpad swipe on the rail to advance the gallery */
              const onWheel = (e: WheelEvent) => {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
                  window.scrollBy({ top: e.deltaX });
                }
              };
              spaces.addEventListener('wheel', onWheel, { passive: true });

              return () => {
                spaces.classList.remove('is-pinned');
                spaces.removeEventListener('wheel', onWheel);
                gsap.set(rail, {clearProps: 'transform'});
                tl.kill();
              };
            }
          });

          if (frame) gsap.fromTo(one('.j-studio-second'), {yPercent: 16}, {yPercent: -10, ease: 'none', scrollTrigger: scrub(one('.j-studio-body'), 'top bottom', 'bottom top')});
          const faq = one('.j-faq');
          if (faq) gsap.fromTo(one('.j-faq-square'), {yPercent: 30}, {yPercent: -30, ease: 'none', scrollTrigger: scrub(faq, 'top bottom', 'bottom top')});
          const community = one('.j-community-figure img');
          if (community) gsap.fromTo(community, {scale: 1.15, yPercent: -4}, {scale: 1.15, yPercent: 4, ease: 'none', scrollTrigger: scrub(one('.j-community'), 'top bottom', 'bottom top')});
        }, root);
        /* Trigger positions are measured once; content that settles later (images, fonts, banners)
           moves the sections, and a stale start pins the spaces rail part-way off screen. Re-measure
           whenever the page's height changes, ignoring the change a refresh itself causes. */
        let measuredHeight = 0;
        const refresh = () => { ScrollTrigger.refresh(); measuredHeight = document.body.scrollHeight; };
        if (document.readyState !== 'complete') window.addEventListener('load', refresh, {once: true});
        else requestAnimationFrame(refresh);
        let resizeTimer = 0;
        const heightWatch = new ResizeObserver(() => {
          window.clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(() => { if (Math.abs(document.body.scrollHeight - measuredHeight) > 1) refresh(); }, 200);
        });
        heightWatch.observe(document.body);
        cleanups.push(() => {window.removeEventListener('load', refresh); heightWatch.disconnect(); window.clearTimeout(resizeTimer); ctx.revert(); spaces?.classList.remove('is-pinned');});
      }).catch(() => {/* scenes are optional */}); });
      cleanups.push(() => { if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle); else window.clearTimeout(idleHandle); });
    }).catch(() => {/* motion is optional; the page is already complete */});

    return () => {disposed = true; cleanups.reverse().forEach(clean => clean());};
  }, []);

  return null;
}
