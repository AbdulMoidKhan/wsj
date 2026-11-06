# Project Context

**Name:** Workspace Junction — Marketing Site
**Purpose:** Next.js marketing/conversion site for a coworking business in Oakbrook Terrace, IL — showcases ~15 service lines (coworking, dedicated desks, meeting rooms, podcast studio, virtual office, mailbox, business address, events, LLC setup, digital services, BPO, printing, notary, digital presence) and drives tour bookings and membership inquiries.

**Tech stack:** Next.js 16 (Turbopack), React 19, TypeScript, GSAP + Motion (framer-motion) for animation, lucide-react icons, a single shared `cn-` CSS design system (`app/community-network.css`) used across the redesigned pages.

**Current phase:** Mid-redesign. All ~15 service pages were just rebuilt on one shared `DynamicPageView` template (`components/dynamic-page-view.tsx` + `lib/dynamic-pages-config.tsx`) — distinct copy/images per page via config, but identical section structure. User has flagged this as unacceptable and wants genuinely distinct layouts per page.

**Key constraints:**
- Pricing data lives in a static `data/approved-pricing.json` catalog; the live `/api/public/pricing` endpoint currently errors server-side and silently falls back to the static file — this is a pre-existing bug, not a feature.
- No admin CMS/auth surface exists yet. A backend-controlled `is_popular` flag + admin toggle (requested for pricing cards) would require new backend/auth work, not just frontend changes.
- Must not break existing routes, forms, or business logic while redesigning.

**Definition of done:** Every service page has a visually distinct layout/composition (not just swapped copy/images) while preserving all existing content; pricing cards render dynamically from backend data including a working `is_popular` → "Most Popular" badge; existing routes/forms/APIs remain functional.
