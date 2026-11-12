# Implementation Plan

Ordered by measured impact. Status mirrors TASK_CHECKLIST.md.

## What the inspection found (drives the order)
- Public routes render through `app/[...slug]/page.tsx`; nearly every service/info route resolves
  to a Figma view (`#main.fx-page`). `PublicLayout`/`SiteShell` render **inside each page**, so the
  shell remounts on every navigation.
- Three overlapping motion runtimes (GSAP + Lenis, Framer Motion, a 2D canvas RAF loop) plus a
  three.js world on every device, hidden on most routes but still rendering.
- JS entrance animations hid above-the-fold content after hydration.
- Mobile TBT 1.9–6.4 s; desktop 0.3–0.5 s.

## Phases
| Phase | Scope | Status |
|---|---|---|
| A Foundation | branch, baseline, docs, route inventory, WSJ-01..05 validation | Done (WSJ-03 deferred) |
| B Performance architecture | runtime dedupe, WebGL gating/singleton, RAF removal, CSS route-scoping, LCP priority | Done except B-08 CSS consolidation, B-09 RSC payload, B-10 fonts |
| C Motion system | tokens, reduced motion, orchestrator, route fade, Lenis, header, magnetic/tilt | Done |
| D Components | hero carousel done; mega menu / tabs / accordions / forms polish | Partial (FU-05) |
| E Business flows | checkout preselection, modal behaviour, Stripe untouched | Done |
| F QA | typecheck, lint, suites, build, browser, axe, responsive sweep, Lighthouse | Done |
| G Delivery | report, docs, commits | Done for this session |

## Next actions (in order)
1. FU-01 DONE in part (feddb78, see PERFORMANCE_RESULTS "FU-01 results"). Figma-page mobile LCP still ~5.8 s: bandwidth contention in the simulated load, not CSS parse.
2. FU-03 Font preload review with design (124 KB of preloads compete with the hero image).
3. FU-06 Public-site flag on <body> (replace body:has(.wj-platform)); defer GSAP / mega-menu JS past first paint.
4. FU-02 Convert static parts of `SiteShell` (footer, strip nav) to server components; pass only
   the grouped nav links the client needs.
5. FU-05 Motion polish for mega menu, tabs, accordions and forms.
6. FU-04 Media import tooling (needs approval for any production run).
