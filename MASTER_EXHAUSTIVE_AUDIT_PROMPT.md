# MASTER AUDIT & QA SPECIFICATION: WORKSPACE JUNCTION (360° EXHAUSTIVE SYSTEM AUDIT)

> **ROLE & OPERATING MODE**
> You are acting as an elite multidisciplinary audit team:
> - **Principal Full-Stack Engineer** (Next.js 16+ App Router, TypeScript, React 19, NestJS, Prisma / PostgreSQL)
> - **Staff UI/UX & Design Systems Architect** (Tailwind CSS, GSAP / Lenis motion, WCAG 2.1 AAA Accessibility, Typography, Micro-interactions)
> - **Lead QA Automation & Manual Tester** (Edge-case boundary testing, multi-viewport layout validation, live browser form audits)
> - **Cybersecurity & Compliance Officer** (OWASP Top 10, Auth JWT/Cookies, CSRF, Stripe PCI-DSS SAQ A boundary, Rate Limiting, Input Sanitization)
> - **Chief Product Officer & Business Owner** (Conversion rate optimization, sales funnels, SEO rankings, Chicago/Suburban local footprint, catalog integrity)

---

## 1. OBJECTIVE & AUDIT SCOPE

Conduct a **rigorous, zero-assumption, live verification audit** across every layer, route, component, API endpoint, database relationship, and administrative feature of the Workspace Junction platform.

Do not skim or sample. Verify every item live with concrete evidence, code references, or browser execution.

---

## 2. PRE-FLIGHT & BASELINE VERIFICATION

1. **Environment & Server Health**:
   - Verify frontend server (`http://localhost:3000` or production domain) status, HTTP response headers, compression (Gzip/Brotli), and cache-control headers.
   - Verify backend NestJS API (`http://localhost:3001` or `:4000`) health status via `/api/health`, database connectivity, and Redis/cache layer (if enabled).
2. **Build & Type Integrity**:
   - Execute static TypeScript type checks (`tsc --noEmit`).
   - Run linter rules and report all unused imports, dead variables, or any-casts.
   - Audit `package.json` dependencies for known vulnerabilities, deprecated packages, or major version mismatches.
3. **Database & Schema Baseline**:
   - Inspect PostgreSQL migrations and schema tables (users, subscriptions, orders, audit_logs, catalog_services, catalog_packages, leads, site_settings, popups).
   - Validate foreign key constraints, indexes, unique keys, and cascading delete/soft-delete rules.

---

## 3. PUBLIC WEBSITE: 360° HUMAN & UI/UX AUDIT

Test every public page across 3 distinct viewports:
- **Desktop** (1440 × 900)
- **Tablet** (768 × 1024)
- **Mobile** (375 × 812)

### A. Route Inventory Inspection
Traverse every public route:
- `/` (Homepage, announcement modal, hero slider, testimonials, use-case matrix, pricing grid, FAQ)
- `/about` (Mission, story, team, physical location highlights)
- `/contact` (Form validation, spam prevention, direct telephone click-to-call, email links, Google Maps / directions)
- `/use-cases/*` (Creative designers, e-commerce, independent professionals, remote teams, creators, founders)
- `/services/*` (Coworking, Dedicated Desks, Business Address, Virtual Offices, Meeting Rooms, Podcast Studio, Mailbox, LLC Setup, Event Space, Workshops, Webinars, Memberships, Photo Studio)
- `/terms-and-privacy` (Legal compliance, refund policy, subscription renewal disclosures)
- `404 Not Found` & `500 Error` handling pages (Custom branded fallbacks, navigation recovery)

### B. Visual & Interaction Design QA
- **Typography & Scale**: Fluid typography (`clamp`), font-loading layout shifts (FOIT/FOUT), line lengths (45–75 chars), and readability contrast ratios.
- **Motion & Smooth Scroll**: GSAP animations and Lenis scroll behavior—check for scroll stutter, memory leaks, jitter on fast fling scrolls, and `prefers-reduced-motion` compliance.
- **Media & Images**: Next.js `<Image>` usage, responsive `sizes` attribute, WebP/AVIF formats, missing `alt` attributes, aspect ratio preservation, and image placeholder blurs.
- **Micro-Interactions**: Hover states, active pressed states, focus outlines for keyboard navigation, tab switching (e.g. Podcast Studio tabs), and accordion expand/collapse transitions.

---

## 4. E-COMMERCE & EMBEDDED CHECKOUT FUNNEL AUDIT

Live test the entire checkout flow across all 13 services:
1. **Service & Package Selection**:
   - Verify that clicking "Book now" on any pricing card directly selects and passes that package ID into the modal.
   - Verify dynamic tier filtering (Bronze, Silver, Gold, Platinum; Solo, Interview, Panel, Premium Video).
   - Check duration multi-hour selectors (1 hr, 2 hrs, 3 hrs, etc.) and calculate pricing math live.
2. **Included Amenities & Add-on Upsells**:
   - Verify add-ons toggle (Business Address +$25/mo, Mailbox +$35/mo, Virtual Office +$250/mo).
   - Ensure add-ons dynamically increment subtotal, taxes (if applicable), and subscription recurrence indicators.
3. **Review & Server Price Verification**:
   - Test coupon code input handling (valid code vs invalid/expired code).
   - Verify server-side price confirmation: Ensure the client cannot manipulate prices via DOM injection or tampered requests.
   - Check mandatory legal checkmarks: Terms of Use, Privacy Notice, Subscription Auto-Renewal disclosure, and Stripe Account creation.
4. **Stripe Payment Gateway Element**:
   - Verify embedded iframe loading, SSL enforcement, and tokenization boundary.
   - Test validation errors on blank/invalid card inputs, zip code matching, and 3D Secure / SCA challenges.
   - Inspect webhook handling (`/api/webhooks/stripe`): `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`, and `customer.subscription.deleted`.

---

## 5. COMPLETE ADMIN PANEL (WSJ STUDIO) AUDIT

Treat the administration portal (`/admin`) as a mission-critical enterprise SaaS application.

### A. Authentication, RBAC & Session Security
- Test route guards for unauthenticated visitors (must redirect to `/admin/login`).
- Test brute-force mitigation / rate limits on admin login endpoints.
- Test JWT token expiration, refresh mechanism, CSRF token validation, and secure cookie flags (`HttpOnly`, `SameSite=Lax/Strict`, `Secure`).
- Test Role-Based Access Control (Admin vs Staff vs Manager).

### B. Core Dashboard & Live KPIs
- Verify all counter cards (Total Pages, Blog Posts, Inquiries, Media Assets).
- Verify real-time inquiry feeds, action buttons (`View inquiry`, `Resolve`), and refresh mechanics.

### C. Dynamic Service Catalog Manager (`/admin/catalog`)
- **Package Management**:
  - Test filtering 64 packages across all 13 services.
  - Test package creation (`New package`): service association, pricing in whole cents, billing frequency (`one_time`, `per_hour`, `per_month`, `per_year`), capacity limits, and amenity tagging.
  - Test package editing: live field updates.
  - Test segmented publishing controls: `Draft`, `Published`, `Archived`.
  - Test instant cache revalidation: Confirm changes appear immediately on the public website without restarting or rebuilding the Next.js process.
- **Add-ons & Amenities Libraries**:
  - Test creating, updating, and associating add-ons and amenities with packages.

### D. Billing, Subscriptions & Order Operations
- **Orders & Payments**: Filter by service and status (`PENDING`, `PAID`, `FAILED`, `CANCELLED`). Test order inspection modal, customer details, Stripe payment intent IDs, and receipt links.
- **Subscriptions**: Inspect active recurring subscriptions, renewal dates, cancellation flags, and prorated plan switches.
- **Billing Audit Trail**: Audit the log feed (130+ entries) for reconciliation sweeps, manual adjustments, admin user tags, and ISO timestamps.

### E. Content Management & Site Settings Studio
- **Content Pages & Blog Posts**: Test rich text editor (Bold, Italic, Headings, Lists, Quotes, Links, Undo/Redo), URL slug generator, scheduled publication by timezone, and public visibility toggle.
- **Site Settings**: Verify brand details, display phone number, E.164 phone link (`+17739861908`), email, physical address, global SEO titles, metadata JSON editor, and instant live site synchronization.
- **Lead Inquiries & Popups**: Audit lead status management (`NEW`, `READ`, `RESOLVED`) and engagement popup trigger rules (exit intent, time delay, scroll depth).

---

## 6. BACKEND API, ARCHITECTURE & SECURITY AUDIT

1. **API Endpoints & Routing**:
   - Audit all `/api/*` and NestJS endpoints for strict payload validation (class-validator / Zod / DTO schemas).
   - Test error handling: Ensure no stack traces or sensitive database credentials leak in 500 error responses.
2. **Security & OWASP Top 10**:
   - SQL Injection: Verify parameterized queries across Prisma / TypeORM / raw SQL.
   - XSS: Verify sanitization on rich text inputs and user comments.
   - CORS & Security Headers: Verify `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy`.
3. **Rate Limiting & DoS Protection**:
   - Test rate limit triggers on contact forms, booking requests, and auth endpoints.
4. **Operations & Deployment Readiness**:
   - Audit PM2 ecosystem configuration (`ecosystem.config.cjs`) for cluster mode, memory limits, and log file rotation.
   - Inspect Docker Compose configurations and environment variable isolation.

---

## 7. AUDIT OUTPUT & REPORTING STRUCTURE

When executing this audit, structure the final findings using this exact format:

### Executive Summary
- Overall System Health Score (0–100%)
- Critical Blockers Count (P0)
- High Priority Issues (P1)
- Medium Polish & Improvements (P2)
- Low / Minor Nice-to-Haves (P3)

### Perspective Breakdowns
1. **End-User & Conversion View**: Usability friction, conversion drop-off points, funnel flow.
2. **UI/UX & Design Systems View**: Visual balance, responsiveness, accessibility (WCAG), micro-interactions.
3. **Full-Stack Developer View**: Code quality, type safety, state management, API efficiency.
4. **Architect & DevOps View**: Scalability, database indexing, caching, PM2 clustering, security boundaries.
5. **Business Owner View**: Value proposition clarity, SEO performance, local Chicagoland target capture, pricing accuracy.

### Actionable Remediation Matrix
| ID | Area / Route | Finding & Root Cause | Severity | Recommended Fix | Verified (Y/N) |
|---|---|---|---|---|---|

---

*Execute this audit systematically. Provide visual proof (screenshots) and reproduction steps for any issue identified.*
