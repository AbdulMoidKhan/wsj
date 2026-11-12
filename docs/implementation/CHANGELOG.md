# Changelog — feature/public-motion-performance-optimization

## Commit a044b1e — baseline snapshot
Pre-existing uncommitted work (account system, Figma page views, /m mirror, earlier cleanup)
committed as found so mission changes diff and roll back independently.

## Commit 8a9c370 — motion runtime, WebGL gating, WSJ-01/02/04
- **WSJ-01** `data/redirects.json`: `/about/` → `/about-us/`, `/contact/` → `/contact-us/` (301).
- **WSJ-02** `lib/catalog-service-hint.ts` `findPlanHint()`: a "Service - Package" CTA selects its
  package only when the name is unique in the live service. `booking-dialog.tsx` uses it as a
  fallback after explicit plan slugs. `pricing-grid.tsx` sends `service - title`. Prices stay
  server-quoted. Test: `scripts/qa/plan-hint.test.ts`.
- **WSJ-04** mobile service pills: directional edge fades (`data-scroll`), current pill scrolled
  into view, inset focus ring.
- `components/gsap-motion.tsx` rewritten: one `gsap.context` per route (replaces global
  `ScrollTrigger.getAll().kill()` / `killTweensOf('*')`), above-the-fold content never hidden,
  live reduced motion, Lenis kept alive across navigations, direction-aware header, tilt
  limited to explicit `[data-tilt]` (≤3°), magnetic via CSS `translate` custom properties (no
  elastic ease), velocity skew/lag removed, curtain wipe removed.
- `components/scene-backdrop.tsx`: WebGL only on capable desktops without reduced motion and on
  routes that show it; module-level singleton reattached across navigations.
- `components/ambient.tsx`: duplicate 2D particle RAF loop and dead `MotionController` /
  `MotionToggle` removed.
- Removed unreachable `CoworkingView`, `DynamicPageView`, `lib/dynamic-pages-config.tsx`
  (every route they served renders the Figma view first) and the `motion` dependency.
- `components/home-live.tsx` hero carousel: pause/play, previous, slide dots, swipe, deferred
  slide 2–3 images, live region only when user-driven.
- `lib/motion-tokens.ts` + `app/motion-system.css`: mission motion scale tokens; route fade only
  on client navigation; no permanent `will-change`; header backdrop blur removed.
- `lib/use-reduced-motion.ts`: `useReducedMotion()` + `canRunRichEffects()`.
- `scripts/qa/mission-perf.mjs`: Lighthouse sampler.

## Commit (next) — load-path tuning, accessibility, QA, docs
- WebGL world built after first user interaction (or a quiet 7 s), never during load.
- Single layout-read pass in the motion orchestrator (no forced reflow).
- `figma-home.css` → `app/page.tsx`, `contact-page.css` → `components/contact-view.tsx`.
- Figma hero image `fetchPriority="high"`.
- AA contrast: `--fx-amber-text`, `--fh-muted`, `--fc-muted`, visit-page greys; amber labels keep the
  brand amber on dark grounds.
- Footer brand link: removed mismatching `aria-label` (WCAG 2.5.3).
- `scripts/qa/mission-responsive.mjs`, npm scripts `test:plan-hint`, `test:mission-perf`,
  `test:mission-responsive`.
- `docs/implementation/*` mission control files and evidence.
