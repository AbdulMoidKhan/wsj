# Release Report: `release/performance-security-20261109`

Clean, minimal performance / security / reliability release for Workspace Junction (`wp.workspacejunction.com`).

| | |
|---|---|
| Prepared | 2026-11-09 |
| Status | **Prepared and verified in isolated staging. Not pushed. Not deployed.** |
| Production actions taken | none (read-only inspection, read-only `pg_dump`, read-only smoke GETs; production PM2 restart counters, uptime, `HEAD` and migration count re-verified unchanged after every staging drill) |
| Previous work | preserved untouched on `fix/audit-findings-f001-f017` (`cc0912b`) plus a safety ref `backup/remediation-cc0912b` |

---

## 1. Exact production baseline

| Ref | Commit | Verified how |
|---|---|---|
| **Production (live)** | **`396ad2a030136b212c77ab572e21003a30dc82f1`** "docs: record verified live VPS deployment and configuration limits" | `git rev-parse HEAD` in `/root/wsj-next` on the VPS: clean tree, PM2 `wsj-web`/`wsj-backend` running from it, 4 Prisma migrations applied |
| Local `main` = `personal/main` (`AbdulMoidKhan/wsj`) | `04b06f31bbc4f5b4e4483d4493440da1fb01f9a7` | 12 commits **ahead of production, never deployed** |
| Remediation branch `fix/audit-findings-f001-f017` | `cc0912b3c565c9d422f05217c63a1fb1cde17882` | 25 commits ahead of production (12 from `main` + 13 remediation/docs) |
| Work remote `origin/main` (`abdulmoid-digaptics/wsj`) | `947ef9e10728504851a0df7076c9f851e736f05d` | different (older) lineage; **has a push-triggered production deploy workflow** (section 14, B1) |

Local `main` does **not** represent production.

## 2. Exact proposed release commit

Branch `release/performance-security-20261109`, created from `396ad2a`, **6 code/tooling commits + this report**:

| Commit | Purpose |
|---|---|
| `c4aaffc1b8a4baf38ce737f5080f744064cda5e2` | security: trust proxy loopback, header-only portal token, purge `?token=` from URL |
| `ac5ae42263fe3597a2e5bacbec4ede5bc3cf1a1f` | performance: root metadata loads only business settings; service-card alt text |
| `92d5b9cd4952cfb9fa60dcf1860c4ccab37261c8` | F-003 SQL eligibility + pagination, migration (indexes, trigger, cents mirror), tests |
| `9c4504e0bbf25ffc7960e1c29a59e54aed59b2f8` | ops: fork-mode loopback PM2 config, backup/restore, switch and smoke tooling, `deploy.yml` disabled |
| `902903217712b3c839c246a174030ff7df67e760` | ops: smoke-test overrides for isolated staging |
| `3d61ba3fd911b24c58c94a2658e87a8da71eba17` | ops: encrypted, verified off-site backup safeguards |
| *(this report)* | documentation only |

The **proposed release commit is the head of this branch** after the report commit. It is code-identical to `3d61ba3`.

Totals vs production: 32 files, of which **11 are application source files** (+100 / −35 lines). **0 CSS files changed. No checkout, redesign or Payment Element code is included.**

## 3. Commit-by-commit release manifest (production `396ad2a` → candidate branches)

Classification keys: **D** design · **S** Stripe checkout · **A** API · **DB** schema · **I** infrastructure · **Doc** documentation.

| # | Commit | Date | Subject | Touches | Decision |
|---|---|---|---|---|---|
| 1 | `5e469e4` | 11-08 | custom Stripe Payment Element checkout with opt-in renewal | S, A, DB (`direct_payments` migration: Order/Subscription columns, `stripeSubscriptionId DROP NOT NULL`), booking dialog UI | **Excluded** (unapproved checkout change) |
| 2 | `00acc3d` | 11-08 | architectural editorial redesign | D | **Excluded** (rejected redesign) |
| 3 | `f048b03` | 11-09 | editorial rails, docked announcement | D | **Excluded** (rejected redesign) |
| 4 | `a4c1e5d` | 11-09 | rebuild navigation, hero, pricing, service composition | D | **Excluded** (rejected redesign) |
| 5 | `bf4768a` | 11-09 | revert: restore previous design + four refinements | D | **Excluded**: production already has the restored design; the "refinements" are new visual changes |
| 6 | `426d2b2` | 11-09 | decorative background layer | D | **Excluded** (design) |
| 7 | `67ebaf9` | 11-09 | craft pass | D | **Excluded** (design) |
| 8 | `df83856` | 11-09 | unclip filters, image console warnings | D | **Excluded** (design) |
| 9 | `2d9ed7a` | 11-09 | motif edge fade | D | **Excluded** (design) |
| 10 | `5aa9b72` | 11-09 | footer rework | D | **Excluded** (design) |
| 11 | `c0b8d15` | 11-09 | menu surface / cards | D | **Excluded** (design) |
| 12 | `04b06f3` | 11-09 | benefits panel rebuild | D | **Excluded** (design) |
| 13 | `a670a70` | 11-09 | F-001/2/3/5/6 | A, frontend | **Partial**: included trust proxy, F-005 portal token (API + URL purge), F-002 settings sanitisation + test, `loadBusiness()`; **excluded** the `[...slug]` local-first page source (F-006) and the `tsconfig` build-dir entry |
| 14 | `a9984c4` | 11-09 | F-004/7/8/9 indexes | DB | **Included** (re-authored in the release migration) |
| 15 | `ccab924` | 11-09 | F-010 ambient, F-001 layout, F-016 alt text | frontend | **Partial**: included layout metadata and alt text; **excluded F-010** (frame cap halves the visible particle speed: motion is per-frame, `p.x += p.vx`) |
| 16 | `114d7f4` | 11-09 | F-012 cluster, F-013 SMTP log, F-014 cents, F-017 backup | A, DB, I | **Partial**: included F-013 and F-014 (dual-write), F-017 script (rewritten); **excluded F-012** cluster mode (in-memory rate limits and cache become per-worker) |
| 17 | `f10db21` | 11-09 | audit reports | Doc | Not carried (stays on remediation branch) |
| 18 | `d736511` | 11-09 | F-015 next/dynamic, F-017 restore script | frontend, I | **Partial**: restore script (rewritten) included; **F-015 excluded** (CSS loading order risk; deferred) |
| 19 | `f66c6f4` | 11-09 | visual captures | Doc | Not carried |
| 20 | `2dc68a3` | 11-09 | tracker | Doc | Not carried |
| 21 | `2c75a2e` | 11-09 | F-003 columns + mock tests | DB, tests | **Superseded** by the real F-003 implementation (commit `92d5b9c`) |
| 22 | `2a0eb2d` | 11-09 | F-011 CSS scoping | frontend CSS order | **Excluded** (moves two stylesheets after all layout CSS, changing cascade precedence; deferred) |
| 23 | `d4a5152` | 11-09 | docs | Doc | Not carried |
| 24 | `c4e4946` | 11-09 | no-tty dump, UTC backfill | DB, I | **Superseded** by the release migration/scripts |
| 25 | `003c13c` | 11-09 | runbook | Doc | Superseded by this report |
| 26 | `b5ef3a4` | 11-09 | migration hardening, scripts, ecosystem | DB, I | **Included in adapted form** (fork mode, no `direct_payments`, trigger-based F-003) |
| 27 | `cc0912b` | 11-09 | runbook, smoke test, `deploy.yml` disable | Doc, I | Tooling **included and adapted**; docs superseded |

"Already deployed" set: everything up to and including `396ad2a`. Nothing listed above is deployed.

## 4. Included fixes

| ID | Change | Customer-visible? | Evidence |
|---|---|---|---|
| F-002 | `/api/public/settings` no longer returns the 3.86 MB scraped `links` archive | No (frontend never reads `links`, verified by grep) | 3,933,052 B → 63,883 B; all other fields byte-identical |
| F-003 | Public eligibility, totals and pagination run **in SQL** on `publishAt/startsAt/endsAt/enabled/requiresReview`. Columns are derived from `metadata` on every write by a DB trigger and on the admin path. The cache expiry boundary comes from SQL `MIN()`. Columns are omitted from public responses. | No | section 9 + parity tests (section 10) |
| F-004/7/8/9 | indexes: `Content(kind,status,sortOrder,createdAt DESC)`, `Content(kind,status,publishAt)`, `Inquiry(status,createdAt DESC)`, `PopupEvent(createdAt DESC)`, `Order(stripePaymentIntentId)`, `Subscription(stripeCustomerId)`, `Subscription(orderId)` | No | query plans use them (section 9) |
| F-014 | Booking `subtotalPriceCents`/`totalPriceCents`: expand-only mirror plus dual-write. Float columns stay authoritative. | No | 28,000 / 20,000 cents = $280.00 / $200.00 |
| F-013 | SMTP failures logged instead of silently swallowed | No | code review |
| F-005 | Portal API accepts the token only from the `Authorization` header; the portal page strips `?token=` from the address bar | No (the page already used the header) | A/B 401/401 |
| Security | `trust proxy 'loopback'`: rate limiting keys on the real client IP behind Nginx instead of 127.0.0.1 for everyone | No | 429 at request 6 with a forwarded client IP |
| F-001 | Root metadata uses `loadBusiness()` (settings only) instead of `loadSite()` (6 collections) | No (identical derivation) | HTML identical apart from alt text |
| F-016 | Alt text on 13 homepage service images | No (only visible if an image fails to load) | homepage pixel-identical |
| Ops | Loopback-only binding (closes verified direct internet access to `:3600` and `:4000`); commit-named build directories; fail-fast backup/restore; one-app PM2 switch with auto-revert; smoke gates; `deploy.yml` hard-disabled | No | staging drills (section 12) |

**Deferred (not in this release):** F-006 (as written it served local static pages instead of CMS content), F-010 (would change animation speed), F-011 and F-015 (CSS loading order), F-012 (cluster changes rate-limit/cache semantics).

## 5. Excluded redesign changes
All 11 design commits (`00acc3d`, `f048b03`, `a4c1e5d`, `bf4768a`, `426d2b2`, `67ebaf9`, `df83856`, `2d9ed7a`, `5aa9b72`, `c0b8d15`, `04b06f3`). None is an ancestor of the release (`git merge-base --is-ancestor` checked for each). `git diff --name-only 396ad2a HEAD -- '*.css'` is empty. The visual reference is the design customers see today on `396ad2a` (the rich photographic green/cream design that `bf4768a` restored). The later refinements on `main` remain there for a separate, explicitly approved design release.

## 6. Excluded Stripe checkout changes
`5e469e4` is excluded entirely: the Payment Element UI, `direct-payments.ts`/`direct-payments-core.ts`, billing renewal/cancellation changes, the `direct_payments` migration (including `Subscription.stripeSubscriptionId DROP NOT NULL`) and `booking-dialog.*`. No remediation fix depended on it. The only checkout-adjacent edits are:
- `billing.ts`: one line, header-only portal token (approved security fix);
- `booking.ts`: cents dual-write and SMTP log only. Prices are still computed by the unchanged `resolved.*Cents` logic.

Verified by:
- `/api/public/payments/config` = 404 both before and after;
- unsigned webhook = 400 both;
- **price fingerprint `c210a51a4dc26412` and 25-quote fingerprint `57498ccd08b03a16` identical to live production**;
- catalog, plan and quote responses byte-identical in the A/B (section 8).

## 7. Design comparison evidence

Method:
- Production code (`396ad2a` build copied from the VPS) and the release ran **side by side on two copies of the same production dump** in isolated staging.
- Captures through an SSH tunnel with `prefers-reduced-motion: reduce` (stops the randomised particle canvas), then a pixel-by-pixel diff (any channel sum > 24 counts).
- Every page was re-captured until two consecutive captures were identical.
- The noise floor was confirmed at 0 (A vs A).

| Page / state | Viewport | Differing pixels |
|---|---|---|
| Homepage | 1440 | **0** (1425×11848) |
| Coworking | 1440 / 390 | **0 / 0** |
| Meeting rooms | 1440 | **0** |
| Podcast studio | 1440 | **0** |
| Dedicated desks | 1440 | **0** |
| Memberships (pricing presentation) | 1440 | **0** |
| Services | 1440 | **0** |
| Contact | 1440 | **0** |
| Mega menu (open) | 1440×900 | **0** |
| Plans & Pricing dialog (open) | 1440×900 | **0** |
| Homepage mobile | 390 | **0** (with equal image-cache history) |

Investigated and explained:
- Earlier non-zero readings came from captures taken before lazy content finished (unequal heights; resolved by settling).
- One case was the browser reusing a cached 1920px hero-slide variant for A but not B (resolved by equalising cache history: 0).
- Server HTML: same size on 12 of 14 routes. A normalised diff (build hashes stripped) shows the homepage differs only in the 13 new `alt` attributes and `/dedicated/` only in React flight chunk segmentation.

Captures: 24 PNGs (A = production code, B = release) delivered as session artifacts in `visual-evidence/`.

Not covered: the booking dialog with **live** catalogue data (in staging the browser's call to the production API is cross-origin blocked on both A and B). The server-side catalogue and quotes were compared byte-for-byte instead, and the dialog component is unchanged.

## 8. API benchmark evidence (isolated staging, same host, same data, interleaved A/B)

**Contract:** 536 responses compared (every list page, total and ordering, and every detail endpoint for all 23 content kinds, the catalogue, 25 quotes, the webhook, health). **531 byte-identical**. The 5 that differ are `/public/settings` variants, identical after removing `links`. Auth: portal `?token=` 401/401, admin without token 401/401.

**Warm (in-process cache hit), n=100 each, total time:**

| Endpoint | Bytes | p50 | p95 |
|---|---|---|---|
| `/public/settings` | 3,933,052 → 63,883 | 43.9 → **3.4 ms** | 78.0 → **10.7 ms** |
| `/health`, `/plans`, `/blog`, `/pricing p2`, `/pages`, catalogue, booking-catalog | unchanged | unchanged within ±0.4 ms | unchanged within noise |
| Web pages (7 routes, n=50) | unchanged except `/` (+556 B alt text) | 3.4–6.8 → 3.4–5.9 ms | mostly lower or equal; `/memberships/` 10.5 → 15.7 ms (single-run noise) |

**Cache miss (each request a new cache key, so the real DB path runs), n=120 each, identical totals and items in every pair:**

| Endpoint | p50 | p95 |
|---|---|---|
| `/public/pages` | 76.6 → **9.0 ms** | 137.1 → 81.7 ms |
| `/public/blog` | 55.4 → **10.2 ms** | 68.4 → 39.3 ms |
| `/public/pricing` | 21.2 → **12.6 ms** | 49.6 → 26.8 ms |
| `/public/services` | 7.1 → 5.7 ms | 11.9 → 9.0 ms |
| `/public/popups` | 4.0 → **6.5 ms (slower)** | 6.2 → 9.3 ms (three boundary aggregates) |

These are server-side (loopback) measurements. **Not measured: production after deployment.** From the Karachi workstation, external TTFB is ~0.83–1.1 s even for a 15-byte health check, dominated by network/TLS. This release cannot change that, and no external TTFB improvement is claimed.

## 9. Database migration validation (isolated staging on a fresh production dump)

Migration `20261109000000_performance_audit_indexes`, sha256 `377fc0a5ea331780b8e596d85b58189d43ac1c5a43b3b90ae1f4f589a29e3bbf` (identical in staging and in the committed tree).

| Check | Result |
|---|---|
| Preflight on production data | `PREFLIGHT 0 failures PASS` on a fresh production dump. The dump's content md5 is identical to live production for all 25 tables, so the result applies to production as of 2026-11-09 18:28 UTC. Re-run read-only on production at deploy time (step 6). |
| `prisma migrate deploy` | applied in 1.96–2.15 s wall (SQL transaction ≈ 0.14 s); re-run reports nothing pending |
| Schema drift (`migrate diff` migrated DB vs `schema.prisma`) | none |
| `migration-verify.sql` | `VERIFY 0 failures PASS`: 7 new columns, trigger enabled, 7 new indexes valid, old index dropped, **`direct_payments` absent**, `stripeSubscriptionId` still `NOT NULL` |
| Publication eligibility counts | 246 visible before = 246 after (services 37, pricing 59 of 277, blog 71, pages 65, categories 10, settings/testimonials/use-cases/popups 1 each) |
| Historical content | `metadata` md5 `50d9c307…` unchanged; 0 production rows carry schedule keys |
| SQL columns vs production `contentEligible()` per row | **0 mismatches** on production data; on 23 synthetic edge cases only 2 (`2026-02-30`, year `0000`: dates V8 accepts and PostgreSQL rejects). The preflight flags them; production has 0. |
| Trigger | raw `UPDATE`/`INSERT` of `metadata` (as the previous release or imports do) recompute the columns |
| Booking financial values | 2 bookings; 28,000 / 20,000 cents = $280.00 / $200.00; reconciles |
| Locking (probe while the transaction is held open) | `ACCESS EXCLUSIVE` on **Content and Booking only**; reads of Order, Subscription, Inquiry and Customer continue; PopupEvent writes wait. Duration ≈ 0.14 s. |
| Lock-timeout fail-fast | with a conflicting lock, the migration fails at ~6.5 s (`55P03`), fully rolled back (0 columns, 0 trigger); `migrate resolve --rolled-back` then `deploy` gives VERIFY PASS |
| Stripe-related queries | `Order.stripePaymentIntentId` and `Subscription.stripeCustomerId` lookups use the new indexes |
| Application rollback compatibility | production code ran on the migrated schema: health, plans, blog and catalogue 200, and the full API A/B on the unmigrated copy matched the release on the migrated copy |

## 10. Regression test results (local, release branch)

| Suite | Result |
|---|---|
| Frontend `tsc --noEmit` | pass |
| ESLint `app components lib` | 0 errors |
| Backend `tsc` build | pass |
| Next.js production build | pass, 183/183 static pages (local 46 s; staging 50–59 s) |
| Backend unit/integration (offline, all files except live-server `api.test.ts`) | **172/172** incl. new **F-003 suite 9/9**: historical, future dates, disabled, popups, unparseable schedules, review pricing, sort + pagination totals, admin writes, and a **randomised parity test** (400 rows × 5 instants × 3 kinds × every page = production JS path) |
| Existing cache/eligibility suite | 14/14, now run against the SQL path through an evaluator of the real Prisma filters |
| Content/frontend safety | 9/9 · service content 11/11 · release regressions 8/8 · paint timeline 8/8 · API scenario guards 7/7 · input guards 8/8 |
| Stripe webhook · payment safety · pricing catalogue · scenario safety | pass |
| Performance-baseline guards | 8/8 (one transient failure under parallel load in a combined run; 3 consecutive isolated passes; passes on production too) |
| Visual regression | section 7 (0 differing pixels) |
| Staging smoke gate (`smoke-test.sh verify`, Nginx-equivalent routing) | **0 FAIL**, 1 expected WARN (no Nginx header in staging) |

## 11. Backup readiness

| Requirement | Status |
|---|---|
| Verified local backup | **Ready.** `backup-postgres.sh`: PGDMP header, TOC = table count, sha256, row counts, fail-fast. A real run against production produced 608,278 B. |
| Isolated restoration test | **Passed** (fresh dump): 25/25 tables, 20 FKs validated, 64 indexes valid, `plpgsql` only, no sequences, **content md5 identical to live for all 25 tables**, restore 603 ms |
| Encryption | **Ready.** GPG 2.4.4 present. The encrypted copy must decrypt byte-identical to the verified dump (tested on the VPS). The passphrase file must be `0600`. |
| Off-server upload + verification | **Implemented, not exercisable.** Upload is refused without encryption; read-back sha256 verification and `.offsite.json` record are in place. No uploader (aws/rclone) or credentials exist on the VPS. |
| Approved destination, restricted credentials, retention | **BLOCKED: none approved.** Needed: provider/bucket (S3, R2 or B2), write-only scoped key, versioning/object-lock, a retention policy (e.g. 30 daily / 12 monthly), and passphrase custody (stored off the VPS). |
| Scheduled backups | none exist today (no cron); add once the destination is approved |
| PITR | not available (`archive_mode=off`) |

**Because off-server storage is not approved, this release is BLOCKED (B3).**

## 12. Deployment downtime estimate (measured in staging, in place, 20 req/s probes)

| Step | Measured |
|---|---|
| Migration (legacy serving) | 0 failed requests; Content/Booking reads blocked ≈ 0.14 s |
| Backend build, `prisma generate`, web build (legacy serving) | 0 failed requests |
| API switch, legacy to release (fork to fork, new script path) | **3.7 s** of refused API connections on the first switch (cold start under load); **1.3 s** on repeat |
| Web switch | **0.6–0.7 s** of refused page connections |
| Rollback (web + API) | 0.7 s + 1.2 s |

Estimate for production: **API unavailable up to ~4 s and web up to ~1 s**, at two separate moments a few minutes apart. Plan a quiet window. A later release using PM2 cluster mode could make future reloads zero-downtime; that is not part of this release.

## 13. Rollback procedure (non-destructive, never touches the database)

The previous build stays untouched in `.next` and `backend/dist`; the release runs from `.next-<sha>` and `backend/dist-<sha>`.

```bash
cd /root/wsj-next
source "$(cat /root/wsj-backups/CURRENT_DEPLOY)/deploy.env"
export WSJ_NEXT_DIST_DIR=.next WSJ_API_DIST=dist
bash scripts/devops/pm2-switch.sh wsj-web     legacy "$DEPLOY_DIR/pm2-legacy.ecosystem.json"
bash scripts/devops/pm2-switch.sh wsj-backend legacy "$DEPLOY_DIR/pm2-legacy.ecosystem.json"
git checkout -- tsconfig.json && git -c advice.detachedHead=false checkout --detach "$PREV_SHA"
curl -fsS http://127.0.0.1:4000/api/health && curl -fsS -o /dev/null http://127.0.0.1:3600/ && pm2 save
```

- Verified in staging: measured outages of 0.7 s (web) and 1.2 s (API); production code healthy on the migrated schema.
- Do **not** run `prisma generate`, `migrate`, `db push` or any `pg_restore`.
- The schema stays migrated (expand-only, verified compatible). The trigger keeps Content columns correct while the old code writes. Bookings created during the rollback have NULL cents; run `sql/rebackfill-mirrors.sql` before rolling forward again.
- No Stripe data shapes change in this release, so there is no checkout reconciliation risk.
- Database recovery (restore beside production, never over it; data-loss statement; post-backup record recovery) follows sections 7.3–7.5 of `reports/remediation/2026-11-09/CORRECTED_DEPLOYMENT_RUNBOOK.md` on the remediation branch. That procedure is release-independent and needs separate authorization.

### Deployment sequence (summary; every block `set -Eeuo pipefail`, stop on any failure)
1. Preconditions: production `HEAD` = `396ad2a`, clean tree, fork apps online, Nginx upstreams 3600/4000, DB healthy, MemAvailable ≥ 3,000 MB.
2. `git fetch` the approved branch from `AbdulMoidKhan/wsj`. Verify the full SHA, ancestry and unchanged dependency manifests, that the only new migration is `20261109000000…`, and its sha256 `377fc0a5…`.
3. `smoke-test.sh baseline`.
4. `pm2-capture-legacy.sh`.
5. `backup-postgres.sh` (plus encrypted off-site once approved) and `restore-postgres.sh` into a throwaway container with `COMPARE_SOURCE=1`.
6. Check out the release, run the preflight (`PASS`), `migrate deploy`, verify (`PASS`), and reconcile (`STRICT=1`).
7. `prisma generate`, then `tsc --outDir dist-<sha>`, then `pm2-switch.sh wsj-backend release`.
8. `NEXT_DIST_DIR=.next-<sha> next build`, then `git checkout -- tsconfig.json`, then `pm2-switch.sh wsj-web release`.
9. `smoke-test.sh verify` (0 FAIL), then `pm2 save`. Take external checks from the workstation (direct `:3600`/`:4000` must now be refused) and observe for 60 minutes.

Exact shell for steps 1–2 and 5–6 follows `CORRECTED_DEPLOYMENT_RUNBOOK.md` section 9, with `pm2-switch … release` instead of `cluster`, 5 total migrations, and no `direct_payments` checks.

## 14. Outstanding blockers

| # | Blocker | Needed from owner |
|---|---|---|
| **B1** | **Accidental production deploy path (critical).** `abdulmoid-digaptics/wsj` `main` has "Deploy to VPS" triggered **on push to `main`**. The repo holds `VPS_HOST`/`VPS_SSH_KEY`; runs #12/#13 deployed successfully; root `authorized_keys` contains a `github-actions-deploy` key. A push there would fast-forward production to `AbdulMoidKhan/wsj` `main` (rejected redesign + Payment Element checkout + `direct_payments` migration) with `npm install` in place and no verified backup. | Authorize: disable that workflow in the work repo **and** remove/rotate the `github-actions-deploy` key and secrets. Until then, never push `main` to `origin`. |
| **B2** | Release not pushed | Authorize `git push personal release/performance-security-20261109`. Safe: the personal repo has **no secrets** and its workflows are `workflow_dispatch`-only and hard-disabled. |
| **B3** | Off-server backup destination not approved | Destination, scoped credentials, retention policy, passphrase custody (section 11) |
| **B4** | Production authorization | Written approval naming the release SHA and window, accepting ~4 s API / ~1 s web unavailability |
| **B5** | Shared VPS coordination | Confirm no concurrent PM2 changes by other operators (the host runs 9 PM2 apps and 3 auto-deploy timers; `pm2 save` persists all of them) |

Known, non-blocking:
- SMTP is unconfigured.
- PITR is unavailable.
- Popups cache-miss latency is +2.5 ms.
- Impossible dates (`2026-02-30`) pass the admin validator and would be hidden by SQL while the old JS showed them. Production has 0.
- `deploy.yml` needs a rewrite before any CI-based deploy.

## 15. Final recommendation

### **NO-GO today. GO once B1–B5 are closed.**

The release itself is ready on the engineering side:
- It is built from the exact production commit and changes nothing customers see: 0 differing pixels on every compared page and state, 0 CSS changes.
- Checkout and prices are unchanged: identical price and quote fingerprints, payments routes unchanged.
- It delivers F-003 for real (SQL filtering and pagination, row-level parity with production).
- It is measurably faster where it matters: settings 3.9 MB → 64 KB (43.9 → 3.4 ms p50), and cache-miss list endpoints up to 8× faster at p50.
- It was proven end-to-end in isolated staging: backup, restore, migration, transition, rollback and smoke gates.

What blocks production is outside the code. B1 is a live push-to-production path that must be closed first; B3 is the unapproved off-server backup storage. The owner authorizations (B2, B4) and shared-host coordination (B5) are also still open.
