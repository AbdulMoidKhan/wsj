'use client';

import dynamic from 'next/dynamic';
import {useEffect, useState} from 'react';

/* Motion is enhancement, never content: every page is fully visible as server HTML. GSAP and
   the orchestrators are therefore kept out of the initial JavaScript and out of the load window,
   so they never compete with the LCP image, hydration or first input. */

const GsapMotion = dynamic(() => import('./gsap-motion').then(m => m.GsapMotion), {ssr: false});
const JunctionMotion = dynamic(() => import('./junction-motion').then(m => m.JunctionMotion), {ssr: false});

/* Motion is armed by the visitor's first sign of movement (scroll, wheel, pointer, touch or key)
   or, failing that, by an idle period a few seconds after load. Above-the-fold motion is pure CSS
   and needs none of this; everything GSAP animates sits below the fold, so it is always armed
   before it can be seen. Nothing in the load window pays for motion. */
const INTENT = ['scroll', 'wheel', 'pointermove', 'pointerdown', 'touchstart', 'keydown'] as const;

function useMotionIntent(fallbackMs = 5000) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    let idle = 0, timer = 0;
    const arm = () => setArmed(true);
    INTENT.forEach(type => window.addEventListener(type, arm, {once: true, passive: true}));
    timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(arm, {timeout: 2000});
      else arm();
    }, fallbackMs);
    return () => {
      INTENT.forEach(type => window.removeEventListener(type, arm));
      window.clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [fallbackMs]);
  return armed;
}

/** Site-wide orchestrator (entrances, header behaviour, Lenis on capable desktops). */
export function DeferredGsapMotion() {
  return useMotionIntent() ? <GsapMotion /> : null;
}

/** Homepage choreography (scroll-linked scenes). */
export function DeferredJunctionMotion() {
  return useMotionIntent() ? <JunctionMotion /> : null;
}
