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
1. FU-01 CSS consolidation: inventory which global sheets each route needs; move Figma-page-only
   rules out of legacy sheets; drop `body:has()` scoping in favour of a body class; re-measure
   mobile LCP (target ≤ 2.5 s).
2. FU-02 Convert static parts of `SiteShell` (footer, strip nav) to server components; pass only
   the grouped nav links the client needs.
3. FU-03 Font preload review with design.
4. FU-05 Motion polish for mega menu, tabs, accordions and forms.
5. FU-04 Media import tooling (needs approval for any production run).
