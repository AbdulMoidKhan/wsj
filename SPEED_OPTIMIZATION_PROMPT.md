# MISSION: 100/100 GOOGLE PAGESPEED INSIGHTS & GTMETRIX GRADE A (100% / 100%) SPEED OPTIMIZATION DIRECTIVE

## OBJECTIVE
Execute a complete, zero-compromise speed and Core Web Vitals optimization pass on Workspace Junction (https://workspacejunction.com/ and the local project stack). The final target is a verified 100/100 Performance Score on Google PageSpeed Insights (both Mobile and Desktop) and Grade A (100% Performance, 100% Structure, LCP < 1.2s, TBT 0ms, CLS 0) on GTmetrix.

---

## 1. HARD CORE WEB VITALS BENCHMARKS
- Largest Contentful Paint (LCP): Under 1.2s on mobile and desktop
- First Contentful Paint (FCP): Under 0.8s
- Total Blocking Time (TBT): Exactly 0ms (hard ceiling 50ms)
- Cumulative Layout Shift (CLS): Exactly 0.000 (zero visual jumps)
- Interaction to Next Paint (INP): Under 100ms
- Speed Index (SI): Under 1.0s

---

## 2. IMAGE & ASSET DELIVERY PIPELINE
1. Next-Gen Image Conversion:
   - Convert all uploaded and static image assets to AVIF (primary) with WebP fallback.
   - Enforce lossy compression at quality index 80 to 82% to keep every image asset below 150 KB without perceptual loss.
2. Zero-CLS Explicit Dimensions:
   - Add explicit width and height attributes or CSS aspect-ratio rules (aspect-ratio: auto W / H) to all <img> tags, <picture> elements, and SVG wrappers to prevent layout shifts during asset downloads.
3. Priority Loading:
   - Mark the main hero/banner image with fetchpriority="high" and loading="eager", backed by a <link rel="preload" as="image" href="..." fetchpriority="high"> tag in the HTML <head>.
   - Apply native loading="lazy" and decoding="async" to all below-the-fold images across the DOM.
4. Third-Party Facades:
   - Replace heavy third-party iframe video players and FacePop video bubbles with static click-to-load poster facades and IntersectionObserver lazy hydration.

---

## 3. JAVASCRIPT THREAD UNBLOCKING & SCRIPT DEFERRAL
1. Booking Plugin & Modal On-Demand Loading:
   - Defer the entire Content Studio Booking bundle (csb-booking.js) and Stripe Elements script until the user clicks the "Plans & Pricing" button. Do not load or execute Stripe or booking logic on initial page render.
2. Third-Party Script Sandbox:
   - Move all tracking scripts (Google Tag Manager, Google Analytics, Meta Pixel) off the main thread using Partytown or delay execution until after the first user gesture (pointerdown, keydown, or scroll).
3. Tree-Shaking & Bundle Splitting:
   - Purge unused JavaScript packages and icons.
   - Dynamically import route components and large UI dependencies using dynamic import with SSR disabled where appropriate.

---

## 4. CRITICAL CSS & FONT RENDERING PATH
1. Critical CSS Inlining:
   - Extract above-the-fold critical CSS (< 14 KB uncompressed) and inline it directly into the document <head>.
2. Asynchronous Stylesheets:
   - Load secondary and plugin stylesheets asynchronously with <link rel="preload" as="style" onload="this.onload=null;this.rel='stylesheet'"> and include a <noscript> fallback.
3. Unused Style Purge:
   - Run CSS purging across Elementor and Tailwind styles to remove unused rules and orphaned selectors.
4. Web Font Optimization:
   - Self-host fonts in WOFF2 format with font-display: swap.
   - Add preconnect hints for critical font origins.
   - Subset fonts to Latin character sets to keep font files under 25 KB each.

---

## 5. SERVER, EDGE & CACHE INFRASTRUCTURE
1. Modern Compression & Protocols:
   - Enable HTTP/3 (QUIC) and 0-RTT on Cloudflare / Nginx.
   - Enable Brotli level 6 compression for all HTML, CSS, JS, SVG, and JSON responses.
2. Immutable Cache Headers:
   - Set static assets (images, fonts, hashed scripts/styles) to:
     Cache-Control: public, max-age=31536000, immutable
   - Set dynamic pages to:
     Cache-Control: public, max-age=0, must-revalidate with Cloudflare edge caching.
3. Resource Hints:
   - Preconnect to mission-critical origins and remove stale external prefetch links.

---

## 6. VERIFICATION WORKFLOW
1. Run PageSpeed Insights for both Mobile and Desktop:
   - Verify LCP < 1.2s
   - Verify TBT = 0ms
   - Verify CLS = 0.000
   - Confirm Performance Score = 100
2. Run GTmetrix test from US test servers (Chicago / Dallas):
   - Confirm Grade A (100% Performance / 100% Structure)
   - Confirm Fully Loaded Time < 1.5s
