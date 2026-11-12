'use client';

import {useSyncExternalStore} from 'react';

/** Live `prefers-reduced-motion` preference. Updates without a reload when the OS setting
 * changes; renders `false` on the server so markup never depends on it. */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches;

export function useReducedMotion() {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

/** Decorative-effect budget: fine pointer, wide viewport, no data saver, not a low-core device. */
export function canRunRichEffects() {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & {connection?: {saveData?: boolean}; deviceMemory?: number};
  return window.matchMedia('(pointer: fine) and (hover: hover)').matches
    && window.innerWidth >= 1024
    && !nav.connection?.saveData
    && !(nav.hardwareConcurrency && nav.hardwareConcurrency <= 4)
    && !(nav.deviceMemory && nav.deviceMemory <= 4);
}
