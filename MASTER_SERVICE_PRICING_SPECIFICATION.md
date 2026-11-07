# WORKSPACE JUNCTION
## COMPLETE SERVICE, PACKAGE, PRICING & ADD-ON SPECIFICATION & AUDIT

**Authoritative Source of Truth**

This specification document serves as the single governing standard for all 13 Workspace Junction service categories, packages, pricing plans, billing units, durations, amenities, and add-on assignments across the Next.js frontend, NestJS backend, PostgreSQL database, and Admin Panel.

---

## 1. COMPREHENSIVE SERVICE & PACKAGE DIRECTORY

### 1. Co-Working (`coworking`)
- **Description**: Flexible shared workspace access with sit/stand desks, high-speed WiFi, printer/scanner access, wellness room, huddle room privileges, complimentary refreshments, partner discounts, and builders library access.
- **Validity Rule**: All coworking packages are valid for one month (30 days). Unused days expire at the end of the monthly validity period and **do not roll over**.
- **Packages**:
  | Package Name | Slug | Price | Included Access | Duration | Billing Type |
  | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Bronze** | `coworking-bronze` | **$50** | 1 day per month | 1 Month (30 days) | Recurring / Monthly |
  | **Silver** | `coworking-silver` | **$100** | 5 days per month | 1 Month (30 days) | Recurring / Monthly |
  | **Gold** | `coworking-gold` | **$150** | 10 days per month | 1 Month (30 days) | Recurring / Monthly |
  | **Platinum** | `coworking-platinum` | **$250** | Full month (all available working days) | 1 Month (30 days) | Recurring / Monthly |
- **Applicable Add-ons**:
  - Business Address: $25 / month
  - Mailbox: $35 / month
  - Virtual Office: $250 / month

---

### 2. Podcast Studio (`podcast-studio`)
- **Description**: State-of-the-art acoustic recording and broadcasting studios equipped with Shure microphones, multi-angle 4K cameras, professional audio interfaces, and studio lighting.
- **Studio Types & Packages**:
  | Studio Type | Package Name | Slug | Duration | Price | Capacity | Billing Type |
  | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
  | **Solo Creator Studio** | Starter Podcast Session | `podcast-solo-starter` | 1 hour | **$75** | 1–2 people | One-time / Hourly |
  | **Interview Studio** | Starter Podcast Session | `podcast-interview-starter` | 1 hour | **$95** | 2–3 people | One-time / Hourly |
  | **Panel Podcast Studio** | Starter Podcast Session | `podcast-panel-starter` | 1 hour | **$120** | Up to 4 people | One-time / Hourly |
  | **Premium Video Podcast Studio** | Starter Podcast Session | `podcast-premium-starter` | 1 hour | **$150** | *(Admin setup required)* | One-time / Hourly |
- **Applicable Add-ons across all 4 Podcast Studio types**:
  | Add-on Name | Slug | Price | Billing Type |
  | :--- | :--- | :--- | :--- |
  | **Podcast Editing** | `addon-podcast-editing` | **$75** | Per podcast |
  | **Social Media Clips** | `addon-podcast-social-clips` | **$40** | Per clip |
  | **Full Video Editing** | `addon-podcast-full-video-editing` | **$150** | One-time |
  | **Intro & Outro Creation** | `addon-podcast-intro-outro` | **$80** | One-time |
  | **Extra Camera** | `addon-podcast-extra-camera` | **$40** | One-time |
  | **Additional Hour** | `addon-podcast-additional-hour` | **$70** | Per hour |

---

### 3. Dedicated Desk (`dedicated`)
- **Description**: Dedicated personal workstations in an executive shared environment with 24/7 keycard access, ergonomic task seating, personal lockable storage, and conference room booking credits.
- **Validity**: Both options include 24/7 access and are valid for 30 days.
- **Packages**:
  | Package Name | Slug | Price | Duration | Included Features |
  | :--- | :--- | :--- | :--- | :--- |
  | **Classic Dedicated Desk** | `dedicated-desk-classic` | **$350** | 30 days | Fixed workstation, ergonomic chair, business WiFi, 24/7 access. |
  | **Performance Dedicated Desk** | `dedicated-desk-performance` | **$375** | 30 days | 27-inch LCD monitor, sit/stand desk controls, focus pod access, boardroom credits. |
- **Applicable Add-ons**:
  - Co-Working Space (30-day flex pass): $50 / 30 days
  - Business Address: $25 / month
  - Mailbox: $35 / month

---

### 4. Virtual Office (`virtual-office`)
- **Description**: Professional commercial business identity, physical address registration in Oakbrook Terrace, secure mail handling, and optional physical workspace credits.
- **Packages**:
  | Package Name | Slug | Price | Duration | Deliverables |
  | :--- | :--- | :--- | :--- | :--- |
  | **Virtual Office** | `virtual-office-standard` | **$250** | 30 days | Commercial address, mail receipt & notifications, meeting room access. |
  | **Virtual Office Plus** | `virtual-office-plus` | **$275** | 30 days | Standard virtual office plus bundled physical coworking desk and room credits. |
- **Applicable Add-ons**:
  - Co-Working Space: $50 / 30 days
  - Business Address: $25 / month
  - Mailbox: $35 / month

---

### 5. Business Address (`business-address`)
- **Description**: Prime commercial street address in Oakbrook Terrace, IL for corporate registration, state licensing, tax records, and Google Business Profile verification.
- **Packages**:
  | Service | Slug | Price | Billing Type |
  | :--- | :--- | :--- | :--- |
  | **Business Address** | `business-address-monthly` | **$25** | Per month |

---

### 6. Mailbox Rental (`virtual-mailbox`)
- **Description**: Secure, locked mailbox rental with professional mailing address. Receive, safeguard, and manage letters and commercial parcels with easy pickup or forwarding.
- **Packages**:
  | Service | Slug | Price | Duration |
  | :--- | :--- | :--- | :--- |
  | **Mailbox Rental** | `mailbox-rental-30-days` | **$35** | 30 days |

---

### 7. LLC Services (`llc-setup`)
- **Description**: Complete corporate entity formation and state compliance filing services for startups and established enterprises.
- **Mandatory Fee Disclosure Notice**:
  > *“The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.”*
- **Packages**:
  | Package Name | Slug | Price | Deliverables |
  | :--- | :--- | :--- | :--- |
  | **Basic Package** | `llc-basic-package` | **$200** | Articles of Organization, name availability search, initial formation documents. |
  | **Professional Package** | `llc-professional-package` | **$400** | Basic package plus custom Operating Agreement, banking resolution, compliance guide. |
  | **Premium Package** | `llc-premium-package` | **$699** | Complete enterprise formation, corporate binder, expedited compliance, priority filing. |
- **Applicable Add-ons**:
  | Add-on Name | Slug | Price | Billing Type | Notes |
  | :--- | :--- | :--- | :--- | :--- |
  | **EIN Registration** | `addon-llc-ein` | **$75** | One-time | Federal Employer ID filing |
  | **Registered Agent Service** | `addon-llc-registered-agent` | **$150** | Per year | **Flagged**: Conflicting mention of $120/yr flagged for admin review. |
  | **Business Address** | `addon-llc-business-address` | **$25** | Per month | Commercial street address |
  | **Virtual Office** | `addon-llc-virtual-office` | **$250** | Per month | Address + mail handling |
  | **Expedited Filing** | `addon-llc-expedited-filing` | **$75** | One-time | Priority state filing |
  | **Same-Day Filing** | `addon-llc-same-day-filing` | **$150** | One-time | Immediate turnaround |
  | **Business Banking Setup Consulting** | `addon-llc-banking-consulting` | **$99** | One-time | Account formation advisory |
  | **Business License Research** | `addon-llc-license-research` | **$125** | One-time | Municipal and state permits |
  | **Business Website Starter** | `addon-llc-website-starter` | **$499** | One-time | Launch landing page |
  | **Website Logo & Branding Starter** | `addon-llc-branding-starter` | **$199** | One-time | Brand identity assets |
  | **Mailbox** | `addon-llc-mailbox` | **$35** | Per month | Physical mail receipt |

---

### 8. Photo Studio (`photo-studio`)
- **Description**: Professional photography studio with cyclorama wall, interchangeable backdrops, continuous daylight lighting kits, hair/makeup dressing area, and gear rentals.
- **Packages**:
  | Package Name | Slug | Price | Duration | Billing Type |
  | :--- | :--- | :--- | :--- | :--- |
  | **Hourly Booking** | `photo-studio-hourly` | **$12** | Per hour (1–24h) | Per hour |
  | **Half-Day Booking** | `photo-studio-half-day` | **$40** | 4 hours | One-time |
  | **Full-Day Booking** | `photo-studio-full-day` | **$75** | 8 hours | One-time |
  | **Monthly Creator Calendar** | `photo-studio-monthly-creator`| **$250** | 30 days (25 studio hours)| 30 days |
- **Applicable Add-ons**:
  | Add-on Name | Slug | Price | Billing Type |
  | :--- | :--- | :--- | :--- |
  | **Professional Photographer** | `addon-photo-photographer` | **$30** | Per session |
  | **Professional Videographer** | `addon-photo-videographer` | **$75** | Per session |
  | **Extra Lighting Setup** | `addon-photo-extra-lighting` | **$12** | Per setup |
  | **Makeup Room** | `addon-photo-makeup-room` | **$12** | Per booking |
  | **Equipment Rental** | `addon-photo-equipment-rental` | **$8** | Per item |

---

### 9. Meeting Rooms (`meeting-rooms`)
- **Description**: Executive boardrooms and distraction-free huddle rooms equipped with 4K presentation screens, video conferencing hardware, whiteboards, and high-speed WiFi.
- **Room Types & Packages**:
  | Room Type | Slug | Price | Duration | Capacity |
  | :--- | :--- | :--- | :--- | :--- |
  | **Huddle Room** | `room-huddle` | **$25** | 1 hour (1–24h) | Up to 4 people |
  | **Collaboration Room** | `room-collaboration` | **$35** | 1 hour (1–24h) | Up to 4 people |
  | **Conference Room** | `room-conference` | **$50** | 1 hour (1–24h) | Up to 6 people |
  | **Board Room** | `room-board` | **$70** | 1 hour (1–24h) | 10–12 people |
- **Applicable Add-ons**:
  | Add-on Name | Slug | Price | Billing Type |
  | :--- | :--- | :--- | :--- |
  | **30-Day Co-Working Space** | `addon-room-coworking-30d` | **$30** | 30 days |
  | **Business Address** | `addon-room-business-address` | **$25** | Per month |

---

### 10. Event Space (`events`)
- **Description**: Presentation-ready venue for corporate mixers, summits, panels, and networking events for up to 50 guests with modular seating and catering kitchen access.
- **Status**: Configurable in Admin Panel (*Flagged for admin pricing & package setup*).

---

### 11. Workshops (`workshops`)
- **Description**: Classroom layouts, projection screens, and breakout areas designed for structured corporate training, masterclasses, and executive seminars.
- **Status**: Configurable in Admin Panel (*Flagged for admin pricing & package setup*).

---

### 12. Webinars (`webinars`)
- **Description**: Multi-camera digital broadcast suites with video switching gear, studio lighting, teleprompter, and live multistream support.
- **Status**: Configurable in Admin Panel (*Flagged for admin pricing & package setup*).

---

### 13. Memberships (`memberships`)
- **Description**: Ongoing recurring community membership offering access to private networking circles, digital growth libraries, and collaborative partner benefits.
- **Status**: Monthly & Yearly recurring subscription tiers with mandatory Industry Circle selection (*Flagged for admin review & custom tier configuration*).

---

## 2. REUSABLE MONTHLY ADD-ONS ACROSS THE PLATFORM

These services can be dynamically attached by administrators to any compatible service or individual package:
| Service Add-on | Price | Billing Type / Duration |
| :--- | :--- | :--- |
| **Co-Working Space** | **$50** | Per month (30 days) |
| **Business Address** | **$25** | Per month |
| **Mailbox** | **$35** | Per month |
| **Virtual Office** | **$250** | Per month |
| **Dedicated Desk** | **$350** | Per month |

---

## 3. SUPPORTED BILLING TYPES (OUT OF THE BOX)
1. `one_time`: Single payment upon checkout
2. `per_hour`: Multiplied by duration hours selected (e.g. Meeting Rooms, Photo Studio)
3. `per_day`: Multiplied by daily booking span
4. `per_month`: Standard recurring 30-day billing
5. `per_year`: Annual recurring subscription
6. `per_session`: Charged per booking session
7. `per_item`: Multiplied by equipment/unit quantity
8. `per_setup`: Single fee for technical or studio preparation
9. `per_booking`: Flat surcharge applied once per appointment
10. `per_podcast`: Media fee per podcast episode recorded
11. `per_clip`: Media fee per highlight clip extracted
12. `custom`: Admin-defined duration and billing interval

---

## 4. CONFLICT & ADMIN ATTENTION REGISTER
1. **LLC Registered Agent Service**: Current table specifies **$150/year**, whereas secondary documentation notes **$120/year**. Initialized at **$150/year** and flagged in the admin panel for explicit administrator confirmation.
2. **Premium Video Podcast Studio Capacity**: Kept unconstrained without artificial guessing; flagged for admin capacity input.
3. **Event Space, Workshops, Webinars, Memberships**: Core packages flagged for admin tier and rate completion.
