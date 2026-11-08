# Workspace Junction replacement

Next.js 16.4.3 / React 19 frontend with a NestJS / Prisma / PostgreSQL backend. Live on the existing VPS at **https://wp.workspacejunction.com/**. See `DEPLOYMENT_2026-11-08.md` for verified deployment scope, database preservation and remaining configuration limits. Never point mutation or load-test suites at production.

## Requirements
Node.js 22+, npm, Docker Desktop with Linux containers. Existing node_modules are present locally. Keep backend/.env private. Never paste credentials into reports or commit them.

## Startup (PowerShell, from repository root)
```powershell
npm ci
npm --prefix backend ci
npm --prefix backend run prisma:generate
# Existing ignored backend/.env already contains local-only credentials.
# New installation: copy backend/.env.example to backend/.env and generate unique values.
docker compose --env-file backend/.env up -d postgres
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
node scripts/import-approved-pricing.cjs
npm --prefix backend run build
# In its own terminal, working directory MUST be backend:
Set-Location backend
npm start
```
In another terminal at the repository root:
```powershell
npm run dev
```
Open http://localhost:3000 and /admin. Administrator credentials are the locally configured ADMIN_EMAIL and ADMIN_PASSWORD in ignored backend/.env. Seeding never overwrites existing users/content. No public registration exists.

## Environment
Copy root .env.example to .env.local for frontend configuration. NEXT_PUBLIC_* values are embedded at build time. API_URL is server-only and must point to the local/private Nest API including /api. NEXT_PUBLIC_API_URL can be /api for same-origin reverse proxying (recommended) or an explicitly configured HTTPS API URL. API image host is restricted to the configured public API origin. Set backend FRONTEND_URL to the exact frontend origin for CORS and cookie-write protection. Optional FRONTEND_URLS is a validated comma-separated extra allowlist; for QA add http://localhost:3100 in the API process environment, never a wildcard. API_ORIGIN controls uploaded media absolute URLs. Backend README documents SMTP and auth settings. Never store secrets in CMS settings because published settings are public.

## Validation
```powershell
npm run test:content
npm run typecheck
npm run lint
npm run build
npm --prefix backend run build
# API must already be running, SMTP_HOST must remain unset for test safety:
npm --prefix backend test
node scripts/migrate/reconcile.mjs
# Production QA on isolated build directory, do not collide with next dev:
$env:NEXT_DIST_DIR='.next-qa'
npm run build
npm run start -- --port 3100
# Another terminal, backend FRONTEND_URL must equal QA origin for browser auth:
$env:QA_BASE_URL='http://localhost:3100'
$env:QA_TMP='<absolute temporary output directory>'
node scripts/qa/public-functional.cjs
node scripts/qa/business-settings.cjs
# Settings test waits for the public ISR cache to restore source defaults.
node scripts/qa/browser-smoke.cjs
node scripts/qa/assets-smoke.cjs
node scripts/qa/redirects.cjs
node scripts/qa/lighthouse.mjs
```
Run the suites sequentially. API/functional tests create temporary globally visible CMS records; concurrent route crawling or campaign tests can observe those records and produce invalid results. After mutation suites finish cleanup, wait for the 30-second ISR/API cache window before the final route crawl. Run Lighthouse alone, without builds or other browser suites competing for CPU. Reports contain measured scope, limitations and current results. Additional functional scripts are under scripts/qa. Full QA creates only uniquely named local test records and removes them when implemented by that script. Public source migration scripts perform read-only source retrieval; do not rerun the crawler blindly over curated data. Offline reconciliation is idempotent.

## Architecture and source evidence
- app + components + lib: server-rendered public pages, local source fallback, authenticated admin.
- backend: NestJS REST API, role controls, PostgreSQL content/settings/leads/media/audit/events.
- data/site.json: 102 page/custom/archive records,71 posts,10 categories. Some page records are category pagination; counts are not distinct business landing pages.
- data/approved-pricing.json:59 source-evidenced plans. Raw imported price evidence remains quarantined pending review; it is not presented as approved plans.
- data/redirects.json:10 exact redirects with archived evidence explained in MIGRATION_REPORT.md.
- public/media: original downloaded public assets. Rich migrated HTML uses responsive same-origin Next Image optimization URLs; redesigned page images use Next Image. Eight prebuilt hero AVIF/WebP derivatives under public/media/optimized avoid first-request encoding on the LCP path. The authentic original remains intact. Regenerate them with `npm run images:hero` only when intentionally updating that source photo; responsive descriptors are validated against intrinsic dimensions.
- scripts/import-approved-pricing.cjs: local-only additive import, refuses nonlocal DB, preserves existing records.

## Deployment checklist (approval required; not executed)
1. Review RELEASE_VALIDATION.md, DEPLOYMENT_2026-11-08.md, remaining pricing configuration and approved business legal policies. Obtain explicit deployment approval.
2. Provision PostgreSQL, private network/backups, durable upload volume, Node frontend/API processes or build containers. Keep live WordPress intact until an approved cutover.
3. Generate fresh production database/JWT/admin/SMTP credentials. Do not reuse local credentials. Set NODE_ENV=production, exact HTTPS FRONTEND_URL, API_ORIGIN and root NEXT_PUBLIC_SITE_URL/NEXT_PUBLIC_API_URL/API_URL.
4. Run Prisma migration deploy, seed/import reviewed content once, inspect record counts and media. Seeding is additive and will not update existing CMS edits; resolve desired content updates explicitly.
5. Build frontend only after build-time public environment values are set; `npm run build`, then `npm start`. Run backend from backend working directory with its private environment. Reverse proxy /api and /uploads consistently, set TLS, persistent storage, safe rate limits, logging, monitoring and backups. Never expose PostgreSQL publicly.
6. Configure real SMTP only after approved sender/domain credentials and perform an approved delivery test. Stripe catalog checkout and subscription handling are implemented; the live webhook is configured. A real payment/refund was not performed during release verification.
7. Run staging route/redirect/content/SEO/accessibility/auth/media/backup-restore checks, verify Lighthouse on staging, then approve DNS/cutover and retain rollback.

## Limits
Email delivery, business-approved privacy/terms, third-party booking/payment credentials, hosting approval and real-device field performance cannot be fabricated. SMTP-not-configured submissions are database receipts, not delivered email. Newsletter forms record consent requests; they do not subscribe an external list. Booking inquiries do not reserve a space, create a paid membership or charge a card. See DEPLOYMENT_2026-11-08.md and the latest validation reports for the remaining configuration and external gaps.

## Repeated local performance profiling

Use `npm run test:performance-baseline` with absolute `QA_TMP` pointing to a fresh temporary output folder. Optional `QA_SAMPLES` is 3–10 (default 5). Run a production frontend on localhost3100 and healthy API on localhost4000, with `FRONTEND_URLS` including `http://localhost:3100` in the API process environment. No private environment-file edits are needed.

The read-only runner alternates full-content homepage/coworking samples serially, saves all Lighthouse JSON/traces, and reports min/median/max without overwriting LIGHTHOUSE_REPORT.md. It checks API health, published pricing, original homepage disclosure, frontend pricing HTML, CORS origin permission, and browser-console errors. Existing summary evidence is never overwritten. An exit code of1 indicates unmet targets or invalid setup, not necessarily a product regression. Server/image cache is warmed by readiness requests and not reset; Lighthouse uses its default simulated-mobile profile. Do not run concurrently with builds, mutation suites, other browser tests or competing workers. `npm run test:performance-guards` exercises refusal paths without launching Chrome. This is lab profiling, not field INP or real-device acceptance.

## Paint versus presentation diagnostics

`npm run test:paint-timeline` checks the offline Chrome trace correlator. Run `node scripts/qa/paint-timeline.mjs <trace.json> <fresh-output.json>` against a saved performance trace. It matches the latest main-frame navigation/LCP node, reports image painting, first commit, first paint, layout, and the union of main-thread task time before LCP. The output file must not exist. Image decode events lack a stable node/URL link and are explicitly unattributed. Time outside recorded tasks is not proof of a GPU, compositor, OS, or paint-holding cause. These are raw trace diagnostics, not simulated Lighthouse metrics, field INP, or product acceptance.


## Full-platform visual redesign (28 October 2026)

The user-requested redesign replaces the old homepage, public shell, inner-page presentation and admin styling. The old `.next-qa` build and historical performance screenshots are not the current visual baseline. Current redesign review builds use `.next-redesign`; source development remains on port 3000.

Public styles are intentionally scoped under `.wj-platform`. Import order in `app/layout.tsx` puts the new platform/home/inner/component/inquiry layers after the legacy sheets. Admin styles remain independently scoped to `.adm-root`.

Service pages present an overview, reviewed pricing and organized details. Entire original sanitized page copy remains in initial server-rendered source disclosures. Historical pricing, old payment/access instructions, imported template staff and source counters are not current platform promises. Articles remain full readable articles. Contact information in current sections comes from business settings.

### Run and review locally
Use normal local terminals for persistent processes; tool-owned review processes may expire.

```powershell
# Terminal 1, project root. Existing private backend/.env remains local.
$env:FRONTEND_URLS="http://localhost:3000,http://localhost:3100,http://localhost:3102"
npm run dev:api

# Terminal 2, project root
npm run dev
```

For a production review, keep the API healthy first. In another terminal:

```powershell
$env:NEXT_DIST_DIR=".next-redesign"
npm run build
npm run start -- --port 3102
```

### Redesign regression

```powershell
$env:QA_BASE_URL="http://localhost:3102"
$env:QA_API_URL="http://localhost:4000/api"
$env:QA_MODE="production"
$env:QA_TMP=Join-Path $env:TEMP "wsj-redesign-qa"
npm run lint
npm run test:content
npm run test:service-content
npm run test:public
# Run read-only crawls/UI checks only AFTER test:public cleans its temporary fixtures.
npm run test:browser
npm run test:redesign-ui
```

`test:redesign-ui` checks service/company/contact/editorial layouts at four viewport widths, authentic source-copy preservation, accessibility samples, and authenticated admin navigation without changing content. It uses the existing local admin credentials privately and never prints them. No test result implies real reservations, payment processing, mail delivery, live deployment, or exhaustive security acceptance.


## Autonomous API and responsive audit (29 Oct 2026)

Governing user scope: `AUTONOMOUS_API_UI_AUDIT_SPEC.md`. Actual current evidence and pending quality gates: `API_STRESS_AUDIT.md`. This change set is not yet fully accepted.

Run suites **serially**, with a healthy local API and no competing marker-data runner. Never seed over existing content. `backend/.env` is read privately for local test credentials; valid submission suites refuse configured SMTP. No live/external target is allowed.

```powershell
# Every main scenario requires 20 consecutive expected passes.
$env:QA_TMP = 'C:\absolute\fresh\api-evidence'
npm run test:api:scenarios
# Matching source/configuration only after a cleanly stopped partial run:
npm run test:api:scenarios -- --resume

# Run only after API scenarios have finished and cleanup has passed.
$env:QA_TMP = 'C:\absolute\fresh\layout-evidence'
$env:QA_BASE_URL = 'http://localhost:3000'
$env:QA_API_URL = 'http://localhost:4000/api'
npm run test:layout
```

The layout runner covers all imported routes at 375, 414, 768, 1024, 1280, 1440, 1920 and 3840px, plus booking/menu and read-only admin checks. `QA_RESUME=1` requires identical configuration/source and verifies saved evidence hashes. Geometry and 44px diagnostics still need review; a scan is not a proof of every possible overlap. Identical ARIA snapshots are deduplicated by content hash.

Backend development now compiles with TypeScript before starting `dist/main.js`, retaining decorator metadata. Explicit DTO parameter pipes also keep validation independent of method metadata. `npm --prefix backend run start:dev` watches and serializes compiled-server restarts; failed compilation retains the last running server without emitting partial output.

The optional local launcher `node scripts/qa/local-audit-launcher.cjs <mode>` supports `typecheck`, `lint`, `backendBuild`, `generate`, `migrate`, `api`, `build`. In this device sandbox `--preserve-symlinks --preserve-symlinks-main` may be needed before the launcher; these flags are inherited by its Node child. They do not resolve every filesystem permission error. `build` defaults to separate `.next-audit`; wait for mutation-suite completion before building. Never treat an interrupted/blocked CLI run as a pass.

Supplemental nonmutating input vectors must wait for a finished full main PASS and verified cleanup:

```powershell
$env:QA_AFTER_REPORT = 'C:\absolute\fresh\api-evidence\api-scenarios.json'
$env:QA_TMP = 'C:\absolute\fresh\input-evidence'
npm run test:api:inputs
npm run test:api:input-guards
```

That companion adds 153 SQL-like/script-like/Unicode/search-boundary/public-safety and invalid-JSON/auth scenarios, each requiring 20 consecutive passes. It enforces the predecessor fingerprint, completion and lock state. Public-safety reads are bounded observations, not exhaustive security proof.

## Focused performance audit (8 November 2026)

See `PERFORMANCE_AUDIT.md` and `reports/performance-2026-11-08/measurements.json` for measured scope, before/after results, and blocked production gates. No deployment or database mutation was performed.

```powershell
npm run test:performance-optimizations
# Each profiler requires a fresh absolute JSON output filename; neither overwrites evidence.
npm run profile:public-reads -- 'C:\absolute\fresh\public-reads.json'
npm run profile:office-models -- 'C:\absolute\fresh\office-models.json'
```

The public-reader profiler refuses nonlocal database hosts, reads only public content/catalog data, and prints only timing, query-count and byte aggregates. It calls controllers/services directly, so its results do not include HTTP, guards, reverse proxies or response serialization. Database buffers remain warm. The model profiler is CPU-only and measures geometry attribute bytes, not total browser/GPU memory. The new regression suite uses mocks and procedural geometry only, without database or network access. On this Windows Guard environment, direct Node commands with `--preserve-symlinks --preserve-symlinks-main` and the existing synchronous test loader were used instead of npm/tsx subprocess paths. Those flags do not fix the blocked Next.js production build.
