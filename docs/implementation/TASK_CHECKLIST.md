# Task Checklist

Statuses: NOT_STARTED · IN_PROGRESS · IMPLEMENTED · VERIFIED · BLOCKED · DEFERRED_APPROVAL.
"VERIFIED" always cites evidence. Branch: `feature/public-motion-performance-optimization`.

## Stage A — Foundation
| ID | Task | Pri | Files | Deps | Acceptance | Status | Evidence |
|---|---|---|---|---|---|---|---|
| A-01 | Inspect repo, stack, routes | P0 | — | — | Architecture understood | VERIFIED | Next 16.4.3 / React 19.3; 157 sitemap routes; public pages render through `app/[...slug]` → Figma views (`#main.fx-page`) |
| A-02 | Isolated branch + baseline snapshot | P0 | git | — | Prior uncommitted work preserved separately | VERIFIED | commit a044b1e on new branch |
| A-03 | Mission-control docs | P0 | docs/implementation/* | A-02 | All 10 files present and current | VERIFIED | this folder |
| A-04 | Baseline measurements | P0 | scripts/qa/mission-perf.mjs | A-02 | 8 routes × mobile/desktop, real numbers | VERIFIED | evidence/perf-baseline.json, PERFORMANCE_BASELINE.md |
| A-05 | Route coverage matrix | P1 | QA_REPORT.md | A-01 | Every sitemap route checked | VERIFIED | evidence/responsive-final.json (all sitemap routes) |

## Stage A — Audit findings
| ID | Task | Pri | Files | Deps | Acceptance | Status | Evidence |
|---|---|---|---|---|---|---|---|
| WSJ-01 | /about, /contact permanent redirects | P0 | data/redirects.json | — | 301, query kept, no loop | VERIFIED | `npm run test:redirects` 20/20 pass; `/about/?utm_source=x` → 301 `/about-us/?utm_source=x`. Note: `/about` (no slash) takes Next’s 308 to `/about/` first (2 hops, framework trailing-slash policy) |
| WSJ-02 | Pricing cards preselect package | P0 | lib/catalog-service-hint.ts, components/booking-dialog.tsx, components/pricing-grid.tsx | — | Clicking a plan opens checkout on that plan; server quote authoritative | VERIFIED | Browser: Bronze → $50, Silver, Gold → $150 preselected from catalog; `npm run test:plan-hint` 3/3 |
| WSJ-03 | Admin media library empty | P2 | backend/src/media.ts | — | Root cause documented | BLOCKED → DEFERRED_APPROVAL | Local `Media` table has 0 rows; `backend/uploads` empty; 1,194 facility images ship as static `public/media/*` and were never registered. A fix needs a new import script + data writes (production write needs approval). See FU-04 |
| WSJ-04 | Mobile service-pill scroll affordance | P1 | components/gsap-motion.tsx, app/motion-system.css | — | Directional fades, active pill visible, unclipped focus | IMPLEMENTED | Code + CSS landed; responsive sweep shows no overflow; visual review on device still recommended |
| WSJ-05 | Verbose revalidation logging | P2 | app/api/studio-revalidate, backend/src | — | No debug logging in production paths | VERIFIED (no change needed) | `grep console.log/info/debug` and Nest `logger.log/debug/verbose` over app, components, lib, backend/src → 0 matches |

## Stage B — Performance architecture
| ID | Task | Pri | Files | Status | Evidence |
|---|---|---|---|---|---|
| B-01 | Remove duplicate animation runtime (Framer Motion) | P0 | package.json, removed coworking-view/dynamic-page-view/dynamic-pages-config | VERIFIED | Shared GSAP+motion chunk (85 KB gz) gone; JS per page 549 → 300 KB |
| B-02 | Gate WebGL to capable desktops + visible routes | P0 | components/scene-backdrop.tsx | VERIFIED | Phones never load three.js; Figma routes `data-scene-off`; browser check on /gallery/ |
| B-03 | Build WebGL once per session, after first interaction | P0 | components/scene-backdrop.tsx | VERIFIED | Same canvas across navigation + back (browser); desktop /contact-us/ TBT 1285 → 131 ms |
| B-04 | Remove 2D particle RAF loop + dead MotionController | P1 | components/ambient.tsx | VERIFIED | File reduced to static markup; typecheck/lint clean |
| B-05 | Batch layout reads (no forced reflow) in motion orchestrator | P1 | components/gsap-motion.tsx | IMPLEMENTED | Single read pass before writes |
| B-06 | Route-scope homepage and contact CSS | P1 | app/layout.tsx, app/page.tsx, components/contact-view.tsx | VERIFIED | Contact page styled (browser); 43 KB off other routes |
| B-07 | LCP hero image fetchpriority=high | P1 | components/figma-page/figma-page-view.tsx | VERIFIED | lcp-discovery-insight: priority hinted, discoverable, eager |
| B-08 | Global CSS consolidation (15 render-blocking files, 336 `:has()`) | P0 | app/*.css | NOT_STARTED | Main remaining mobile LCP bottleneck → FU-01 |
| B-09 | Slim RSC payload / server-render static shell | P1 | components/site-shell.tsx, public-layout.tsx | NOT_STARTED | Home 116 KB inline payload → FU-02 |
| B-10 | Font preload strategy | P2 | app/layout.tsx | NOT_STARTED | Needs visual review → FU-03 |

## Stage C — Motion system
| ID | Task | Pri | Status | Evidence |
|---|---|---|---|---|
| C-01 | Motion tokens (CSS + TS) to mission scale | P0 | VERIFIED | app/motion-system.css `:root --motion-*`, lib/motion-tokens.ts |
| C-02 | Live reduced-motion hook | P0 | VERIFIED | lib/use-reduced-motion.ts; reduced pass in responsive sweep |
| C-03 | Single gsap.context per route, no global kill | P0 | VERIFIED | gsap-motion.tsx; no console errors across navigations |
| C-04 | Never hide above-fold/LCP content | P0 | VERIFIED | Browser: 0 hidden above-fold elements; sweep `stuckHidden` |
| C-05 | Route transition: subtle fade-rise on client nav only, no curtain | P0 | VERIFIED | `mainAnim: mo-route-in` only after client nav; curtain element removed |
| C-06 | Lenis singleton synced with ScrollTrigger, scroll-lock aware | P1 | VERIFIED | `has-lenis` persists across nav; observer only on body/html style |
| C-07 | Direction-aware header retract | P1 | IMPLEMENTED | Applies where header is sticky; Figma routes intentionally use a non-sticky header (design) |
| C-08 | Magnetic CTAs via CSS translate, tilt ≤ 3°, no elastic ease | P1 | VERIFIED | Browser: 1 magnetic CTA on /gallery/; tilt removed from pricing cards |
| C-09 | Mobile/coarse/reduced: no continuous decorative drift | P1 | IMPLEMENTED | CSS media rule in motion-system.css |

## Stage D/E — Components and business flows
| ID | Task | Pri | Status | Evidence |
|---|---|---|---|---|
| D-01 | Home hero carousel: pause/play, prev, dots, swipe, deferred slides | P0 | IMPLEMENTED | Typecheck/lint clean; in final build; WCAG 2.2.2 pause control |
| D-02 | Mega menu / mobile drawer motion polish | P2 | NOT_STARTED | Existing drawer already has focus trap, scroll lock, Escape |
| D-03 | Tabs/accordions animated indicators | P2 | NOT_STARTED | — |
| D-04 | Form micro-interactions | P2 | NOT_STARTED | Existing forms untouched (no regressions) |
| E-01 | Checkout preselection (see WSJ-02) | P0 | VERIFIED | Browser |
| E-02 | Checkout modal Escape/focus return/scroll lock | P0 | VERIFIED | Real Escape closes, focus returns to Silver card button, body overflow restored |
| E-03 | Stripe/quote boundaries unchanged | P0 | VERIFIED | No backend/billing files modified by this mission; `test:payment-safety` 4/4, `test:pricing-catalog` 7/7 |

## Stage F — QA
| ID | Task | Status | Evidence |
|---|---|---|---|
| F-01 | Typecheck + lint | VERIFIED | `npm run typecheck`, `npm run lint` clean |
| F-02 | Unit/guard suites | VERIFIED | content 9/9, service-content 11/11, performance-optimizations 12/12, plan-hint 3/3, payment-safety 4/4, pricing-catalog 7/7, api scenario guards 7/7 + safety 5/5 |
| F-03 | Production build | VERIFIED | `next build` exit 0 (NEXT_DIST_DIR=.next-mission-after) |
| F-04 | Accessibility (axe WCAG 2.2 AA) | IMPLEMENTED | Contrast tokens + label-in-name fixed after final Lighthouse run; re-measure in next build |
| F-05 | Responsive sweep (all sitemap routes) | see QA_REPORT.md | evidence/responsive-final.json |
| F-06 | Performance retest | VERIFIED | PERFORMANCE_RESULTS.md |

## Follow-ups
| ID | Item | Why not done here |
|---|---|---|
| FU-01 | Consolidate/split global CSS (biggest remaining mobile cost) | Cross-route cascade refactor across 157 routes; needs visual regression review |
| FU-02 | Server-render static shell, slim nav payload | Touches every page’s client boundary |
| FU-03 | Font preload (italic Playfair) | Needs design sign-off |
| FU-04 | Media library import (WSJ-03) | New import tooling + production data write → approval |
| FU-05 | Mega menu, tabs, accordions, form motion polish | Lower priority than performance; no regressions introduced |
