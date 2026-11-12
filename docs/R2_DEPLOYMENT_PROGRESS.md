# Workspace Junction — Cloudflare R2 Deployment Progress

**Date**: 2026-11-12
**Current Branch**: `feature/public-motion-performance-optimization`
**Target Production Domain**: `https://wp.workspacejunction.com`
**R2 Bucket**: `workspacejunction` (Cloudflare account `e1fa8ad7608693fd4f11d2135db28d08`)
**Public Dev URL**: `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev`

---

## 1. Phase Status Summary

- [x] **Phase 1: Complete Infrastructure, Codebase & Cloudflare Audit**
  - **Local Repo**: Next.js App Router frontend, NestJS backend with `R2StorageService`, Prisma ORM on PostgreSQL.
  - **Cloudflare**: Bucket `workspacejunction` active in APAC. `test.jpg` (48.96 kB) confirmed live and accessible.
  - **VPS (72.61.0.11)**: Hostinger Ubuntu 24.04 KVM 4. Running Docker container `wsj-app-postgres-1` (PostgreSQL 17 on 127.0.0.1:5437), PM2 processes `wsj-backend` (port 4000) and `wsj-web` (port 3600) behind Nginx proxy.
  - **Database state**: 0 rows in `Media`, 464 rows in `Content`. 123 Content rows reference media extensions; 156 external image URLs (historical WordPress uploads on `workspacejunction.com/wp-content/uploads/...`).
  - **Media files**: No local files in `backend/uploads` or `public/uploads` on VPS. Local git repo has 602 files in `public/media` (175.7 MB) and 12 in `public/m` (512 KB).

- [x] **Phase 2: Configure Cloudflare R2 Bucket**
  - **CORS**: Configured on bucket for `https://wp.workspacejunction.com` and `http://localhost:3000` with `GET, HEAD, PUT` and headers `Content-Type, Content-Length, Cache-Control, x-amz-*`.
  - **Lifecycle Rules**: Verified default multipart abort rule (7 days).
  - **Delivery Options**: Evaluated custom domain vs Worker vs public development URL. Because DNS is managed in Liquid Web and nameserver migration is restricted, direct Custom Domain assignment requires a zone on Cloudflare. Worker proxying or pub URL documented.

- [ ] **Phase 3 & 4: Backend NestJS R2 Integration & Presigned Uploads** (In Progress)
  - Connect `MediaController` (`backend/src/media.ts`) to use `R2StorageService` instead of local disk.
  - Add presigned upload endpoint (`/admin/media/presign`) and finalization endpoint (`/admin/media/finalize`).
  - Update `Media` schema or model usage with R2 keys and derived URLs.
  - Run all backend unit and live tests.

- [ ] **Phase 5: Admin Dashboard Media Library Integration**
  - Verify admin frontend media upload components support direct/presigned R2 uploads.

- [ ] **Phase 6 & 7: Static & Dynamic Media Migration to R2**
  - Migrate eligible files from `public/media` to `workspacejunction/static/...`.
  - Generate migration manifest `docs/R2_MIGRATION_REPORT.md`.
  - Centralize frontend media URL helper (`NEXT_PUBLIC_MEDIA_URL`).

- [ ] **Phase 8, 9 & 10: Performance Optimization**
  - Optimize responsive image delivery, Next.js `remotePatterns`.
  - Document before/after metrics.

- [ ] **Phase 11 - 14: Environment, Staging Verification & Pre-flight**
  - Verify PostgreSQL backup with `scripts/devops/backup-postgres.sh`.
  - Verify build outputs for Next.js and NestJS.

- [ ] **Phase 15 & 16: Safe VPS Production Deployment & Runbooks**
  - Commit authorized changes cleanly.
  - Deploy to VPS, reload PM2 services atomically, run smoke tests.

---

## 2. Files Modified / To Modify
- `backend/src/media.ts`
- `backend/src/application.ts`
- `backend/src/storage.ts`
- `backend/test/storage.test.ts`
- `lib/media.ts`
- `next.config.ts`
- `docs/R2_DEPLOYMENT_PROGRESS.md`
- `docs/R2_MIGRATION_REPORT.md`
- `docs/R2_DEPLOYMENT_RUNBOOK.md`
- `docs/R2_ROLLBACK_RUNBOOK.md`
- `docs/R2_PERFORMANCE_REPORT.md`
