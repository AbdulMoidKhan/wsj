# Workspace Junction — Cloudflare R2 Media Migration Report

**Date**: 2026-11-12
**Bucket**: `workspacejunction` (Cloudflare R2, Region: `auto` / APAC)
**Public Delivery URL**: `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev`

---

## 1. Migration Summary

- **Total Local Media Files Discovered**: 743 static assets in `public/media`.
- **Total Files Successfully Migrated to R2**: 743 objects (433 newly uploaded, 310 verified existing from prior batch upload).
- **Total Storage Uploaded / Synchronized**: 181.43 MB.
- **R2 Key Structure**: `static/{relativePath}` preserving full directory taxonomy and extension signatures.
- **Cache-Control Metadata**: `public, max-age=31536000, immutable` applied to all uploaded objects for long-lived browser and edge caching.
- **CORS Configuration**: Configured with allowed origins `https://wp.workspacejunction.com` and `http://localhost:3000` with `GET, HEAD, PUT` and headers `Content-Type, Content-Length, Cache-Control, x-amz-*`.

---

## 2. Dynamic Database Media Inventory

- **`Media` Table**: 0 historical rows on VPS database.
- **`Content` Table**: 464 rows. 123 rows contain media file extensions; 156 external image URLs (historical WordPress uploads on `workspacejunction.com/wp-content/uploads/...`).
- **Dynamic Uploads Directory (`backend/uploads`, `public/uploads`)**: 0 local files on VPS.
- **Forward Path**: All new uploads created via `/admin/media` (or presigned direct upload via `/admin/media/presign`) will be stored directly into `workspacejunction` under category prefixes (`images/`, `videos/`, `blogs/`, etc.) and registered in the `Media` table with stable keys and public delivery URLs.

---

## 3. Sample Migrated Assets & Verification

| Asset Path | R2 Object Key | Verified Public URL |
|------------|---------------|---------------------|
| `public/media/figma-home/creative.webp` | `static/figma-home/creative.webp` | `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev/static/figma-home/creative.webp` (200 OK, 30.6 KB) |
| `public/media/chicagoland-podcast-studio-white.png` | `static/chicagoland-podcast-studio-white.png` | `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev/static/chicagoland-podcast-studio-white.png` (200 OK, 52.3 KB) |
| `public/media/figma-home/meeting.webp` | `static/figma-home/meeting.webp` | `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev/static/figma-home/meeting.webp` (200 OK) |
| `public/media/figma-contact/lounge.webp` | `static/figma-contact/lounge.webp` | `https://pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev/static/figma-contact/lounge.webp` (200 OK) |

---

## 4. Frontend Helper & Zero Regression Guarantee

- A centralized helper `getMediaUrl(src)` in `lib/media.ts` prefixes static assets with `NEXT_PUBLIC_MEDIA_URL` when provided.
- If `NEXT_PUBLIC_MEDIA_URL` is omitted, `getMediaUrl` gracefully falls back to local relative paths (`/media/...`), ensuring zero broken images or regressions.
- Next.js `remotePatterns` updated to permit `pub-e4b4ffee7e0747098f49cc9765932cee.r2.dev` and `*.r2.dev`.
