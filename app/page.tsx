import Image from 'next/image';
import {ArrowUpRight, Plus} from 'lucide-react';
import {PublicLayout} from '@/components/public-layout';
import {BookingButton} from '@/components/booking';
import {routeFor, jsonLd, publicItems, publicSetting} from '@/lib/site';
import {Pricing} from '@/components/pricing';
import {HeroSlides, StudioTabs} from '@/components/home-live';
import homeFaqs from '@/lib/home-faqs.json';

/* Homepage content mirrors the live workspacejunction.com homepage (captured 28 Oct 2026). */
export const metadata = {alternates: {canonical: '/'}};

const defaultStats = [
  {value: '200+', label: 'Clients'},
  {value: 'Flexible', label: 'Office Solutions'},
  {value: '24/7', label: 'Workspace Access'},
  {value: '01', label: 'Prime Location'},
];

const defaultServices: Array<{title: string; img: string; href: string; text?: string}> = [
  {title: 'Networking Events & Professional Workshops', img: '/media/2237100300-WhatsApp-Image-2026-01-16-at-11.14.32-PM-1.png', href: '/events/', text: 'We host networking events, training sessions, and professional workshops designed to connect founders, consultants, and business leaders in Oakbrook Terrace'},
  {title: 'Performance Workstations', img: '/media/aa3035148c-Gemini_Generated_Image_7pp87l7pp87l7pp8_3-scaled-e1772659687822.jpg', href: '/dedicated/', text: 'Ergonomic sit/stand desks designed for long, productive work sessions. Because serious work deserves more than a kitchen table.'},
  {title: 'Junction Reading Room', img: '/media/86b51f62ae-image_27-scaled-e1772659725319.jpg', href: '/library/', text: 'A hand-selected library of growth and leadership books available for member checkout — because better thinking builds better businesses.'},
  {title: 'Active Wellness & Productivity Room', img: '/media/da4c556748-unnamed_6-e1772660358899.jpg', href: '/coworking/', text: 'Walking desks, cycling stations, and movement space help maintain energy and focus throughout the day — because productivity thrives when both mind and body are supported.'},
  {title: 'Printing Services', img: '/media/c4dc512512-printing.png', href: '/printed-services/'},
  {title: 'Tradeshow Realm', img: '/media/94856fcc80-tradeshow.png', href: '/trade-shows/'},
  {title: 'Workshops', img: '/media/759405a994-workshop.png', href: '/workshops/'},
  {title: 'Webinars', img: '/media/a18c8126a2-webinar-1.png', href: '/webinars/'},
  {title: 'LLC Setup', img: '/media/f264a969b9-llc.png', href: '/llc-setup/'},
  {title: 'Notary Services', img: '/media/b27262ec27-notray.png', href: '/notary-public/'},
  {title: 'Business Automations', img: '/media/2ca5049d4f-bussiness-automations.jpg', href: '/digital-services/'},
  {title: 'Digital Growth', img: '/media/93c111cc45-digital-growth.png', href: '/digital-presence/'},
  {title: 'BPO Services', img: '/media/34f5480b28-bpo-services.png', href: '/bpo-services/'},
];

const faqs = homeFaqs as Array<{q: string; a: string}>;

export default async function Home() {
  const [rawServices, statsItem] = await Promise.all([
    publicItems('services'),
    publicSetting('homepage-stats'),
  ]);

  const services = rawServices && rawServices.length > 0
    ? rawServices.map(s => ({
        title: s.title,
        img: String(s.metadata?.img ?? ''),
        href: String(s.metadata?.href ?? '/services/'),
        ...(s.metadata?.text ? {text: String(s.metadata.text)} : {}),
      })).filter(s => s.img)
    : defaultServices;

  const stats: Array<{value: string; label: string}> = Array.isArray(statsItem?.metadata?.items)
    ? (statsItem.metadata.items as Array<{value: string; label: string}>)
    : defaultStats;

  return <PublicLayout>
    <main id="main" className="home-page hp-home lv-home">
      <section className="lv-hero" aria-labelledby="hp-title"><HeroSlides/></section>

      <section className="hp-section lv-intro" aria-labelledby="lv-intro-title"><div className="hp-shell lv-intro-grid">
        <div>
          <p className="eyebrow hp-eyebrow">MORE THAN A WORKSPACE</p>
          <h2 id="lv-intro-title" className="hp-heading">At The Junction, we go beyond providing workspaces</h2>
          <p className="lv-lead">We create flexible environments that adapt to the way you work. Thoughtfully designed to inspire creativity and elevate productivity, our space encourage meaningful collaboration and turns ideas into real impact.</p>
        </div>
        <div className="lv-think">
          <span className="lv-think-word">Think</span>
          <Image src="/media/8acf93fa71-workspace-logo.png" alt="Workspace Junction emblem: Collaborate boldly, grow endlessly" width={302} height={313} className="lv-emblem"/>
          <span className="lv-think-word">Build</span>
        </div>
      </div></section>

      <section className="hp-section lv-events" aria-labelledby="lv-events-title"><div className="hp-shell">
        <dl className="lv-stats">{stats.map(s => <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>)}</dl>
        <div className="lv-split">
          <figure className="lv-photo"><Image src="/media/2b124bae06-Rectangle-5527.png" alt="A workshop audience seated in the Workspace Junction event space" fill sizes="(max-width: 900px) calc(100vw - 40px), 560px" className="hp-photo"/></figure>
          <div className="lv-copy">
            <p className="eyebrow hp-eyebrow">EVENTS &amp; WORKSHOPS</p>
            <h2 id="lv-events-title" className="hp-heading">Event &amp; Workshop Space Rental in Oakbrook Terrace / Lombard / Villa Park</h2>
            <p>Host corporate events, workshops, seminars, networking gatherings, and training sessions in a modern, presentation-ready venue accommodating up to 50 guests.</p>
            <p>With access to breakout boardrooms, kitchen facilities for catering, and a professional environment designed for productive engagement, Workspace Junction makes hosting seamless and elevated.</p>
            <div className="hp-actions"><BookingButton className="btn btn-primary lv-pill" service="Event space">Host Event <ArrowUpRight size={18}/></BookingButton><a href={routeFor('events', '/events/')} className="text-link hp-link">Reserve for Event <ArrowUpRight size={18}/></a></div>
          </div>
        </div>
      </div></section>

      <div className="hp-pricing lv-pricing"><Pricing eyebrow="MEMBERSHIPS" title="Workspace on Your Terms" intro="Why adjust your workday to an office when your workspace can adjust to you? Workspace Junction offers flexible, on-demand shared and private workspaces — available when you need them, with no long-term commitments. An environment where entrepreneurs stay focused and move faster."/></div>

      <section className="hp-section lv-meeting" aria-labelledby="lv-meeting-title"><div className="hp-shell lv-split lv-split-rev">
        <div className="lv-copy">
          <p className="eyebrow hp-eyebrow">MEETING ROOMS</p>
          <h2 id="lv-meeting-title" className="hp-heading">Meeting &amp; Conference Room Rental in Oakbrook / Lombard / Villa Park</h2>
          <p>Fully furnished huddle rooms, private boardrooms, and modern conference suites designed for serious, distraction-free work. Ideal for strategy sessions, client meetings, team collaborations, and private gatherings — all within a professional, executive setting.</p>
          <p>Available by the hour or day, with flexible booking and no long-term commitments. When your work demands focus, the space is ready.</p>
          <div className="hp-actions"><BookingButton className="btn btn-primary lv-pill" service="Meeting rooms">Reserve Your Room <ArrowUpRight size={18}/></BookingButton><a href={routeFor('meeting-rooms', '/meeting-rooms/')} className="text-link hp-link">Details <ArrowUpRight size={18}/></a></div>
        </div>
        <figure className="lv-photo lv-photo-free"><Image src="/media/17c10c9bf6-Group-1597885688.png" alt="A client presentation in a conference room, with a boardroom video call inset" fill sizes="(max-width: 900px) calc(100vw - 40px), 560px" className="lv-contain"/></figure>
      </div></section>

      <section className="hp-section lv-podcast amb-local" aria-labelledby="lv-podcast-title"><div className="hp-shell">
        <div className="lv-podcast-head">
          <Image src="https://chicagolandpodcaststudio.com/images/logo-chicagoland.png" alt="Chicagoland Podcast Studio" width={180} height={60} className="lv-podcast-logo"/>
          <div><p className="eyebrow hp-eyebrow">CREATE &amp; BROADCAST</p><h2 id="lv-podcast-title" className="hp-heading">Chicagoland Podcast Studio</h2></div>
          <a href="https://chicagolandpodcaststudio.com" target="_blank" rel="noreferrer" className="text-link hp-link">Visit Site <ArrowUpRight size={18}/></a>
        </div>
        <div className="lv-podcast-photos">
          <figure className="lv-photo"><Image src="/media/d978fc3d1e-abd1.jpg" alt="Three people recording a podcast at the studio desk" fill sizes="(max-width: 900px) calc(100vw - 40px), 760px" className="hp-photo"/></figure>
          <figure className="lv-photo"><Image src="/media/80ce3cafcc-ezgif-553327e8e003b6e3.png" alt="An interview podcast recorded at a round table" fill sizes="(max-width: 900px) calc(100vw - 40px), 400px" className="hp-photo"/></figure>
        </div>
        <StudioTabs/>
      </div></section>

      <section className="hp-section lv-services" aria-labelledby="lv-services-title"><div className="hp-shell">
        <div className="hp-section-head"><div><p className="eyebrow hp-eyebrow">BEYOND THE DESK</p><h2 id="lv-services-title" className="hp-heading">When working from home isn’t working anymore, we’ve got you covered</h2></div></div>
        <div className="lv-service-grid">{services.map(s => <a key={s.title} href={s.href} className={'lv-service' + (s.text ? ' has-text' : '')}>
          <span className="lv-service-img"><Image src={s.img} alt="" fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 400px" className="hp-photo"/></span>
          <span className="lv-service-body"><span className="lv-service-title">{s.title}</span>{s.text && <span className="lv-service-text">{s.text}</span>}<ArrowUpRight size={18} aria-hidden="true"/></span>
        </a>)}</div>
      </div></section>

      <section className="hp-section hp-faq lv-faq" aria-labelledby="hp-faq-title"><div className="hp-shell hp-faq-grid">
        <div className="lv-faq-side">
          <p className="eyebrow hp-eyebrow">FAQ &amp; CONTACT</p>
          <h2 id="hp-faq-title" className="hp-heading">Got questions? We’ve got you covered!</h2>
          <p>From memberships to meeting rooms — find quick answers to all your coworking queries right here. No confusion, just clarity.</p>
          <figure className="lv-photo lv-faq-photo"><Image src="/media/dfcf491571-image.png" alt="Members working together at a table beneath the Workspace Junction sign" fill sizes="(max-width: 900px) calc(100vw - 40px), 420px" className="hp-photo"/></figure>
          <p>Find answers to common questions or get in touch with us for more information!</p>
          <div className="hp-actions"><a href={routeFor('contact', '/contact-us/')} className="btn btn-primary lv-pill">Contact Us <ArrowUpRight size={18}/></a></div>
        </div>
        <div className="hp-faq-list">{faqs.map(({q, a}) => <details key={q}><summary>{q}<Plus size={19}/></summary><p>{a}</p></details>)}</div>
      </div></section>
    </main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLd({'@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'Workspace Junction', url: 'https://workspacejunction.com', telephone: '+17739861908', email: 'grow@workspacejunction.com', address: {'@type': 'PostalAddress', streetAddress: '1S280 Summit Ave Unit E2 Suite 1', addressLocality: 'Oakbrook Terrace', addressRegion: 'IL', postalCode: '60181', addressCountry: 'US'}})}}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLd({'@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(({q, a}) => ({'@type': 'Question', name: q, acceptedAnswer: {'@type': 'Answer', text: a}}))})}}/>
  </PublicLayout>;
}
