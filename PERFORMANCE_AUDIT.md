> Historical baseline note: the initial Guard-mode blockers and obsolete test failure below were subsequently resolved for the source release. See RELEASE_VALIDATION.md for the current clean production build, schema validation, HTTP smoke checks and 218 passing tests. Before/after timings below are preserved as measured, not relabeled as production evidence.

# Performance audit: 8 November 2026

## Status and scope

Focused local optimizations implemented. **Not production-performance acceptance.** No deployment, database mutation/migration, dependency installation, secret/environment-file edit, or infrastructure/workflow change was performed.

Inspected npm scripts, Next.js 16.4.3 App Router/React 19 routes and client shell, NestJS 11 controllers/services, Prisma 6.19 schema/access patterns, existing tests, Docker/Compose, and manual VPS deployment workflow. Read installed Next.js lazy-loading, package-bundling and Image guidance before editing. Local Node is 26.5.0; the runtime container specifies Node 22, so production verification still matters.

Evidence: `reports/performance-2026-11-08/measurements.json`. It contains aggregate timings and browser resource URLs, not SQL/parameters, credentials or CMS response bodies.

## Main bottlenecks

- The public catalog summary performed an existence count and loaded full plans, full add-ons and unused amenities: **7 SQL queries** for a 6,242-byte response on this local dataset.
- The decorative scene rebuilt repeated identical models. Its 18 objects generated **49 distinct geometries / 1,408,032 geometry attribute bytes**.
- The current homepage bypassed existing prebuilt responsive hero derivatives. Overlapping secondary carousel images also requested images during initial load despite lazy loading; a below-fold studio logo was incorrectly prioritized.
- Remaining: the public content list reads all matching rows before filtering/pagination. A one-item settings response was **3,934,299 bytes**. `loadSite()` fetches and sanitizes whole page/blog collections for the public shell. These deserve a separate projection/pagination change with scheduling and content-parity coverage, not unsafe publication filtering or private caching.

## Changes and rationale

- `backend/src/catalog.ts`: dedicated summary-only projection; removed redundant existence count from `publicServices()`. Preserved response fields, zero prices, ordering/currency rules, active/archive gates, legacy fallback and existing 20-second cache/invalidation. The full `activeServices()` reader is unchanged.
- `components/office-models.ts`: construct each model once per scene and clone its object hierarchy, sharing immutable geometry/materials while keeping transforms independent. Dispose temporary indexed source geometry after conversion.
- `components/scene-backdrop.tsx`: dispose shared geometry once and cancel pending idle/timer initialization on unmount. Startup checks disposal before imports. Motion, layout, meshes and quality rules remain intact.
- `components/home-hero-image.tsx`, `components/home-live.tsx`, `app/page.tsx`: use existing first-slide derivatives with the current full-width sizing, alt text and CSS class; give other slides low fetch priority; remove below-fold logo priority. Secondary slides remain mounted to preserve ready crossfades. No claim of fewer carousel requests or smaller production JS is made.
- `lib/catalog.ts`: bound server-side catalog fetches to 3 seconds, retaining existing revalidation and unavailable-API fallbacks rather than allowing an indefinite render wait.
- Added six catalog summary mock tests in `backend/test/catalog-summary-performance.test.ts`, four frontend/model/timeout checks in `scripts/qa/performance-optimizations.test.cjs`, and two read-only profiling scripts. Added npm scripts and README instructions. No new dependency or shared cache for authenticated data.

## Before/after measurements

### Public reads and database

Protocol: direct controller/service calls against the existing **local PostgreSQL** dataset, serial execution; 10 samples with the application cache cleared, then 30 warm-cache samples per reader. Database buffers were not reset. Timing excludes HTTP middleware, guards, proxying and response serialization. p95 uses nearest rank; ten samples are a small lab sample, not a production SLA.

- `/api/public/catalog/services`: cold median **29.05 -> 11.91 ms**; p95 **62.18 -> 33.86 ms**. SQL queries **7 -> 4**. Median summed SQL duration **12.5 -> 4.5 ms**. Response **6,242 -> 6,242 bytes**. Approximately 59% lower median handler time in this run.
- An independent repeat measured **11.35 ms median / 34.05 ms p95**, again four queries. Comparing the optimized summary against the unchanged full-row projection on real local data passed deep equality.
- Unchanged detail control, `/api/public/catalog/services/coworking`: median **19.96 -> 18.72 ms**, p95 **43.83 -> 41.24 ms**, **8 -> 8 queries**, **16,514 -> 16,514 bytes**. Treat variation as noise, not an optimization.
- Unchanged content controls, `limit=1&page=1`: pages median **102.60 -> 101.57 ms** (p95 132.17 -> 131.98); blog **66.14 -> 58.71 ms** (71.47 -> 72.55); settings **328.94 -> 311.15 ms** (373.73 -> 340.90); pricing **22.78 -> 20.82 ms** (28.61 -> 25.89). Each still performs one SQL query. These are controls, not claimed gains.
- Warm catalog summary calls measured approximately **0.00465 -> 0.00200 ms**. This trivial cache-path variation is not meaningful throughput evidence. Production cache-hit/error rates, CPU, RSS and pool wait were not available.

### Procedural scene

CPU-only construction of the exact 18-model sequence, five discarded warm-ups and 20 measured samples, no browser/GPU/network:

- Median **24.18 -> 13.44 ms**; p95 **29.67 -> 17.31 ms**.
- Unique geometries **49 -> 24**; attribute bytes **1,408,032 -> 683,712** (about 51% less).
- Mesh count **49 -> 49**. This is not total GPU/browser memory or a frame-rate measurement.

### Browser diagnostic observations, not acceptance

Existing development frontend, API unavailable/fallback content, unthrottled browser, warm HTTP cache, one discarded warm-up plus three recorded reloads at each CSS viewport; 2.5-second post-load observation. No concurrent builds were run during recorded browser samples. Browser cache/DPR were not independently reset/pinned; development HMR and adaptive resource-cache reporting make these unsuitable for production bundle comparisons.

- Homepage, 1440x900: median LCP **1,660 -> 1,568 ms**, TTFB **1,294 -> 1,224 ms**, load event **1,912 -> 1,844 ms**; observed CLS **0 -> 0**.
- Homepage, 390x844: median LCP **1,544 -> 1,680 ms**, TTFB **1,281 -> 1,326 ms**, load event **1,740 -> 1,849 ms**; observed CLS **0 -> 0**.
- Summed long-task time remained high: desktop **3,615 -> 3,501 ms**, mobile **3,491 -> 3,646 ms** over the observation window. These values are not Lighthouse TBT.
- **No demonstrated overall LCP win:** mobile was slower in this diagnostic run. Do not turn desktop variation or isolated CPU savings into a production speed claim.
- Carousel selection, menu open/close, inquiry launch/close and homepage-to-coworking navigation worked. The inquiry correctly displayed the unavailable-live-catalog fallback; checkout was not validated. Homepage and coworking had no horizontal overflow at 390px, and the decorative scene remained live.

## Checks run

Used root-relative Node commands with `--preserve-symlinks --preserve-symlinks-main` because this Windows Guard environment restricts CLI filesystem traversal.

Passed:

- `node ... scripts/qa/local-audit-launcher.cjs typecheck` and `lint` (including final checks after implementation).
- `node ... scripts/qa/local-audit-launcher.cjs backendBuild`.
- `node ... scripts/qa/performance-optimizations.test.cjs`: **10/10**.
- `node ... -r ./scripts/qa/ts-register.cjs scripts/qa/frontend-safety.test.ts`: **9/9**, including authentic hero derivative dimensions.
- Same loader with `scripts/qa/service-content.test.ts`: **11/11**.
- Same loader with `backend/test/catalog-core.test.ts`: **18/18**.
- Both profiling scripts before/after; real-data catalog summary equivalence.

Not clean / blocked:

- Existing `local-audit-launcher.cjs pure`: **75 passed, 1 failed**. Unchanged `api-scenarios-safety.test.cjs:55` fails with `ReferenceError: mapService is not defined` while extracting booking source. It is unrelated to the changed files; not silently treated as a pass or weakened.
- Frontend production build via the existing launcher and supported `next build --webpack` both failed before compilation with **EPERM, lstat `C:\`**. Current production route sizes, client bundles and Lighthouse/TBT are **[blocked]**; the pre-existing `.next` build was not used as current evidence. The same filesystem blocker was not repeatedly retried after code changes.
- An initial focused run using Node's `--test` subprocess mode stalled and was terminated. Running the same tests directly in one process passed; the new npm command uses that path.
- Git status/diff commands failed on `/dev/null` access. Listed changes were reviewed directly; no claim that the entire pre-existing working tree was clean.
- The owned API process initialized and connected to the local DB, but health requests timed out from browser and shell. It was stopped afterward. **HTTP API median/p95, integrated healthy-API page loads, authenticated integration/checkout tests and production error/cache rates are [blocked].** Mutation suites were not run against existing data.
- Field INP is **[blocked]**: no real-user telemetry or production traffic was collected. The short lab observation is not field Core Web Vitals.

## Exact next steps and remaining recommendations

1. In a normal local terminal or approved staging environment outside the filesystem restriction, run the backend from `backend` with its existing private configuration, verify `http://localhost:4000/api/health`, then build with `NEXT_DIST_DIR=.next-perf-review` and run `npm start -- --port 3100` with that same variable. Allow the QA origin through the API's existing exact-origin mechanism without changing secrets.
2. Set `QA_BASE_URL=http://localhost:3100`, `QA_API_URL=http://localhost:4000/api`, and a fresh absolute `QA_TMP`; run `npm run test:lighthouse` serially on healthy full-content pages. Repeat at least three times and inspect each saved report. The older `test:performance-baseline` also requires obsolete `source-home` disclosure markup, so its readiness assertion must be deliberately updated with matching guard tests before using it for this redesigned homepage.
3. Capture current production manifests/chunk sizes from that successful build and test home, coworking, meeting rooms, journal and account routes with fixed device/DPR/throttling. Collect representative scripted interactions; obtain field LCP/INP/CLS/TTFB distributions through approved first-party RUM before claiming real-world improvements.
4. Measure real HTTP median/p95, guarded-request DB/pool wait, cache hit rates and resource usage under safe staging concurrency. Use query plans and realistic cardinalities before adding indexes. Preserve immediate account revocation instead of caching the auth user lookup blindly.
5. Next code targets: a lightweight public shell/navigation reader, content-list pagination that retains all publication/scheduling semantics, and reducing large settings payloads. Profile continuous 3D/GSAP work on actual mobile hardware before changing animation behavior. Inspect deployed Nginx/CDN compression and cache headers with read-only infrastructure access; repository configuration alone cannot prove those settings.

No production process, hosting, DNS, payment provider, deployment workflow or environment value was modified. The pre-existing development frontend was left running.
