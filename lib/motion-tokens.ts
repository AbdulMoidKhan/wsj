/**
 * Central motion design tokens for Workspace Junction.
 * Single source of truth for timings, easings and distances. Mirrors the --motion-* CSS
 * tokens in app/motion-system.css. Restrained by design: no elastic/back eases, tilt <= 3deg.
 */

export const MOTION_TOKENS = {
  duration: {
    fast: 0.16,
    base: 0.28,
    slow: 0.45,
    reveal: 0.50,
    cinematic: 0.90,
    route: 0.28,
  },
  ease: {
    // Premium custom cubic beziers and GSAP eases
    enter: 'expo.out',
    exit: 'power2.in',
    state: 'power2.out',
    smooth: 'power3.out',
    cinematic: 'power4.out',
    linear: 'none',
  },
  distance: {
    xs: 8,
    sm: 16,
    md: 28,
    lg: 48,
    xl: 72,
  },
  stagger: {
    tight: 0.04,
    base: 0.08,
    loose: 0.14,
    cap: 0.5, // maximum total stagger for any grid
  },
  parallax: {
    subtle: 0.04,
    base: 0.08,
    deep: 0.14,
  },
  tilt: {
    maxDeg: 3,
    perspective: 1000,
    scale: 1,
  },
  magnetic: {
    maxOffsetPx: 6,
    factor: 0.2,
  },
} as const;

export type MotionTokens = typeof MOTION_TOKENS;
