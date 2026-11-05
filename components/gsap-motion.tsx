'use client';

import {useEffect, useRef} from 'react';
import {usePathname} from 'next/navigation';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {ScrollToPlugin} from 'gsap/ScrollToPlugin';
import {Observer} from 'gsap/Observer';
import {MOTION_TOKENS} from '@/lib/motion-tokens';
import {splitText} from '@/lib/split-text';

// Register standard free GSAP plugins once
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, Observer);
  (window as any).gsap = gsap;
  (window as any).ScrollTrigger = ScrollTrigger;
}

const REVEAL_SELECTOR = [
  '.hp-section-head > *', '.hp-heading', '.hp-actions', '.hp-service-card', '.lv-service',
  '.price-card', '.pricing-filters', '.lx-card-col', '.lx-testimonial-card', '.lx-stat',
  '.lx-quote', '.lx-table-wrap', '.lx-faq details', '.ip-service-card', '.ip-feature-card',
  '.ip-topic', '.directory-card', '.journal-card', '.ip-journal-card', '.contact-detail',
  '.cn-circle-card', '.cn-membership-card', '.sv-card', '.mem-plan-card', '.uc-card',
  '.visit-contact > *', '.hp-faq-list details', '.ap-card', '.lx-sec .lx-h', '.lx-sec .lx-text',
  '.lx-sec .lx-img', '.ip-section-heading > *', '.archive-intro > *', '.visit-hero-copy > *',
  '.cn-section-head > *', '.sv-section-head > *', '.mem-section-head > *', '.uc-section-head > *'
].join(',');

const COUNT_SELECTOR = '.lv-stats dd,[data-mo-count],[data-anim="counter"]';
const IMAGE_SELECTOR = '.wj-platform img:not([data-mo-static])';

export function GsapMotion() {
  const pathname = usePathname();
  const prevPathRef = useRef<string>(pathname);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.wj-platform');
    if (!root) return;

    // Detect user preferences and device capabilities
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const nav = navigator as unknown as { connection?: { saveData?: boolean }; hardwareConcurrency?: number };
    const isLowEnd = Boolean(nav.connection?.saveData || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4));

    document.documentElement.dataset.motion = reduced ? 'reduced' : 'enhanced';

    // Route transition animation if pathname changed
    if (prevPathRef.current !== pathname && !reduced) {
      prevPathRef.current = pathname;
      const curtain = root.querySelector<HTMLElement>('.wj-curtain-wipe');
      if (curtain) {
        gsap.fromTo(
          curtain,
          {scaleY: 1, transformOrigin: 'top center'},
          {
            scaleY: 0,
            duration: 0.42,
            ease: 'expo.out',
            overwrite: 'auto',
          }
        );
      }
    } else {
      prevPathRef.current = pathname;
    }

    const cleanups: Array<() => void> = [];
    const timers: number[] = [];
    const splits: Array<{ revert: () => void }> = [];

    // Safety fallback: reveal all content if anything delays
    const revealAll = () => {
      root.querySelectorAll<HTMLElement>('[data-mo-pending]').forEach(el => {
        el.classList.add('is-revealed');
        el.removeAttribute('data-mo-pending');
      });
    };

    // If reduced motion, reveal everything immediately and skip heavy animations
    if (reduced) {
      revealAll();
      return () => {
        revealAll();
      };
    }

    // Initialize Lenis smooth scroll
    let lenis: any = null;
    let frameLoop: ((time: number) => void) | null = null;

    if (!reduced && fine && !isLowEnd) {
      import('@studio-freight/lenis')
        .then(({default: Lenis}) => {
          lenis = new Lenis({
            lerp: 0.09,
            duration: 1.1,
            smoothWheel: true,
            wheelMultiplier: 1.0,
            touchMultiplier: 1.0,
            syncTouch: false,
          });

          // Sync Lenis with GSAP ScrollTrigger
          lenis.on('scroll', ScrollTrigger.update);
          gsap.ticker.lagSmoothing(0);

          frameLoop = (time: number) => {
            lenis.raf(time * 1000);
          };
          gsap.ticker.add(frameLoop);

          // Stop Lenis when modal/dialogs are open to preserve scroll lock
          const syncScrollLock = () => {
            const locked =
              document.body.style.overflow === 'hidden' ||
              Boolean(document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]'));
            if (locked) {
              lenis?.stop();
            } else {
              lenis?.start();
            }
          };

          const observer = new MutationObserver(syncScrollLock);
          observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['style'],
            childList: true,
            subtree: true,
          });
          syncScrollLock();

          cleanups.push(() => {
            observer.disconnect();
            if (frameLoop) gsap.ticker.remove(frameLoop);
            lenis?.destroy();
          });
        })
        .catch(() => {});
    }

    // Header elevation and shrink on scroll past 80px
    const header = root.querySelector<HTMLElement>('.wj-header');
    if (header) {
      const headerTrigger = ScrollTrigger.create({
        start: 'top -80px',
        onUpdate: self => {
          if (self.isActive || self.scroll() > 80) {
            header.classList.add('is-elevated');
          } else {
            header.classList.remove('is-elevated');
          }
        },
      });
      cleanups.push(() => headerTrigger.kill());
    }

    // Smooth anchor jumps with offset
    const onAnchorClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const href = anchor?.getAttribute('href');
      if (!anchor || !href || href === '#' || anchor.classList.contains('wj-skip')) return;

      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      if (!target) return;

      if (lenis && !lenis.isStopped) {
        event.preventDefault();
        history.pushState(null, '', href);
        lenis.scrollTo(target, {offset: -90, duration: 0.9});
      }
    };
    document.addEventListener('click', onAnchorClick);
    cleanups.push(() => document.removeEventListener('click', onAnchorClick));

    // Thin amber reading progress bar
    const progressBar = root.querySelector<HTMLElement>('.gx-progress');
    if (progressBar) {
      const progressTrigger = ScrollTrigger.create({
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => {
          progressBar.style.transform = `scaleX(${self.progress})`;
        },
      });
      cleanups.push(() => progressTrigger.kill());
    }

    // 1. DECLARATIVE DATA-ANIM REVEALS
    const animElements = Array.from(root.querySelectorAll<HTMLElement>('[data-anim]'));
    animElements.forEach(el => {
      if (el.closest('[data-mo-static], dialog, [role="dialog"], .wj-header, .wj-footer')) return;

      const animType = el.dataset.anim || 'fade-up';
      const delay = parseFloat(el.dataset.animDelay || '0');
      const start = el.dataset.animStart || 'top 88%';
      const once = el.dataset.animOnce !== 'false';

      if (animType === 'split-lines') {
        const split = splitText(el, {lines: true});
        splits.push(split);
        if (split.lines.length > 0) {
          gsap.set(split.lines, {y: '110%', opacity: 0});
          const tween = gsap.to(split.lines, {
            y: '0%',
            opacity: 1,
            duration: MOTION_TOKENS.duration.reveal,
            ease: MOTION_TOKENS.ease.enter,
            stagger: MOTION_TOKENS.stagger.base,
            delay,
            scrollTrigger: {
              trigger: el,
              start,
              once,
            },
          });
          cleanups.push(() => tween.kill());
        }
      } else if (animType === 'split-chars') {
        const split = splitText(el, {chars: true, lines: false});
        splits.push(split);
        if (split.chars.length > 0) {
          gsap.set(split.chars, {y: 20, opacity: 0});
          const tween = gsap.to(split.chars, {
            y: 0,
            opacity: 1,
            duration: MOTION_TOKENS.duration.slow,
            ease: MOTION_TOKENS.ease.enter,
            stagger: 0.02,
            delay,
            scrollTrigger: {
              trigger: el,
              start,
              once,
            },
          });
          cleanups.push(() => tween.kill());
        }
      } else if (animType === 'clip-up') {
        gsap.set(el, {clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)', y: 24, opacity: 0.01});
        const tween = gsap.to(el, {
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
          y: 0,
          opacity: 1,
          duration: MOTION_TOKENS.duration.reveal,
          ease: MOTION_TOKENS.ease.enter,
          delay,
          scrollTrigger: {
            trigger: el,
            start,
            once,
          },
        });
        cleanups.push(() => tween.kill());
      } else if (animType === 'mask-reveal') {
        const innerImg = el.querySelector<HTMLElement>('img, .lv-contain, .hp-photo');
        gsap.set(el, {clipPath: 'inset(100% 0% 0% 0%)', opacity: 1});
        if (innerImg) gsap.set(innerImg, {scale: 1.12});

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: el,
            start,
            once,
          },
        });
        tl.to(el, {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: MOTION_TOKENS.duration.cinematic,
          ease: MOTION_TOKENS.ease.cinematic,
          delay,
        });
        if (innerImg) {
          tl.to(
            innerImg,
            {
              scale: 1,
              duration: MOTION_TOKENS.duration.cinematic,
              ease: MOTION_TOKENS.ease.smooth,
            },
            '-=0.8'
          );
        }
        cleanups.push(() => tl.kill());
      } else if (animType === 'scale-in') {
        gsap.set(el, {scale: 0.92, opacity: 0});
        const tween = gsap.to(el, {
          scale: 1,
          opacity: 1,
          duration: MOTION_TOKENS.duration.reveal,
          ease: MOTION_TOKENS.ease.enter,
          delay,
          scrollTrigger: {
            trigger: el,
            start,
            once,
          },
        });
        cleanups.push(() => tween.kill());
      } else if (animType === 'fade-up') {
        gsap.set(el, {y: 32, opacity: 0});
        const tween = gsap.to(el, {
          y: 0,
          opacity: 1,
          duration: MOTION_TOKENS.duration.reveal,
          ease: MOTION_TOKENS.ease.enter,
          delay,
          scrollTrigger: {
            trigger: el,
            start,
            once,
          },
        });
        cleanups.push(() => tween.kill());
      } else if (animType === 'fade') {
        gsap.set(el, {opacity: 0});
        const tween = gsap.to(el, {
          opacity: 1,
          duration: MOTION_TOKENS.duration.slow,
          ease: MOTION_TOKENS.ease.state,
          delay,
          scrollTrigger: {
            trigger: el,
            start,
            once,
          },
        });
        cleanups.push(() => tween.kill());
      }
    });

    // 2. STAGGERED GRIDS (Cards, Services, Testimonials)
    const staggerContainers = Array.from(root.querySelectorAll<HTMLElement>('[data-anim-stagger-group]'));
    staggerContainers.forEach(container => {
      const items = Array.from(container.children) as HTMLElement[];
      if (!items.length) return;
      const staggerTime = Math.min(
        parseFloat(container.dataset.animStagger || '0.07'),
        MOTION_TOKENS.stagger.cap / items.length
      );
      gsap.set(items, {y: 30, opacity: 0});
      const tween = gsap.to(items, {
        y: 0,
        opacity: 1,
        duration: MOTION_TOKENS.duration.slow,
        ease: MOTION_TOKENS.ease.enter,
        stagger: staggerTime,
        scrollTrigger: {
          trigger: container,
          start: 'top 86%',
          once: true,
        },
      });
      cleanups.push(() => tween.kill());
    });

    // 3. PARALLAX EFFECT ([data-parallax])
    if (!isLowEnd) {
      const parallaxElements = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));
      parallaxElements.forEach(el => {
        const factor = parseFloat(el.dataset.parallax || '0.08');
        const offset = factor * 160;
        const trigger = el.parentElement || el;

        const tween = gsap.fromTo(
          el,
          {y: -offset},
          {
            y: offset,
            ease: 'none',
            scrollTrigger: {
              trigger,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
        cleanups.push(() => tween.kill());
      });
    }

    // 4. SCROLL LAG / VELOCITY TRAIL ([data-lag])
    if (!isLowEnd && fine) {
      const lagElements = Array.from(root.querySelectorAll<HTMLElement>('[data-lag]'));
      if (lagElements.length > 0) {
        const lagSetters = lagElements.map(el => {
          const factor = parseFloat(el.dataset.lag || '0.12');
          const quick = gsap.quickTo(el, 'y', {
            duration: 0.8,
            ease: 'power3.out',
          });
          return {factor, quick};
        });

        const onLenisScroll = ({velocity}: {velocity: number}) => {
          const v = Math.max(-100, Math.min(100, velocity || 0));
          lagSetters.forEach(({factor, quick}) => {
            const offset = Math.max(-MOTION_TOKENS.lag.maxOffsetPx, Math.min(MOTION_TOKENS.lag.maxOffsetPx, -v * factor * 1.5));
            quick(offset);
          });
        };

        if (lenis) {
          lenis.on('scroll', onLenisScroll);
          cleanups.push(() => lenis.off('scroll', onLenisScroll));
        }
      }
    }

    // 5. VELOCITY SKEW ON MEDIA ONLY ([data-skew="true"])
    if (!isLowEnd && fine) {
      const skewElements = Array.from(root.querySelectorAll<HTMLElement>('[data-skew="true"]'));
      const safeSkewMedia = skewElements.filter(
        el => el.tagName === 'FIGURE' || el.tagName === 'IMG' || el.classList.contains('lv-photo')
      );
      if (safeSkewMedia.length > 0) {
        const skewSetters = safeSkewMedia.map(el =>
          gsap.quickTo(el, 'skewY', {duration: 0.35, ease: 'power2.out'})
        );

        const onSkewScroll = ({velocity}: {velocity: number}) => {
          const raw = -(velocity || 0) * 0.18;
          const clamped = Math.max(-MOTION_TOKENS.skew.maxDeg, Math.min(MOTION_TOKENS.skew.maxDeg, raw));
          skewSetters.forEach(quick => quick(clamped));
        };

        if (lenis) {
          lenis.on('scroll', onSkewScroll);
          cleanups.push(() => lenis.off('scroll', onSkewScroll));
        }
      }
    }

    // 6. NUMERIC SCROLL COUNTERS ([data-anim="counter"], .lv-stats dd, [data-mo-count])
    const countElements = Array.from(root.querySelectorAll<HTMLElement>(COUNT_SELECTOR));
    countElements.forEach(el => {
      const text = (el.textContent || '').trim();
      const match = text.match(/^(\$?)(\d[\d,]*)(.*)$/);
      if (!match) return;

      const prefix = match[1] || '';
      const rawNum = Number(match[2].replaceAll(',', ''));
      const suffix = match[3] || '';
      if (rawNum <= 1 && !suffix) return;

      const counterObj = {value: 0};
      const tween = gsap.to(counterObj, {
        value: rawNum,
        duration: 1.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
        onUpdate: () => {
          el.textContent = `${prefix}${Math.round(counterObj.value).toLocaleString('en-US')}${suffix}`;
        },
      });
      cleanups.push(() => tween.kill());
    });

    // 7. PINNED STORYTELLING EXPERIENCES ([data-pin="section"])
    if (isDesktop && !isLowEnd) {
      const pinSections = Array.from(root.querySelectorAll<HTMLElement>('[data-pin="section"]'));
      pinSections.forEach(section => {
        const pinInner = section.querySelector<HTMLElement>('.lv-pin-inner') || section;
        const trigger = ScrollTrigger.create({
          trigger: section,
          pin: pinInner,
          start: 'top 80px',
          end: '+=100%',
          pinSpacing: true,
          anticipatePin: 1,
        });
        cleanups.push(() => trigger.kill());
      });
    }

    // 8. 3D CARD TILT ([data-tilt] or .price-card, .lv-service, .hp-service-card, .uc-card)
    if (fine && !isLowEnd) {
      const tiltCards = Array.from(
        root.querySelectorAll<HTMLElement>('[data-tilt], .price-card, .hp-service-card, .lv-service.has-text, .uc-card')
      );

      tiltCards.forEach(card => {
        let isHovered = false;
        const maxDeg = parseFloat(card.dataset.tilt || String(MOTION_TOKENS.tilt.maxDeg));

        const onMouseEnter = () => {
          isHovered = true;
          gsap.to(card, {
            scale: MOTION_TOKENS.tilt.scale,
            duration: MOTION_TOKENS.duration.base,
            ease: MOTION_TOKENS.ease.state,
          });
        };

        const onMouseMove = (e: MouseEvent) => {
          if (!isHovered) return;
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const xPct = (x / rect.width - 0.5) * 2;
          const yPct = (y / rect.height - 0.5) * 2;

          gsap.to(card, {
            rotateY: xPct * maxDeg,
            rotateX: -yPct * maxDeg,
            transformPerspective: MOTION_TOKENS.tilt.perspective,
            duration: 0.25,
            ease: 'power1.out',
            overwrite: 'auto',
          });
        };

        const onMouseLeave = () => {
          isHovered = false;
          gsap.to(card, {
            rotateX: 0,
            rotateY: 0,
            scale: 1,
            duration: MOTION_TOKENS.duration.slow,
            ease: MOTION_TOKENS.ease.spring,
            overwrite: 'auto',
          });
        };

        card.addEventListener('mouseenter', onMouseEnter);
        card.addEventListener('mousemove', onMouseMove);
        card.addEventListener('mouseleave', onMouseLeave);

        cleanups.push(() => {
          card.removeEventListener('mouseenter', onMouseEnter);
          card.removeEventListener('mousemove', onMouseMove);
          card.removeEventListener('mouseleave', onMouseLeave);
        });
      });
    }

    // 9. MAGNETIC BUTTONS ([data-magnetic] or .btn-primary, .lv-pill, .wj-button-yellow)
    if (fine && !isLowEnd) {
      const magneticButtons = Array.from(
        root.querySelectorAll<HTMLElement>('[data-magnetic], .lv-pill, .wj-button-yellow, .btn-primary:not(.no-magnetic)')
      );

      magneticButtons.forEach(btn => {
        const factor = parseFloat(btn.dataset.magnetic || String(MOTION_TOKENS.magnetic.factor));
        const maxPx = MOTION_TOKENS.magnetic.maxOffsetPx;

        const onMouseMove = (e: MouseEvent) => {
          const rect = btn.getBoundingClientRect();
          const x = (e.clientX - (rect.left + rect.width / 2)) * factor;
          const y = (e.clientY - (rect.top + rect.height / 2)) * factor;
          const clampedX = Math.max(-maxPx, Math.min(maxPx, x));
          const clampedY = Math.max(-maxPx, Math.min(maxPx, y));

          gsap.to(btn, {
            x: clampedX,
            y: clampedY,
            duration: 0.2,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        };

        const onMouseLeave = () => {
          gsap.to(btn, {
            x: 0,
            y: 0,
            duration: MOTION_TOKENS.duration.slow,
            ease: MOTION_TOKENS.ease.elastic,
            overwrite: 'auto',
          });
        };

        btn.addEventListener('mousemove', onMouseMove);
        btn.addEventListener('mouseleave', onMouseLeave);

        cleanups.push(() => {
          btn.removeEventListener('mousemove', onMouseMove);
          btn.removeEventListener('mouseleave', onMouseLeave);
        });
      });
    }

    // 10. FALLBACK FOR LEGACY REVEAL SELECTORS
    const legacyCandidates = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
    const siblingIndex = new Map<Element, number>();
    const pendingList: HTMLElement[] = [];

    for (const el of legacyCandidates) {
      if (
        el.dataset.anim ||
        el.closest('[data-mo-static], dialog, [role="dialog"], .wj-header, .wj-footer') ||
        el.parentElement?.closest('[data-mo-reveal]')
      ) {
        continue;
      }
      el.dataset.moReveal = '';
      if (el.getBoundingClientRect().top <= window.innerHeight * 1.05) {
        el.classList.add('is-revealed');
        continue;
      }
      const parent = el.parentElement || root;
      const index = siblingIndex.get(parent) || 0;
      siblingIndex.set(parent, index + 1);
      el.style.setProperty('--mo-delay', Math.min(index * 70, 630) + 'ms');
      el.dataset.moPending = '';
      pendingList.push(el);
    }

    if (pendingList.length > 0) {
      const revealObserver = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const target = entry.target as HTMLElement;
            target.classList.add('is-revealed');
            target.removeAttribute('data-mo-pending');
            revealObserver.unobserve(target);
          }
        },
        {rootMargin: '0px 0px 10% 0px', threshold: 0.01}
      );
      pendingList.forEach(el => revealObserver.observe(el));
      timers.push(window.setTimeout(revealAll, 3200));
      cleanups.push(() => {
        revealObserver.disconnect();
        revealAll();
      });
    }

    // Images fade-in handling
    root.querySelectorAll<HTMLImageElement>(IMAGE_SELECTOR).forEach(img => {
      if (img.complete) {
        img.classList.add('is-mo-loaded');
        return;
      }
      img.dataset.moImage = '';
      const ready = () => img.classList.add('is-mo-loaded');
      img.addEventListener('load', ready, {once: true});
      img.addEventListener('error', ready, {once: true});
      timers.push(window.setTimeout(ready, 1800));
    });

    // Cleanup everything on route change / unmount
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      cleanups.reverse().forEach(clean => clean());
      splits.forEach(s => s.revert());
      ScrollTrigger.getAll().forEach(st => st.kill());
      gsap.killTweensOf('*');
    };
  }, [pathname]);

  return (
    <>
      <div className="gx-progress" aria-hidden="true" />
      <div className="wj-curtain-wipe" aria-hidden="true" />
    </>
  );
}
