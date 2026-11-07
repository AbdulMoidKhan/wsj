/**
 * Seeds the dynamic service catalog with the authoritative values from
 * MASTER_SERVICE_PRICING_SPECIFICATION.md: 13 services, their packages, the
 * reusable add-on library, amenities and every assignment between them.
 *
 * Idempotent. Everything is keyed by slug and upserted, so running it again
 * repairs drift without creating duplicates and without touching orders,
 * subscriptions or any other financial record.
 *
 *   npm run db:seed:catalog
 */
import {PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

const dollars = (value: number) => Math.round(value * 100);

const COWORKING_RULE = 'All packages are valid for 30 days. Unused days expire at the end of the monthly validity period and do not roll over.';
const LLC_NOTICE = 'The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.';

type Flow = 'STANDARD' | 'NO_EXTRAS' | 'MEMBERSHIP' | 'CUSTOM';
type Unit =
  | 'ONE_TIME'
  | 'PER_HOUR'
  | 'PER_DAY'
  | 'PER_MONTH'
  | 'PER_YEAR'
  | 'PER_SESSION'
  | 'PER_ITEM'
  | 'PER_SETUP'
  | 'PER_BOOKING'
  | 'PER_PODCAST'
  | 'PER_CLIP'
  | 'CUSTOM';

interface PlanSeed {
  slug: string;
  name: string;
  description: string;
  price: number;
  billingUnit: Unit;
  durationMinutes?: number;
  durationDays?: number;
  minQuantity?: number;
  maxQuantity?: number;
  capacityText?: string;
  capacityMin?: number;
  capacityMax?: number;
  featured?: boolean;
  sortOrder?: number;
  rulesNotice?: string;
  governmentNotice?: string;
  adminFlagNote?: string;
  includedCredits?: Array<{kind: 'COWORKING_DAY'; amount?: number; unlimited?: boolean; resetInterval: 'MONTH'}>;
  amenities?: string[];
  addOns?: Array<{slug: string; priceOverride?: number; isRequired?: boolean}>;
}

interface ServiceSeed {
  slug: string;
  name: string;
  description: string;
  categoryBadge?: string;
  iconName: string;
  flowType: Flow;
  displayOrder: number;
  metadata?: Record<string, unknown>;
  amenities?: string[];
  addOns?: Array<{slug: string; priceOverride?: number; isRequired?: boolean}>;
  plans: PlanSeed[];
}

/* ── Amenities library ── */
const AMENITIES: Array<{slug: string; name: string; description?: string; iconName: string}> = [
  {slug: 'high-speed-wifi', name: 'High-Speed WiFi', description: 'Business-grade fibre across the whole building.', iconName: 'Wifi'},
  {slug: 'sit-stand-desks', name: 'Sit / Stand Desks', description: 'Height-adjustable desks at every workstation.', iconName: 'Monitor'},
  {slug: 'printer-scanner', name: 'Printer & Scanner', description: 'Print, scan and copy from any member device.', iconName: 'Printer'},
  {slug: 'wellness-room', name: 'Wellness Room', description: 'Quiet room for breaks, calls and recovery.', iconName: 'HeartPulse'},
  {slug: 'huddle-room-access', name: 'Huddle Room Access', description: 'Drop-in rooms for short calls and stand-ups.', iconName: 'DoorOpen'},
  {slug: 'complimentary-refreshments', name: 'Complimentary Refreshments', description: 'Coffee, tea and filtered water included.', iconName: 'Coffee'},
  {slug: 'partner-discounts', name: 'Partner Discounts', description: 'Member rates with our local business partners.', iconName: 'Ticket'},
  {slug: 'builders-library', name: 'Builders Library', description: 'Curated business and growth resource library.', iconName: 'BookOpen'},
  {slug: 'keycard-access-247', name: '24/7 Keycard Access', description: 'Secure entry at any hour, every day.', iconName: 'Lock'},
  {slug: 'lockable-storage', name: 'Personal Lockable Storage', description: 'Private storage for your equipment.', iconName: 'Archive'},
  {slug: 'ergonomic-seating', name: 'Ergonomic Task Seating', description: 'Professional task chairs at every desk.', iconName: 'Armchair'},
  {slug: 'conference-room-credits', name: 'Conference Room Credits', description: 'Included hours in our bookable rooms.', iconName: 'CalendarDays'},
  {slug: 'presentation-screen', name: '4K Presentation Screen', description: 'Wireless screen sharing in every room.', iconName: 'MonitorPlay'},
  {slug: 'video-conferencing', name: 'Video Conferencing Hardware', description: 'Room-grade camera, mic and speaker system.', iconName: 'Video'},
  {slug: 'whiteboard', name: 'Whiteboard', description: 'Full-wall writable surfaces.', iconName: 'PenLine'},
  {slug: 'cyclorama-wall', name: 'Cyclorama Wall', description: 'Seamless infinity wall for photo and video.', iconName: 'Frame'},
  {slug: 'studio-lighting', name: 'Studio Lighting Kit', description: 'Continuous daylight-balanced lighting.', iconName: 'Lightbulb'},
  {slug: 'makeup-area', name: 'Hair & Makeup Area', description: 'Dressing area with mirrors and lighting.', iconName: 'Sparkles'},
  {slug: 'shure-microphones', name: 'Shure Microphones', description: 'Broadcast microphones on every seat.', iconName: 'Mic'},
  {slug: 'multi-angle-cameras', name: 'Multi-Angle 4K Cameras', description: 'Multi-camera capture with switching.', iconName: 'Camera'},
  {slug: 'mail-handling', name: 'Secure Mail Handling', description: 'Receipt, notification and safe storage of mail.', iconName: 'Mail'},
  {slug: 'commercial-address', name: 'Commercial Street Address', description: 'Registerable Oakbrook Terrace business address.', iconName: 'Building2'},
  {slug: 'catering-kitchen', name: 'Catering Kitchen Access', description: 'Prep kitchen for catered events.', iconName: 'Utensils'},
  {slug: 'modular-seating', name: 'Modular Event Seating', description: 'Reconfigurable layouts for any format.', iconName: 'LayoutGrid'},
  {slug: 'teleprompter', name: 'Teleprompter', description: 'On-camera script prompting.', iconName: 'ScrollText'},
  {slug: 'live-multistream', name: 'Live Multistream Support', description: 'Simultaneous broadcast to multiple platforms.', iconName: 'Radio'},
];

/* ── Reusable add-on library ──
   Created once and attached to many services, with per-service or per-package
   price overrides where the commercial terms differ. */
const ADDONS: Array<{slug: string; name: string; description: string; price: number; billingUnit: Unit; minQuantity?: number; maxQuantity?: number; defaultQuantity?: number; adminFlagNote?: string}> = [
  /* Global monthly library */
  {slug: 'addon-coworking-space', name: 'Co-Working Space', description: 'Flexible shared workspace access, valid 30 days.', price: 50, billingUnit: 'PER_MONTH'},
  {slug: 'addon-business-address', name: 'Business Address', description: 'Commercial street address for registration and licensing.', price: 25, billingUnit: 'PER_MONTH'},
  {slug: 'addon-mailbox', name: 'Mailbox', description: 'Locked mailbox with professional mailing address.', price: 35, billingUnit: 'PER_MONTH'},
  {slug: 'addon-virtual-office', name: 'Virtual Office', description: 'Business address with mail handling and room access.', price: 250, billingUnit: 'PER_MONTH'},
  {slug: 'addon-dedicated-desk', name: 'Dedicated Desk', description: 'Your own permanent workstation with 24/7 access.', price: 350, billingUnit: 'PER_MONTH'},
  /* Podcast studio */
  {slug: 'addon-podcast-editing', name: 'Podcast Editing', description: 'Full episode edit, mix and master.', price: 75, billingUnit: 'PER_PODCAST', maxQuantity: 20},
  {slug: 'addon-podcast-social-clips', name: 'Social Media Clips', description: 'Short vertical highlight clips cut from your episode.', price: 40, billingUnit: 'PER_CLIP', maxQuantity: 30},
  {slug: 'addon-podcast-full-video-editing', name: 'Full Video Editing', description: 'Multi-camera video edit with graphics.', price: 150, billingUnit: 'ONE_TIME'},
  {slug: 'addon-podcast-intro-outro', name: 'Intro & Outro Creation', description: 'Branded intro and outro production.', price: 80, billingUnit: 'ONE_TIME'},
  {slug: 'addon-podcast-extra-camera', name: 'Extra Camera', description: 'Additional 4K camera angle.', price: 40, billingUnit: 'ONE_TIME', maxQuantity: 4},
  {slug: 'addon-podcast-additional-hour', name: 'Additional Hour', description: 'Extend your studio session.', price: 70, billingUnit: 'PER_HOUR', maxQuantity: 12},
  /* Photo studio */
  {slug: 'addon-photo-photographer', name: 'Professional Photographer', description: 'Experienced studio photographer for your shoot.', price: 30, billingUnit: 'PER_SESSION', maxQuantity: 5},
  {slug: 'addon-photo-videographer', name: 'Professional Videographer', description: 'Videographer with studio camera package.', price: 75, billingUnit: 'PER_SESSION', maxQuantity: 5},
  {slug: 'addon-photo-extra-lighting', name: 'Extra Lighting Setup', description: 'Additional lighting configuration staged for you.', price: 12, billingUnit: 'PER_SETUP', maxQuantity: 10},
  {slug: 'addon-photo-makeup-room', name: 'Makeup Room', description: 'Private hair and makeup room for your booking.', price: 12, billingUnit: 'PER_BOOKING'},
  {slug: 'addon-photo-equipment-rental', name: 'Equipment Rental', description: 'Lenses, tripods, modifiers and grip, per item.', price: 8, billingUnit: 'PER_ITEM', maxQuantity: 20},
  /* LLC services */
  {slug: 'addon-llc-ein', name: 'EIN Registration', description: 'Federal Employer Identification Number filing.', price: 75, billingUnit: 'ONE_TIME'},
  {
    slug: 'addon-llc-registered-agent',
    name: 'Registered Agent Service',
    description: 'Statutory registered agent for service of process.',
    price: 150,
    billingUnit: 'PER_YEAR',
    adminFlagNote: 'Registered Agent Service is configured at $150/year. Historical notes mention a conflicting $120/year figure. Confirm or adjust the rate.',
  },
  {slug: 'addon-llc-expedited-filing', name: 'Expedited Filing', description: 'Priority handling with the state.', price: 75, billingUnit: 'ONE_TIME'},
  {slug: 'addon-llc-same-day-filing', name: 'Same-Day Filing', description: 'Immediate same-business-day submission.', price: 150, billingUnit: 'ONE_TIME'},
  {slug: 'addon-llc-banking-consulting', name: 'Business Banking Setup Consulting', description: 'Advisory session on opening your business account.', price: 99, billingUnit: 'ONE_TIME'},
  {slug: 'addon-llc-license-research', name: 'Business License Research', description: 'Municipal and state permit research for your activity.', price: 125, billingUnit: 'ONE_TIME'},
  {slug: 'addon-llc-website-starter', name: 'Business Website Starter', description: 'Launch-ready landing page for your new entity.', price: 499, billingUnit: 'ONE_TIME'},
  {slug: 'addon-llc-branding-starter', name: 'Website Logo & Branding Starter', description: 'Logo and core brand identity assets.', price: 199, billingUnit: 'ONE_TIME'},
];

const WORKSPACE_AMENITIES = ['high-speed-wifi', 'sit-stand-desks', 'printer-scanner', 'wellness-room', 'huddle-room-access', 'complimentary-refreshments', 'partner-discounts', 'builders-library'];
const MONTHLY_LIBRARY = ['addon-business-address', 'addon-mailbox', 'addon-virtual-office'];

const SERVICES: ServiceSeed[] = [
  {
    slug: 'coworking',
    name: 'Co-Working',
    description:
      'Flexible shared workspace access with sit/stand desks, high-speed WiFi, printer and scanner access, wellness room, huddle room privileges, complimentary refreshments, partner discounts and builders library access.',
    categoryBadge: 'Most popular',
    iconName: 'Globe2',
    flowType: 'STANDARD',
    displayOrder: 1,
    amenities: WORKSPACE_AMENITIES,
    addOns: MONTHLY_LIBRARY.map(slug => ({slug})),
    plans: [
      {slug: 'coworking-bronze', name: 'Bronze', description: '1 day of coworking access per month. Valid for 30 days.', includedCredits: [{kind: 'COWORKING_DAY', amount: 1, resetInterval: 'MONTH'}], price: 50, billingUnit: 'PER_MONTH', durationDays: 30, rulesNotice: COWORKING_RULE, sortOrder: 1},
      {slug: 'coworking-silver', name: 'Silver', description: '5 days of coworking access per month. Valid for 30 days.', includedCredits: [{kind: 'COWORKING_DAY', amount: 5, resetInterval: 'MONTH'}], price: 100, billingUnit: 'PER_MONTH', durationDays: 30, rulesNotice: COWORKING_RULE, sortOrder: 2},
      {slug: 'coworking-gold', name: 'Gold', description: '10 days of coworking access per month. Valid for 30 days.', includedCredits: [{kind: 'COWORKING_DAY', amount: 10, resetInterval: 'MONTH'}], price: 150, billingUnit: 'PER_MONTH', durationDays: 30, rulesNotice: COWORKING_RULE, featured: true, sortOrder: 3},
      {
        slug: 'coworking-platinum',
        name: 'Platinum',
        description: 'Full month of coworking access on all available working days. Valid for 30 days.',
        includedCredits: [{kind: 'COWORKING_DAY', unlimited: true, resetInterval: 'MONTH'}],
        price: 250,
        billingUnit: 'PER_MONTH',
        durationDays: 30,
        rulesNotice: COWORKING_RULE,
        sortOrder: 4,
      },
    ],
  },
  {
    slug: 'podcast-studio',
    name: 'Podcast Studio',
    description:
      'State-of-the-art acoustic recording and broadcasting studios equipped with Shure microphones, multi-angle 4K cameras, professional audio interfaces and studio lighting.',
    iconName: 'Mic',
    flowType: 'STANDARD',
    displayOrder: 2,
    amenities: ['shure-microphones', 'multi-angle-cameras', 'studio-lighting', 'high-speed-wifi', 'complimentary-refreshments'],
    addOns: [
      {slug: 'addon-podcast-editing'},
      {slug: 'addon-podcast-social-clips'},
      {slug: 'addon-podcast-full-video-editing'},
      {slug: 'addon-podcast-intro-outro'},
      {slug: 'addon-podcast-extra-camera'},
      {slug: 'addon-podcast-additional-hour'},
    ],
    plans: [
      {slug: 'podcast-solo-starter', name: 'Solo Creator Studio', description: 'Starter podcast session for solo creators and short-form recordings.', price: 75, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: '1–2 people', capacityMin: 1, capacityMax: 2, sortOrder: 1},
      {slug: 'podcast-interview-starter', name: 'Interview Studio', description: 'Starter podcast session set up for host and guest interviews.', price: 95, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: '2–3 people', capacityMin: 2, capacityMax: 3, sortOrder: 2},
      {slug: 'podcast-panel-starter', name: 'Panel Podcast Studio', description: 'Starter podcast session for panel and roundtable formats.', price: 120, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: 'Up to 4 people', capacityMin: 1, capacityMax: 4, featured: true, sortOrder: 3},
      {
        slug: 'podcast-premium-starter',
        name: 'Premium Video Podcast Studio',
        description: 'Starter podcast session in our flagship multi-camera video studio.',
        price: 150,
        billingUnit: 'PER_HOUR',
        maxQuantity: 24,
        durationMinutes: 60,
        adminFlagNote: 'Studio capacity was never documented and is intentionally left unconstrained. Set the guest capacity before promoting this package.',
        sortOrder: 4,
      },
    ],
  },
  {
    slug: 'dedicated',
    name: 'Dedicated Desk',
    description:
      'Dedicated personal workstations in an executive shared environment with 24/7 keycard access, ergonomic task seating, personal lockable storage and conference room booking credits.',
    iconName: 'Monitor',
    flowType: 'STANDARD',
    displayOrder: 3,
    amenities: ['keycard-access-247', 'ergonomic-seating', 'lockable-storage', 'conference-room-credits', 'high-speed-wifi'],
    addOns: [{slug: 'addon-coworking-space'}, {slug: 'addon-business-address'}, {slug: 'addon-mailbox'}],
    plans: [
      {slug: 'dedicated-desk-classic', name: 'Classic Dedicated Desk', description: 'Fixed workstation, ergonomic chair, business WiFi and 24/7 access.', price: 350, billingUnit: 'PER_MONTH', durationDays: 30, sortOrder: 1},
      {slug: 'dedicated-desk-performance', name: 'Performance Dedicated Desk', description: '27-inch LCD monitor, sit/stand desk controls, focus pod access and boardroom credits.', price: 375, billingUnit: 'PER_MONTH', durationDays: 30, featured: true, sortOrder: 2},
    ],
  },
  {
    slug: 'virtual-office',
    name: 'Virtual Office',
    description:
      'Professional commercial business identity, physical address registration in Oakbrook Terrace, secure mail handling and optional physical workspace credits.',
    iconName: 'Mail',
    flowType: 'STANDARD',
    displayOrder: 4,
    amenities: ['commercial-address', 'mail-handling', 'conference-room-credits'],
    addOns: [{slug: 'addon-coworking-space'}, {slug: 'addon-business-address'}, {slug: 'addon-mailbox'}],
    plans: [
      {slug: 'virtual-office-standard', name: 'Virtual Office', description: 'Commercial address, mail receipt and notifications, meeting room access.', price: 250, billingUnit: 'PER_MONTH', durationDays: 30, sortOrder: 1},
      {slug: 'virtual-office-plus', name: 'Virtual Office Plus', description: 'Standard virtual office plus bundled coworking desk and room credits.', price: 275, billingUnit: 'PER_MONTH', durationDays: 30, featured: true, sortOrder: 2},
    ],
  },
  {
    slug: 'business-address',
    name: 'Business Address',
    description:
      'Prime commercial street address in Oakbrook Terrace, IL for corporate registration, state licensing, tax records and Google Business Profile verification.',
    iconName: 'Building2',
    flowType: 'NO_EXTRAS',
    displayOrder: 5,
    amenities: ['commercial-address', 'mail-handling'],
    plans: [{slug: 'business-address-monthly', name: 'Business Address', description: 'Registerable commercial street address, billed monthly.', price: 25, billingUnit: 'PER_MONTH', sortOrder: 1}],
  },
  {
    slug: 'virtual-mailbox',
    name: 'Mailbox Rental',
    description:
      'Secure, locked mailbox rental with a professional mailing address. Receive, safeguard and manage letters and commercial parcels with easy pickup or forwarding.',
    iconName: 'Package',
    flowType: 'NO_EXTRAS',
    displayOrder: 6,
    amenities: ['mail-handling', 'commercial-address'],
    plans: [{slug: 'mailbox-rental-30-days', name: 'Mailbox Rental', description: 'Locked mailbox with professional mailing address. Valid for 30 days.', price: 35, billingUnit: 'PER_MONTH', durationDays: 30, sortOrder: 1}],
  },
  {
    slug: 'llc-setup',
    name: 'LLC Services',
    description: 'Complete corporate entity formation and state compliance filing services for startups and established enterprises.',
    categoryBadge: 'Formation',
    iconName: 'Briefcase',
    flowType: 'STANDARD',
    displayOrder: 7,
    addOns: [
      {slug: 'addon-llc-ein'},
      {slug: 'addon-llc-registered-agent'},
      {slug: 'addon-business-address'},
      {slug: 'addon-virtual-office'},
      {slug: 'addon-llc-expedited-filing'},
      {slug: 'addon-llc-same-day-filing'},
      {slug: 'addon-llc-banking-consulting'},
      {slug: 'addon-llc-license-research'},
      {slug: 'addon-llc-website-starter'},
      {slug: 'addon-llc-branding-starter'},
      {slug: 'addon-mailbox'},
    ],
    plans: [
      {slug: 'llc-basic-package', name: 'Basic Package', description: 'Articles of Organization, name availability search and initial formation documents.', price: 200, billingUnit: 'ONE_TIME', governmentNotice: LLC_NOTICE, sortOrder: 1},
      {slug: 'llc-professional-package', name: 'Professional Package', description: 'Basic package plus custom Operating Agreement, banking resolution and compliance guide.', price: 400, billingUnit: 'ONE_TIME', governmentNotice: LLC_NOTICE, featured: true, sortOrder: 2},
      {slug: 'llc-premium-package', name: 'Premium Package', description: 'Complete enterprise formation, corporate binder, expedited compliance and priority filing.', price: 699, billingUnit: 'ONE_TIME', governmentNotice: LLC_NOTICE, sortOrder: 3},
    ],
  },
  {
    slug: 'photo-studio',
    name: 'Photo Studio',
    description:
      'Professional photography studio with cyclorama wall, interchangeable backdrops, continuous daylight lighting kits, hair and makeup dressing area and gear rentals.',
    iconName: 'Store',
    flowType: 'STANDARD',
    displayOrder: 8,
    amenities: ['cyclorama-wall', 'studio-lighting', 'makeup-area', 'high-speed-wifi'],
    addOns: [{slug: 'addon-photo-photographer'}, {slug: 'addon-photo-videographer'}, {slug: 'addon-photo-extra-lighting'}, {slug: 'addon-photo-makeup-room'}, {slug: 'addon-photo-equipment-rental'}],
    plans: [
      {slug: 'photo-studio-hourly', name: 'Hourly Booking', description: 'Studio time by the hour with lighting and backdrops included.', price: 12, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, sortOrder: 1},
      {slug: 'photo-studio-half-day', name: 'Half-Day Booking', description: 'Four continuous hours of studio time.', price: 40, billingUnit: 'ONE_TIME', durationMinutes: 240, sortOrder: 2},
      {slug: 'photo-studio-full-day', name: 'Full-Day Booking', description: 'Eight continuous hours of studio time.', price: 75, billingUnit: 'ONE_TIME', durationMinutes: 480, featured: true, sortOrder: 3},
      {slug: 'photo-studio-monthly-creator', name: 'Monthly Creator Calendar', description: '25 studio hours every month for recurring content production.', price: 250, billingUnit: 'PER_MONTH', durationDays: 30, sortOrder: 4},
    ],
  },
  {
    slug: 'meeting-rooms',
    name: 'Meeting Rooms',
    description:
      'Executive boardrooms and distraction-free huddle rooms equipped with 4K presentation screens, video conferencing hardware, whiteboards and high-speed WiFi.',
    iconName: 'DoorOpen',
    flowType: 'STANDARD',
    displayOrder: 9,
    amenities: ['presentation-screen', 'video-conferencing', 'whiteboard', 'high-speed-wifi', 'complimentary-refreshments'],
    /* The same coworking add-on, sold here as a $30 30-day pass via an override. */
    addOns: [{slug: 'addon-coworking-space', priceOverride: 30}, {slug: 'addon-business-address'}],
    plans: [
      {slug: 'room-huddle', name: 'Huddle Room', description: 'Compact room for focused conversations and calls.', price: 25, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: 'Up to 4 people', capacityMax: 4, sortOrder: 1},
      {slug: 'room-collaboration', name: 'Collaboration Room', description: 'Writable walls and screen sharing for working sessions.', price: 35, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: 'Up to 4 people', capacityMax: 4, sortOrder: 2},
      {slug: 'room-conference', name: 'Conference Room', description: 'Formal conference table with video conferencing hardware.', price: 50, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: 'Up to 6 people', capacityMax: 6, featured: true, sortOrder: 3},
      {slug: 'room-board', name: 'Board Room', description: 'Executive boardroom for leadership and client meetings.', price: 70, billingUnit: 'PER_HOUR', maxQuantity: 24, durationMinutes: 60, capacityText: '10–12 people', capacityMin: 10, capacityMax: 12, sortOrder: 4},
    ],
  },
  {
    slug: 'events',
    name: 'Event Space',
    description:
      'Presentation-ready venue for corporate mixers, summits, panels and networking events for up to 50 guests with modular seating and catering kitchen access.',
    iconName: 'PartyPopper',
    flowType: 'STANDARD',
    displayOrder: 10,
    metadata: {adminReview: 'Tier names and rates are pending administrator configuration. Add packages in Admin → Packages & Pricing.'},
    amenities: ['modular-seating', 'catering-kitchen', 'presentation-screen', 'high-speed-wifi'],
    addOns: [{slug: 'addon-photo-photographer'}, {slug: 'addon-photo-videographer'}],
    plans: [],
  },
  {
    slug: 'workshops',
    name: 'Workshops',
    description: 'Classroom layouts, projection screens and breakout areas designed for structured corporate training, masterclasses and executive seminars.',
    iconName: 'Wrench',
    flowType: 'STANDARD',
    displayOrder: 11,
    metadata: {adminReview: 'Tier names and rates are pending administrator configuration. Add packages in Admin → Packages & Pricing.'},
    amenities: ['presentation-screen', 'whiteboard', 'modular-seating', 'complimentary-refreshments'],
    plans: [],
  },
  {
    slug: 'webinars',
    name: 'Webinars',
    description: 'Multi-camera digital broadcast suites with video switching gear, studio lighting, teleprompter and live multistream support.',
    iconName: 'Radio',
    flowType: 'STANDARD',
    displayOrder: 12,
    metadata: {adminReview: 'Tier names and rates are pending administrator configuration. Add packages in Admin → Packages & Pricing.'},
    amenities: ['multi-angle-cameras', 'studio-lighting', 'teleprompter', 'live-multistream'],
    addOns: [{slug: 'addon-podcast-full-video-editing'}, {slug: 'addon-podcast-social-clips'}],
    plans: [],
  },
  {
    slug: 'memberships',
    name: 'Memberships',
    description:
      'Ongoing recurring community membership offering access to private networking circles, digital growth libraries and collaborative partner benefits.',
    categoryBadge: 'Community',
    iconName: 'Handshake',
    flowType: 'MEMBERSHIP',
    displayOrder: 13,
    metadata: {
      requiresCircle: true,
      adminReview: 'Monthly and yearly tier rates are pending administrator configuration.',
      circles: [
        'Community Circles',
        'Founder Circle',
        'Healthcare Entrepreneurs Circle',
        'Finance & Investment Circle',
        'Legal Professionals Circle',
        'Restaurant & Catering Owners Circle',
        'Tech Innovators Circle',
        'Marketing Leaders Circle',
      ],
    },
    amenities: ['partner-discounts', 'builders-library', 'complimentary-refreshments'],
    plans: [],
  },
];

async function main() {
  console.log('Seeding dynamic service catalog…');

  /* 1. Amenities library */
  const amenityIds = new Map<string, string>();
  for (const amenity of AMENITIES) {
    const row = await prisma.catalogAmenity.upsert({
      where: {slug: amenity.slug},
      update: {name: amenity.name, description: amenity.description ?? '', iconName: amenity.iconName, active: true},
      create: {slug: amenity.slug, name: amenity.name, description: amenity.description ?? '', iconName: amenity.iconName},
    });
    amenityIds.set(amenity.slug, row.id);
  }
  console.log('  amenities: ' + amenityIds.size);

  /* 2. Reusable add-on library */
  const addOnIds = new Map<string, string>();
  for (const addOn of ADDONS) {
    const data = {
      name: addOn.name,
      description: addOn.description,
      unitAmountCents: dollars(addOn.price),
      billingUnit: addOn.billingUnit as never,
      minQuantity: addOn.minQuantity ?? 0,
      maxQuantity: addOn.maxQuantity ?? 1,
      defaultQuantity: addOn.defaultQuantity ?? 1,
      adminFlagNote: addOn.adminFlagNote ?? null,
      active: true,
      archivedAt: null,
    };
    const row = await prisma.catalogAddOn.upsert({where: {slug: addOn.slug}, update: data, create: {slug: addOn.slug, ...data}});
    addOnIds.set(addOn.slug, row.id);
  }
  console.log('  add-ons: ' + addOnIds.size);

  /* 3. Services, their packages and every assignment */
  let planCount = 0;
  for (const service of SERVICES) {
    const serviceData = {
      name: service.name,
      description: service.description,
      categoryBadge: service.categoryBadge ?? null,
      iconName: service.iconName,
      displayOrder: service.displayOrder,
      flowType: service.flowType as never,
      metadata: (service.metadata ?? {}) as never,
      active: true,
      archivedAt: null,
    };
    const row = await prisma.serviceCategory.upsert({where: {slug: service.slug}, update: serviceData, create: {slug: service.slug, ...serviceData}});

    for (const [index, slug] of (service.amenities ?? []).entries()) {
      const amenityId = amenityIds.get(slug);
      if (!amenityId) throw new Error('Unknown amenity in seed: ' + slug);
      await prisma.serviceAmenity.upsert({
        where: {serviceId_amenityId: {serviceId: row.id, amenityId}},
        update: {sortOrder: index},
        create: {serviceId: row.id, amenityId, sortOrder: index},
      });
    }

    for (const [index, link] of (service.addOns ?? []).entries()) {
      const addOnId = addOnIds.get(link.slug);
      if (!addOnId) throw new Error('Unknown add-on in seed: ' + link.slug);
      const assignment = {priceOverrideCents: link.priceOverride === undefined ? null : dollars(link.priceOverride), isRequired: link.isRequired ?? false, sortOrder: index};
      await prisma.serviceAddOn.upsert({
        where: {serviceId_addOnId: {serviceId: row.id, addOnId}},
        update: assignment,
        create: {serviceId: row.id, addOnId, ...assignment},
      });
    }

    for (const plan of service.plans) {
      const previous = plan.includedCredits ? await prisma.catalogPlan.findUnique({where: {slug: plan.slug}, select: {metadata: true}}) : null;
      const previousMetadata = previous?.metadata && typeof previous.metadata === 'object' && !Array.isArray(previous.metadata) ? previous.metadata : {};
      const planData = {
        serviceId: row.id,
        name: plan.name,
        description: plan.description,
        unitAmountCents: dollars(plan.price),
        billingUnit: plan.billingUnit as never,
        durationMinutes: plan.durationMinutes ?? null,
        durationDays: plan.durationDays ?? null,
        minQuantity: plan.minQuantity ?? 1,
        maxQuantity: plan.maxQuantity ?? 1,
        capacityText: plan.capacityText ?? null,
        capacityMin: plan.capacityMin ?? null,
        capacityMax: plan.capacityMax ?? null,
        featured: plan.featured ?? false,
        sortOrder: plan.sortOrder ?? 0,
        rulesNotice: plan.rulesNotice ?? null,
        governmentNotice: plan.governmentNotice ?? null,
        adminFlagNote: plan.adminFlagNote ?? null,
        ...(plan.includedCredits ? {metadata: {...previousMetadata, includedCredits: plan.includedCredits} as never} : {}),
        active: true,
        archivedAt: null,
      };
      const planRow = await prisma.catalogPlan.upsert({where: {slug: plan.slug}, update: planData, create: {slug: plan.slug, ...planData}});
      planCount += 1;

      for (const [index, slug] of (plan.amenities ?? []).entries()) {
        const amenityId = amenityIds.get(slug);
        if (!amenityId) throw new Error('Unknown amenity in seed: ' + slug);
        await prisma.planAmenity.upsert({where: {planId_amenityId: {planId: planRow.id, amenityId}}, update: {sortOrder: index}, create: {planId: planRow.id, amenityId, sortOrder: index}});
      }
      for (const [index, link] of (plan.addOns ?? []).entries()) {
        const addOnId = addOnIds.get(link.slug);
        if (!addOnId) throw new Error('Unknown add-on in seed: ' + link.slug);
        const assignment = {priceOverrideCents: link.priceOverride === undefined ? null : dollars(link.priceOverride), isRequired: link.isRequired ?? false, sortOrder: index};
        await prisma.planAddOn.upsert({where: {planId_addOnId: {planId: planRow.id, addOnId}}, update: assignment, create: {planId: planRow.id, addOnId, ...assignment}});
      }
    }
    console.log('  ' + service.slug + ': ' + service.plans.length + ' package(s)');
  }

  console.log('Done. ' + SERVICES.length + ' services, ' + planCount + ' packages, ' + addOnIds.size + ' add-ons, ' + amenityIds.size + ' amenities.');
  console.log('Flagged for admin review: podcast-premium-starter capacity, addon-llc-registered-agent rate, and tiers for events / workshops / webinars / memberships.');
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
