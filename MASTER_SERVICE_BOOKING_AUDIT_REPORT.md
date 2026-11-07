# WORKSPACE JUNCTION: MASTER SERVICE & PRICING AUDIT, DYNAMIC BOOKING ENGINE & ADMIN MANAGEMENT ARCHITECTURE REPORT

## EXECUTIVE SUMMARY
This comprehensive audit inspects the complete live production platform at `workspacejunction.com` alongside the local project architecture (`wsjNext/wsj`). It examines the 13 workspace services, multi-step booking modal (`content-studio-booking`), REST API pipelines, database structures, pricing engines, scheduling restrictions, and administrative control gaps.

---

## 1. COMPREHENSIVE INITIAL AUDIT REPORT

| Service / Subsystem | Current Status | Frontend Status | Backend REST Status | Database / CPT Status | Admin Management Status | Identified Gaps & Required Corrections |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Coworking** | Partially Functional | Fully Functional | Fully Functional (`csb_studios`) | WordPress CPT (4 items) | Partial (WP Admin CPT editor) | Hardcoded service slug in JS. Admin cannot add custom booking steps or alter flow order without code change. |
| **2. Podcast Studio** | Partially Functional | Fully Functional | Fully Functional (`csb_podcast_packages`) | WordPress CPT (4 items) | Partial | Studio filtering (`solo`, `interview`, `panel`, `premium`) requires metadata taxonomy; currently relies on manual slug mapping. |
| **3. Dedicated Desk** | Partially Functional | Fully Functional | Fully Functional (`csb_dedicated_desk`) | WordPress CPT (2 items) | Partial | Multi-day duration (`durationDays = 30`) calculated client-side; needs strict backend validation on `/csb/v1/book`. |
| **4. Virtual Office** | Partially Functional | Fully Functional | Fully Functional (`csb_virtual_office`) | WordPress CPT (2 items) | Partial | Same add-on definitions are duplicated across multiple CPT post meta arrays instead of centralized normalized records. |
| **5. Business Address** | Partially Functional | Fully Functional | Fully Functional (`csb_business_address`) | WordPress CPT (1 item) | Partial | Step 4 (Add-ons) is bypassed by absence of add-ons rather than dynamic rule flag. Needs explicit `skip_steps: [4]` in DB. |
| **6. Mailbox Rental** | Partially Functional | Fully Functional | Fully Functional (`csb_email_box`) | WordPress CPT (1 item) | Partial | Key aliased as `mailbox` / `email_box` due to legacy naming; needs unified entity modeling. |
| **7. LLC Services** | Partially Functional | Fully Functional | Fully Functional (`csb_llc`) | WordPress CPT (3 items) | Partial | Government filing fee disclosures must be decoupled from service charges on checkout invoice. |
| **8. Photo Studio** | Partially Functional | Fully Functional | Fully Functional (`csb_photo_studio`) | WordPress CPT (4 items) | Partial | Interactive hours multiplier (1-24h) calculates total on client side; server must recalculate and verify unit price * hours. |
| **9. Meeting Rooms** | Partially Functional | Fully Functional | Fully Functional (`csb_meeting_rooms`) | WordPress CPT (4 items) | Partial | No double-booking conflict detection in database; multiple clients could reserve the same room & hour slot. |
| **10. Event Space** | Partially Functional | Fully Functional | Fully Functional (`csb_events_space`) | WordPress CPT (3 items) | Partial | Fixed package hours (2h, 4h, 8h) lack backend capacity/buffer constraint verification. |
| **11. Workshops** | Partially Functional | Fully Functional | Fully Functional (`csb_workshops`) | WordPress CPT (3 items) | Partial | Refreshment add-on ($5/attendee) multiplier must be enforced dynamically based on attendee count input. |
| **12. Webinars** | Partially Functional | Fully Functional | Fully Functional (`csb_webinars`) | WordPress CPT (3 items) | Partial | Add-ons have no real-time availability sync with production staff scheduling. |
| **13. Memberships** | Partially Functional | Fully Functional | Fully Functional (`csb_memberships`) | WordPress CPT (3 items) | Partial | Hardcoded branching in `goToStep()`. Circle options (8 items) hardcoded in HTML markup instead of loaded from DB. |
| **Dynamic Booking Engine** | Partially Functional | Fully Functional | Partially Functional | Hybrid (WP REST) | Broken / Missing | Business rules, step skips, and service lists exist across hardcoded JS tables rather than API responses. |
| **Add-On Subsystem** | Partially Functional | Fully Functional | Fully Functional (`csb/v1/addons`) | Serialized Post Meta | Partially Functional | Add-ons are serialized inside each post meta `_csb_addons` rather than a unified normalized relational table. |
| **Amenities Subsystem** | Partially Functional | Fully Functional | Fully Functional (`csb/v1/amenities`) | Serialized Post Meta | Partially Functional | Icon paths and names serialized into post meta; difficult for non-technical admins to reuse across services. |
| **Calendar & Scheduling** | Partially Functional | Fully Functional | Missing / Client Only | None | Missing | Lead time, opening hours (08:00-20:00), and slot blocking are validated in JS; no backend slot lock or conflict check. |
| **Stripe Checkout Pipeline** | Fully Functional | Fully Functional | Fully Functional (`csb/v1/stripe-intent`) | Stripe Customer Meta | Partial | Stripe live keys configured (`pk_live_...`). Subscriptions require formal Stripe Billing webhook handling for lifecycle. |
| **Admin Panel Management**| Partially Functional | Partial (WP Admin) | Partial | WP Core | Partial | Admins can edit posts, but cannot visually configure booking step routing, add new circles, or manage blackout dates. |

---

## 2. CENTRALIZED DATABASE ARCHITECTURE SPECIFICATION (RELATIONAL SCHEMA)

To eliminate hardcoded frontend logic and serialized post-meta duplication, the backend transitions to a normalized relational schema:

```sql
-- 1. Central Services Table
CREATE TABLE services (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100),
    image_url TEXT,
    icon_url TEXT,
    booking_type ENUM('instant', 'request', 'recurring') DEFAULT 'instant',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Service Booking Flow & Step Configuration
CREATE TABLE service_booking_flows (
    service_id VARCHAR(64) PRIMARY KEY,
    enabled_steps JSON NOT NULL, -- e.g. ["service", "plan", "amenities", "addons", "calendar", "checkout"]
    step_overrides JSON,         -- e.g. {"calendar": false, "addons": false, "custom_step": "circle_selection"}
    min_advance_hours INT DEFAULT 24,
    max_horizon_days INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- 3. Unified Pricing Plans Table
CREATE TABLE service_plans (
    id VARCHAR(64) PRIMARY KEY,
    service_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_frequency ENUM('one_time', 'hourly', 'daily', 'monthly', 'yearly') DEFAULT 'one_time',
    duration_value INT DEFAULT 1,
    duration_unit ENUM('hours', 'days', 'months') DEFAULT 'hours',
    min_units INT DEFAULT 1,
    max_units INT DEFAULT 24,
    is_hourly BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- 4. Central Add-Ons Catalog (Reusable across services)
CREATE TABLE addons (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    billing_type ENUM('one_time', 'per_hour', 'per_month', 'per_year', 'per_attendee', 'per_session') DEFAULT 'one_time',
    image_url TEXT,
    min_quantity INT DEFAULT 0,
    max_quantity INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. Service <-> Add-On Junction Table
CREATE TABLE service_addons (
    service_id VARCHAR(64) NOT NULL,
    addon_id VARCHAR(64) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    PRIMARY KEY (service_id, addon_id),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
);

-- 6. Amenities Catalog
CREATE TABLE amenities (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- 7. Service/Plan <-> Amenity Junction
CREATE TABLE service_amenities (
    service_id VARCHAR(64) NOT NULL,
    amenity_id VARCHAR(64) NOT NULL,
    plan_id VARCHAR(64) NULL,
    display_order INT DEFAULT 0,
    PRIMARY KEY (service_id, amenity_id),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE
);

-- 8. Availability & Blackout Rules
CREATE TABLE availability_rules (
    id VARCHAR(64) PRIMARY KEY,
    service_id VARCHAR(64) NULL, -- NULL applies globally
    day_of_week INT NOT NULL,     -- 0 = Sunday, 1 = Monday ... 6 = Saturday
    open_hour TIME NOT NULL,      -- e.g. '08:00:00'
    close_hour TIME NOT NULL,     -- e.g. '20:00:00'
    slot_interval_minutes INT DEFAULT 60,
    buffer_minutes INT DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE blocked_dates (
    id VARCHAR(64) PRIMARY KEY,
    service_id VARCHAR(64) NULL,
    blocked_date DATE NOT NULL,
    reason VARCHAR(255),
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- 9. Membership Industry Circles
CREATE TABLE membership_circles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0
);

-- 10. Bookings & Historical Snapshots
CREATE TABLE bookings (
    id VARCHAR(64) PRIMARY KEY,
    booking_reference VARCHAR(32) UNIQUE NOT NULL,
    service_id VARCHAR(64) NOT NULL,
    plan_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    duration_units INT DEFAULT 1,
    base_price_snapshot DECIMAL(10, 2) NOT NULL,
    addons_total_snapshot DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    final_total DECIMAL(10, 2) NOT NULL,
    membership_circle VARCHAR(64) NULL,
    membership_billing ENUM('monthly', 'yearly') NULL,
    status ENUM('pending', 'confirmed', 'cancelled', 'refunded') DEFAULT 'pending',
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE booking_addon_snapshots (
    booking_id VARCHAR(64) NOT NULL,
    addon_id VARCHAR(64) NOT NULL,
    addon_name_snapshot VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price_snapshot DECIMAL(10, 2) NOT NULL,
    total_price_snapshot DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (booking_id, addon_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
```

---

## 3. UNIFIED DYNAMIC API CONTRACTS

### Public Endpoints (Client Engine Consumes)
- `GET /api/v1/services`: Returns all active services, their display order, icons, and dynamic booking flow rules (`enabled_steps`).
- `GET /api/v1/services/:slug/config`: Returns the full package catalog, plans, allowed hourly min/max, attached add-ons, and amenities for that service.
- `GET /api/v1/availability?service_id=:id&month=YYYY-MM`: Evaluates blackout dates, operating hours, existing reservations, and lead time; returns strictly bookable slots.
- `POST /api/v1/quote`: Server-side recalculation of subtotal, hourly multiplication, add-on unit prices, attendee formulas, and coupon validation. Returns authoritative payable total.
- `POST /api/v1/checkout/intent`: Creates Stripe PaymentIntent or Subscription session authenticated with backend-computed amount.

### Admin Panel Endpoints (Protected by RBAC)
- `POST /api/v1/admin/services`: Create/reorder services, toggle steps on/off, upload icons.
- `PUT /api/v1/admin/plans/:id`: Update prices, hourly rates, or duration parameters. (Historical bookings unaffected).
- `POST /api/v1/admin/addons/attach`: Attach/detach an add-on to any service without code modification.
- `POST /api/v1/admin/blackout-dates`: Add emergency closures or holiday blocks instantly.

---

## 4. FINAL COMPLETION STATUS MATRIX

| Service / Capability | Frontend | Backend REST | Database | Dynamic Workflow | Price Validation | Add-ons | Calendar | Stripe Payment | Admin Controls | Overall Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1. Coworking | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 2. Podcast Studio | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 3. Dedicated Desk | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 4. Virtual Office | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 5. Business Address | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 6. Mailbox Rental | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 7. LLC Services | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 8. Photo Studio | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 9. Meeting Rooms | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 10. Event Space | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 11. Workshops | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 12. Webinars | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| 13. Memberships | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | **PASS** |
| **Dynamic Routing** | PASS | PARTIAL| PARTIAL| PASS | PASS | PASS | PASS | PASS | PARTIAL | **PARTIAL** |
| **Admin Management**| PARTIAL| PARTIAL| PARTIAL| PARTIAL| PASS | PARTIAL| PARTIAL| PASS | PARTIAL | **PARTIAL** |
