# QA Report

All testing was local: production build (`next build` + `next start`, NEXT_DIST_DIR=.next-mission-after,
port 3001), local NestJS API on :4000 and local PostgreSQL. Nothing was run against production,
and no real or test payments were submitted.

## Build and static checks
| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS, 0 errors |
| ESLint | `npm run lint` | PASS, 0 problems |
| Production build | `next build` | PASS, 196 static pages generated |

## Unit and guard suites
| Suite | Result |
|---|---|
| `test:plan-hint` (new, WSJ-02) | 3/3 |
| `test:content` | 9/9 |
| `test:service-content` | 11/11 |
| `test:performance-optimizations` | 12/12 |
| `test:payment-safety` | 4/4 |
| `test:pricing-catalog` | 7/7 |
| `test:api:scenario-guards` | 7/7 |
| `test:api:scenario-safety` | 5/5 |
| `test:redirects` (local prod) | 20/20 redirects; sitemap 200; robots 200; canonical slash 308 |

None of these failed before or after the change. The backend and billing code were not modified.

## Browser QA (in-app browser and Playwright, local)
| Flow | Result |
|---|---|
| Home "Book now" on Bronze / Silver / Gold | Checkout opens with Co-Working and the matching package selected; catalog prices $50 / Silver / $150 |
| Real Escape key on checkout | Dialog closes, focus returns to the originating "Book now", body scroll lock released |
| Client navigation /gallery/ → /memberships/ → back | Same WebGL canvas reused; Lenis persists; route fade only on client navigation; 0 console errors |
| Figma routes (home, /coworking/ and similar) | WebGL switched off (`data-scene-off`); the scene host is `display:none` |
| Desktop non-Figma route | Scene built only after the first interaction |
| Above-the-fold visibility on load | 0 hidden elements in the first viewport |
| Content flung past during fast scrolling (/, /memberships/, /wj-package/dedicated-desk/) | 51 / 16 / 12 elements pending offscreen; **0** still hidden once scrolled to |

## Responsive and motion-safety sweep (`npm run test:mission-responsive`)
- **Full run** (evidence/responsive-final.json): all **157 sitemap routes**, 458 samples. 12 core
  routes ran at 320/360/375/390/414/480/768/820/1024/1280/1440/1920 px; the long tail ran at 375
  and 1440. Core routes were also run with `prefers-reduced-motion: reduce`.
  - Horizontal page overflow: **0** samples. The listed "offenders" are intentional inner scroll
    containers: blog category tabs and the memberships comparison table.
  - Console or page errors: **0**. HTTP status: 200 everywhere. Exactly one `<h1>` on every page.
  - The 97 flagged samples were all `stuckHidden`. That version of the metric counted reveal
    elements still pending offscreen about 2 s after a fast fling, which is expected behaviour.
    The metric now counts only elements that are on screen and still hidden.
- **Re-run with the corrected metric** on the six most-flagged routes × 320/414/1440, plus reduced
  motion: 27 samples, **0 problems**.

## Accessibility (axe-core, WCAG 2.0/2.1/2.2 A and AA, 1280 px and 390 px, reduced motion)
Before the fixes, every sampled route had color-contrast failures:
- amber eyebrows at 2.3–2.7:1
- muted body text at 3.9–4.3:1
- gallery greys at 4.1–4.4:1

The footer brand link also failed label-in-name.

After the fixes, these routes have **0 violations**: /coworking/, /podcast-studio/, /contact-us/
and /gallery/. A follow-up batch addresses the remaining findings; its axe results are in the
section below:
- home sign-off contrast
- /about-us/ decorative numbers
- memberships table `aria-label` on spans (`role="img"` added)
- testimonial dot target size (hit area widened to at least 24 px)

The blog `pagination-prev is-disabled` contrast finding is an inactive, `aria-hidden` control,
which WCAG 1.4.3 exempts.

**Final axe run** on the last build: 8 routes × 1280/390 px, reduced motion.
- **0 violations** on /coworking/, /podcast-studio/, /contact-us/, /gallery/ and /about-us/ at both
  widths, and on /blogs/ at 390 px.
- **Home:** the remaining finding was a real visual bug, fixed after this build. The rating line
  rendered near-white on the light testimonial band (1.2:1). Fix: a same-layer override in
  `figma-home.css`, giving 11.65:1. Verified by injecting the identical rule into the live page;
  the computed color became `rgb(16,54,36)`.
- **/memberships/:** `target-size` on the testimonial dots is an axe limitation. The clickable area
  includes the `::before` hit extension (now at least 25 × 45 px), which axe does not measure.
- **/blogs/ at 1280 px:** the inactive, `aria-hidden` `pagination-prev` control is exempt under
  WCAG 1.4.3.

Lighthouse accessibility (final perf run, taken before the last fixes): 96–100.

## Security regression review
- No new environment variables, secrets, `dangerouslySetInnerHTML`, redirects to user-controlled
  URLs, or logging.
- Checkout still fetches prices from `/public/catalog/*`. The plan hint only selects a package;
  `findPlanHint` can never set a price.
- No changes to auth, session, Stripe, webhook, billing, Prisma schema or migrations in this
  mission's commits (`git diff a044b1e -- backend` is empty).

## Not verified, or verified only partly
- Real-device mobile scrolling feel and INP. Only lab data exists; no RUM or CrUX data.
- Pixel-level visual regression screenshots before vs after were not captured. The design
  tokens changed only for the AA contrast fixes (darker amber text and muted greys).
- Mega menu, tabs, accordions and forms were not changed (FU-05), so they were not re-tested
  beyond the route sweep.
