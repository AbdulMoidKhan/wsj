# Performance Results — before vs after

Same machine, same local API/DB, same tool (lighthouse 13.6.0 (lab, simulated throttling)), same 8 routes × 2 form factors, one
sample each. **Before:** 2026-11-12T02:52 UTC, build of a044b1e. **After:** 2026-11-12T03:34 UTC, final mission build.
Lab data only — no field/RUM data (INP cannot be measured locally; TBT is the lab proxy).
Single samples carry roughly ±5 points of score noise; the large deltas below exceed it.
Raw evidence: evidence/perf-baseline.json, evidence/perf-after-1.json, evidence/perf-after-2.json, evidence/perf-final.json.

## mobile

| Route | Perf | TBT ms | LCP ms | FCP ms | JS KB | Main-thread ms | A11y | CLS | Target met (perf 90+) |
|---|---|---|---|---|---|---|---|---|---|
| / | 64 → **68** | 6401 → 2148 (-66%) | 1672 → 1803 (+8%) | 1672 → 1803 | 475 → 280 | 16413 → 7292 | 97 → 97 | 0.00 → 0.00 | FAIL |
| /about-us/ | 45 → **59** | 1949 → 709 (-64%) | 6690 → 5816 (-13%) | 1977 → 1974 | 559 → 302 | 7101 → 8032 | 96 → 96 | 0.00 → 0.00 | FAIL |
| /coworking/ | 43 → **51** | 3449 → 864 (-75%) | 7306 → 5968 (-18%) | 1973 → 2520 | 559 → 302 | 8781 → 4050 | 96 → 96 | 0.00 → 0.00 | FAIL |
| /podcast-studio/ | 45 → **59** | 2879 → 747 (-74%) | 6681 → 5711 (-15%) | 1824 → 1824 | 559 → 302 | 7926 → 3825 | 96 → 96 | 0.00 → 0.00 | FAIL |
| /virtual-office/ | 40 → **57** | 3309 → 888 (-73%) | 6606 → 5677 (-14%) | 2403 → 1819 | 559 → 302 | 8267 → 3942 | 96 → 96 | 0.00 → 0.00 | FAIL |
| /meeting-rooms/ | 40 → **58** | 3179 → 808 (-75%) | 6661 → 5758 (-14%) | 2387 → 1821 | 559 → 302 | 8700 → 4228 | 96 → 96 | 0.00 → 0.00 | FAIL |
| /contact-us/ | 62 → **74** | 2347 → 1052 (-55%) | 2364 → 1821 (-23%) | 2364 → 1821 | 565 → 309 | 9616 → 4346 | 100 → 100 | 0.00 → 0.00 | FAIL |
| /blogs/ | 68 → **75** | 2738 → 1046 (-62%) | 1826 → 1825 (0%) | 1826 → 1825 | 559 → 302 | 8151 → 4807 | 100 → 100 | 0.00 → 0.00 | FAIL |
| **average** | 51 → **63** | 3282 → 1033 | 4976 → 4297 | | 549 → 300 | 9370 → 5065 | | | |

## desktop

| Route | Perf | TBT ms | LCP ms | FCP ms | JS KB | Main-thread ms | A11y | CLS | Target met (perf 95+) |
|---|---|---|---|---|---|---|---|---|---|
| / | 78 → **88** | 484 → 289 (-40%) | 954 → 769 (-19%) | 380 → 381 | 479 → 284 | 2633 → 1953 | 97 → 97 | 0.00 → 0.00 | FAIL |
| /about-us/ | 83 → **99** | 341 → 63 (-82%) | 1066 → 1032 (-3%) | 460 → 459 | 562 → 306 | 1985 → 1039 | 96 → 96 | 0.00 → 0.00 | PASS |
| /coworking/ | 75 → **98** | 536 → 80 (-85%) | 1046 → 1016 (-3%) | 456 → 456 | 562 → 306 | 2400 → 1199 | 96 → 96 | 0.00 → 0.00 | PASS |
| /podcast-studio/ | 80 → **98** | 424 → 68 (-84%) | 965 → 964 (0%) | 416 → 418 | 562 → 306 | 2161 → 1084 | 96 → 96 | 0.00 → 0.00 | PASS |
| /virtual-office/ | 80 → **98** | 418 → 68 (-84%) | 991 → 966 (-3%) | 421 → 417 | 562 → 306 | 2169 → 1089 | 96 → 96 | 0.00 → 0.00 | PASS |
| /meeting-rooms/ | 81 → **98** | 413 → 80 (-81%) | 968 → 988 (+2%) | 418 → 419 | 562 → 306 | 2080 → 1131 | 96 → 96 | 0.00 → 0.00 | PASS |
| /contact-us/ | 88 → **98** | 292 → 131 (-55%) | 581 → 419 (-28%) | 581 → 419 | 569 → 313 | 1976 → 1891 | 96 → 100 | 0.00 → 0.00 | PASS |
| /blogs/ | 88 → **98** | 287 → 118 (-59%) | 417 → 419 (+1%) | 417 → 419 | 562 → 306 | 2218 → 1596 | 96 → 96 | 0.00 → 0.00 | PASS |
| **average** | 82 → **97** | 399 → 112 | 873 → 822 | | 553 → 304 | 2203 → 1373 | | | |

## Build output

| | Before | After |
|---|---|---|
| Client JS emitted (raw) | 2800 KB / 45 chunks | 2588 KB / 45 chunks |
| GSAP + Framer Motion shared chunk | 344 KB raw / 85 KB gz on every page | removed (Framer Motion uninstalled) |
| three.js on phones/tablets | downloaded + built after idle | never downloaded |
| three.js on capable desktops | rebuilt on every navigation | built once after first interaction, reused |
| Global render-blocking CSS | 24 imports incl. home/contact-only sheets | home (30 KB) and contact (13 KB) sheets load only on their routes |

## Acceptance targets

| Target | Result |
|---|---|
| Desktop Lighthouse ≥ 95 | **PASS on 7/8 routes** (97–99); homepage 88 (FAIL — hydration of a large client tree, see below) |
| Mobile Lighthouse ≥ 90 | **FAIL** — 51–75 (was 40–68) |
| Accessibility ≥ 95 | PASS (96–100); further AA contrast + label-in-name fixes landed after this run |
| Best Practices ≥ 95 | PASS (100 everywhere) |
| SEO ≥ 95 | PASS (100 everywhere) |
| TBT ≤ 200 ms | PASS desktop inner routes (63–131 ms); FAIL mobile (0.7–2.1 s) and desktop home (289 ms) |
| CLS ≤ 0.1 | PASS (0 everywhere) |
| FCP ≤ 1.8 s | PASS desktop; mobile 1.8–2.8 s (FAIL on 4 routes) |
| LCP ≤ 2.5 s | PASS desktop; mobile PASS on /, /contact-us/, /blogs/; FAIL on Figma inner pages (~5.7 s) |
| JS errors | PASS — zero console errors on every sampled route |

## Remaining bottlenecks (measured, not guessed)

1. **Mobile LCP on Figma inner pages (~5.7 s simulated).** LCP is the hero image; it is discoverable,
   preloaded, `fetchpriority=high` and loads in ~0.5 s, then waits **~1.7 s of element render delay**
   (lcp-breakdown-insight). The main thread is busy with style/layout over ~125 KB of global,
   `!important`-heavy CSS (15 render-blocking files, 336 `:has()` selectors). Fix = CSS consolidation
   and per-route splitting (follow-up FU-01).
2. **Mobile homepage TBT (~2 s).** 232 KB HTML with 116 KB inline RSC payload and hydration of a large
   client tree (SiteShell + nav links on every page, home carousel/tabs). Fix = move static shell parts
   to server components, slim the nav-link prop (FU-02).
3. **Fonts:** three high-priority font preloads (124 KB, Playfair normal + italic + Inter) compete with
   the LCP image on slow 4G. Splitting the italic face needs a visual review (FU-03).

---

# FU-01 results (2026-11-12, commit feddb78)

**Method.** Two local production builds measured back to back on the same machine and port:
the pre-FU-01 build (e3fa2ea, `.next-fu01-base`) and the FU-01 build. Mobile = **median of 3
Lighthouse runs** per route per build (single runs varied by up to ±5 points); desktop = 1 run.
Evidence: `evidence/perf-fu01-before-m{1,2,3}.json`, `perf-fu01-after-m{1,2,3}.json`,
`perf-fu01-before-desktop.json`, `perf-fu01-after-desktop.json`.

## mobile (median of 3)

| Route | Perf | TBT ms | LCP ms | FCP ms | Main-thread ms | JS KB | CSS KB |
|---|---|---|---|---|---|---|---|
| / | 64 → **70** | 2364 → 1601 | 2346 → 1890 | 2346 → 1890 | 7528 → 5831 | 280 → 263 | 108 → 107 |
| /about-us/ | 57 → **61** | 707 → 647 | 5835 → 5698 | 1975 → 1668 | 8161 → 7337 | 302 → 276 | 125 → 109 |
| /coworking/ | 52 → **59** | 883 → 720 | 5964 → 5990 | 2523 → 1823 | 4329 → 3292 | 302 → 276 | 125 → 109 |
| /podcast-studio/ | 58 → **59** | 761 → 749 | 5722 → 5858 | 1823 → 1672 | 3910 → 3382 | 302 → 276 | 125 → 109 |
| /virtual-office/ | 50 → **54** | 938 → 840 | 5668 → 5682 | 2822 → 2381 | 4078 → 3393 | 302 → 276 | 125 → 109 |
| /meeting-rooms/ | 51 → **53** | 870 → 858 | 5780 → 5818 | 2805 → 2399 | 4042 → 3475 | 302 → 276 | 125 → 109 |
| /contact-us/ | 74 → **75** | 1081 → 800 | 1831 → 2080 | 1831 → 2080 | 4415 → 3785 | 309 → 289 | 130 → 114 |
| /blogs/ | 75 → **78** | 1118 → 912 | 1833 → 1665 | 1833 → 1665 | 4755 → 3845 | 302 → 276 | 125 → 109 |
| **average** | 60.1 → **63.6** | 1090 → 891 (-18%) | 4372 → 4335 | | 5152 → 4293 (-17%) | | |

## desktop (1 run)

| Route | Perf | TBT ms | LCP ms | JS KB |
|---|---|---|---|---|
| / | 78 → **89** | 332 → 183 | 1654 → 1450 | 284 → 266 |
| /about-us/ | 97 → **99** | 73 → 55 | 1130 → 986 | 306 → 280 |
| /coworking/ | 98 → **99** | 83 → 41 | 1036 → 835 | 306 → 280 |
| /podcast-studio/ | 99 → **99** | 67 → 45 | 889 → 927 | 306 → 280 |
| /virtual-office/ | 97 → **99** | 116 → 35 | 1009 → 794 | 306 → 280 |
| /meeting-rooms/ | 98 → **99** | 115 → 49 | 845 → 933 | 306 → 280 |
| /contact-us/ | 96 → **97** | 137 → 120 | 583 → 377 | 313 → 292 |
| /blogs/ | 98 → **100** | 119 → 79 | 421 → 376 | 306 → 280 |

Desktop home scored 95 in one other run of the same build; it sits at the 95 boundary.

## Mechanism-level measurements (fast desktop CPU, unthrottled)
| Measure | Before | After |
|---|---|---|
| Style/layout passes > 15 ms during load (/coworking/) | 6 (402 ms) | 4 (288 ms) |
| Forced recalcs from ScrollTrigger at startup | 4 | 0 |
| Recalc cost of inserting one element into the page | ~44 ms | 0.2 ms (unclassed node) |
| Stylesheets on a Figma page | 14 | 9 |

## What FU-01 did NOT fix (measured)
- **Mobile LCP on Figma inner pages stays ~5.7-6.0 s.** The LCP breakdown shows TTFB ~15 ms, load
  delay ~20 ms, load ~10-60 ms and 1.2-2.4 s of *render delay* in the observed trace. Lighthouse
  simulates an image LCP by replaying every request that started before it on a 1.6 Mbps link;
  every JS chunk starts in `<head>`, so the hero shares bandwidth with ~276 KB JS + 124 KB fonts +
  109 KB CSS. Text-LCP pages (home, contact, blogs) do not pay this and score 70-78.
  `decoding="sync"` on the hero did not change it. Remaining levers, in order of size: font
  preloads (124 KB, FU-03, needs design sign-off); shared client JS (react-dom + Next runtime
  ~110 KB gz is fixed; GSAP ~26 KB, header/mega-menu ~15 KB and lucide ~14 KB could load after
  first paint, FU-02/FU-06).
- Inserting an element that **carries a class** still costs ~44 ms of recalculation; the remaining
  cost comes from the 55 `body:has(.wj-platform) ...` rules in button/consistency/motion sheets
  (removing them in-page drops it to ~9 ms; a child-combinator rewrite did not help). Replacing
  that gate needs a server-rendered public-site flag on `<body>`, i.e. a layout change (FU-06).
