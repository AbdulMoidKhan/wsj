import type {FigmaPage, Img, Section} from './types';

/* Workspace and mail pages — Figma "REDESIGN / … — Homepage Style" frames. */

export const img = (stem: string, alt: string): Img => ({src: '/media/figma-pages/' + stem + '.webp', alt});

export const MORE_THAN_LEAD = 'Clear, transparent solutions designed for flexible productivity and scalable growth.';

export function closing(title: string, lead: string, label: string, book?: string, href?: string): Section {
  return {kind: 'closing', eyebrow: 'WORK. CONNECT. GROW.', title, lead, actions: [{label, book: href ? undefined : book ?? '', href}]};
}

const ROOM_FEATURES = 'High-Speed WiFi  •  HDMI / Screen Sharing\nWhiteboard  •  Video Conferencing Setup\nQuiet Meeting Environment  •  Presentation Screen / TV';

export const spacesPages: Record<string, FigmaPage> = {
  '/coworking/': {
    node: '6196:1066',
    title: 'Coworking Space in Oakbrook Terrace',
    description: 'Flexible desks, private offices and meeting rooms in Oakbrook Terrace — a professional workspace for founders, freelancers and growing teams.',
    sections: [
      {kind: 'hero', eyebrow: 'COWORKING SPACE', title: 'Work, Connect,\nand Grow.', size: 'xl',
        lead: 'Flexible desks, private offices and meeting rooms in Oakbrook Terrace — a professional workspace for founders, freelancers and growing teams, without the overhead of a traditional lease.',
        chips: [{icon: 'armchair', label: 'Flexible desk access'}, {icon: 'wifi', label: 'High-speed WiFi'}, {icon: 'coffee', label: 'Coffee included'}],
        actions: [{label: 'Book a Tour', book: 'Coworking'}, {label: 'View Memberships', href: '#pricing'}],
        image: img('coworking-hero', 'Two members working at a shared table in the coworking space'),
        strip: {price: {service: 'coworking', plan: 'coworking-bronze'}, prefix: 'From ', suffix: ' / month'}},
      {kind: 'intro', id: 'what-is', bg: 'white', icon: 'users', eyebrow: 'WORKSPACE JUNCTION / COWORKING', title: 'What is Coworking at Workspace Junction?',
        lead: 'A modern, professional workspace built for entrepreneurs, remote professionals and growing teams who want flexibility without sacrificing comfort or productivity.',
        image: img('coworking-intro', 'Members working at shared desks'), imageSide: 'left',
        checks: ['Flexible hot desk access', 'High-speed WiFi & printing access', 'Complimentary coffee & refreshments']},
      {kind: 'grid', id: 'spaces', bg: 'sage', eyebrow: 'EXPLORE OUR SPACES', title: 'Spaces & Amenities', split: true, cols: 3, variant: 'photo',
        lead: 'Every space is purpose-built — from a quiet desk for the day to a studio for your next shoot.',
        items: [
          {icon: 'monitor', title: 'Dedicated Desk', text: "A reserved desk that's yours every day, no setup required.", image: img('coworking-dedicated', 'Dedicated desk with monitor')},
          {icon: 'presentation', title: 'Meeting Rooms', text: 'Book a room by the hour for client calls and team sessions.', image: img('coworking-meeting', 'Conference table in a meeting room')},
          {icon: 'armchair', title: 'Hot Desk', text: 'Drop in and work from any open desk in the shared lounge.', image: img('coworking-hotdesk', 'Shared hot desks in the lounge')},
        ],
        tiles: [
          {icon: 'lock-keyhole', title: 'Private Office', href: '/contact-us/'},
          {icon: 'monitor', title: 'Podcast Studio', href: '/podcast-studio/'},
          {icon: 'mail', title: 'Virtual Office', href: '/virtual-office/'},
          {icon: 'presentation', title: 'Boardroom', href: '/meeting-rooms/'},
          {icon: 'armchair', title: 'Wellness Room', href: '/contact-us/'},
        ]},
      {kind: 'pricing', bg: 'cream', service: 'coworking', layout: 'cards', eyebrow: 'PLANS & PRICING', title: 'Coworking Options', lead: MORE_THAN_LEAD,
        plans: [
          {label: 'MEMBERSHIP', name: 'Bronze', price: {service: 'coworking', plan: 'coworking-bronze'}, unit: '/ month', features: ['Full-day coworking access', 'High-speed WiFi', 'Sit/stand desks', 'Printer & Scanning Access', 'Complimentary coffee & refreshments', 'Huddle Room Access', 'Access to Active Wellness Room', 'Partner Discounts', 'Builders Library Access']},
          {label: 'MEMBERSHIP', name: 'Silver', price: {service: 'coworking', plan: 'coworking-silver'}, unit: '/ month', features: ['5 co-working days monthly', 'High-speed WiFi', 'Sit/stand desks', 'Printer & Scanning Access', 'Complimentary coffee & refreshments', 'Huddle Room Access', 'Access to Active Wellness Room', 'Partner Discounts', 'Builders Library Access']},
          {label: 'MEMBERSHIP', name: 'Gold', price: {service: 'coworking', plan: 'coworking-gold'}, unit: '/ month', features: ['10 coworking days monthly', 'High-speed WiFi', 'Sit/stand desks', 'Printer & Scanning Access', 'Complimentary coffee & refreshments', 'Huddle Room Access', 'Access to Active Wellness Room', 'Partner Discounts', 'Builders Library Access']},
          {label: 'MOST POPULAR', name: 'Platinum', featured: true, price: {service: 'coworking', plan: 'coworking-platinum'}, unit: '/ month', features: ['Unlimited monthly access', 'Mailing address', 'Conference room access & credits', 'Boardroom access & credits', 'Exclusive Networking Events access', 'Exclusive Webinar & Workshop access', 'Growth Lab CRM and LMS Access', 'Website & Marketing Support', 'Podcast Studio Access & Discount']},
        ]},
      closing('Become a Member at Workspace Junction', 'More than a desk — a workspace that supports how you work.', 'Book a Tour', 'Coworking'),
    ],
  },

  '/dedicated/': {
    node: '6196:2118',
    title: 'Dedicated Desks in Oakbrook Terrace',
    description: 'A reserved, personal workstation in Oakbrook Terrace — set up once, return daily, with the consistency of a private office without the lease.',
    sections: [
      {kind: 'hero', eyebrow: 'DEDICATED DESKS', title: 'A Desk That’s\nAlways Yours.', size: 'xl',
        lead: 'A reserved, personal workstation in Oakbrook Terrace — set up once, return daily, and work with the consistency of a private office without the lease.',
        chips: [{icon: 'monitor', label: 'Reserved workstation'}, {icon: 'clock', label: '24/7 access'}, {icon: 'shield-check', label: 'Secure workspace'}],
        actions: [{label: 'Reserve a Desk', book: 'Dedicated Desk'}, {label: 'View Pricing', href: '#pricing'}],
        image: img('dedicated-hero', 'A dedicated desk set up with monitor and chair'),
        strip: {price: {service: 'dedicated', plan: 'dedicated-desk-classic'}, prefix: 'From ', suffix: ' / month'}},
      {kind: 'intro', id: 'own-spot', bg: 'white', icon: 'monitor', eyebrow: 'WORKSPACE JUNCTION / DEDICATED DESKS', title: 'Your Own Spot, Every Day',
        lead: 'Built for professionals who want daily consistency: a permanent desk, ergonomic seating and 24/7 access within a professional coworking environment.',
        image: img('dedicated-intro', 'Row of dedicated desks'), imageSide: 'right',
        checks: ['Reserved personal workstation', '24/7 access', 'Ergonomic office chair']},
      {kind: 'grid', id: 'how', bg: 'sage', eyebrow: 'HOW IT WORKS', title: 'Set Up Once, Work Every Day', split: true, cols: 3, variant: 'card',
        lead: 'Choose your plan, claim your desk, and settle in — no daily setup required.',
        items: [
          {icon: 'armchair', title: 'Settle In', text: 'Ergonomic setup'},
          {icon: 'clock', title: '24/7 Access', text: 'Work on your hours'},
          {icon: 'shield-check', title: 'Secure', text: 'Your space, protected'},
        ]},
      {kind: 'pricing', bg: 'cream', service: 'dedicated', layout: 'cards', eyebrow: 'PLANS & PRICING', title: 'Dedicated Desk Options', lead: MORE_THAN_LEAD,
        plans: [
          {label: 'MEMBERSHIP', name: 'Classic Dedicated Desk', price: {service: 'dedicated', plan: 'dedicated-desk-classic'}, unit: '/ month', features: ['Reserved personal workstation', '24/7 access', 'Professional Business address', 'Ergonomic office chair']},
          {label: 'PERFORMANCE', name: 'Performance Dedicated Desk', featured: true, price: {service: 'dedicated', plan: 'dedicated-desk-performance'}, unit: '/ month', features: ['Reserved personal workstation', 'Ergonomic office chair', '27 inch LCD monitor', 'Standing/Sitting desk', '24/7 access']},
        ],
        included: {title: 'Included in both plans', items: ['High-speed business WiFi', 'Access to Focus Pods', 'Active Wellness Room access', 'Member networking invitations', 'Boardroom access and credits', 'Conference Room access and credits', 'Exclusive access to Webinars & Workshops', 'Social Media Marketing Support', 'Website & Marketing Support', 'CRM & LMS access', '1:1 Growth session/coaching', 'Podcast Studio Access', 'Regular Cleaning', 'Printers & Office Supplies', 'Coffee station', 'Cashless Payments']}},
      closing('Ready to upgrade your work routine?', 'Make every workday feel like you’re in control.', 'Book a Tour', 'Dedicated Desk'),
    ],
  },

  '/meeting-rooms/': {
    node: '6196:3143',
    title: 'Meeting Rooms in Oakbrook Terrace',
    description: 'From a quick huddle to a full boardroom presentation, book the right room by the hour — AV, WiFi and whiteboards included.',
    sections: [
      {kind: 'hero', eyebrow: 'MEETING ROOMS', title: 'Rooms Built for\nFocused\nConversations.', size: 'xl',
        lead: 'From a quick huddle to a full boardroom presentation, book the right room by the hour — AV, WiFi and whiteboards included.',
        chips: [{icon: 'presentation', label: 'AV included'}, {icon: 'wifi', label: 'High-speed WiFi'}, {icon: 'calendar-check', label: 'Book by the hour'}],
        actions: [{label: 'Book a Room', book: 'Meeting Rooms'}, {label: 'View Pricing', href: '#pricing'}],
        image: img('meeting-hero', 'Boardroom table ready for a meeting'),
        strip: {price: {service: 'meeting-rooms', plan: 'room-huddle'}, prefix: 'From ', suffix: ' / hour'}},
      {kind: 'intro', id: 'right-room', bg: 'white', icon: 'presentation', eyebrow: 'WORKSPACE JUNCTION / MEETING ROOMS', title: 'The Right Room for Every Meeting',
        lead: "Whether it's a two-person huddle or a client presentation, our rooms are equipped and ready — book by the hour, no setup required.",
        image: img('meeting-intro', 'Meeting room with screen and whiteboard'), imageSide: 'left',
        checks: ['High-speed WiFi and HDMI screen sharing', 'Whiteboards in every room', 'Simple hourly booking, no commitment']},
      {kind: 'grid', id: 'how', bg: 'sage', eyebrow: 'HOW IT WORKS', title: 'How Room Bookings Work', split: true, cols: 3, variant: 'card',
        lead: 'Pick your room size, book your hours, and walk in ready to meet.',
        items: [
          {icon: 'presentation', title: 'Choose Your Room', text: 'Select a meeting room that fits your group size and meeting style.'},
          {icon: 'calendar-check', title: 'Book Your Time', text: 'Book by the hour or session with simple scheduling.'},
          {icon: 'users', title: 'Arrive & Meet', text: 'Arrive to a prepared space and focus on your discussion.'},
        ]},
      {kind: 'pricing', bg: 'cream', service: 'meeting-rooms', layout: 'rooms', eyebrow: 'PLANS & PRICING', title: 'Meeting Rooms Options', lead: MORE_THAN_LEAD,
        plans: [
          {label: '', name: 'Board Room', price: {service: 'meeting-rooms', plan: 'room-board'}, unit: '/ hour', desc: ROOM_FEATURES, image: img('meeting-board', 'Board room')},
          {label: '', name: 'Conference Room', price: {service: 'meeting-rooms', plan: 'room-conference'}, unit: '/ hour', desc: ROOM_FEATURES, image: img('meeting-conference', 'Conference room')},
          {label: '', name: 'Collaboration Room', price: {service: 'meeting-rooms', plan: 'room-collaboration'}, unit: '/ hour', desc: ROOM_FEATURES, image: img('meeting-collab', 'Collaboration room')},
          {label: '', name: 'Huddle Room', price: {service: 'meeting-rooms', plan: 'room-huddle'}, unit: '/ hour', desc: ROOM_FEATURES, image: img('meeting-huddle', 'Huddle room')},
        ]},
      closing('Reserve Your Meeting Room Today', 'Find the right room for your next meeting or presentation.', 'Reserve a Room', 'Meeting Rooms'),
    ],
  },

  '/virtual-office/': {
    node: '6196:4177',
    title: 'Virtual Office in Oakbrook Terrace',
    description: 'A professional business address, mail handling and discounted workspace access — built for teams who work remotely but need a real presence.',
    sections: [
      {kind: 'hero', eyebrow: 'VIRTUAL OFFICE', title: 'Run Your Business\nFrom Anywhere.', size: 'xl',
        lead: 'A professional business address, mail handling and discounted workspace access — built for teams who work remotely but need a real presence.',
        chips: [{icon: 'map-pin', label: 'Business address'}, {icon: 'mail', label: 'Mail handling'}, {icon: 'presentation', label: 'Room access'}],
        actions: [{label: 'Get a Virtual Office', book: 'Virtual Office'}, {label: 'View Plans', href: '#pricing'}],
        image: img('voffice-hero', 'Reception area of Workspace Junction'),
        strip: {price: {service: 'virtual-office', plan: 'virtual-office-standard'}, prefix: 'Plans from '}},
      {kind: 'intro', id: 'presence', bg: 'white', icon: 'mail', eyebrow: 'WORKSPACE JUNCTION / VIRTUAL OFFICE', title: 'A Presence Without the Overhead',
        lead: 'Keep the flexibility of remote work while giving your business a professional Oakbrook Terrace address, mail handling and workspace access when you need it.',
        image: img('voffice-intro', 'Mail and workspace at the Junction'), imageSide: 'right',
        checks: ['Business address', 'Mail handling and notifications', 'Discounted meeting room access']},
      {kind: 'grid', id: 'included', bg: 'sage', eyebrow: 'WHAT’S INCLUDED', title: 'Built for Remote-First Teams', split: true, cols: 4, variant: 'card',
        lead: 'A professional presence, plus the workspace access to back it up.',
        items: [
          {icon: 'map-pin', title: 'Business Address', text: 'A prestigious address for your business and mail.'},
          {icon: 'mail', title: 'Mail Handling', text: 'Mail received, sorted and notified to you.'},
          {icon: 'presentation', title: 'Meeting Room Access', text: 'Discounted access when you need to meet in person.'},
          {icon: 'monitor', title: 'Coworking Day Passes', text: 'Drop in for focused work whenever you need a desk.'},
        ]},
      {kind: 'pricing', bg: 'cream', service: 'virtual-office', layout: 'cards', eyebrow: 'PLANS & PRICING', title: 'Virtual Office Options', lead: MORE_THAN_LEAD,
        plans: [
          {label: 'MEMBERSHIP', name: 'Virtual Office', price: {service: 'virtual-office', plan: 'virtual-office-standard'}, unit: '/ 30 days', features: ['Business address', 'Mail handling and notifications', '2 coworking day passes per month', 'Meeting room access (discounted)', 'High-speed Internet', 'Regular Cleaning', 'Printers & Office Supplies', 'Coffee station', 'Cashless Payments']},
          {label: 'PLUS', name: 'Virtual Office Plus', featured: true, price: {service: 'virtual-office', plan: 'virtual-office-plus'}, unit: '/ month', features: ['Business address', 'Mail handling and notifications', '2 coworking day passes per month', 'Meeting room access (discounted)', 'High-speed Internet', 'Regular Cleaning', 'Printers & Office Supplies', 'Coffee station', 'Cashless Payments']},
        ]},
      closing('Set Up Your Virtual Office Today', 'Get a professional address and workspace access without the lease.', 'Get in Touch', undefined, '/contact-us/'),
    ],
  },

  '/business-address/': {
    node: '6196:5205',
    title: 'Business Address in Oakbrook Terrace',
    description: 'Register, receive mail and present your business from a prestigious Oakbrook Terrace address — without renting a full office.',
    sections: [
      {kind: 'hero', eyebrow: 'BUSINESS ADDRESS', title: 'A Professional\nAddress for\nYour Business.', size: 'xl',
        lead: 'Register, receive mail and present your business from a prestigious Oakbrook Terrace address — without renting a full office.',
        chips: [{icon: 'map-pin', label: 'Real street address'}, {icon: 'mail', label: 'Secure mail handling'}, {icon: 'lock-keyhole', label: 'Home privacy'}],
        actions: [{label: 'Get a Business Address', book: 'Business Address'}, {label: 'View Pricing', href: '#pricing'}],
        image: img('address-hero', 'Workspace Junction building entrance'),
        strip: {price: {service: 'business-address', plan: 'business-address-monthly'}, prefix: 'Business Address · '}},
      {kind: 'intro', id: 'private', bg: 'white', icon: 'map-pin', eyebrow: 'WORKSPACE JUNCTION / BUSINESS ADDRESS', title: 'Keep Your Home Address Private',
        lead: 'A dedicated business address separates your personal and business life — ideal for registration, correspondence and client-facing credibility.',
        image: img('address-intro', 'Front desk at Workspace Junction'), imageSide: 'left',
        checks: ['Professional Oakbrook Terrace address', 'Secure mail handling', 'Registration, where permitted']},
      {kind: 'grid', id: 'included', bg: 'sage', eyebrow: 'WHAT’S INCLUDED', title: 'A Simple, Professional Setup', split: true, cols: 4, variant: 'card',
        lead: 'One plan, built around what a growing business actually needs from an address.',
        items: [
          {icon: 'map-pin', title: 'Oakbrook Terrace Address', text: 'A professional street address for your business.'},
          {icon: 'mail', title: 'Mail Handling', text: 'Secure mail pickup during office hours.'},
          {icon: 'shield-check', title: 'Registration Support', text: 'Use the address for business registration, where permitted.'},
          {icon: 'lock-keyhole', title: 'Privacy', text: 'Keep your home address off public record.'},
        ]},
      {kind: 'pricing', bg: 'cream', service: 'business-address', layout: 'location', eyebrow: 'PLANS & PRICING', title: 'Business Address Options', lead: MORE_THAN_LEAD,
        location: {image: img('address-location', 'Map of the Oakbrook Terrace location'), eyebrow: 'OAKBROOK TERRACE, ILLINOIS', lines: ['1S280 Summit Avenue', 'Unit E2, Suite 1', 'Oakbrook Terrace, IL 60181']},
        plans: [{label: 'BUSINESS ADDRESS', name: 'Business Address', price: {service: 'business-address', plan: 'business-address-monthly'}, features: ['Professional Oakbrook Terrace address', 'Mail pickup during office hours', 'Secure mail handling', 'Ideal for business registration (where permitted)'], note: 'Billing period: confirm with our team.'}]},
      closing('Give Your Business a Real Address', 'Set up your business address at the Junction in minutes.', 'Get in Touch', undefined, '/contact-us/'),
    ],
  },

  '/mail-box/': {
    node: '6214:62734',
    title: 'Mailbox Rental in Oakbrook Terrace',
    description: 'Rent a secure mailbox for your personal or business mail — easy pickup, safe handling, no PO box hassle.',
    sections: [
      {kind: 'hero', eyebrow: 'MAILBOX', title: 'A Secure Mailbox\nin Oakbrook Terrace.', size: 'lg',
        lead: 'Rent a secure mailbox for your personal or business mail — easy pickup, safe handling, no PO box hassle.',
        chips: [{icon: 'package', label: 'Mail & packages'}, {icon: 'shield-check', label: 'Secure storage'}, {icon: 'mail', label: 'Easy pickup'}],
        actions: [{label: 'Rent a Mailbox', book: 'Mailbox Rental'}, {label: 'View Pricing', href: '#pricing'}],
        image: img('mailbox-hero', 'Secure mailboxes at Workspace Junction'),
        strip: {price: {service: 'virtual-mailbox', plan: 'mailbox-rental-30-days'}, suffix: ' / 30 days'}},
      {kind: 'about', id: 'about', bg: 'white', icon: 'mail', eyebrow: 'ABOUT MAILBOX', title: 'Mail Handled, Simply',
        lead: 'Your own secure mailbox with a real street address — pick up on your schedule, with safe handling for packages and letters alike.',
        highlights: [{icon: 'package', title: 'Receive', text: 'Mail & packages'}, {icon: 'shield-check', title: 'Secure', text: 'Safe, private storage'}, {icon: 'calendar-check', title: 'Pick Up', text: 'On your schedule'}]},
      {kind: 'grid', id: 'included', bg: 'sage', eyebrow: 'WHAT’S INCLUDED', title: 'Simple Mail, Handled Right', split: true, cols: 4, variant: 'card',
        lead: 'A straightforward mailbox plan for anyone who needs a real address nearby.',
        items: [
          {icon: 'package', title: 'Package Acceptance', text: 'We sign for and hold packages until you pick them up.'},
          {icon: 'bell', title: 'Pickup Notifications', text: 'Know the moment your mail or package arrives.'},
          {icon: 'map-pin', title: 'Real Street Address', text: 'A professional address, not a PO box.'},
          {icon: 'send', title: 'Forwarding Available', text: "Have mail forwarded when you're away."},
        ]},
      {kind: 'gallery', id: 'gallery', bg: 'cream', title: 'Your mailbox at the Junction', lead: 'A secure mailbox with a real Oakbrook Terrace street address.', smallFirst: true,
        images: [img('mailbox-g1', 'Mailboxes in the lobby'), img('mailbox-g2', 'Package shelf behind the front desk')]},
      {kind: 'pricing', bg: 'cream', service: 'virtual-mailbox', layout: 'feature', eyebrow: 'PLANS & PRICING', title: 'Mailbox Options', lead: MORE_THAN_LEAD,
        plans: [{label: 'MAILBOX RENTAL', name: 'Mailbox Rental', price: {service: 'virtual-mailbox', plan: 'mailbox-rental-30-days'}, unit: '/ 30 days', desc: 'Secure mailbox rental with a professional mailing address for personal or business use. Receive and manage your mail and packages safely with easy pickup or forwarding options.'}],
        aside: {icon: 'shield-check', title: 'A real address.\nA simpler routine.', items: [
          {icon: 'package', title: 'We sign for and hold packages until you pick them up.'},
          {icon: 'bell', title: 'Know the moment your mail or package arrives.'},
          {icon: 'map-pin', title: 'A professional address, not a PO box.'},
          {icon: 'send', title: "Have mail forwarded when you're away."},
        ]}},
      closing('Never Miss Your Mail Again', 'Set up your mailbox at Workspace Junction today.', 'Rent a Mailbox', 'Mailbox Rental'),
    ],
  },

  '/virtual-mailbox/': {
    node: '6214:72584',
    title: 'Virtual Mailbox in Oakbrook Terrace',
    description: 'Get a real address and manage your mail entirely online — view, forward or pick up letters and packages from anywhere.',
    sections: [
      {kind: 'hero', eyebrow: 'VIRTUAL MAILBOX', title: 'Your Mail,\nManaged Remotely.', size: 'lg',
        lead: 'Get a real address and manage your mail entirely online — view, forward or pick up letters and packages from anywhere.',
        chips: [{icon: 'monitor', label: 'Manage remotely'}, {icon: 'package', label: 'Mail & packages'}, {icon: 'send', label: 'Mail forwarding'}],
        actions: [{label: 'Open a Virtual Mailbox', book: 'Mailbox Rental'}, {label: 'View Pricing', href: '#pricing'}],
        image: img('vmailbox-hero', 'Mail sorting at the front desk'),
        strip: {price: {service: 'virtual-mailbox', plan: 'mailbox-rental-30-days'}, suffix: ' / 30 days'}},
      {kind: 'about', id: 'about', bg: 'white', icon: 'mail', eyebrow: 'ABOUT VIRTUAL MAILBOX', title: 'Mail Management, Fully Remote',
        lead: 'Built for people who travel or work remotely — a real Oakbrook Terrace address with mail you can manage without ever stopping in.',
        highlights: [{icon: 'monitor', title: 'Manage Remotely', text: 'From anywhere'}, {icon: 'package', title: 'Receive', text: 'Mail & packages'}, {icon: 'send', title: 'Forward', text: 'When you need it'}]},
      {kind: 'grid', id: 'included', bg: 'sage', eyebrow: 'WHAT’S INCLUDED', title: 'Built for Life on the Move', split: true, cols: 4, variant: 'card',
        lead: "A mailbox plan designed for people who aren't always local.",
        items: [
          {icon: 'map-pin', title: 'Professional Address', text: 'A real street address for personal or business use.'},
          {icon: 'package', title: 'Package Management', text: 'Safe handling for packages of any size.'},
          {icon: 'bell', title: 'Instant Notifications', text: 'Know the moment something arrives.'},
          {icon: 'send', title: 'Mail Forwarding', text: 'Have mail sent wherever you are.'},
        ]},
      {kind: 'gallery', id: 'gallery', bg: 'cream', title: 'A real address. Connected from anywhere.', lead: 'Mail and package handling at Workspace Junction.', smallFirst: true,
        images: [img('vmailbox-g1', 'Mail handling at Workspace Junction'), img('vmailbox-g2', 'Package storage area')]},
      {kind: 'pricing', bg: 'cream', service: 'virtual-mailbox', layout: 'feature', eyebrow: 'PLANS & PRICING', title: 'Virtual Mailbox Options', lead: MORE_THAN_LEAD,
        plans: [{label: 'MAILBOX RENTAL', name: 'Mailbox Rental', price: {service: 'virtual-mailbox', plan: 'mailbox-rental-30-days'}, unit: '/ 30 days', desc: 'Secure mailbox rental with a professional mailing address for personal or business use. Receive and manage your mail and packages safely with easy pickup or forwarding options.'}],
        aside: {icon: 'monitor', title: 'Manage remotely.\nStay connected.', items: [
          {icon: 'map-pin', title: 'A real street address for personal or business use.'},
          {icon: 'package', title: 'Safe handling for packages of any size.'},
          {icon: 'bell', title: 'Know the moment something arrives.'},
          {icon: 'send', title: 'Have mail sent wherever you are.'},
        ]}},
      closing('Manage Your Mail From Anywhere', 'Open your virtual mailbox at Workspace Junction today.', 'Open a Virtual Mailbox', 'Mailbox Rental'),
    ],
  },
};
