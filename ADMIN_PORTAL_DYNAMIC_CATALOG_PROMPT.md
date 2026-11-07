# MASTER DIRECTIVE: DYNAMIC SERVICE, PACKAGE, PRICING & ADD-ON MANAGEMENT SYSTEM (FRONTEND, BACKEND & ADMIN PORTAL)

## MISSION STATEMENT
Build and integrate a 100% backend-driven, database-persisted service catalog and dynamic booking management engine into Workspace Junction (\`wsj\`). The system must empower non-technical administrators to create, edit, archive, price, and cross-assign services, packages, add-ons, amenities, and billing types directly through the Admin Portal (\`/admin\`) with zero code modifications, while providing seamless real-time synchronization with the public customer-facing website and Stripe checkout flow.

---

## 1. ARCHITECTURAL REQUIREMENTS & CONSTRAINTS

1. **Zero Hardcoded Business Logic**: No service names, package pricing, billing intervals, add-on costs, or amenity checklists may be hardcoded into frontend components. All customer-facing pages and booking wizards must hydrate dynamically from authoritative backend REST endpoints.
2. **Server-Side Authoritative Pricing**: The frontend never submits raw dollar amounts for payment. It submits entity references (\`planSlug\`, \`addOnSlugs\`, \`quantity\`, \`hours\`), and the backend recalculates and verifies the authoritative price from database snapshots before issuing Stripe intents.
3. **Reusable Add-on Architecture**: An add-on definition (e.g., "Business Address ($25/mo)" or "Dedicated Desk ($350/mo)") must be created once in the library and attachable to multiple services or individual packages with custom pricing overrides.
4. **Historical Price Protection**: Modifying an active package or add-on price in the admin panel must never retroactively alter the financial records of past confirmed orders or active subscription billing cycles.

---

## 2. BACKEND & DATABASE SPECIFICATION (PRISMA SCHEMA)

Extend \`backend/prisma/schema.prisma\` with the following normalized relational entities:

\`\`\`prisma
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Catalog: Services, Plans, Add-ons, Amenities, and Cross-Assignments
// ─────────────────────────────────────────────────────────────────────────────

enum ServiceBookingFlow {
  STANDARD          // 6-step: Service -> Plan -> Amenities -> Extras -> Schedule -> Checkout
  NO_EXTRAS         // Skips add-on selection (e.g. Business Address, Mailbox)
  MEMBERSHIP        // Skips amenities, add-ons, calendar; routes to Circle Selection
  CUSTOM            // Admin-defined step array
}

enum BillingIntervalUnit {
  ONE_TIME          // Flat one-time charge
  PER_HOUR          // Multiplied by selected duration hours (1-24h)
  PER_DAY           // Multiplied by day count
  PER_MONTH         // Monthly recurring cycle (30 days)
  PER_YEAR          // Annual recurring cycle
  PER_SESSION       // Billed per appointment session
  PER_ITEM          // Multiplied by gear/item quantity
  PER_SETUP         // Flat technical staging fee
  PER_BOOKING       // Flat booking surcharge
  PER_PODCAST       // Media fee per podcast episode
  PER_CLIP          // Media fee per highlight clip
  CUSTOM            // Custom duration
}

model ServiceCategory {
  id                String             @id @default(uuid())
  slug              String             @unique
  name              String
  description       String             @default("")
  categoryBadge     String?
  iconName          String             @default("Layers")
  heroImageUrl      String?
  displayOrder      Int                @default(0)
  active            Boolean            @default(true)
  flowType          ServiceBookingFlow @default(STANDARD)
  customSteps       Json               @default("[]")
  metadata          Json               @default("{}")
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  plans             CatalogPlan[]
  serviceAddOns     ServiceAddOn[]
  serviceAmenities  ServiceAmenity[]

  @@index([active, displayOrder])
}

model CatalogPlan {
  id                String              @id @default(uuid())
  slug              String              @unique
  serviceId         String
  service           ServiceCategory     @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  name              String
  description       String              @default("")
  unitAmountCents   Int                 // Integer cents ($50 = 5000)
  currency          String              @default("usd")
  billingUnit       BillingIntervalUnit @default(PER_MONTH)
  durationMinutes   Int?
  durationDays      Int?
  minQuantity       Int                 @default(1)
  maxQuantity       Int                 @default(1)
  capacityText      String?             // e.g. "1–2 people", "Up to 4 people"
  featured          Boolean             @default(false)
  active            Boolean             @default(true)
  archivedAt        DateTime?
  sortOrder         Int                 @default(0)
  rulesNotice       String?             // e.g. "Unused days expire at the end of the monthly validity period and do not roll over."
  governmentNotice  String?             // e.g. LLC state filing fee disclosure
  metadata          Json                @default("{}")
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  planAddOns        PlanAddOn[]
  planAmenities     PlanAmenity[]

  @@index([serviceId, active, sortOrder])
}

model CatalogAddOn {
  id                String              @id @default(uuid())
  slug              String              @unique
  name              String
  description       String              @default("")
  unitAmountCents   Int
  currency          String              @default("usd")
  billingUnit       BillingIntervalUnit @default(ONE_TIME)
  minQuantity       Int                 @default(0)
  maxQuantity       Int                 @default(10)
  defaultQuantity   Int                 @default(1)
  imageUrl          String?
  active            Boolean             @default(true)
  adminFlagNote     String?             // e.g. Flagging $120 vs $150 registered agent conflict
  metadata          Json                @default("{}")
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  serviceAddOns     ServiceAddOn[]
  planAddOns        PlanAddOn[]

  @@index([active])
}

model ServiceAddOn {
  serviceId         String
  service           ServiceCategory     @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  addOnId           String
  addOn             CatalogAddOn        @relation(fields: [addOnId], references: [id], onDelete: Cascade)
  priceOverrideCents Int?               // Optional custom price for this service
  isRequired        Boolean             @default(false)
  sortOrder         Int                 @default(0)

  @@id([serviceId, addOnId])
}

model PlanAddOn {
  planId            String
  plan              CatalogPlan         @relation(fields: [planId], references: [id], onDelete: Cascade)
  addOnId           String
  addOn             CatalogAddOn        @relation(fields: [addOnId], references: [id], onDelete: Cascade)
  priceOverrideCents Int?               // Optional custom price for this plan
  isRequired        Boolean             @default(false)
  sortOrder         Int                 @default(0)

  @@id([planId, addOnId])
}

model CatalogAmenity {
  id                String              @id @default(uuid())
  name              String
  description       String              @default("")
  iconUrl           String?
  iconName          String              @default("Check")
  active            Boolean             @default(true)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  serviceAmenities  ServiceAmenity[]
  planAmenities     PlanAmenity[]
}

model ServiceAmenity {
  serviceId         String
  service           ServiceCategory     @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  amenityId         String
  amenity           CatalogAmenity      @relation(fields: [amenityId], references: [id], onDelete: Cascade)
  sortOrder         Int                 @default(0)

  @@id([serviceId, amenityId])
}

model PlanAmenity {
  planId            String
  plan              CatalogPlan         @relation(fields: [planId], references: [id], onDelete: Cascade)
  amenityId         String
  amenity           CatalogAmenity      @relation(fields: [amenityId], references: [id], onDelete: Cascade)
  sortOrder         Int                 @default(0)

  @@id([planId, amenityId])
}
\`\`\`

---

## 3. BACKEND API SPECIFICATION (NESTJS CONTROLLERS & SERVICES)

Implement clean, validated REST routes with \`class-validator\` and \`AuthGuard\` (\`ADMIN\` role required for mutations).

### A. Public Discovery Endpoints (Unauthenticated)
- \`GET /api/public/catalog/services\`: Returns all active services with their basic metadata, display order, and allowed booking flow.
- \`GET /api/public/catalog/services/:slug\`: Returns the full service object, active packages, attached add-ons (with price overrides), and amenities.
- \`GET /api/public/catalog/plans/:slug\`: Returns an individual plan, rules notice, legal disclosures, and compatible add-ons.
- \`POST /api/public/catalog/quote\`:
  - Body: \`{ planSlug: string, addOns: [{ slug: string, quantity: number }], durationHours?: number, days?: number }\`
  - Output: Server-computed authoritative line items, subtotal, tax, discounts, and payable total in whole cents.

### B. Admin Management Endpoints (\`@UseGuards(AuthGuard), @Roles('ADMIN')\`)
- **Services**:
  - \`GET /api/admin/catalog/services\`
  - \`POST /api/admin/catalog/services\` (Create new category)
  - \`PATCH /api/admin/catalog/services/:id\` (Edit name, description, icon, flowType, displayOrder)
  - \`DELETE /api/admin/catalog/services/:id\` (Soft delete / archive)
- **Packages / Plans**:
  - \`GET /api/admin/catalog/plans?serviceId=...\`
  - \`POST /api/admin/catalog/plans\` (Add new package)
  - \`PATCH /api/admin/catalog/plans/:id\` (Update price, capacity, duration, billingUnit, notices)
  - \`DELETE /api/admin/catalog/plans/:id\`
- **Add-Ons Catalog**:
  - \`GET /api/admin/catalog/addons\`
  - \`POST /api/admin/catalog/addons\` (Create reusable add-on)
  - \`PATCH /api/admin/catalog/addons/:id\` (Edit name, unit price, billing unit, admin notes)
  - \`POST /api/admin/catalog/addons/assign-service\` (\`{ serviceId, addOnId, isRequired, priceOverride }\`)
  - \`POST /api/admin/catalog/addons/assign-plan\` (\`{ planId, addOnId, isRequired, priceOverride }\`)
  - \`DELETE /api/admin/catalog/addons/unassign\`: Remove add-on from specific service/plan.
- **Amenities**:
  - \`GET /api/admin/catalog/amenities\`
  - \`POST /api/admin/catalog/amenities\`
  - \`POST /api/admin/catalog/amenities/assign\`

---

## 4. ADMIN PORTAL USER INTERFACE (\`app/admin/\`)

Create a unified, responsive **Catalog Management Console** inside the Admin Portal:

### 1. Navigation & View Switcher
Inside \`app/admin/page.tsx\`, add top-level sidebar resources:
- \`catalog/services\`: "Services & Categories"
- \`catalog/plans\`: "Packages & Pricing"
- \`catalog/addons\`: "Add-Ons Library"
- \`catalog/amenities\`: "Amenities & Deliverables"

### 2. Services Manager (\`ServiceManager.tsx\`)
- Visual table displaying all 13 services with their slug, icon, active package count, and booking flow type.
- Reorder items via drag-and-drop or sort arrows (updates \`displayOrder\`).
- Quick toggle for "Active / Inactive" visibility on public site.
- Modal editor allowing live text editing, hero image upload, and booking flow selection (\`STANDARD\`, \`NO_EXTRAS\`, \`MEMBERSHIP\`).

### 3. Package & Pricing Editor (\`PlanEditor.tsx\`)
- Filter packages by Service Category dropdown.
- **Price Input**: Dollar value input converted to integer cents on submission.
- **Billing Duration Dropdown**:
  - \`one_time\`, \`per_hour\`, \`per_day\`, \`per_month\`, \`per_year\`, \`per_session\`, \`per_item\`, \`per_setup\`, \`per_booking\`, \`per_podcast\`, \`per_clip\`, \`custom\`.
- **Special Notice Fields**:
  - Dedicated textarea for *Usage & Validity Rule* (e.g. "Unused days expire at the end of the monthly validity period and do not roll over.").
  - Dedicated textarea for *Government Fee Disclosures* (automatically rendered on LLC packages).
- **Capacity & Guest Inputs**: Numeric fields for attendee limits (e.g., meeting rooms 4-12 people, podcast 1-4 people).

### 4. Central Add-On Library & Assignment Matrix (\`AddonMatrix.tsx\`)
- Grid displaying all reusable add-ons with their unit price and billing type.
- **Assignment Matrix Table**: Matrix showing all Services on the Y-axis and Add-Ons on the X-axis. Administrators can check checkboxes to attach/detach add-ons to services instantly.
- **Conflict & Attention Alert Banner**:
  - Renders a yellow attention box on add-ons with active flags:
    > **Admin Review Flag**: Registered Agent Service is configured at $150/year. Historical notes mention a conflicting $120/year figure. Click to confirm or adjust rate.

---

## 5. CUSTOMER-FACING BOOKING DIALOG INTEGRATION (\`components/booking-dialog.tsx\`)

Upgrade the booking wizard to consume the new dynamic catalog endpoints:

1. **Step Flow Adaptation**:
   - Query \`/api/public/catalog/services/:slug\`.
   - If \`flowType === 'NO_EXTRAS'\` or attached add-ons array is empty, completely bypass Step 4 (Extras).
   - If \`flowType === 'MEMBERSHIP'\`, display the Monthly/Yearly toggle and route immediately to Industry Circle selection, skipping amenities, add-ons, and calendar scheduling.
2. **LLC Legal Disclosures**:
   - Whenever an LLC package is selected, render the mandatory fee notice directly below the price tag:
     > *"The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state."*
3. **Coworking Validity & No-Rollover Rule**:
   - Display a clean rule pill below the 4 coworking tiers:
     > *"All packages valid for 30 days. Unused days expire at the end of the monthly period and do not roll over."*
4. **Dynamic Add-on Multipliers**:
   - Respect billing units: calculate \`addon.price * quantity\` for items, \`addon.price * durationHours\` for hourly packages, and include clear labels (\`/month\`, \`one-time\`, \`/session\`).

---

## 6. INITIAL DATABASE SEED DATA (AUTHORITATIVE VALUES)

Execute database migration and seed the 13 baseline services with exact prompt values:

1. **Coworking**: Bronze ($50/mo, 1d), Silver ($100/mo, 5d), Gold ($150/mo, 10d), Platinum ($250/mo, full month). Unused days do not roll over. Add-ons: Business Address ($25), Mailbox ($35), Virtual Office ($250).
2. **Podcast Studio**: Solo ($75/h, 1-2p), Interview ($95/h, 2-3p), Panel ($120/h, 4p), Premium ($150/h, capacity flagged). Add-ons: Editing ($75/pod), Social Clips ($40/clip), Full Video ($150), Intro/Outro ($80), Extra Cam ($40), Extra Hour ($70/h).
3. **Dedicated Desk**: Classic ($350/30d), Performance ($375/30d). 24/7 access. Add-ons: Coworking ($50), Address ($25), Mailbox ($35).
4. **Virtual Office**: Virtual Office ($250/30d), Virtual Office Plus ($275/30d). Add-ons: Coworking ($50), Address ($25), Mailbox ($35).
5. **Business Address**: $25/mo. (Bypasses add-ons).
6. **Mailbox Rental**: $35/30d. (Bypasses add-ons).
7. **LLC Services**: Basic ($200), Professional ($400), Premium ($699). Mandatory state fee notice displayed. Add-ons: EIN ($75), Registered Agent ($150/yr, flagged $120 conflict), Business Address ($25), Virtual Office ($250), Expedited ($75), Same-Day ($150), Banking Consultation ($99), License Research ($125), Website Starter ($499), Branding ($199), Mailbox ($35).
8. **Photo Studio**: Hourly ($12/h), Half-Day ($40/4h), Full-Day ($75/8h), Monthly Creator ($250/30d). Add-ons: Photographer ($30/session), Videographer ($75/session), Lighting ($12/setup), Makeup Room ($12/booking), Equipment ($8/item).
9. **Meeting Rooms**: Huddle ($25/h, 4p), Collaboration ($35/h, 4p), Conference ($50/h, 6p), Board Room ($70/h, 10-12p). Add-ons: 30-Day Coworking ($30), Business Address ($25).
10, 11, 12, 13. **Event Space, Workshops, Webinars, Memberships**: Initialized with authentic descriptions; tier rates flagged for admin review.
14. **Global Monthly Add-ons Library**: Co-Working ($50), Business Address ($25), Mailbox ($35), Virtual Office ($250), Dedicated Desk ($350).

---

## 7. VERIFICATION & QUALITY ASSURANCE ACCEPTANCE CRITERIA

- [ ] **Admin Catalog CRUD**: Administrator can add a new service, create a package, and change a price in the Admin Portal and see it reflect on the public site immediately without build/code updates.
- [ ] **Add-On Attachment Flexibility**: An administrator can attach any reusable add-on to any service or plan with or without a custom price override.
- [ ] **Billing Unit Support**: All 12 billing types calculate properly in quotes and checkout receipts.
- [ ] **No Hardcoded Pricing**: Frontend contains zero static price literals in components.
- [ ] **Stripe Checkout Synchronization**: Server validates all item totals before opening checkout sessions.
- [ ] **Responsive Admin UI**: All tables, modals, and matrix pickers work smoothly on desktop, tablet, and mobile viewports.
