# Performance Baseline (before mission changes)

Measured 2026-11-12 02:52 UTC with lighthouse 13.6.0 (lab, simulated throttling) against a LOCAL production build
(next build + next start, NEXT_DIST_DIR=.next-mission, port 3001) of commit a044b1e plus the
redirect-only WSJ-01 change, live local API (NestJS :4000) and local PostgreSQL.
One sample per route/form factor; Lighthouse default mobile (Moto G Power, 4x CPU, slow 4G
simulated) and desktop presets. Lab data only: no field (CrUX/RUM) data or INP exists locally.
Raw evidence: evidence/perf-baseline.json.

## mobile

| Route | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTFB ms | JS KB | CSS KB | Img KB | Req | Main-thread ms | Long tasks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 64 | 97 | 100 | 100 | 1672 | 1672 | 6401 | 0.000 | 5746 | 17 | 475 | 108 | 66 | 42 | 16413 | 16 |
| /about-us/ | 45 | 96 | 100 | 100 | 1977 | 6690 | 1949 | 0.000 | 4320 | 12 | 559 | 128 | 66 | 47 | 7101 | 12 |
| /coworking/ | 43 | 96 | 100 | 100 | 1973 | 7306 | 3449 | 0.000 | 4257 | 15 | 559 | 128 | 122 | 49 | 8781 | 13 |
| /podcast-studio/ | 45 | 96 | 100 | 100 | 1824 | 6681 | 2879 | 0.000 | 3942 | 12 | 559 | 128 | 77 | 47 | 7926 | 11 |
| /virtual-office/ | 40 | 96 | 100 | 100 | 2403 | 6606 | 3309 | 0.000 | 5444 | 12 | 559 | 128 | 45 | 46 | 8267 | 15 |
| /meeting-rooms/ | 40 | 96 | 100 | 100 | 2387 | 6661 | 3179 | 0.000 | 5489 | 14 | 559 | 128 | 64 | 47 | 8700 | 15 |
| /contact-us/ | 62 | 100 | 100 | 100 | 2364 | 2364 | 2347 | 0.000 | 5749 | 8 | 565 | 128 | 43 | 50 | 9616 | 13 |
| /blogs/ | 68 | 100 | 100 | 100 | 1826 | 1826 | 2738 | 0.000 | 3253 | 391 | 559 | 128 | 102 | 49 | 8151 | 16 |

## desktop

| Route | Perf | A11y | BP | SEO | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTFB ms | JS KB | CSS KB | Img KB | Req | Main-thread ms | Long tasks |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 78 | 97 | 100 | 100 | 380 | 954 | 484 | 0.000 | 978 | 11 | 479 | 108 | 92 | 47 | 2633 | 8 |
| /about-us/ | 83 | 96 | 100 | 100 | 460 | 1066 | 341 | 0.000 | 878 | 12 | 562 | 128 | 76 | 48 | 1985 | 6 |
| /coworking/ | 75 | 96 | 100 | 100 | 456 | 1046 | 536 | 0.000 | 968 | 14 | 562 | 128 | 99 | 51 | 2400 | 6 |
| /podcast-studio/ | 80 | 96 | 100 | 100 | 416 | 965 | 424 | 0.000 | 870 | 11 | 562 | 128 | 57 | 48 | 2161 | 6 |
| /virtual-office/ | 80 | 96 | 100 | 100 | 421 | 991 | 418 | 0.000 | 961 | 12 | 562 | 128 | 34 | 48 | 2169 | 6 |
| /meeting-rooms/ | 81 | 96 | 100 | 100 | 418 | 968 | 413 | 0.000 | 818 | 8 | 562 | 128 | 75 | 52 | 2080 | 6 |
| /contact-us/ | 88 | 96 | 100 | 100 | 581 | 581 | 292 | 0.000 | 963 | 12 | 569 | 128 | 35 | 52 | 1976 | 5 |
| /blogs/ | 88 | 96 | 100 | 100 | 417 | 417 | 287 | 0.000 | 1040 | 330 | 562 | 128 | 137 | 54 | 2218 | 5 |

## Build output (baseline)

- Client JS emitted: 2800 KB raw across 45 chunks; CSS 820 KB raw across 18 files.
- Largest shared chunk: GSAP ScrollTrigger + Framer Motion runtime together (344 KB raw / 85 KB gzip).
- three.js chunks (377 KB + 368 KB raw) loaded on every public route on every device after idle.

## Observations that drove the plan

- Mobile TBT 1.9-6.4 s and 7-16 s main-thread work: script evaluation dominated (bootup 3.3-10.8 s).
  The WebGL world (three.js + procedural office models) started on phones too, beside a second
  2D particle requestAnimationFrame loop and ~12 infinite CSS drift animations on large layers.
- The whole public shell (header, WebGL, canvas, GSAP setup) was rebuilt on every navigation.
- Above-the-fold content was hidden by JS entrance animations after hydration (data-anim on H1s,
  Framer Motion initial=hidden sections) and a full-screen curtain wipe covered each navigation.
- No console errors on any sampled route. CLS 0 everywhere. A11y 96-100, BP 100, SEO 100.
- Recurrent failing audits: color-contrast, label-content-name-mismatch, unused CSS/JS,
  render-blocking CSS (24 global stylesheets), legacy-javascript, forced reflow.
