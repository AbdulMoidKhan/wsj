# Dynamic Service, Package, Pricing & Add-On Catalog

Services, packages, prices, add-ons and amenities are database records an
administrator edits in the Admin Portal. The public site, the booking wizard and
Stripe checkout all read the same records, so there is nothing to redeploy when a
price or a service changes.

## How it fits together

```
Admin Portal  /admin → Service catalog     Public site & booking dialog
  ServiceManager   ─┐                        GET  /api/public/catalog/services
  PlanEditor        ├─ /api/admin/catalog/*  GET  /api/public/catalog/services/:slug
  AddonMatrix       │                        GET  /api/public/catalog/plans/:slug
  AmenityManager   ─┘                        POST /api/public/catalog/quote
                                             POST /api/public/catalog/checkout
                         PostgreSQL
    ServiceCategory ─< CatalogPlan ─< PlanAddOn >─ CatalogAddOn
            │                   └─< PlanAmenity >─ CatalogAmenity
            ├─< ServiceAddOn >──────────────────── CatalogAddOn
            └─< ServiceAmenity >───────────────── CatalogAmenity
```

## Guarantees

- **No hardcoded business logic.** Components hold layout and marketing copy
  only. Every amount, billing period, capacity, amenity and add-on comes from
  the API. When the API is unreachable a page shows "on request" rather than a
  number that could contradict the database.
- **Server-authoritative pricing.** The browser submits references
  (`planSlug`, `addOns[].slug`, `durationHours`, `days`, `quantity`). The server
  re-reads every price, clamps every quantity to the catalog bounds and only
  then creates the Stripe session. `POST /public/catalog/quote` runs the exact
  same maths as checkout.
- **Reusable add-ons.** An add-on is defined once and attached to any number of
  services or individual packages, each attachment with an optional
  `priceOverrideCents`. The seeded example: *Co-Working Space* is $50/month in
  the library and sold at $30 with Meeting Rooms through an override.
- **Historical price protection.** Editing a price only affects new purchases.
  Orders keep `OrderItem.unitAmount`, subscriptions keep the Stripe price they
  were created with, and deletes are archives (`active:false` + `archivedAt`).

## Billing units

`ONE_TIME`, `PER_HOUR`, `PER_DAY`, `PER_MONTH`, `PER_YEAR`, `PER_SESSION`,
`PER_ITEM`, `PER_SETUP`, `PER_BOOKING`, `PER_PODCAST`, `PER_CLIP`, `CUSTOM`.

| Multiplier | Units |
| :--- | :--- |
| `PER_HOUR` | hours chosen by the customer (1–24, clamped by the package) |
| `PER_DAY` | days chosen by the customer |
| `PER_SESSION`, `PER_ITEM`, `PER_PODCAST`, `PER_CLIP`, `CUSTOM` | quantity chosen by the customer |
| `ONE_TIME`, `PER_SETUP`, `PER_BOOKING` | flat, unless the package raises its maximum quantity |
| `PER_MONTH`, `PER_YEAR` | flat per billing cycle; these are the only recurring units |

`PER_HOUR` and `PER_DAY` add-ons attached to an hourly or daily package follow
the package duration, so "Additional Hour" on a 3-hour session bills 3 hours.
The rules live in `backend/src/catalog-core.ts` and are covered by
`backend/test/catalog-core.test.ts`.

## Booking flows

`ServiceCategory.flowType` decides the wizard steps:

| Flow | Steps |
| :--- | :--- |
| `STANDARD` | service → package → amenities → extras → schedule → checkout |
| `NO_EXTRAS` | the add-on step is skipped |
| `MEMBERSHIP` | service → package → Industry Circle → checkout |
| `CUSTOM` | the step list in `customSteps` |

Steps with nothing to show (no amenities, no add-ons, no schedule) drop out
automatically, so a service never renders an empty step.

## Admin Portal

`/admin` → **Service catalog**

| Screen | What it does |
| :--- | :--- |
| Services & categories | Create, reorder, publish/hide, set icon, badge, hero image and booking flow. |
| Packages & pricing | Dollar price input (stored as integer cents), billing duration, capacity, validity rule, government fee disclosure, per-package add-ons and amenities. |
| Add-ons library | Reusable add-ons, the service × add-on assignment matrix, per-assignment price overrides and the yellow admin review flag. |
| Amenities & deliverables | The "what's included" library and its service matrix. |

Every write clears the API read cache and revalidates the Next.js pages, so a
change is visible on the public site immediately.

## API

### Public (unauthenticated)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| GET | `/api/public/catalog/services` | Active services, display order, flow type, "from" price |
| GET | `/api/public/catalog/services/:slug` | Service with packages, amenities, add-ons and resolved steps |
| GET | `/api/public/catalog/plans/:slug` | One package with its notices and compatible add-ons |
| POST | `/api/public/catalog/quote` | Server-computed line items, subtotal, discount, tax and totals in cents |
| POST | `/api/public/catalog/checkout` | Re-prices, then creates the order and the Stripe session |

### Admin (`AuthGuard`, ADMIN/EDITOR; archive is ADMIN)

`GET /api/admin/catalog/overview` powers the whole console in one request.

```
GET|POST        /api/admin/catalog/services
PATCH|DELETE    /api/admin/catalog/services/:id
POST            /api/admin/catalog/services/reorder
GET|POST        /api/admin/catalog/plans            (?serviceId=)
PATCH|DELETE    /api/admin/catalog/plans/:id
GET|POST        /api/admin/catalog/addons
PATCH|DELETE    /api/admin/catalog/addons/:id
POST            /api/admin/catalog/addons/assign-service
POST            /api/admin/catalog/addons/assign-plan
DELETE          /api/admin/catalog/addons/unassign
GET|POST        /api/admin/catalog/amenities
PATCH|DELETE    /api/admin/catalog/amenities/:id
POST            /api/admin/catalog/amenities/assign
DELETE          /api/admin/catalog/amenities/unassign
```

## Install

```bash
cd backend
npm run prisma:generate      # picks up the new catalog models
npm run db:migrate           # applies 20261108090000_add_dynamic_service_catalog
npm run db:seed:catalog      # 13 services, 25 packages, 24 add-ons, 26 amenities
npm test                     # includes catalog-core unit tests
```

The seed is idempotent: it upserts by slug, repairs drift and never touches
orders, subscriptions or invoices. Until it runs, the public endpoints project
the legacy `Plan` table into the same shape so the site keeps working.

## Flagged for administrator review after seeding

1. **Registered Agent Service** is seeded at **$150/year**; historical notes
   mention $120/year. The add-on carries an `adminFlagNote`, which raises the
   yellow banner on the Add-ons library screen until an administrator confirms
   or changes the rate.
2. **Premium Video Podcast Studio** capacity was never documented and is left
   unconstrained, flagged on the package.
3. **Event Space, Workshops, Webinars and Memberships** are seeded with their
   authentic descriptions and no packages. They appear on the site as
   "pricing confirmed by our team" until tiers and rates are added in
   Packages & pricing.
