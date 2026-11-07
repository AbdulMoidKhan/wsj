import { PrismaClient, BillingType, BillingInterval, PricingUnit } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master Service Packages and Add-ons...');

  const plans = [
    // 1. Coworking
    {
      slug: 'coworking-bronze',
      name: 'Bronze',
      serviceType: 'coworking',
      description: 'Single-day access to our professional coworking space in Oakbrook Terrace. Valid for 1 month (30 days). Unused days do not roll over.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 5000, // $50.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { includedAccess: '1 day per month', validityRule: 'Valid 1 month, no rollover', addOns: ['business-address', 'mailbox', 'virtual-office'] }
    },
    {
      slug: 'coworking-silver',
      name: 'Silver',
      serviceType: 'coworking',
      description: 'Five flexible coworking days per month for professionals. Valid for 1 month (30 days). Unused days do not roll over.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 10000, // $100.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { includedAccess: '5 days per month', validityRule: 'Valid 1 month, no rollover', addOns: ['business-address', 'mailbox', 'virtual-office'] }
    },
    {
      slug: 'coworking-gold',
      name: 'Gold',
      serviceType: 'coworking',
      description: 'Ten coworking days per month designed for entrepreneurs and hybrid teams. Valid for 1 month (30 days). Unused days do not roll over.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 15000, // $150.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { includedAccess: '10 days per month', validityRule: 'Valid 1 month, no rollover', addOns: ['business-address', 'mailbox', 'virtual-office'] }
    },
    {
      slug: 'coworking-platinum',
      name: 'Platinum',
      serviceType: 'coworking',
      description: 'Full month unlimited coworking access on all available working days. Valid for 1 month (30 days). Unused days do not roll over.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 25000, // $250.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { includedAccess: 'Full month (all working days)', validityRule: 'Valid 1 month, no rollover', addOns: ['business-address', 'mailbox', 'virtual-office'] }
    },

    // 2. Podcast Studio
    {
      slug: 'podcast-solo-starter',
      name: 'Solo Creator Studio — Starter Session',
      serviceType: 'podcast-studio',
      description: 'Perfect for solo podcasters, content creators, and short-form recordings. Capacity: 1–2 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 7500, // $75.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: '1–2 people', studioType: 'Solo Creator Studio', addOns: ['podcast-editing', 'social-clips', 'full-video-editing', 'intro-outro', 'extra-camera', 'additional-hour'] }
    },
    {
      slug: 'podcast-interview-starter',
      name: 'Interview Studio — Starter Session',
      serviceType: 'podcast-studio',
      description: 'Ideal for interview-style podcasts and two-host shows. Capacity: 2–3 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 9500, // $95.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: '2–3 people', studioType: 'Interview Studio', addOns: ['podcast-editing', 'social-clips', 'full-video-editing', 'intro-outro', 'extra-camera', 'additional-hour'] }
    },
    {
      slug: 'podcast-panel-starter',
      name: 'Panel Podcast Studio — Starter Session',
      serviceType: 'podcast-studio',
      description: 'Designed for multi-host podcasts and roundtables. Capacity: Up to 4 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 12000, // $120.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: 'Up to 4 people', studioType: 'Panel Podcast Studio', addOns: ['podcast-editing', 'social-clips', 'full-video-editing', 'intro-outro', 'extra-camera', 'additional-hour'] }
    },
    {
      slug: 'podcast-premium-starter',
      name: 'Premium Video Podcast Studio — Starter Session',
      serviceType: 'podcast-studio',
      description: 'Flagship studio for high-end video podcasts and professional broadcasts.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 15000, // $150.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacityNeedsReview: true, studioType: 'Premium Video Podcast Studio', addOns: ['podcast-editing', 'social-clips', 'full-video-editing', 'intro-outro', 'extra-camera', 'additional-hour'] }
    },

    // 3. Dedicated Desk
    {
      slug: 'dedicated-desk-performance',
      name: 'Performance Dedicated Desk',
      serviceType: 'dedicated',
      description: 'Fixed workstation with 24/7 access, 27-inch LCD monitor, sit/stand desk controls, focus pod access, and boardroom credits. Valid for 30 days.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 37500, // $375.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { duration: '30 days', access: '24/7', addOns: ['coworking-30d', 'business-address', 'mailbox'] }
    },
    {
      slug: 'dedicated-desk-classic',
      name: 'Classic Dedicated Desk',
      serviceType: 'dedicated',
      description: 'Fixed personal workstation in professional coworking environment with 24/7 access. Valid for 30 days.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 35000, // $350.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { duration: '30 days', access: '24/7', addOns: ['coworking-30d', 'business-address', 'mailbox'] }
    },

    // 4. Virtual Office
    {
      slug: 'virtual-office-plus',
      name: 'Virtual Office Plus',
      serviceType: 'virtual-office',
      description: 'Comprehensive business presence and mail handling plus occasional physical desk and room access. Valid for 30 days.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 27500, // $275.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { duration: '30 days', addOns: ['coworking-30d', 'business-address', 'mailbox'] }
    },
    {
      slug: 'virtual-office-standard',
      name: 'Virtual Office',
      serviceType: 'virtual-office',
      description: 'Professional commercial address, mail handling, and room access credits. Valid for 30 days.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 25000, // $250.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { duration: '30 days', addOns: ['coworking-30d', 'business-address', 'mailbox'] }
    },

    // 5. Business Address
    {
      slug: 'business-address-monthly',
      name: 'Business Address',
      serviceType: 'business-address',
      description: 'Commercial business address in Oakbrook Terrace for state business licensing, tax filings, and Google Business Profile.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 2500, // $25.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { billingType: 'Per month' }
    },

    // 6. Mailbox Rental
    {
      slug: 'mailbox-rental-30-days',
      name: 'Mailbox Rental',
      serviceType: 'virtual-mailbox',
      description: 'Secure mailbox rental with professional mailing address. Receive, safeguard, and manage letters and commercial parcels. Valid for 30 days.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 3500, // $35.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { duration: '30 days' }
    },

    // 7. LLC Services
    {
      slug: 'llc-basic-package',
      name: 'Basic Package',
      serviceType: 'llc-setup',
      description: 'Includes essential LLC setup to get your business off the ground. The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 20000, // $200.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: {
        governmentFeeNotice: 'The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.',
        addOns: ['ein-registration', 'registered-agent', 'business-address', 'virtual-office', 'expedited-filing', 'same-day-filing', 'banking-consulting', 'license-research', 'website-starter', 'branding-starter', 'mailbox']
      }
    },
    {
      slug: 'llc-professional-package',
      name: 'Professional Package',
      serviceType: 'llc-setup',
      description: 'Perfect for growing businesses needing extra support. The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 40000, // $400.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: {
        governmentFeeNotice: 'The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.',
        addOns: ['ein-registration', 'registered-agent', 'business-address', 'virtual-office', 'expedited-filing', 'same-day-filing', 'banking-consulting', 'license-research', 'website-starter', 'branding-starter', 'mailbox']
      }
    },
    {
      slug: 'llc-premium-package',
      name: 'Premium Package',
      serviceType: 'llc-setup',
      description: 'Comprehensive package for a fully equipped business setup. The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 69900, // $699.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: {
        governmentFeeNotice: 'The listed price covers our service and filing fees. Any additional government or state fees will be charged separately by the respective state.',
        addOns: ['ein-registration', 'registered-agent', 'business-address', 'virtual-office', 'expedited-filing', 'same-day-filing', 'banking-consulting', 'license-research', 'website-starter', 'branding-starter', 'mailbox']
      }
    },

    // 8. Photo Studio
    {
      slug: 'photo-studio-hourly',
      name: 'Hourly Booking',
      serviceType: 'photo-studio',
      description: 'Flexible studio access for quick shoots, content creation, or product photography. Includes basic lighting and backdrop setup.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 1200, // $12.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { duration: 'Per hour', minHours: 1, maxHours: 24, addOns: ['photographer', 'videographer', 'extra-lighting', 'makeup-room', 'equipment-rental'] }
    },
    {
      slug: 'photo-studio-half-day',
      name: 'Half-Day Booking',
      serviceType: 'photo-studio',
      description: 'Ideal for small production sessions, brand shoots, or interview recordings. 4 hours studio time.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 4000, // $40.00
      pricingUnit: PricingUnit.PACKAGE,
      durationMinutes: 240,
      metadata: { duration: '4 hours', addOns: ['photographer', 'videographer', 'extra-lighting', 'makeup-room', 'equipment-rental'] }
    },
    {
      slug: 'photo-studio-full-day',
      name: 'Full-Day Booking',
      serviceType: 'photo-studio',
      description: 'Best for commercial shoots, large content batches, or production teams. 8 hours studio time.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 7500, // $75.00
      pricingUnit: PricingUnit.PACKAGE,
      durationMinutes: 480,
      metadata: { duration: '8 hours', addOns: ['photographer', 'videographer', 'extra-lighting', 'makeup-room', 'equipment-rental'] }
    },
    {
      slug: 'photo-studio-monthly-creator',
      name: 'Monthly Creator Calendar',
      serviceType: 'photo-studio',
      description: 'Designed for content creators and agencies who require consistent monthly access. Includes 25 studio hours per month.',
      billingType: BillingType.RECURRING,
      interval: BillingInterval.MONTH,
      unitAmount: 25000, // $250.00
      pricingUnit: PricingUnit.PACKAGE,
      metadata: { duration: '30 days (25 hours)', addOns: ['photographer', 'videographer', 'extra-lighting', 'makeup-room', 'equipment-rental'] }
    },

    // 9. Meeting Rooms
    {
      slug: 'room-board',
      name: 'Board Room',
      serviceType: 'meeting-rooms',
      description: 'Professional executive environment for board meetings and formal presentations. Capacity: 10–12 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 7000, // $70.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: '10–12 people', duration: '1 hour', addOns: ['coworking-30d-room', 'business-address'] }
    },
    {
      slug: 'room-conference',
      name: 'Conference Room',
      serviceType: 'meeting-rooms',
      description: 'Professional meeting space for strategy sessions and team presentations. Capacity: 6 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 5000, // $50.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: '6 people', duration: '1 hour', addOns: ['coworking-30d-room', 'business-address'] }
    },
    {
      slug: 'room-collaboration',
      name: 'Collaboration Room',
      serviceType: 'meeting-rooms',
      description: 'Comfortable workspace designed for teamwork and brainstorming. Capacity: 4 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 3500, // $35.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: '4 people', duration: '1 hour', addOns: ['coworking-30d-room', 'business-address'] }
    },
    {
      slug: 'room-huddle',
      name: 'Huddle Room',
      serviceType: 'meeting-rooms',
      description: 'Compact meeting room for quick discussions and small group calls. Capacity: 4 people.',
      billingType: BillingType.ONE_TIME,
      unitAmount: 2500, // $25.00
      pricingUnit: PricingUnit.HOUR,
      durationMinutes: 60,
      metadata: { capacity: '4 people', duration: '1 hour', addOns: ['coworking-30d-room', 'business-address'] }
    }
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        serviceType: plan.serviceType,
        description: plan.description,
        billingType: plan.billingType,
        interval: plan.interval || null,
        unitAmount: plan.unitAmount,
        pricingUnit: plan.pricingUnit,
        durationMinutes: plan.durationMinutes || null,
        metadata: plan.metadata,
        active: true
      },
      create: {
        slug: plan.slug,
        name: plan.name,
        serviceType: plan.serviceType,
        description: plan.description,
        billingType: plan.billingType,
        interval: plan.interval || null,
        unitAmount: plan.unitAmount,
        pricingUnit: plan.pricingUnit,
        durationMinutes: plan.durationMinutes || null,
        metadata: plan.metadata,
        active: true
      }
    });
  }

  console.log('Successfully seeded ' + plans.length + ' master service plans.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
