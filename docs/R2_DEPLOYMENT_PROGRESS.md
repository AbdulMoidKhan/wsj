# Workspace Junction — Cloudflare R2 Deployment Progress

**Date**: 2026-11-12
**Current Branch**: `feature/public-motion-performance-optimization`
**Target Production Domain**: `https://wp.workspacejunction.com`
**R2 Bucket**: `workspacejunction` (Cloudflare account `e1fa8ad7608693fd4f11d2135db28d08`)
**Public Dev URL**: `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev`

**Status**: **PRODUCTION DEPLOYED — VERIFIED AND HEALTHY**

---

## 1. Phase Status Summary

- [x] **Phase 1: Complete Infrastructure, Codebase & Cloudflare Audit**
  - **Local Repo**: Next.js App Router frontend, NestJS backend, Prisma ORM on PostgreSQL.
  - **Cloudflare**: Bucket `workspacejunction` active in APAC. Confirmed live and accessible.
  - **VPS (72.61.0.11)**: Hostinger Ubuntu 24.04 KVM 4. Running Docker container `wsj-app-postgres-1` (PostgreSQL 17 on 127.0.0.1:5437), PM2 processes `wsj-backend` (port 4000) and `wsj-web` (port 3600) behind Nginx proxy.
  - **Database state**: 0 rows in `Media`, 464 rows in `Content`.

- [x] **Phase 2: Configure Cloudflare R2 Bucket**
  - **CORS**: Configured on bucket for `https://wp.workspacejunction.com` and `http://localhost:3000` with `GET, HEAD, PUT` and headers `Content-Type, Content-Length, Cache-Control, x-amz-*`.
  - **Lifecycle Rules**: Verified default multipart abort rule (7 days).
  - **Delivery Options**: Evaluated custom domain vs Worker vs public development URL.

- [x] **Phase 3 & 4: Backend NestJS R2 Integration & Presigned Uploads**
  - Connected `MediaController` (`backend/src/media.ts`) to use `R2StorageService` instead of local disk.
  - Added presigned upload endpoint (`POST /admin/media/presign`) and finalization endpoint (`POST /admin/media/finalize`).
  - Unit and live R2 upload, signature detection, category validation and deletion tests passed.

- [x] **Phase 5: Admin Dashboard Media Library Integration**
  - Preserved existing contracts, added direct and presigned support.

- [x] **Phase 6 & 7: Static & Dynamic Media Migration to R2**
  - Migrated 743 files from `public/media` to `workspacejunction/static/...` (181.43 MB).
  - Generated migration manifest `docs/R2_MIGRATION_REPORT.md`.
  - Implemented centralized frontend media URL helper `getMediaUrl(src)` in `lib/media.ts` supporting `NEXT_PUBLIC_MEDIA_URL` with graceful local fallback.

- [x] **Phase 8, 9 & 10: Performance Optimization**
  - Configured Next.js `remotePatterns` for R2 domains.
  - Long-lived cache headers (`Cache-Control: public, max-age=31536000, immutable`) applied to all uploaded objects.

- [x] **Phase 11 - 14: Environment, Staging Verification & Pre-flight**
  - Verified PostgreSQL backup before deployment (`/root/wsj-backups/wsj_db_pre_r2_20261112_173746.sql.gz`).
  - Next.js and NestJS built cleanly on both local and production VPS environments.

- [x] **Phase 15 & 16: Safe VPS Production Deployment & Runbooks**
  - Deployed to VPS `72.61.0.11` on branch `feature/r2-vps-main`.
  - PM2 services `wsj-backend` and `wsj-web` restarted with updated environment.
  - Production smoke tests confirmed healthy:
    - `/api/health`: 200 OK (`{"status":"ok"}`)
    - `https://wp.workspacejunction.com/`: 200 OK
    - `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev/static/figma-home/creative.webp`: 200 OK


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
