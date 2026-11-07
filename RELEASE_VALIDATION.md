# Release validation: 8 November 2026

Destination: **AbdulMoidKhan/wsj**, branch **main**. Commit email: **moidkhan127@gmail.com**.

## Completed corrections

- Header and homepage hero Plans & Pricing controls open the existing catalog popup without scrolling or adding #pricing.
- Fixed obsolete booking-mapper regression, exact/longest live-catalog service matching and ambiguous-hint safety; restored the missing historical operations runbook required by its test.
- Preserved legacy recurring interval counts and schedule/resource validation through catalog checkout.
- Optional add-ons with zero quantity are not charged; hourly/day add-ons use their own selected units rather than silently inheriting package duration.
- Catalog-owned slugs cannot bypass current pricing, deactivation or required add-ons via legacy checkout; inactive services/plans cannot resurrect through legacy public fallbacks.
- Preserved omitted admin metadata. Catalog identity and explicit purchased-benefit snapshots survive subscription renewals and price edits, retaining idempotent ledger grants. No benefits are invented from marketing text. Catalog seed code now declares the existing 1/5/10-day and full-month coworking benefits as structured metadata; that seed was not executed against existing data.
- Restored database readiness checks, bounded public caches, invalidated both legacy/catalog projections after admin edits, and enforced publication/popup time boundaries and in-flight invalidation races.
- Split CMS reads into 25-item requests: measured response pages are 301,818 / 949,347 / 373,646 bytes instead of an oversized 100-item Next.js cache entry. The final production build has no oversized-cache errors.
- Reused decorative geometry, improved hero delivery and retained the measured performance limitations in PERFORMANCE_AUDIT.md.
- Restored broad secret/log/dependency/build/private-storage ignore rules and normalized changed text line endings.

## Validation results

- **npm run test:release: 218 passed, 0 failed** (210 single-process offline tests plus 8 operational tests).
- **npm run lint: pass.** Frontend TypeScript checks and production build TypeScript pass.
- **npm --prefix backend run build: pass.**
- **Production frontend build: pass**, isolated NEXT_DIST_DIR=.next-release-review, Next.js 16.4.3 / Turbopack; 183 generated static pages, with intended dynamic routes retained. Final build is clean of the earlier CMS cache error.
- **Prisma validate: pass.** **Prisma migrate status: four migrations found; local schema is up to date.** No migration or seed was applied.
- Real local API: health 200; public catalog 200 with 13 services; podcast detail 200 with four plans; unauthenticated admin catalog 401.
- Nonmutating quote smoke checks: two studio hours plus zero optional extension = 15,000 cents; plus one independently selected extension = 22,000 cents. Legacy catalog-price bypass and client-supplied amount both rejected with 400. No checkout/order creation, real Stripe call, payment or email was performed.
- Production-mode HTTP routes /, /coworking/, /meeting-rooms/, /use-cases/, /admin/ and /account/ all returned 200.
- Production-mode header popup opened with the live 13-service catalog at unchanged URL and scroll position. Earlier header/hero and mobile layout checks also passed.
- Candidate secret/private-path scan found no flagged provider credentials or private keys. Staged-file review and final remote commit equality are the final publishing gates.

## Publication and database boundaries

All reviewed frontend, backend, public project assets, database schema, four migrations, seed/source scripts, regression tests and release/performance documentation are included. Existing local deletions of superseded audit reports are retained; the required operations runbook is restored with a historical-status note. Locally ignored prompt scratch remains local.

Private .env files, tokens/keys, SQL dumps/backups, mutable uploads/customer records, logs, dependencies and generated build output are excluded. No database contents are exported. Schema/catalog seed changes require their normal approved deployment/configuration step; pushing source does not execute them.

The personal remote was fetched and main matched local HEAD before committing; no force push or history rewrite is used. The deployment workflow is manual-only and is not executed by this push. No production VPS, hosting, DNS, environment or live database was changed.

## Limits and historical blockers

Initial Guard-mode filesystem denials are resolved by the user's actual Full access change. Initial build/Prisma/Git failures and the old 75/76 test result in PERFORMANCE_AUDIT.md are historical, superseded by the successful gates above. Node test harnesses still emit dependency/module-format warnings; these are not failed assertions or production build errors. Local Stripe webhook signing configuration remains absent and fails closed; no real-provider or field-performance acceptance is claimed. Authenticated mutation suites were deliberately not run against existing records.
