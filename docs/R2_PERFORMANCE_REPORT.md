# Workspace Junction — Performance Baseline Report

**Date**: 2026-11-12
**Environment**: Production (`https://wp.workspacejunction.com`) & Local (`http://localhost:3000`)

---

## 1. Production Metrics (`https://wp.workspacejunction.com`)

Captured from live Chrome browser instance:
- **Status**: 200 OK
- **Server**: `nginx/1.24.0 (Ubuntu)` + Next.js App Router
- **DOM Content Loaded**: 1,471 ms
- **Page Load Time**: 1,770 ms
- **First Contentful Paint (FCP)**: 1,548 ms
- **Total Network Requests (Initial Render)**: 38 requests
- **Image Requests**: 4 images
- **Initial Transfer Weight**: ~2.1 KB uncompressed HTML initial doc (with gzip compression over wire)

---

## 2. Local Environment (`http://localhost:3000`)

- **DOM Content Loaded**: 6,151 ms (Next.js development mode with hot-reloading)
- **Page Load Time**: 11,855 ms
- **First Contentful Paint (FCP)**: 8,266 ms
- **Total Requests**: 73 requests (includes React DevTools and webpack/turbopack HMR payloads)
- **Total Transfer**: ~1.19 MB (unminified JS chunks in dev mode)

---

## 3. Optimization Targets

1. **Largest Contentful Paint (LCP)**: ≤ 2.5s on 4G/broadband.
2. **Cumulative Layout Shift (CLS)**: ≤ 0.1.
3. **Interaction to Next Paint (INP)**: ≤ 200 ms.
4. **Media Asset Offloading**: Offload heavy static assets and dynamic uploads to Cloudflare R2 object storage with long-lived immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`), reducing VPS bandwidth and disk saturation.
