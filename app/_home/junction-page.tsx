import Image from 'next/image';
import Link from 'next/link';
import {ArrowDown, ArrowUpRight, MapPin, Plus} from 'lucide-react';
import {PublicLayout} from '@/components/public-layout';
import {jsonLd, loadSite, publicItems, publicSetting} from '@/lib/site';
import {Pricing} from '@/components/pricing';
import {BookingButton} from '@/components/booking';
import {StudioTabs} from '@/components/home-live';
import {EcosystemExplorer} from '@/components/ecosystem-explorer';
import {DeferredJunctionMotion} from '@/components/deferred-motion';
import {fetchHomepageUseCases} from '@/lib/use-cases';
import {fetchCatalogService, priceLabel, type ServiceDetail} from '@/lib/catalog';
import {CHAPTERS} from '@/lib/ecosystem';
import {TestimonialsSection} from '@/components/testimonials-section';
import homeFaqs from '@/lib/home-faqs.json';
import './junction-home.css';

/* Homepage — "the place carries it". A full-height photograph of the Junction with the six
   chapters of the ecosystem standing beside it as colour blocks; each later section is its own
   composition and its own field of brand colour. Every price, plan, rate, testimonial and use
   case below is read from the catalog / CMS at request time; nothing commercial is hardcoded. */

const faqs = homeFaqs as Array<{q: string; a: string}>;

/* Formation & presence services, in the order a founder meets them. Prices come from the catalog. */
const FOUNDATION: Array<{group: string; items: Array<{slug: string; label: string; note: string; href: string; priced: boolean}>}> = [
  {group: 'Start it.', items: [
    {slug: 'llc-setup', label: 'LLC formation', note: 'Illinois filing, EIN registration and setup guidance', href: '/llc-setup/', priced: true},
    {slug: 'services', label: 'Business consultancy', note: 'Talk through structure, services and next steps', href: '/book-an-appointment/', priced: false},
  ]},
  {group: 'Establish it.', items: [
    {slug: 'business-address', label: 'Business address', note: 'A real street address in Oakbrook Terrace', href: '/business-address/', priced: true},
    {slug: 'virtual-office', label: 'Virtual office', note: 'Address, mail handling and workspace when you need it', href: '/virtual-office/', priced: true},
    {slug: 'mail-box', label: 'Private mailbox', note: 'Mail and package receiving at a staffed location', href: '/mail-box/', priced: true},
    {slug: 'virtual-mailbox', label: 'Virtual mailbox', note: 'Mail handled for you, wherever you are', href: '/virtual-mailbox/', priced: true},
    {slug: 'notary-public', label: 'Notary public', note: 'On-site Illinois notary for business documents', href: '/notary-public/', priced: true},
  ]},
];

/* Verified against /digital-services/, /digital-presence/, /printed-services/ and /bpo-services/. */
const GROWTH = [
  {label: 'Websites & development', note: 'Business websites, landing pages, UX/UI', href: '/digital-services/', image: '/media/figma-home/commerce.webp'},
  {label: 'Marketing & growth', note: 'Local SEO, paid ads, content calendars', href: '/digital-presence/', image: '/media/figma-home/independent.webp'},
  {label: 'Branding & identity', note: 'Logos, identity systems, guidelines', href: '/digital-services/', image: '/media/figma-home/creative.webp'},
  {label: 'CRM & automation', note: 'Lead follow-up, booking, integrations', href: '/digital-services/', image: '/media/figma-home/meeting.webp'},
  {label: 'Video & content', note: 'Editing, motion graphics, podcast support', href: '/podcast-studio/', image: '/media/figma-home/creators.webp'},
  {label: 'Print & business support', note: 'Collateral printing; BPO via Orbitus Solutions', href: '/printed-services/', image: '/media/figma-home/boardroom.webp'},
] as const;

const SPACES = [
  {label: 'Coworking', note: 'An open floor with focus desks and a reading room', href: '/coworking/', image: '/media/figma-home/independent.webp', alt: 'Rows of workstations in the coworking room'},
  {label: 'Dedicated desks', note: 'Your own desk, set up the way you left it', href: '/dedicated/', image: '/media/6d247f9676-dedicated-desk.png', alt: 'A dedicated desk with monitor and chair'},
  {label: 'Meeting rooms', note: 'Screens, whiteboards and quiet for the conversation', href: '/meeting-rooms/', image: '/media/dd1c51ab0f-4933b5d2-a1a7-4b5a-b5d3-933ae189a7dc.png', alt: 'A team meeting around a round table'},
  {label: 'The boardroom', note: 'A long table for the meetings that matter', href: '/meeting-rooms/', image: '/media/figma-home/boardroom.webp', alt: 'The Workspace Junction boardroom with a long table and wall display'},
  {label: 'Event space', note: 'Workshops, launches and networking evenings', href: '/events/', image: '/media/b81bede8e6-slider1.png', alt: 'A presentation room set up with a whiteboard'},
  {label: 'Virtual office', note: 'A real address and mail handling, wherever you work', href: '/virtual-office/', image: '/media/24aa74cdc6-virtual-office.png', alt: 'The Workspace Junction virtual office service'},
  {label: 'Podcast studio', note: 'Microphones, cameras and lighting, ready to record', href: '/podcast-studio/', image: '/media/figma-home/podcast-studio-wide.webp', alt: 'A four-person podcast recording at the studio desk'},
] as const;

const MARQUEE = ['Coworking', 'Dedicated desks', 'Meeting rooms', 'Event space', 'Virtual office', 'Business address', 'LLC setup', 'Mailbox', 'Notary', 'Podcast studio', 'Photo studio', 'Digital growth'];

function lowestPlan(service: ServiceDetail | null) {
  const plans = (service?.plans ?? []).filter(plan => plan.unitAmountCents > 0);
  return plans.sort((a, b) => a.unitAmountCents - b.unitAmountCents)[0] ?? null;
}

export default async function JunctionHome() {
  const pricedSlugs = FOUNDATION.flatMap(g => g.items).filter(i => i.priced).map(i => i.slug);
  const [site, rawServices, useCases, podcast, statsItem, foundationServices] = await Promise.all([
    loadSite(), publicItems('services'), fetchHomepageUseCases(), fetchCatalogService('podcast-studio'), publicSetting('homepage-stats'),
    Promise.all(pricedSlugs.map(slug => fetchCatalogService(slug))),
  ]);
  const fromPrice = new Map<string, string>();
  pricedSlugs.forEach((slug, i) => {
    const plan = lowestPlan(foundationServices[i]);
    if (plan) fromPrice.set(slug, 'from ' + priceLabel(plan));
  });

  const available = new Set(site.pages.map(p => p.path.replace(/\/$/, '') || '/'));
  const exists = (href: string) => available.has(href.replace(/\/$/, '') || '/');
  const chapters = CHAPTERS.map(c => ({id: c.id, verb: c.verb, promise: c.promise, title: c.title, text: c.text, image: c.image, routes: c.routes.filter(([, href]) => exists(href)).map(([label, href]) => ({label, href}))})).filter(c => c.routes.length);
  const studioRates = (podcast?.plans ?? []).map(plan => ({slug: plan.slug, name: plan.name, capacityText: plan.capacityText, unitAmountCents: plan.unitAmountCents, currency: plan.currency, description: plan.description, durationMinutes: plan.durationMinutes}));
  const cmsServices = (rawServices || []).map(s => ({title: s.title, href: typeof s.metadata?.href === 'string' ? s.metadata.href : ''})).filter(s => s.title && s.href.startsWith('/') && !s.href.startsWith('//') && exists(s.href));
  const pricing = await Pricing({eyebrow: 'Plans & pricing', title: 'Find your kind of space.', intro: 'Current plans, read live from our catalog. Compare, then book the one that fits the way you work.'});
  const stats = Array.isArray(statsItem?.metadata?.items) ? (statsItem.metadata.items as Array<{value?: string; label?: string}>).filter(item => typeof item?.value === 'string' && typeof item?.label === 'string') : [];
  const business = site.business;
  const address = business?.address || '1S280 Summit Ave Unit E2 Suite 1, Oakbrook Terrace, IL 60181';
  const [street, ...rest] = address.split(/,\s*/);
  const [region, postalCode] = (rest[1] || 'IL 60181').trim().split(/\s+/);
  const postalAddress = {'@type': 'PostalAddress', streetAddress: street, addressLocality: rest[0] || 'Oakbrook Terrace', addressRegion: region || 'IL', postalCode: postalCode || '60181', addressCountry: 'US'};
  const phone = business?.phone || '(773) 986-1908';
  const phoneHref = business?.phoneHref || '+17739861908';
  const email = business?.email || 'grow@workspacejunction.com';

  const spaces = SPACES.filter(item => exists(item.href));
  const heroStats = stats.slice(0, 3);

  return <PublicLayout>
    <main id="main" className="junction-home">

      {/* 1 — Hero: editorial headline beside a composed set of photographs of the place. */}
      <section className="h-hero" aria-labelledby="j-title">
        <div className="j-wrap h-hero-grid">
          <div className="h-hero-copy">
            <p className="h-kicker"><span className="h-dot" aria-hidden="true" />Coworking &amp; business hub · Oakbrook Terrace, Illinois</p>
            <h1 id="j-title" className="h-title"><span className="h-line"><span>Your business,</span></span> <span className="h-line"><em>connected.</em></span></h1>
            <p className="h-lead">Business formation, a professional address, workspaces, creative studios and a community of founders — under one roof, run by people who know your name.</p>
            <div className="h-actions">
              <BookingButton className="wj-button wj-button-yellow h-cta" service="Workspace Junction tour" data-magnetic="0.2">Book a tour <ArrowUpRight size={18} aria-hidden="true" /></BookingButton>
              <a className="h-textlink" href="#spaces">Explore our spaces <ArrowDown size={17} aria-hidden="true" /></a>
            </div>
            {heroStats.length > 0
              ? <dl className="h-hero-stats">{heroStats.map((item, i) => <div key={item.label + '-' + i}><dd>{item.value}</dd><dt>{item.label}</dt></div>)}</dl>
              : <ul className="h-hero-points"><li>Desks, offices &amp; meeting rooms</li><li>Address, mail &amp; LLC setup</li><li>Podcast &amp; photo studios</li></ul>}
          </div>
          <div className="h-hero-media">
            <figure className="h-hero-main"><Image src="/media/7bfb01371b-image-49-scaled.png" alt="Members at work in the Workspace Junction coworking space, Oakbrook Terrace" fill preload fetchPriority="high" sizes="(max-width: 900px) 100vw, 46vw" className="h-hero-img" /></figure>
            <figure className="h-hero-side"><Image src="/media/figma-home/boardroom.webp" alt="The Workspace Junction boardroom" fill sizes="(max-width: 900px) 40vw, 18vw" /></figure>
            <a className="h-hero-card" href={'https://maps.google.com/?q=' + encodeURIComponent(address)} target="_blank" rel="noreferrer">
              <MapPin size={20} aria-hidden="true" />
              <span><strong>Visit the Junction</strong><span>{street}, {rest[0] || 'Oakbrook Terrace'}</span></span>
              <span className="sr-only"> (opens map in a new tab)</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2 — A slow marquee of everything under the roof (decorative; the links live below). */}
      <div className="h-marquee" aria-hidden="true">
        <div className="h-marquee-track">
          {[0, 1].map(copy => <span key={copy} className="h-marquee-set">{MARQUEE.map(word => <span key={word + copy}>{word}<i>✦</i></span>)}</span>)}
        </div>
      </div>

      {/* 3 — The idea in one paragraph; words light up as you read down. */}
      <section className="h-intro" aria-labelledby="h-intro-title">
        <div className="j-wrap h-intro-grid">
          <h2 id="h-intro-title" className="sr-only">About Workspace Junction</h2>
          <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Why the Junction</p>
          <p className="h-statement" data-words>Most coworking companies sell desks. <em>We connect everything a business needs</em> — a legal shape, a real address, rooms to work in, studios to create in and people to grow with.</p>
          <div className="h-intro-side">
            <figure className="h-intro-figure"><Image src="/media/2b124bae06-Rectangle-5527.png" alt="A workshop audience in the Workspace Junction event space" fill sizes="(max-width: 900px) 100vw, 24vw" /></figure>
            <p>A connected business ecosystem on Summit Avenue — from the day you file your LLC to the day you hire your first team.</p>
            <Link className="j-link" href="/about-us/">Our story <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      {/* 4 — Spaces: a horizontal gallery of rooms (pinned on desktop, swipeable on phones). */}
      <section id="spaces" className="h-spaces" aria-labelledby="h-spaces-title" data-header-yield>
        <div className="h-spaces-pin">
          <div className="j-wrap h-spaces-head">
            <div>
              <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Work on it</p>
              <h2 id="h-spaces-title">Rooms that <em>mean business.</em></h2>
            </div>
            <div className="h-spaces-aside">
              <p>Furnished, connected and bookable by the hour, the day or the month. Meeting &amp; conference rooms and event space for up to 50 guests in Oakbrook Terrace, minutes from Lombard and Villa Park.</p>
              <div className="h-spaces-book">
                <BookingButton className="j-btn j-btn-green" service="Meeting rooms">Reserve a room <ArrowUpRight size={18} aria-hidden="true" /></BookingButton>
                <BookingButton className="j-btn j-btn-green" service="Event space">Host an event <ArrowUpRight size={18} aria-hidden="true" /></BookingButton>
              </div>
              <Link className="j-link" href="/coworking/">All workspaces <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
          <ul className="h-rail">
            {spaces.map((item, i) => (
              <li key={item.label}>
                <Link href={item.href} className="h-room">
                  <span className="h-room-img"><Image src={item.image} alt={item.alt} fill sizes="(max-width: 900px) 78vw, 30vw" /></span>
                  <span className="h-room-meta"><span className="h-room-num">{String(i + 1).padStart(2, '0')}</span><span className="h-room-arrow"><ArrowUpRight size={18} aria-hidden="true" /></span></span>
                  <span className="h-room-name">{item.label}</span>
                  <span className="h-room-note">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2 — The explorer: the live thing. */}
      <section id="ecosystem" className="j-ecosystem" aria-labelledby="j-eco-title">
        <div className="j-wrap">
          <div className="j-eco-head">
            <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />The ecosystem</p>
            <h2 id="j-eco-title" data-anim="clip-up">Six ways in. <em>One junction.</em></h2>
            <p>Start, establish, work, create, grow, connect — choose where your business is today and see what is here for you.</p>
          </div>
          <EcosystemExplorer chapters={chapters} />
        </div>
      </section>

      {/* 4 — Formation and presence: the printed sheet. */}
      <section className="j-foundation" aria-labelledby="j-foundation-title">
        <div className="j-wrap j-foundation-grid">
          <div className="j-foundation-copy">
            <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Start it. Establish it.</p>
            <h2 id="j-foundation-title" data-anim="clip-up">Make it <em>official.</em></h2>
            <p data-anim="fade-up">An idea becomes a company on paper first. Form your LLC, give it a real Oakbrook Terrace address, have its mail received and its documents notarized — at the same front desk that books your meeting room.</p>
            <figure className="j-foundation-figure">
              <Image src="/media/9d2454834b-sr6.png" alt="Private mailboxes at Workspace Junction" fill sizes="(max-width: 900px) 70vw, 26vw" />
            </figure>
            <Link className="j-btn j-btn-green" data-anim="fade-up" href="/llc-setup/">Start your LLC <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="j-sheet">
            <p className="j-sheet-title">Foundation services</p>
            <p className="j-sheet-note">{address}</p>
            {FOUNDATION.map(group => (
              <div key={group.group} className="j-sheet-group">
                <h3>{group.group}</h3>
                <ul>
                  {group.items.filter(item => exists(item.href)).map(item => (
                    <li key={item.slug}><Link href={item.href}><span className="j-sheet-name">{item.label}</span><span className="j-sheet-price">{fromPrice.get(item.slug) || 'Ask our team'}</span><span className="j-sheet-desc">{item.note}</span></Link></li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="j-sheet-foot">Prices read live from our catalog and confirmed before you pay.</p>
          </div>
        </div>
      </section>

      {/* 5 — Creative and digital growth: an agency index on amber. */}
      <section className="j-growth" aria-labelledby="j-growth-title">
        <div className="j-wrap">
          <div className="j-growth-head">
            <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Grow it</p>
            <h2 id="j-growth-title" data-anim="clip-up">Built to be <em>seen.</em></h2>
            <p>Designers, developers, marketers and editors build the brand, the website and the systems behind your growth — while you get on with the business.</p>
          </div>
          <span className="h-cursor-img" aria-hidden="true">{GROWTH.map(g => <Image key={g.label} src={g.image} alt="" fill sizes="320px" loading="lazy" />)}</span>
          <ul className="j-index">
            {GROWTH.map(g => (
              <li key={g.label}>
                <Link href={g.href}>
                  <span className="j-index-name">{g.label}</span>
                  <span className="j-index-note">{g.note}</span>
                  <span className="j-index-thumb" aria-hidden="true"><Image src={g.image} alt="" fill sizes="240px" loading="lazy" /></span>
                  <ArrowUpRight className="j-index-arrow" size={30} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {cmsServices.length > 0 && <div className="j-cms-services" aria-label="More business services">{cmsServices.map((s, i) => <Link key={s.href + '-' + i} href={s.href}>{s.title}</Link>)}</div>}
        </div>
      </section>

      {/* 6 — The studio: cinematic, partner disclosed, live rates. */}
      <section className="j-studio" aria-labelledby="j-studio-title">
        <div className="j-studio-frame">
          <Image src="/media/48d393a566-slide-3.png" alt="A live podcast recording under the On Air sign at Chicagoland Podcast Studio" fill sizes="100vw" />
          <div className="j-wrap j-studio-title">
            <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Create for it</p>
            <h2 id="j-studio-title" data-anim="clip-up">Press <em>record.</em></h2>
            <p>Chicagoland Podcast Studio, inside Workspace Junction.</p>
          </div>
        </div>
        <div className="j-wrap j-studio-body">
          <div className="j-studio-intro" data-anim="fade-up">
            <p>An acoustically treated set with professional microphones, multi-camera video and studio lighting — for solo shows, interviews, panels and branded video. Bring the conversation; the room handles the rest.</p>
            <div className="j-studio-links">
              <Link className="j-link" href="/podcast-studio/">Studio details <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link className="j-link" href="/photo-studio/">Photo studio <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <a className="j-link" href="https://chicagolandpodcaststudio.com" target="_blank" rel="noreferrer">Studio website <ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
            </div>
          </div>
          <figure className="j-studio-second">
            <Image src="/media/ec32287da6-slide-2.png" alt="Guests recording at the Chicagoland Podcast Studio set" fill sizes="(max-width: 900px) 100vw, 34vw" />
          </figure>
        </div>
        <div className="j-wrap j-studio-rates"><StudioTabs rates={studioRates} /></div>
      </section>

      {/* 7 — Plans: live catalog. */}
      <div id="home-pricing" className="j-price">
        {pricing || <section className="j-wrap j-price-empty" aria-labelledby="j-price-title"><h2 id="j-price-title">Find your kind of space.</h2><p>Current plans are being refreshed. Our team can walk you through memberships and availability today.</p><Link className="j-btn j-btn-green" href="/memberships/">Explore memberships <ArrowUpRight size={18} aria-hidden="true" /></Link></section>}
      </div>

      {/* 8 — Community: photograph and the people it is for. */}
      <section className="j-community" aria-labelledby="j-community-title">
        <div className="j-community-grid">
          <figure className="j-community-figure">
            <Image src="/media/2b124bae06-Rectangle-5527.png" alt="An audience at a workshop in the Workspace Junction event space" fill sizes="(max-width: 900px) 100vw, 56vw" />
          </figure>
          <div className="j-community-copy">
            <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Connect</p>
            <h2 id="j-community-title" data-anim="clip-up">Better <em>together.</em></h2>
            <p>Networking evenings, expert-led workshops, webinars and a community network with industry circles. The people at the next desk are often the introduction you needed.</p>
            <div className="j-community-links">
              <Link className="j-link" href="/events/">Events <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link className="j-link" href="/workshops/">Workshops <ArrowUpRight size={18} aria-hidden="true" /></Link>
              <Link className="j-link" href="/community-network/">Community network <ArrowUpRight size={18} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
        {useCases.length > 0 && <div className="j-wrap j-audiences">
          <div className="j-audiences-side">
            <h2 className="j-audiences-title" data-anim="clip-up">Made for</h2>
            <Link className="j-link" href="/use-cases/">Explore all use cases <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
          <ul data-anim-stagger-group="true" data-anim-stagger="0.06">{useCases.map(item => <li key={item.id}><Link href={item.serviceHref && (item.serviceHref.startsWith('http') || exists(item.serviceHref)) ? item.serviceHref : '/use-cases/'}>{item.title}<ArrowUpRight size={20} aria-hidden="true" /></Link></li>)}</ul>
        </div>}
      </section>

      <TestimonialsSection />

      {/* 9 — Questions beside a tall photograph. */}
      <section className="j-faq" aria-labelledby="j-faq-title">
        <div className="j-wrap j-faq-grid">
          <div className="j-faq-copy">
            <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Questions</p>
            <h2 id="j-faq-title" data-anim="clip-up">Good <em>questions.</em></h2>
            <dl className="j-facts">
              <div><dt>Where</dt><dd>{address}</dd></div>
              <div><dt>Call</dt><dd><a href={'tel:' + phoneHref}>{phone}</a></dd></div>
              <div><dt>Write</dt><dd><a href={'mailto:' + email}>{email}</a></dd></div>
            </dl>
            <div className="j-faq-list" data-anim-stagger-group="true" data-anim-stagger="0.05">{faqs.map(({q, a}) => <details key={q}><summary>{q}<Plus size={20} aria-hidden="true" /></summary><p>{a}</p></details>)}</div>
          </div>
          <div className="j-faq-media" aria-hidden="true">
            <figure className="j-faq-tall"><Image src="/media/figma-home/meeting.webp" alt="" fill sizes="(max-width: 900px) 100vw, 40vw" /></figure>
            <figure className="j-faq-square"><Image src="/media/figma-home/podcast-studio-round.webp" alt="" fill sizes="(max-width: 900px) 40vw, 16vw" /></figure>
          </div>
        </div>
      </section>

      {/* 10 — Visit card on a photograph, then the brand statement. */}
      <section className="j-visit" aria-labelledby="j-visit-title">
        <div className="j-visit-photo"><Image src="/media/94db02fbd0-hero-office-1.png" alt="The Workspace Junction reception desk" fill sizes="100vw" /></div>
        <div className="j-visit-card">
          <p className="h-intro-label"><span className="h-dot" aria-hidden="true" />Visit</p>
          <h2 id="j-visit-title">Come by the <em>Junction.</em></h2>
          <address>{street}<br />{rest.join(', ')}</address>
          <p><a href={'tel:' + phoneHref}>{phone}</a><br /><a href={'mailto:' + email}>{email}</a></p>
          <BookingButton className="j-btn j-btn-green j-visit-book" service="Workspace Junction tour">Book a tour <ArrowUpRight size={18} aria-hidden="true" /></BookingButton>
          <Link className="j-link" href="/contact-us/">Directions &amp; contact <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>
      <DeferredJunctionMotion />
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLd({'@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Workspace Junction', url: 'https://workspacejunction.com', telephone: phoneHref, email, address: postalAddress})}} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLd({'@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(({q, a}) => ({'@type': 'Question', name: q, acceptedAnswer: {'@type': 'Answer', text: a}}))})}} />
  </PublicLayout>;
}
