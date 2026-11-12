import type {FigmaPage, HeroSection, IconName, Item, Section} from './types';
import {closing, img} from './spaces';

/* Use Cases hub and industry pages — Figma "REDESIGN / … — Homepage Style" frames. */

type Triple = [IconName, string, string];
const items = (list: Triple[]): Item[] => list.map(([icon, title, text]) => ({icon, title, text}));

function industry(o: {
  node: string; path: string; title: string; eyebrow: string; heading: string; lead: string; size?: HeroSection['size'];
  chips: [IconName, string][]; cta: string; stem: string; alt: string;
  about: {icon: IconName; title: string; lead: string; highlights: Triple[]};
  grid: {eyebrow: string; title: string; items: Triple[]};
  extra: Section[];
  closing: [string, string, string];
}): [string, FigmaPage] {
  return [o.path, {
    node: o.node, title: o.title, description: o.lead,
    sections: [
      {kind: 'hero', eyebrow: o.eyebrow, title: o.heading, lead: o.lead, size: o.size || 'lg', chips: o.chips.map(([icon, label]) => ({icon, label})),
        actions: [{label: o.cta, href: '/contact-us/'}, {label: 'Explore Options', href: '/services/'}], image: img(o.stem + '-hero', o.alt), strip: {text: 'Work. Connect. Grow.'}},
      {kind: 'about', id: 'about', bg: 'white', icon: o.about.icon, eyebrow: 'WORKSPACE JUNCTION', title: o.about.title, lead: o.about.lead, highlights: items(o.about.highlights)},
      {kind: 'grid', id: 'options', bg: 'sage', eyebrow: o.grid.eyebrow, title: o.grid.title, cols: 2, variant: 'card', items: items(o.grid.items)},
      ...o.extra,
      closing(o.closing[0], o.closing[1], o.closing[2], undefined, '/contact-us/'),
    ],
  }];
}

const wide = (stem: string, eyebrow: string, title: string, alt: string): Section => ({kind: 'gallery', id: 'gallery', bg: 'white', eyebrow, title, images: [img(stem + '-wide', alt)]});
const pair = (stem: string, eyebrow: string, title: string, a: string, b: string): Section => ({kind: 'gallery', id: 'gallery', bg: 'white', eyebrow, title, images: [img(stem + '-g1', a), img(stem + '-g2', b)]});
const media = (stem: string, eyebrow: string, title: string, side: 'left' | 'right', alt: string, list: Triple[]): Section => ({kind: 'media', id: 'media', bg: 'white', eyebrow, title, image: img(stem + '-media', alt), imageSide: side, items: items(list)});

export const useCasePages: Record<string, FigmaPage> = {
  '/use-cases/': {
    node: '6255:160472',
    title: 'Use Cases',
    description: 'Flexible workspace, media production, professional services and a community that supports the way you work, create and grow.',
    sections: [
      {kind: 'hero', eyebrow: 'USE CASES', title: 'Space for the way\nyou work.', size: 'lg',
        lead: 'Flexible workspace, media production, professional services and a community that supports the way you work, create and grow.',
        chips: [{icon: 'laptop', label: 'Flexible Work'}, {icon: 'camera', label: 'Creative Production'}, {icon: 'chart-no-axes-combined', label: 'Business Growth'}],
        actions: [{label: 'Explore Use Cases', href: '#industries'}, {label: 'Talk to Our Team', href: '/contact-us/'}],
        image: img('usecases-hero', 'Members working across the Junction'), strip: {text: 'Work. Connect. Grow.'}},
      {kind: 'grid', id: 'industries', bg: 'sage', eyebrow: 'INDUSTRY SOLUTIONS', title: 'Find your fit at the Junction.', cols: 2, variant: 'card',
        items: [
          {icon: 'palette', title: 'Creative Designers & Agencies', text: 'Build campaigns, pitch clients and create media in one place.', href: '/creative-designers-agencies/'},
          {icon: 'laptop', title: 'Freelancers & Solopreneurs', text: 'Stay focused, meet clients and establish a professional presence.', href: '/use-cases/freelancers-solopreneurs/'},
          {icon: 'scale', title: 'Law Firms & Attorneys', text: 'Work privately and host clients in polished meeting rooms.', href: '/use-cases/law-firms-attorneys/'},
          {icon: 'globe', title: 'Digital Nomads', text: 'Drop in for focused work, stay connected and manage mail remotely.', href: '/use-cases/digital-nomads/'},
          {icon: 'briefcase-business', title: 'E-Commerce & Online Business', text: 'Produce product media and keep back-office operations organized.', href: '/e-commerce-online-business/'},
          {icon: 'presentation', title: 'Business Consultants', text: 'Host strategy sessions, run workshops and record expert content.', href: '/use-cases/business-consultants/'},
        ]},
      wide('usecases', 'EXPLORE MORE', 'Work. Create. Grow.', 'Members collaborating in the lounge'),
      {kind: 'checks', id: 'together', bg: 'white', eyebrow: 'THE JUNCTION', title: 'What brings it all together?',
        items: [{icon: 'laptop', title: 'Flexible desks and private offices'}, {icon: 'camera', title: 'Professional media studios'}, {icon: 'users', title: 'Client-ready meeting rooms'}, {icon: 'mail', title: 'Business address and mail services'}]},
      closing('Find a setup that fits your work.', 'Talk to our team about your workflow and the space you need.', 'Talk to Our Team', undefined, '/contact-us/'),
    ],
  },
  ...Object.fromEntries([
    industry({
      node: '6255:163676', path: '/creative-designers-agencies/', title: 'Creative Designers & Agencies', eyebrow: 'CREATIVE DESIGNERS & AGENCIES', heading: 'Craft ideas.\nElevate every campaign.', size: 'md',
      lead: 'Flexible workspaces, collaborative zones and media production tools for brand identities, digital experiences and visual campaigns.',
      chips: [['laptop', 'Focus'], ['users', 'Collaborate'], ['camera', 'Create']], cta: 'Explore Creative Spaces', stem: 'creative', alt: 'Creative team reviewing designs',
      about: {icon: 'palette', title: 'From idea to deliverable.', lead: 'Use focus spaces, client-ready meeting rooms and professional media tools at every stage of your creative process.', highlights: [['laptop', 'Focus', 'Develop concepts'], ['users', 'Collaborate', 'Run team sprints'], ['camera', 'Deliver', 'Pitch and produce']]},
      grid: {eyebrow: 'THE CREATIVE WORKFLOW', title: 'Make room for every stage.', items: [
        ['laptop', 'Concept & Focus Work', 'Work through design decisions in a quiet, focused space.'],
        ['users', 'Ideation & Team Sprints', 'Bring collaborators together for brainstorms and reviews.'],
        ['presentation', 'Client Pitches & Briefs', 'Present campaigns and concepts in polished meeting rooms.'],
        ['camera', 'Media & Asset Creation', 'Shoot, record and produce campaign content with studio tools.'],
      ]},
      extra: [
        media('creative', 'WORKSPACE & PRODUCTION', 'Spaces that move with your work.', 'left', 'Creative workstation with studio lights', [
          ['laptop', 'Workstations & studios', 'Hot desks, dedicated desks and private offices support different project needs.'],
          ['camera', 'Media production', 'Photo, video, podcast and webinar spaces for client-ready assets.'],
          ['printer', 'Print & collateral', 'Prepare portfolios, presentation materials and branded signage.'],
        ]),
        pair('creative', 'EXPLORE MORE', 'From team review to client presentation.', 'Team reviewing work on a screen', 'Client presentation in a meeting room'),
      ],
      closing: ['Make room for your next campaign.', 'Explore flexible workspaces and studios for creative teams.', 'Explore Creative Spaces'],
    }),
    industry({
      node: '6255:166900', path: '/use-cases/freelancers-solopreneurs/', title: 'Freelancers & Solopreneurs', eyebrow: 'FREELANCERS & SOLOPRENEURS', heading: 'Work independently.\nLook established.', size: 'md',
      lead: 'Professional space, creative tools and community support for independent work, client meetings and business growth.',
      chips: [['laptop', 'Focus'], ['users', 'Meet Clients'], ['palette', 'Build Your Brand']], cta: 'Explore Workspace', stem: 'freelancers', alt: 'Freelancer working at a desk',
      about: {icon: 'laptop', title: 'A professional base for independent work.', lead: 'Work your way without a long lease. Balance deep focus, client interaction and creative production in one place.', highlights: [['laptop', 'Work', 'Flexible workstation options'], ['users', 'Meet', 'Client-ready rooms'], ['camera', 'Create', 'Media and print tools']]},
      grid: {eyebrow: 'FLEXIBLE OPTIONS', title: 'Build a setup around your day.', items: [
        ['laptop', 'Hot Desks & Dedicated Desks', 'Drop in for focused work or reserve a regular workspace.'],
        ['briefcase-business', 'Private Offices', 'Work on sensitive projects in a confidential, quiet setting.'],
        ['users', 'Meeting & Consultation Rooms', 'Host pitches, strategy sessions and hybrid client meetings.'],
        ['mail', 'Virtual Office Services', 'Maintain a professional address and manage your mail remotely.'],
      ]},
      extra: [
        media('freelancers', 'PRODUCTION & PRINT', 'Tools to grow your brand.', 'right', 'Recording content in the studio', [
          ['camera', 'Record and present', 'Use podcast, photo and webinar studios for your portfolio and client content.'],
          ['printer', 'Print professional materials', 'Prepare cards, portfolios, flyers and event signage with TradeShow Realm.'],
          ['handshake', 'Connect with peers', 'Meet professionals across fields and find collaborators through the community.'],
        ]),
        pair('freelancers', 'EXPLORE MORE', 'Make the most of your workday.', 'Focused work in the lounge', 'Client call in a private room'),
      ],
      closing: ['Upgrade your professional workspace.', 'Find the right space for focus, client work and creative production.', 'Explore Workspace'],
    }),
    industry({
      node: '6263:164866', path: '/use-cases/law-firms-attorneys/', title: 'Law Firms & Attorneys', eyebrow: 'LAW FIRMS & ATTORNEYS', heading: 'A professional setting\nfor legal work.', size: 'md',
      lead: 'Private offices, client-ready meeting rooms and flexible workspace for solo attorneys, boutique practices and growing legal teams.',
      chips: [['shield-check', 'Private Offices'], ['users', 'Meet Clients'], ['map-pin', 'Business Presence']], cta: 'Explore Legal Workspaces', stem: 'law', alt: 'Attorney meeting with a client',
      about: {icon: 'scale', title: 'Confidentiality, credibility and flexibility.', lead: 'Support case preparation, client consultations and team strategy sessions without taking on a traditional office lease.', highlights: [['file-check', 'Prepare', 'Private, focused workspace'], ['users', 'Consult', 'Client-ready meeting rooms'], ['mail', 'Operate', 'Business address and mail']]},
      grid: {eyebrow: 'LEGAL WORKSPACE OPTIONS', title: 'A workspace for the way you practice.', items: [
        ['shield-check', 'Private Studio Offices', 'Lockable, furnished offices for case prep and sensitive document review.'],
        ['laptop', 'Dedicated Desks', 'A consistent workstation with storage for focused daily work.'],
        ['users', 'Meeting & Conference Rooms', 'Host consultations, mediations, depositions and partner strategy sessions.'],
        ['mail', 'Virtual Office & Mail', 'Maintain a professional business address, with mail handling and forwarding.'],
      ]},
      extra: [
        media('law', 'CLIENT EXPERIENCE', 'Ready for high-stakes meetings.', 'left', 'Conference room set for a consultation', [
          ['users', 'Client consultations', 'Meet clients in a polished, private setting.'],
          ['file-check', 'Case reviews', 'Use screens and presentation tools for team strategy sessions.'],
          ['users', 'Hybrid engagement', 'Support remote consultations and presentations with professional AV.'],
        ]),
        wide('law', 'EXPLORE MORE', 'Professional from the first visit.', 'Reception and lounge at the Junction'),
      ],
      closing: ['Find the right space for your practice.', 'Explore offices and meeting rooms for your legal team.', 'Talk to Our Team'],
    }),
    industry({
      node: '6263:168094', path: '/use-cases/digital-nomads/', title: 'Digital Nomads', eyebrow: 'DIGITAL NOMADS', heading: 'Stay productive.\nKeep moving.',
      lead: 'Flexible workspaces, reliable connectivity and remote mail support for digital nomads and traveling professionals.',
      chips: [['users', 'Drop In'], ['globe', 'Stay Connected'], ['mail', 'Manage Mail']], cta: 'Explore Flexible Access', stem: 'nomads', alt: 'Traveling professional working on a laptop',
      about: {icon: 'globe', title: 'A professional base, wherever work takes you.', lead: 'Drop in for a day or secure a recurring workspace. Stay productive, meet clients and keep your business organized on the move.', highlights: [['laptop', 'Work', 'No long-term lease'], ['users', 'Connect', 'Hybrid meeting tools'], ['mail', 'Manage', 'Virtual mail support']]},
      grid: {eyebrow: 'WORKSPACE & SUPPORT', title: 'Travel light. Work with the right tools.', items: [
        ['laptop', 'Flexible Workspace', 'Drop in for focused work or secure a regular desk or private office.'],
        ['globe', 'Reliable Connectivity', 'Stay connected with high-speed internet, private call spaces and charging stations.'],
        ['users', 'Meeting & Presentation Rooms', 'Host clients in person or bring remote participants into a hybrid session.'],
        ['mail', 'Virtual Office & Mail', 'Keep a professional address and manage mail scans and forwarding remotely.'],
      ]},
      extra: [
        pair('nomads', 'EXPLORE MORE', 'Stay connected, in person and online.', 'Video call from a focus booth', 'Working in the lounge'),
        {kind: 'checks', id: 'in-town', bg: 'white', eyebrow: 'WAYS TO USE THE JUNCTION', title: 'When you’re in town.',
          items: [{icon: 'laptop', title: 'Drop in for a focused workday'}, {icon: 'mic', title: 'Record a podcast or webinar'}, {icon: 'presentation', title: 'Host a client presentation'}, {icon: 'printer', title: 'Prepare print and event materials'}]},
      ],
      closing: ['Make the world your office.', 'Find flexible access and business support that travels with you.', 'Explore Flexible Access'],
    }),
    industry({
      node: '6263:171330', path: '/e-commerce-online-business/', title: 'E-Commerce & Online Business', eyebrow: 'E-COMMERCE & ONLINE BUSINESS', heading: 'Sell everywhere.\nGrow from here.',
      lead: 'Flexible workspace, product media and business support to help online brands organize operations and bring products to market.',
      chips: [['camera', 'Product Media'], ['briefcase-business', 'Business Support'], ['chart-no-axes-combined', 'Scale Flexibly']], cta: 'Explore Business Tools', stem: 'ecommerce', alt: 'Product photography for an online store',
      about: {icon: 'briefcase-business', title: 'A physical base for your online business.', lead: 'Build a professional presence, produce stronger product visuals and keep day-to-day operations organized as demand changes.', highlights: [['map-pin', 'Present', 'Professional business address'], ['camera', 'Produce', 'Photo and video studios'], ['mail', 'Operate', 'Mail and logistics support']]},
      grid: {eyebrow: 'E-COMMERCE WORKFLOW', title: 'Support for every part of your store.', items: [
        ['map-pin', 'Professional Presence', 'Use a commercial business address without leasing a storefront.'],
        ['camera', 'Product Media', 'Create catalog photos, demos and campaign content in professional studios.'],
        ['briefcase-business', 'Back-Office & Logistics', 'Manage business correspondence, packages and vendor coordination.'],
        ['chart-no-axes-combined', 'Flexible Growth', 'Choose drop-in desks, dedicated workstations or a private office as demand changes.'],
      ]},
      extra: [
        media('ecommerce', 'PRODUCT CONTENT & PACKAGING', 'Make your next launch look the part.', 'right', 'Product shoot setup', [
          ['camera', 'Shoot product visuals', 'Capture clean photos and video for listings and campaigns.'],
          ['printer', 'Create branded materials', 'Prepare flyers, packaging collateral and event signage with TradeShow Realm.'],
          ['mail', 'Stay organized', 'Use business address and virtual mailbox services to manage correspondence.'],
        ]),
        wide('ecommerce', 'EXPLORE MORE', 'Built for digital commerce.', 'Team packing and planning product launches'),
      ],
      closing: ['Give your online business a place to grow.', 'Explore workspaces, studios and business services for your next stage.', 'Explore Business Tools'],
    }),
    industry({
      node: '6263:174554', path: '/use-cases/business-consultants/', title: 'Business Consultants', eyebrow: 'BUSINESS CONSULTANTS', heading: 'Meet with confidence.\nDeliver with focus.', size: 'md',
      lead: 'Professional workspace, meeting rooms and business support for consultants who work across client engagements, teams and locations.',
      chips: [['users', 'Meet Clients'], ['graduation-cap', 'Run Workshops'], ['mic', 'Create Content']], cta: 'Explore Consultant Spaces', stem: 'consultants', alt: 'Consultant leading a strategy session',
      about: {icon: 'presentation', title: 'A professional base for client work.', lead: 'Run strategy sessions, meet with stakeholders and build your practice with a workspace that adapts to each engagement.', highlights: [['laptop', 'Focus', 'Private offices and desks'], ['presentation', 'Facilitate', 'Meeting and training rooms'], ['mic', 'Publish', 'Podcast and webinar studios']]},
      grid: {eyebrow: 'CONSULTING WORKFLOW', title: 'Space for the work behind the advice.', items: [
        ['laptop', 'Private Offices & Dedicated Desks', 'Find a reliable base for analysis, proposals and focused project work.'],
        ['users', 'Meeting & Workshop Spaces', 'Host executive briefings, client workshops and hybrid strategy sessions.'],
        ['mail', 'Virtual Office & Mail Services', 'Maintain a professional address and manage business correspondence.'],
        ['camera', 'Media & Print Support', 'Record thought leadership and create client-ready presentations and collateral.'],
      ]},
      extra: [
        media('consultants', 'CLIENT EXPERIENCE', 'Adapt to each engagement.', 'left', 'Client workshop in a meeting room', [
          ['handshake', 'Build client trust', 'Meet stakeholders in a setting that reflects the quality of your work.'],
          ['users', 'Facilitate across locations', 'Bring remote participants into meetings and workshops.'],
          ['mic', 'Share your expertise', 'Record webinars, podcasts and training content.'],
        ]),
        wide('consultants', 'EXPLORE MORE', 'Make room for collaborative work.', 'Team collaborating at the Junction'),
      ],
      closing: ['Elevate your consulting practice.', 'Find flexible spaces and support for your next client engagement.', 'Talk to Our Team'],
    }),
  ]),
};
