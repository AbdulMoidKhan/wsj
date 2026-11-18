# Workspace Junction — Public Website Motion, Performance & QA Mission

Durable copy of the owner brief received 2026-11-12 (condensed but complete) for resumed
sessions. Section numbers match the brief.

## 1–3. Mandate and operating rules
- Implementation mission, not recommendations: inspect, implement, test, fix regressions, repeat.
- Preserve brand identity: deep architectural green, emerald/forest accents, amber/gold CTAs,
  neutral backgrounds, Playfair Display + Inter, real facility photography. Existing design
  tokens are the source of truth. Do not redesign.
- Work autonomously; no approval requests for routine decisions. Document blockers and continue.
- **Authorized:** read repo, isolated branch, edit public components/styles, motion utilities,
  justified compatible deps via npm, tests, dev/prod builds, local browser QA, local perf
  reports, local commits, docs/checkpoints.
- **Restricted (record as DEFERRED_APPROVAL):** production deploy, live DB changes, restarting
  production, live env vars, credential rotation/exposure, real Stripe payments, deleting
  business data, changing billing rules/prices/payment auth logic, auth changes without need +
  tests, force-push/history rewrite, pushing to remotes, overwriting unrelated user changes,
  destructive migrations.

## 4. Usage-limit recovery
Keep `docs/implementation/*` current. Checkpoint after each logical batch: checklist →
`PROGRESS_STATE.json` → `SESSION_HANDOFF.md` → test results → local commit → record hash.
On resume follow `RESUME_INSTRUCTIONS.md`; reconcile git state; never restart from scratch.
Never claim automatic resumption works unless configured and verified.

## 5. Phase 0 — inspection & baseline
Inspect architecture and routes (app dir, dynamic routes, sitemap, nav, footer, catalogs, blog);
route coverage matrix; baseline Lighthouse (4 categories), LCP, CLS, TBT, SI, FCP, TTFB, JS/CSS/
image bytes, requests, main-thread, long tasks, console errors, API timing, cache, mobile scroll.
Distinguish lab from field. Never fabricate numbers.

## 6. Phase 1 — audit findings
- **WSJ-01** `/about`, `/contact` → permanent redirects to `/about-us/`, `/contact-us/` (no loops,
  keep query, trailing-slash policy, minimal chains).
- **WSJ-02** pricing cards / booking buttons preselect the matching service + package in checkout;
  server-side quote stays authoritative; add-on rules preserved.
- **WSJ-03** admin media library empty — inspect safely; no production seeding; else follow-up.
- **WSJ-04** mobile service pills: directional fade, touch scroll, active item visible, keyboard,
  unclipped focus, correct start/end behaviour.
- **WSJ-05** remove verbose revalidation debug logging; keep error/security/billing audit logs.

## 7–9. Motion system, page transitions, scroll
One reusable motion system. Tokens `--motion-instant 100ms … --motion-deliberate 850ms`,
`--ease-out-expo`, `--ease-in-out-cubic`, `--ease-standard`, `--ease-tactile`. Restrained, fast,
transform/opacity only, selective will-change, CSS for simple states, GSAP only where it earns
it, single orchestration. Route transitions: opacity + 4–8px, 180–320ms, never block navigation,
no white flash / duplicate content / hydration or SEO impact; history, hash and scroll
restoration preserved. One scroll loop; Lenis + ScrollTrigger synced; native touch; anchors,
find-in-page, keyboard, reduced motion; no hijacking; modal scroll-lock compatible. Background
effects pause when hidden/off-screen, respect device capability, avoid WebGL on mobile, static
fallbacks.

## 10–12. Header/nav, heroes/carousels, buttons/links
Sticky header initial → scrolled without layout shift; direction-aware retract (never while
menus/dialogs/focus); animated underline/active states; accessible mega/mobile menus (Escape,
focus trap, body lock). Hero text and LCP never hidden or delayed; carousel crossfade, pausable,
swipe, first slide prioritised. Buttons: subtle lift, 2–4px icon nudge, pressed state,
focus-visible, genuine loading states. Magnetic only on a few desktop CTAs (never checkout/forms;
off on touch and reduced motion). Links: animated underline. Disabled/loading semantics, stable
size, duplicate-submit protection.

## 13–15. Cards & pricing, section reveals, tabs/accordions/filters
Unified card hover (lift, small image zoom, border, arrow). Pricing visuals only — never change
prices/entitlements or invent interpolated prices. Tilt ≤ 2–4°, selected decorative desktop cards
only. Reveals: label → heading → description → cards → CTA; 8–20px, 300–500ms, 40–80ms stagger.
Content stays visible without JS/GSAP, on hydration errors and with reduced motion. Light
parallax on selected media only. Decorative objects aria-hidden. Tabs: indicator, ARIA, arrow
keys. Accordions: smooth, accessible, no clipping. Filters: instant feedback, debounce if useful.

## 16–17. Forms and checkout
Focus/validation/success/loading states, no duplicate submits, keep server validation, anti-spam
and destinations. Checkout modal: fade/scale entrance, focus trap, Escape, scroll lock, progress,
directional steps, add-on feedback, only authoritative backend prices. Stripe: no card capture;
tokenization, PCI boundary and webhook auth unchanged; test mode only.

## 18–19. Speed optimisation and acceptance targets
Bundles (duplicate runtimes, unused deps/plugins, server/client boundaries, dynamic imports);
rendering (static/ISR where possible; never cache personal/payment data); images (AVIF/WebP,
sizes, lazy below fold, never lazy LCP); fonts (next/font, subset, swap); CSS consolidation;
animation runtime cleanup (context cleanup, no leaks / duplicate triggers / RAF loops);
API/network (dedupe, parallel, cache, cancel stale); backend/DB diagnostics (migrations proposed
only); third-party scripts; caching/delivery (repo-level only); mobile-first throttled testing.
**Targets** (lab unless field data exists): desktop perf 95+, mobile perf 90+, a11y/SEO/BP 95+,
TBT ≤ 200ms, FCP ≤ 1.8s, LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms (field), zero new JS errors, no
checkout regressions. Performance and accessibility outrank decoration.

## 20–23. Responsive, accessibility, SEO, security
Viewports 320 → 1920+ plus landscape: no horizontal scroll, clipping, overlap or hidden CTAs.
WCAG 2.2 AA; global, live reduced-motion support for every effect. SEO: titles, descriptions,
canonicals, robots, sitemap, structured data, headings, alt text and local SEO (Oakbrook Terrace,
Lombard, DuPage County, Chicago area) preserved; no hidden/duplicated content. Security: no
secrets in bundles, no unsafe HTML/redirects, no weakened auth, no sensitive logs.

## 24–25. QA and retest
Run the real repository scripts (typecheck, lint, tests, build, browser). Separate pre-existing
from new failures. Browser QA of routes, nav, cards, booking, checkout steps, mobile menu, tabs,
accordions, forms, carousel, reduced motion, keyboard, history, console. Before/after screenshots;
animation QA (flicker, stuck hidden content, leaks, idle CPU). Repeat baseline measurements under
comparable conditions; investigate every regression.

## 26–29. Order, design rules, deliverables
Stages A foundation → B performance architecture → C motion system → D components → E business-
critical flows → F QA → G cleanup & report. Every animation must communicate interaction,
hierarchy, feedback, navigation, conversion or continuity — otherwise remove it. Final report:
executive summary, inventory, page-by-page coverage, performance, QA, git/recovery,
GO / CONDITIONAL GO / NO-GO. Never deploy.
