/**
 * Central motion design tokens for Workspace Junction.
 * Single source of truth for timings, easings, distances, parallax, and lag.
 */

export const MOTION_TOKENS = {
  duration: {
    fast: 0.16,
    base: 0.28,
    slow: 0.52,
    reveal: 0.70,
    cinematic: 1.10,
    route: 0.45,
  },
  ease: {
    // Premium custom cubic beziers and GSAP eases
    enter: 'expo.out',
    exit: 'power2.in',
    state: 'power2.out',
    smooth: 'power3.out',
    cinematic: 'power4.out',
    elastic: 'elastic.out(1, 0.4)',
    spring: 'back.out(1.4)',
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
    cap: 0.9, // maximum stagger duration for any grid
  },
  parallax: {
    subtle: 0.04,
    base: 0.08,
    deep: 0.14,
  },
  lag: {
    subtle: 0.06,
    base: 0.12,
    deep: 0.20,
    maxOffsetPx: 42,
  },
  tilt: {
    maxDeg: 6,
    perspective: 1000,
    scale: 1.02,
  },
  magnetic: {
    maxOffsetPx: 8,
    factor: 0.25,
  },
  skew: {
    maxDeg: 3,
  },
} as const;

export type MotionTokens = typeof MOTION_TOKENS;
