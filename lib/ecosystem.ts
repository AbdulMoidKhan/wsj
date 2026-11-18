/* The Workspace Junction ecosystem: six chapters a business moves through.
   One source for the homepage explorer, the header route strip and the inner-page
   heroes, so the brand's "Start it. Establish it. Work on it. Create for it. Grow it."
   promise reads the same everywhere. Routes are filtered against the live page list
   by callers, so a chapter never links to a page that does not exist. */

export type ChapterId = 'start' | 'establish' | 'work' | 'create' | 'grow' | 'connect';

export interface Chapter {
  id: ChapterId;
  verb: string;
  /** "Start it." — the brand line for the chapter */
  promise: string;
  title: string;
  text: string;
  image: {src: string; alt: string};
  routes: ReadonlyArray<readonly [label: string, href: string]>;
  /** Every route that belongs to this chapter (drives inner-page art direction). */
  paths: readonly string[];
}

export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'start', verb: 'Start', promise: 'Start it.',
    title: 'Give the idea a legal shape.',
    text: 'Guided LLC formation, registration support and practical business consultancy for founders taking the first official step.',
    image: {src: '/media/3675f6dc28-slide-1.png', alt: 'A consultation in the Workspace Junction boardroom'},
    routes: [['LLC setup', '/llc-setup/'], ['Business services', '/services/'], ['Book a consultation', '/book-an-appointment/']],
    paths: ['/llc-setup/', '/services/', '/book-an-appointment/'],
  },
  {
    id: 'establish', verb: 'Establish', promise: 'Establish it.',
    title: 'A real address. A professional presence.',
    text: 'A business address in Oakbrook Terrace, mail and package handling, virtual offices and notary services that make a young company look established.',
    image: {src: '/media/9d2454834b-sr6.png', alt: 'Private mailboxes at Workspace Junction'},
    routes: [['Business address', '/business-address/'], ['Virtual office', '/virtual-office/'], ['Mailbox', '/mail-box/'], ['Virtual mailbox', '/virtual-mailbox/'], ['Notary public', '/notary-public/']],
    paths: ['/business-address/', '/virtual-office/', '/virtual-office-plus/', '/mail-box/', '/virtual-mailbox/', '/notary-public/'],
  },
  {
    id: 'work', verb: 'Work', promise: 'Work on it.',
    title: 'Desks, offices and rooms that mean business.',
    text: 'Coworking, dedicated desks, private offices and bookable meeting rooms for focused days and important conversations.',
    image: {src: '/media/7bfb01371b-image-49-scaled.png', alt: 'Members working in the Workspace Junction coworking space'},
    routes: [['Coworking', '/coworking/'], ['Dedicated desks', '/dedicated/'], ['Meeting rooms', '/meeting-rooms/'], ['Memberships', '/memberships/'], ['Reading room', '/library/']],
    paths: ['/coworking/', '/dedicated/', '/meeting-rooms/', '/memberships/', '/membership-plans/', '/library/', '/gallery/'],
  },
  {
    id: 'create', verb: 'Create', promise: 'Create for it.',
    title: 'Studios for the story you tell.',
    text: 'The Chicagoland Podcast Studio and a photo studio on site: microphones, multi-camera video and lighting, ready when you are.',
    image: {src: '/media/figma-home/podcast-studio-wide.webp', alt: 'A four-person podcast recording at the studio desk'},
    routes: [['Podcast studio', '/podcast-studio/'], ['Photo studio', '/photo-studio/']],
    paths: ['/podcast-studio/', '/photo-studio/'],
  },
  {
    id: 'grow', verb: 'Grow', promise: 'Grow it.',
    title: 'Websites, marketing and the systems behind them.',
    text: 'Website design and development, digital marketing, branding, automation, printing and business process support for companies ready for more.',
    image: {src: '/media/figma-home/creative.webp', alt: 'An editor working on a video timeline'},
    routes: [['Digital services', '/digital-services/'], ['Digital presence', '/digital-presence/'], ['BPO services', '/bpo-services/'], ['Printed services', '/printed-services/']],
    paths: ['/digital-services/', '/digital-presence/', '/bpo-services/', '/printed-services/'],
  },
  {
    id: 'connect', verb: 'Connect', promise: 'Connect it.',
    title: 'People worth knowing, under one roof.',
    text: 'Networking events, workshops, webinars, trade shows and a community network for professionals who grow faster together.',
    image: {src: '/media/cc977b7637-image-9.png', alt: 'A workshop audience in the Workspace Junction event space'},
    routes: [['Events', '/events/'], ['Workshops', '/workshops/'], ['Webinars', '/webinars/'], ['Community network', '/community-network/']],
    paths: ['/events/', '/upcoming-events/', '/workshops/', '/webinars/', '/trade-shows/', '/community-network/', '/community/', '/partners/', '/our-partners/', '/about-us/'],
  },
];

const norm = (path: string) => '/' + path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '') + '/';

/** The chapter a route belongs to, or null for routes outside the six chapters (blog, use cases, legal…). */
export function chapterFor(path: string): Chapter | null {
  const key = norm(path);
  return CHAPTERS.find(chapter => chapter.paths.includes(key)) ?? null;
}
