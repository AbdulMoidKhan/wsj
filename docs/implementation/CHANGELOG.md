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

## Commit feddb78 (+ follow-up docs commit) — FU-01: CSS cost, startup recalcs, route-only JS
Diagnosis came first (traces in this commit's evidence): the inner-page mobile LCP was not CSS
download time. The hero image finished loading in ~50 ms but painted 1.2-2.4 s later, behind
startup main-thread work, and Lighthouse's simulation then charged every early request to LCP.
- **Catch-all route bundles.** `app/[...slug]/page.tsx` statically imported ten bespoke views
  that Figma pages shadow on every path they handle (community-network, library, workshops,
  trade-shows, services directory, use-cases, partners/about-us, webinars/photo-studio,
  creative-designers, e-commerce). Their nine stylesheets and JS shipped on all ~150 catch-all
  URLs. Removed the branches, the components and the sheets (`use-cases-view.css` stays: the
  use-case detail route still imports it). Proof of no visual impact: none of their rules matched
  any element on 11 live routes at 390/1440 px (positive control: memberships/testimonial sheets
  matched 81/36 rules).
- **Route-only client components** are code-split through `components/lazy-client.tsx`
  (`InquiryForm`, `VisitPagesView`, `ServicePricingSection`, `VenueGallery`): the form library
  (~44 KB gz) and the gallery chunk with the pricing dataset (~20 KB gz) no longer load on every
  Figma page. Their CSS stays statically imported there so server HTML is styled.
  (`next/dynamic` inside the *server* page was tried first and rejected: Next emitted every
  view's stylesheet as render-blocking.)
- **`:has()` hot spots.** Inserting any element into the document cost ~44 ms of style
  recalculation on desktop (~4x on a phone). Bisection pinned it to `:has()` arguments that can
  match anything (`:not(:has(*))`, `:not(:has(> :not(img)))`) and to sibling-structure arguments
  (`:only-child`, `:nth-child`, `+`). Fixed by: dropping an always-true `:not(:has(*))`; spelling
  "only images" as an explicit element list from the live-sections renderer (same specificity);
  `PricingGrid` `data-count` replacing `:has(> .price-card:nth-child(4):last-child)` (same
  specificity via repeated attribute); moving 77 live-sections structure rules to
  `public/styles/live-sections-structure.css`, loaded by `LiveSections` as a React stylesheet
  resource only on pages that render it. Plain-node insertion: 44 ms -> 0.2 ms.
- **ScrollTrigger off the startup path.** Registering + refreshing it forced four full-document
  recalcs on every page. Play-once reveals/counters now run off one IntersectionObserver and the
  progress bar off a passive scroll listener; ScrollTrigger is imported on demand only for
  parallax/pins on capable desktops.
- LCP hero/cover images: `decoding="sync"` (and `fetchPriority="high"` on post covers).
- `scripts/qa/mission-perf.mjs`: LCP phase breakdown, LCP element and render-blocking list.
- Regression evidence: computed styles of 14,048 elements on 12 routes x 2 widths, baseline
  build vs FU-01 build: 0 CSS differences (3 header-width deltas come from the account slot's
  session state, not CSS).
