import {
  Calendar,
  Users,
  Mic,
  PartyPopper,
  Presentation,
  Megaphone,
  Armchair,
  Wifi,
  ShieldCheck,
  MapPin,
  FileText,
  Lock,
  Building2,
  Video,
  Headphones,
  Camera,
  Sparkles,
  Globe,
  Mail,
  Inbox,
  Package,
  Truck,
  Bell,
  DoorOpen,
  Monitor,
  Cpu,
  BarChart3,
  Workflow,
  Plug,
  Headset,
  ClipboardList,
  UserCheck,
  Gauge,
  Printer,
  FileStack,
  Scissors,
  ScanLine,
  Stamp,
  Scale,
  FileSignature,
  Search,
  LayoutTemplate,
  TrendingUp,
  ClipboardCheck,
  FileCheck,
  Rocket,
  BookOpen,
  Handshake,
  Clock
} from 'lucide-react';
import type {DynamicPageConfig, MoreWayItem} from '@/components/dynamic-page-view';

const defaultMoreWays: MoreWayItem[] = [
  {icon: MapPin, title: 'Book a Tour', desc: 'See the space in person and meet the team.', href: '/book-an-appointment/'},
  {icon: Calendar, title: 'Attend an Event', desc: 'Join upcoming workshops and member meetups.', href: '/events/'},
  {icon: Handshake, title: 'Explore Coworking', desc: 'Flexible desks and rooms for every workstyle.', href: '/coworking/'},
  {icon: BookOpen, title: 'Read the Latest', desc: 'Updates, stories and resources from the Junction.', href: '/blogs/'}
];

export const DYNAMIC_PAGES: Record<string, DynamicPageConfig> = {
  /* ==================== Events ==================== */
  events: {
    pageId: 'ev',
    pricingService: 'events',
    pricingTitle: 'Events',
    hero: {
      eyebrow: 'EVENT SPACE',
      title: <>Host Your Next<br />Event at the Junction</>,
      desc: 'A flexible event space in Oakbrook Terrace for workshops, mixers, panels and private gatherings — fully set up so you can focus on the room, not the logistics.',
      image: '/media/5f8e75abc6-events.png',
      imageAlt: 'Community event at Workspace Junction',
      primaryLabel: 'Book Your Event',
      secondaryLabel: 'View Packages'
    },
    about: {
      eyebrow: 'ABOUT OUR EVENTS',
      title: 'A Space Built for Gathering',
      desc: 'From community workshops to private corporate functions, our event space flexes to fit your guest list, layout and format — with the amenities already in place.',
      image: '/media/3ae7176f13-Community-Events-1024x683.jpg',
      imageAlt: 'Guests gathered at a Workspace Junction event',
      values: [
        {icon: Users, title: 'Gather', sub: 'Up to 50 guests'},
        {icon: Presentation, title: 'Present', sub: 'AV & seating ready'},
        {icon: PartyPopper, title: 'Celebrate', sub: 'Custom layouts'}
      ]
    },
    grid: {
      eyebrow: 'EXPLORE OUR PACKAGES',
      title: 'Event Types We Host',
      sub: 'Every event package includes the room, seating and core amenities — scaled to your guest count.',
      items: [
        {icon: Megaphone, title: 'Private Events', desc: 'Full-day access for launches, celebrations and private functions.', sage: true},
        {icon: Presentation, title: 'Corporate Workshops', desc: 'Training sessions and team offsites with flexible seating.'},
        {icon: Users, title: 'Networking Mixers', desc: 'Community-style gatherings built for conversation.'},
        {icon: Mic, title: 'Panel Discussions', desc: 'Presentation-ready setups with AV and screen sharing.'}
      ]
    },
    benefits: {
      eyebrow: "WHAT'S INCLUDED",
      title: 'Everything the Room Needs',
      desc: 'Book the space and the essentials come with it.',
      image: '/media/df61262de6-Community-Events-768x512.jpg',
      imageAlt: 'Event setup at Workspace Junction',
      items: ['Flexible seating & custom layouts', 'High-speed WiFi throughout the space', 'Screen sharing & presentation support', 'On-site team to help you set up']
    },
    banner: {
      eyebrow: 'PLAN YOUR EVENT',
      title: 'Bring Your Next Event to the Junction',
      desc: "Tell us your guest count and format, and we'll help you pick the right package.",
      image: '/media/9a436d5d74-Community-Events-2048x1365.jpg',
      imageAlt: 'Workspace Junction event space'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Dedicated Desks ==================== */
  dedicated: {
    pageId: 'dd',
    pricingService: 'dedicated',
    pricingTitle: 'Dedicated Desk',
    hero: {
      eyebrow: 'DEDICATED DESK',
      title: <>A Desk That&apos;s<br />Always Yours</>,
      desc: 'A reserved, personal workstation in Oakbrook Terrace — set up once, return daily, and work with the consistency of a private office without the lease.',
      image: '/media/482b2f4699-dedicated-desks2.png',
      imageAlt: 'Dedicated desk at Workspace Junction',
      primaryLabel: 'Reserve a Desk',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'ABOUT DEDICATED DESKS',
      title: 'Your Own Spot, Every Day',
      desc: 'Built for professionals who want daily consistency: a permanent desk, ergonomic seating and 24/7 access within a professional coworking environment.',
      image: '/media/2d6330e293-Dedicated-Desks-scaled.jpg',
      imageAlt: 'Dedicated desk workspace',
      values: [
        {icon: Armchair, title: 'Settle In', sub: 'Ergonomic setup'},
        {icon: Clock, title: '24/7 Access', sub: 'Work on your hours'},
        {icon: ShieldCheck, title: 'Secure', sub: 'Your space, protected'}
      ]
    },
    works: {
      eyebrow: 'HOW IT WORKS',
      title: 'Set Up Once, Work Every Day',
      desc: 'Choose your plan, claim your desk, and settle in — no daily setup required.',
      ctaLabel: 'See Desk Features',
      topImage: '/media/162dd5e564-Dedicated-Desks-1536x960.jpg',
      topImageAlt: 'Dedicated desk row at Workspace Junction',
      bottomImage: '/media/6e07d4feff-dedicated-desk-1024x683.jpg',
      bottomImageAlt: 'A member working at their dedicated desk',
      features: [
        {icon: Wifi, title: 'Business-Grade WiFi', desc: 'High-speed internet built for daily, uninterrupted work.'},
        {icon: MapPin, title: 'Business Address', desc: "Use the Junction's address for mail and registration."}
      ]
    },
    benefits: {
      eyebrow: 'WHY A DEDICATED DESK',
      title: 'Consistency Without the Lease',
      desc: 'All the structure of a private office, none of the overhead.',
      image: '/media/341271dd48-Dedicated-desk-scaled.jpg',
      imageAlt: 'Dedicated desk setup',
      items: ['Reserved personal workstation', 'Access to Focus Pods & meeting rooms', 'Member networking invitations', 'Printers, coffee & regular cleaning included']
    },
    banner: {
      eyebrow: 'CLAIM YOUR DESK',
      title: 'Make the Junction Your Desk Home',
      desc: 'Tour the space and find the dedicated desk plan that fits your routine.',
      image: '/media/3b62744581-Dedicated-desk-2048x1363.jpg',
      imageAlt: 'Dedicated desk area at Workspace Junction'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Business Address ==================== */
  'business-address': {
    pageId: 'ba',
    pricingService: 'business-address',
    pricingTitle: 'Business Address',
    hero: {
      eyebrow: 'BUSINESS ADDRESS',
      title: <>A Professional Address<br />for Your Business</>,
      desc: 'Register, receive mail and present your business from a prestigious Oakbrook Terrace address — without renting a full office.',
      image: '/media/8b6df6a2af-Business-Address-scaled.jpg',
      imageAlt: 'Workspace Junction business address signage',
      primaryLabel: 'Get a Business Address',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'WHY A BUSINESS ADDRESS',
      title: 'Keep Your Home Address Private',
      desc: 'A dedicated business address separates your personal and business life — ideal for registration, correspondence and client-facing credibility.',
      image: '/media/32c1e607a9-Business-Address-1024x487.jpg',
      imageAlt: 'Business Address suite at Workspace Junction',
      values: [
        {icon: Building2, title: 'Present', sub: 'A real, staffed location'},
        {icon: Lock, title: 'Protect', sub: 'Keep your home private'},
        {icon: FileText, title: 'Register', sub: 'Where permitted'}
      ]
    },
    grid: {
      eyebrow: 'WHAT YOU GET',
      title: 'A Simple, Professional Setup',
      sub: 'One plan, built around what a growing business actually needs from an address.',
      items: [
        {icon: MapPin, title: 'Oakbrook Terrace Address', desc: 'A professional street address for your business.', sage: true},
        {icon: Mail, title: 'Mail Handling', desc: 'Secure mail pickup during office hours.'},
        {icon: FileText, title: 'Registration Support', desc: 'Use the address for business registration, where permitted.'},
        {icon: Lock, title: 'Privacy', desc: 'Keep your home address off public record.'}
      ]
    },
    banner: {
      eyebrow: 'GET STARTED',
      title: 'Give Your Business a Real Address',
      desc: 'Set up your business address at the Junction in minutes.',
      image: '/media/039e4b8f9e-Business-Address-2048x975.jpg',
      imageAlt: 'Workspace Junction entrance'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Podcast Studio ==================== */
  'podcast-studio': {
    pageId: 'ps',
    pricingService: 'podcast-studio',
    pricingTitle: 'Podcast Studio',
    hero: {
      eyebrow: 'PODCAST STUDIO',
      title: <>Record, Create<br />and Produce On-Site</>,
      desc: 'A fully equipped podcast and content studio in Oakbrook Terrace — solo recording, interviews, panels and video, ready whenever you are.',
      image: '/media/6e6e0920a9-podcast-image-1.png',
      imageAlt: 'Podcast studio at Workspace Junction',
      primaryLabel: 'Book Studio Time',
      secondaryLabel: 'View Sessions'
    },
    about: {
      eyebrow: 'ABOUT THE STUDIO',
      title: 'A Studio for Every Format',
      desc: 'From a solo creator booth to a full panel video setup, our studio is built to flex — bring your guests and your mic, we handle the rest.',
      image: '/media/a4eba19a5f-Flexible-Podcast-Recording-Options-1024x572.jpg',
      imageAlt: 'Recording setup at the podcast studio',
      values: [
        {icon: Mic, title: 'Record', sub: 'Pro-grade audio'},
        {icon: Video, title: 'Film', sub: 'Multi-camera ready'},
        {icon: Sparkles, title: 'Produce', sub: 'Content-ready output'}
      ]
    },
    works: {
      eyebrow: 'OUR APPROACH',
      title: 'How Studio Bookings Work',
      desc: 'Pick a session length and studio type, show up, and start recording.',
      ctaLabel: 'See Session Options',
      topImage: '/media/6267600d3d-Flexible-Podcast-Recording-Options-1536x857.jpg',
      topImageAlt: 'Podcast interview setup',
      bottomImage: '/media/82394f89dd-comfortable-podcast-seating.png',
      bottomImageAlt: 'Comfortable podcast studio seating',
      features: [
        {icon: Headphones, title: 'Pro Audio Gear', desc: 'Studio mics, mixers and acoustic treatment included.'},
        {icon: Camera, title: 'Video-Ready Rooms', desc: 'Multi-camera setups for video podcasts and interviews.'}
      ]
    },
    benefits: {
      eyebrow: 'WHY RECORD HERE',
      title: 'A Studio Built for Creators',
      desc: 'Everything you need to go from idea to published episode.',
      image: '/media/161e3d389e-Podcast-studio.jpg',
      imageAlt: 'Podcast studio interior',
      items: ['Solo, interview, panel & video studio options', 'Professional lighting & acoustic treatment', 'Flexible hourly and multi-hour sessions', 'On-site support to get you set up fast']
    },
    banner: {
      eyebrow: 'READY TO RECORD',
      title: 'Book Your Next Episode at the Junction',
      desc: 'Reserve studio time and bring your next episode to life.',
      image: '/media/a27bd88902-Flexible-Podcast-Recording-Options-scaled.jpg',
      imageAlt: 'Podcast studio recording session'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Virtual Office ==================== */
  'virtual-office': {
    pageId: 'vo',
    pricingService: 'virtual-office',
    pricingTitle: 'Virtual Office',
    hero: {
      eyebrow: 'VIRTUAL OFFICE',
      title: <>Run Your Business<br />From Anywhere</>,
      desc: 'A professional business address, mail handling and discounted workspace access — built for teams who work remotely but need a real presence.',
      image: '/media/24aa74cdc6-virtual-office.png',
      imageAlt: 'Virtual office illustration',
      primaryLabel: 'Get a Virtual Office',
      secondaryLabel: 'View Plans'
    },
    about: {
      eyebrow: 'ABOUT VIRTUAL OFFICE',
      title: 'A Presence Without the Overhead',
      desc: 'Keep the flexibility of remote work while giving your business a professional Oakbrook Terrace address, mail handling and workspace access when you need it.',
      image: '/media/a8c1cfd5fc-virtual-address-oakbrook-terrace-1024x665.jpg.webp',
      imageAlt: 'Virtual office address location',
      values: [
        {icon: Globe, title: 'Work Anywhere', sub: 'Stay fully remote'},
        {icon: Mail, title: 'Get Your Mail', sub: 'Handled & notified'},
        {icon: Users, title: 'Drop In', sub: 'Discounted day passes'}
      ]
    },
    grid: {
      eyebrow: "WHAT'S INCLUDED",
      title: 'Built for Remote-First Teams',
      sub: 'A professional presence, plus the workspace access to back it up.',
      items: [
        {icon: MapPin, title: 'Business Address', desc: 'A prestigious address for your business and mail.', sage: true},
        {icon: Mail, title: 'Mail Handling', desc: 'Mail received, sorted and notified to you.'},
        {icon: Building2, title: 'Meeting Room Access', desc: 'Discounted access when you need to meet in person.'},
        {icon: Users, title: 'Coworking Day Passes', desc: 'Drop in for focused work whenever you need a desk.'}
      ]
    },
    banner: {
      eyebrow: 'GO VIRTUAL',
      title: 'Set Up Your Virtual Office Today',
      desc: 'Get a professional address and workspace access without the lease.',
      image: '/media/b7e1c26f28-virtual-address-oakbrook-terrace-scaled.jpg',
      imageAlt: 'Virtual office address'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Mail Box ==================== */
  'mail-box': {
    pageId: 'mb',
    pricingService: 'mail-box',
    pricingTitle: 'Mailbox',
    hero: {
      eyebrow: 'MAILBOX',
      title: <>A Secure Mailbox<br />in Oakbrook Terrace</>,
      desc: 'Rent a secure mailbox for your personal or business mail — easy pickup, safe handling, no PO box hassle.',
      image: '/media/3bc8c509c7-mailbox.png',
      imageAlt: 'Secure mailbox at Workspace Junction',
      primaryLabel: 'Rent a Mailbox',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'ABOUT THE MAILBOX',
      title: 'Mail Handled, Simply',
      desc: 'Your own secure mailbox with a real street address — pick up on your schedule, with safe handling for packages and letters alike.',
      image: '/media/3a6028a8be-Mailbox-oakbrook-terrace-1024x576.jpg',
      imageAlt: 'Mailbox wall at Workspace Junction',
      values: [
        {icon: Inbox, title: 'Receive', sub: 'Mail & packages'},
        {icon: Lock, title: 'Secure', sub: 'Safe, private storage'},
        {icon: Clock, title: 'Pick Up', sub: 'On your schedule'}
      ]
    },
    grid: {
      eyebrow: 'HOW IT WORKS',
      title: 'Simple Mail, Handled Right',
      sub: 'A straightforward mailbox plan for anyone who needs a real address nearby.',
      items: [
        {icon: Package, title: 'Package Acceptance', desc: 'We sign for and hold packages until you pick them up.', sage: true},
        {icon: Bell, title: 'Pickup Notifications', desc: 'Know the moment your mail or package arrives.'},
        {icon: MapPin, title: 'Real Street Address', desc: 'A professional address, not a PO box.'},
        {icon: Truck, title: 'Forwarding Available', desc: "Have mail forwarded when you're away."}
      ]
    },
    banner: {
      eyebrow: 'GET A MAILBOX',
      title: 'Never Miss Your Mail Again',
      desc: 'Set up your mailbox at Workspace Junction today.',
      image: '/media/4a17121ea4-Mailbox-oakbrook-terrace-scaled.jpg',
      imageAlt: 'Mailbox area at Workspace Junction'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Meeting Rooms ==================== */
  'meeting-rooms': {
    pageId: 'mr',
    pricingService: 'meeting-rooms',
    pricingTitle: 'Meeting Rooms',
    hero: {
      eyebrow: 'MEETING ROOMS',
      title: <>Rooms Built for<br />Focused Conversations</>,
      desc: 'From a quick huddle to a full boardroom presentation, book the right room by the hour — AV, WiFi and whiteboards included.',
      image: '/media/0c15617f3a-meeting-rooms.jpg',
      imageAlt: 'Meeting room at Workspace Junction',
      primaryLabel: 'Book a Room',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'ABOUT OUR ROOMS',
      title: 'The Right Room for Every Meeting',
      desc: "Whether it's a two-person huddle or a client presentation, our rooms are equipped and ready — book by the hour, no setup required.",
      image: '/media/8c6bb01c87-Meeting-Rooms-1536x1024.jpg',
      imageAlt: 'Meeting room table setup',
      values: [
        {icon: Users, title: 'Meet', sub: 'Any group size'},
        {icon: Presentation, title: 'Present', sub: 'Screen sharing built in'},
        {icon: Wifi, title: 'Connect', sub: 'High-speed WiFi'}
      ]
    },
    works: {
      eyebrow: 'OUR APPROACH',
      title: 'How Room Bookings Work',
      desc: 'Pick your room size, book your hours, and walk in ready to meet.',
      ctaLabel: 'See Room Types',
      topImage: '/media/00fb7cff28-Meeting-Rooms-1024x683.jpg',
      topImageAlt: 'Team meeting in progress',
      bottomImage: '/media/a1af396527-Meeting-Rooms-2048x1365.jpg',
      bottomImageAlt: 'Meeting room with presentation screen',
      features: [
        {icon: DoorOpen, title: 'Book by the Hour', desc: 'Reserve exactly the time you need, no long leases.'},
        {icon: Monitor, title: 'AV Included', desc: 'HDMI, screen sharing and whiteboards in every room.'}
      ]
    },
    benefits: {
      eyebrow: 'WHY BOOK WITH US',
      title: 'Ready Rooms, Zero Setup',
      desc: 'Walk in and start the meeting — we handle the rest.',
      image: '/media/8a85b59a70-Meeting-Rooms-scaled.jpg',
      imageAlt: 'Empty meeting room ready for booking',
      items: ['Huddle, collaboration, conference & board rooms', 'High-speed WiFi and HDMI screen sharing', 'Whiteboards in every room', 'Simple hourly booking, no commitment']
    },
    banner: {
      eyebrow: 'BOOK A ROOM',
      title: 'Reserve Your Meeting Room Today',
      desc: 'Find the right room for your next meeting or presentation.',
      image: '/media/e368ecf69a-Meeting-Rooms-768x512.jpg',
      imageAlt: 'Meeting room at the Junction'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Virtual Mailbox ==================== */
  'virtual-mailbox': {
    pageId: 'vm',
    pricingService: 'virtual-mailbox',
    pricingTitle: 'Virtual Mailbox',
    hero: {
      eyebrow: 'VIRTUAL MAILBOX',
      title: <>Your Mail,<br />Managed Remotely</>,
      desc: 'Get a real address and manage your mail entirely online — view, forward or pick up letters and packages from anywhere.',
      image: '/media/d86a1e8c3b-mailbox-1.png',
      imageAlt: 'Virtual mailbox illustration',
      primaryLabel: 'Open a Virtual Mailbox',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'ABOUT VIRTUAL MAILBOX',
      title: 'Mail Management, Fully Remote',
      desc: "Built for people who travel or work remotely — a real Oakbrook Terrace address with mail you can manage without ever stopping in.",
      image: '/media/ce900da43f-mailbox-1024x683.jpg',
      imageAlt: 'Mailbox wall at Workspace Junction',
      values: [
        {icon: Globe, title: 'Manage Remotely', sub: 'From anywhere'},
        {icon: Inbox, title: 'Receive', sub: 'Mail & packages'},
        {icon: Truck, title: 'Forward', sub: 'When you need it'}
      ]
    },
    grid: {
      eyebrow: 'WHAT YOU GET',
      title: "Built for Life on the Move",
      sub: "A mailbox plan designed for people who aren't always local.",
      items: [
        {icon: MapPin, title: 'Professional Address', desc: 'A real street address for personal or business use.', sage: true},
        {icon: Package, title: 'Package Management', desc: 'Safe handling for packages of any size.'},
        {icon: Bell, title: 'Instant Notifications', desc: 'Know the moment something arrives.'},
        {icon: Truck, title: 'Mail Forwarding', desc: 'Have mail sent wherever you are.'}
      ]
    },
    banner: {
      eyebrow: 'GET STARTED',
      title: 'Manage Your Mail From Anywhere',
      desc: 'Open your virtual mailbox at Workspace Junction today.',
      image: '/media/2c46fca10e-mailbox-scaled.jpg',
      imageAlt: 'Mailbox area at Workspace Junction'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Digital Services ==================== */
  'digital-services': {
    pageId: 'ds',
    pricingService: 'digital-services',
    pricingTitle: 'Digital Services',
    hero: {
      eyebrow: 'DIGITAL SERVICES',
      title: <>Systems and Automation<br />That Scale With You</>,
      desc: 'CRM pipelines, custom integrations and workflow automation — built by our team to cut the busywork out of growing your business.',
      image: '/media/93c111cc45-digital-growth.png',
      imageAlt: 'Digital growth and automation illustration',
      primaryLabel: 'Book Strategy Call',
      secondaryLabel: 'View Packages'
    },
    about: {
      eyebrow: 'ABOUT DIGITAL SERVICES',
      title: 'Less Manual Work, More Growth',
      desc: 'We audit your current tech stack and build the automations, integrations and reporting that let your team focus on the work that matters.',
      image: '/media/94db02fbd0-hero-office-1.png',
      imageAlt: 'Team working at Workspace Junction',
      values: [
        {icon: Search, title: 'Audit', sub: 'Workflow & tech review'},
        {icon: Workflow, title: 'Automate', sub: 'Custom integrations'},
        {icon: BarChart3, title: 'Report', sub: 'Clear performance data'}
      ]
    },
    grid: {
      eyebrow: 'WHAT WE BUILD',
      title: "Systems Built Around Your Business",
      sub: 'From a single automation to a full operations overhaul.',
      items: [
        {icon: Cpu, title: 'CRM Automation', desc: 'Pipelines that move leads forward without manual follow-up.', sage: true},
        {icon: Plug, title: 'API Integrations', desc: 'Connect the tools you already use into one workflow.'},
        {icon: Workflow, title: 'Workflow Systems', desc: 'Custom processes that remove repetitive manual steps.'},
        {icon: BarChart3, title: 'Reporting Dashboards', desc: "Real-time visibility into what's actually working."}
      ]
    },
    banner: {
      eyebrow: 'START THE AUDIT',
      title: "Let's Automate Your Busywork",
      desc: "Book a free strategy call and see what we'd build for you.",
      image: '/media/614c7ecd7a-hero-office-1-1024x804.png',
      imageAlt: 'Workspace Junction office'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== BPO Services ==================== */
  'bpo-services': {
    pageId: 'bpo',
    pricingService: 'bpo-services',
    pricingTitle: 'BPO Services',
    hero: {
      eyebrow: 'BPO SERVICES',
      title: <>Dedicated Support,<br />Without the Headcount</>,
      desc: 'Trained back-office and customer support staff who plug directly into your operations — scalable, accountable, and ready when you are.',
      image: '/media/34f5480b28-bpo-services.png',
      imageAlt: 'BPO services illustration',
      primaryLabel: 'Schedule Assessment',
      secondaryLabel: 'View Packages'
    },
    about: {
      eyebrow: 'ABOUT BPO SERVICES',
      title: 'Operations Support That Scales',
      desc: 'From customer support to back-office processing, our dedicated teams handle the operational load so yours can focus on growth.',
      image: '/media/5aa70e84ef-Pacific-Workplaces-Coworking-Flex-Desk-Memberships-1200x900-1-1024x768.jpg',
      imageAlt: 'Team collaborating at Workspace Junction',
      values: [
        {icon: Headset, title: 'Support', sub: 'Customer-facing staff'},
        {icon: ClipboardList, title: 'Process', sub: 'Back-office handling'},
        {icon: Gauge, title: 'Track', sub: 'Daily KPI reporting'}
      ]
    },
    grid: {
      eyebrow: 'WHAT WE PROVIDE',
      title: 'A Team Built Around Your Workload',
      sub: 'Flexible staffing that scales month to month.',
      items: [
        {icon: Headset, title: 'Customer Support', desc: 'Trained staff handling inquiries on your behalf.', sage: true},
        {icon: ClipboardList, title: 'Back-Office Processing', desc: 'Data entry, documentation and admin, handled daily.'},
        {icon: UserCheck, title: 'Staffing Augmentation', desc: 'Dedicated people added directly to your workflow.'},
        {icon: Gauge, title: 'Quality Assurance', desc: 'Daily KPI reporting to keep performance visible.'}
      ]
    },
    banner: {
      eyebrow: 'GET STARTED',
      title: 'Build Your Dedicated Support Team',
      desc: 'Schedule a free needs assessment to see what fits your operation.',
      image: '/media/93b4750e37-Pacific-Workplaces-Coworking-Flex-Desk-Memberships-1200x900-1-768x576.jpg',
      imageAlt: 'Team working at Workspace Junction'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Printed Services ==================== */
  'printed-services': {
    pageId: 'pr',
    pricingService: 'printed-services',
    pricingTitle: 'Printed Services',
    hero: {
      eyebrow: 'PRINTED SERVICES',
      title: <>Printing, Scanning<br />and Everything Between</>,
      desc: 'From a quick single-page print to large-format marketing collateral — on-demand and commercial printing, handled on-site.',
      image: '/media/f9ab2e39c3-printingservices-banner.png',
      imageAlt: 'Printing services at Workspace Junction',
      primaryLabel: 'Use Print Station',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'ABOUT PRINTED SERVICES',
      title: 'From a Single Page to a Full Campaign',
      desc: 'Self-service print stations for everyday needs, plus commercial and large-format printing for marketing materials and trade show collateral.',
      image: '/media/c4771675b0-printingservices-banner-1024x355.png',
      imageAlt: 'Printing station setup',
      values: [
        {icon: Printer, title: 'Print', sub: 'Color & B&W'},
        {icon: ScanLine, title: 'Scan', sub: 'High-resolution uploads'},
        {icon: FileStack, title: 'Produce', sub: 'Commercial runs'}
      ]
    },
    grid: {
      eyebrow: 'WHAT WE OFFER',
      title: 'Print Services Built for Every Need',
      sub: 'Self-service stations and full commercial production, under one roof.',
      items: [
        {icon: Printer, title: 'Color & B&W Printing', desc: 'High-speed printing for everyday documents.', sage: true},
        {icon: FileStack, title: 'Large-Format Printing', desc: 'Banners, boards and trade show materials.'},
        {icon: Scissors, title: 'Binding & Finishing', desc: 'Professional finishing for presentations and proposals.'},
        {icon: ScanLine, title: 'Scanning & Upload', desc: 'High-resolution scans with direct cloud upload.'}
      ]
    },
    banner: {
      eyebrow: 'PRINT TODAY',
      title: 'Get Your Next Project Printed',
      desc: 'Walk in for quick jobs or request a quote for commercial runs.',
      image: '/media/c4dc512512-printing.png',
      imageAlt: 'Printing services'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Notary Public ==================== */
  'notary-public': {
    pageId: 'np',
    pricingService: 'notary-public',
    pricingTitle: 'Notary Public',
    hero: {
      eyebrow: 'NOTARY PUBLIC',
      title: <>Notarization,<br />Done Right Here</>,
      desc: 'A licensed Illinois notary on-site in Oakbrook Terrace — standard notarizations, real estate closings and corporate document execution.',
      image: '/media/4fa425c324-notary-service.png',
      imageAlt: 'Notary public services illustration',
      primaryLabel: 'Book Notary Appointment',
      secondaryLabel: 'View Pricing'
    },
    about: {
      eyebrow: 'ABOUT NOTARY SERVICES',
      title: 'Quick, Official, In Person',
      desc: 'From a single signed document to a full closing package, our licensed notary handles verification and execution in a private, professional setting.',
      image: '/media/faba5af999-notary-service-285x300.png',
      imageAlt: 'Notary signing documents',
      values: [
        {icon: Stamp, title: 'Notarize', sub: 'Official State seal'},
        {icon: UserCheck, title: 'Verify', sub: 'Identity confirmation'},
        {icon: Scale, title: 'Close', sub: 'Real estate & legal'}
      ]
    },
    grid: {
      eyebrow: 'WHAT WE OFFER',
      title: 'Notary Services for Every Document',
      sub: 'Walk-in or scheduled, standard or complex.',
      items: [
        {icon: Stamp, title: 'Standard Notarization', desc: 'Quick, official notarization with State of Illinois seal.', sage: true},
        {icon: Building2, title: 'Real Estate Closings', desc: 'On-site execution for closing document packages.'},
        {icon: FileSignature, title: 'Corporate Documents', desc: 'Legal and corporate paperwork, notarized on-site.'},
        {icon: Users, title: 'Multi-Party Witnessing', desc: 'Witnessing and binding for multi-signer documents.'}
      ]
    },
    banner: {
      eyebrow: 'BOOK A NOTARY',
      title: 'Get Your Documents Notarized Today',
      desc: 'Schedule an appointment or walk in during office hours.',
      image: '/media/4fa425c324-notary-service.png',
      imageAlt: 'Notary public service'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== Digital Presence ==================== */
  'digital-presence': {
    pageId: 'dp',
    pricingService: 'digital-presence',
    pricingTitle: 'Digital Presence',
    hero: {
      eyebrow: 'DIGITAL PRESENCE',
      title: <>Be Found. Be<br />Remembered. Be Chosen.</>,
      desc: 'Local SEO, web presence and reputation management — built to get your business in front of the right people in Chicagoland.',
      image: '/media/93c111cc45-digital-growth.png',
      imageAlt: 'Digital presence growth illustration',
      primaryLabel: 'Book Free Audit',
      secondaryLabel: 'View Packages'
    },
    about: {
      eyebrow: 'ABOUT DIGITAL PRESENCE',
      title: 'Your Business, Visible Everywhere It Matters',
      desc: 'We audit your current online presence and build the local SEO, website and reputation strategy that turns searches into customers.',
      image: '/media/96454f1e99-hero-office-1-768x603.png',
      imageAlt: 'Workspace Junction workspace',
      values: [
        {icon: Search, title: 'Get Found', sub: 'Local search ranking'},
        {icon: LayoutTemplate, title: 'Get Seen', sub: 'Modern web presence'},
        {icon: TrendingUp, title: 'Get Chosen', sub: 'Reputation & reviews'}
      ]
    },
    grid: {
      eyebrow: 'WHAT WE BUILD',
      title: 'A Full Digital Growth Package',
      sub: 'Everything your business needs to compete online, in one place.',
      items: [
        {icon: Search, title: 'Local SEO', desc: 'Ranking strategy built around Oakbrook & Chicago search.', sage: true},
        {icon: LayoutTemplate, title: 'Website Design', desc: 'A modern, high-converting site built for your business.'},
        {icon: TrendingUp, title: 'Reputation Management', desc: 'Review generation and response strategy that builds trust.'},
        {icon: BarChart3, title: 'Analytics & Reporting', desc: "Monthly performance reviews so you know what's working."}
      ]
    },
    banner: {
      eyebrow: 'GET DISCOVERED',
      title: 'Grow Your Digital Presence Today',
      desc: 'Start with a free brand and local SEO audit, no obligation.',
      image: '/media/3b1ea95a9b-hero-office-1-300x236.png',
      imageAlt: 'Workspace Junction office'
    },
    moreWays: defaultMoreWays
  },

  /* ==================== LLC Setup ==================== */
  'llc-setup': {
    pageId: 'llc',
    pricingService: 'llc-setup',
    pricingTitle: 'LLC Setup',
    hero: {
      eyebrow: 'LLC SETUP',
      title: <>Start Your Business<br />the Right Way</>,
      desc: 'From EIN registration to full branding, we handle the paperwork and setup so your business is ready to operate, not just registered.',
      image: '/media/f264a969b9-llc.png',
      imageAlt: 'LLC setup illustration',
      primaryLabel: 'Start My LLC',
      secondaryLabel: 'View Packages'
    },
    about: {
      eyebrow: 'ABOUT LLC SETUP',
      title: 'Formation, Without the Confusion',
      desc: 'We guide you through LLC formation, EIN setup and the business essentials — so you launch with a solid foundation, not just a filing.',
      image: '/media/2a197ba0c0-llc.jpg',
      imageAlt: 'Business formation documents',
      values: [
        {icon: FileCheck, title: 'File', sub: 'State paperwork handled'},
        {icon: ClipboardCheck, title: 'Set Up', sub: 'EIN & essentials'},
        {icon: Rocket, title: 'Launch', sub: 'Ready to operate'}
      ]
    },
    works: {
      eyebrow: 'HOW IT WORKS',
      title: 'From Idea to Registered Business',
      desc: 'Pick a package, send us the details, and we handle formation from there.',
      ctaLabel: 'See Our Packages',
      topImage: '/media/f264a969b9-llc.png',
      topImageAlt: 'LLC formation planning',
      bottomImage: '/media/2a197ba0c0-llc.jpg',
      bottomImageAlt: 'Business documents and formation paperwork',
      features: [
        {icon: FileCheck, title: 'LLC Setup + EIN', desc: 'State filing and federal EIN registration, handled for you.'},
        {icon: LayoutTemplate, title: 'Branding & Website', desc: 'Logo, branding kit and a website to launch with.'}
      ]
    },
    grid: {
      eyebrow: 'OUR PACKAGES',
      title: 'Choose the Level of Support You Need',
      sub: 'Three packages, from essential filing to a fully branded launch.',
      items: [
        {icon: FileCheck, title: 'Basic Package', desc: 'Essential LLC setup to get your business off the ground.', sage: true},
        {icon: ClipboardCheck, title: 'Professional Package', desc: 'Extra support for growing businesses.'},
        {icon: Rocket, title: 'Premium Package', desc: 'A fully equipped business setup, branding included.'},
        {icon: Scale, title: 'Ongoing Compliance', desc: 'Stay on top of state filing requirements as you grow.'}
      ]
    },
    banner: {
      eyebrow: 'LAUNCH TODAY',
      title: "Let's Get Your LLC Started",
      desc: "Tell us about your business and we'll recommend the right package.",
      image: '/media/f264a969b9-llc.png',
      imageAlt: 'LLC formation at Workspace Junction'
    },
    moreWays: defaultMoreWays
  }
};
