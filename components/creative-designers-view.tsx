import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, Check} from 'lucide-react';
import {BookingButton} from './booking';
import {TestimonialsSection} from './testimonials-section';
import './creative-designers-view.css';

const workflowPhases = [
  {
    num: '01',
    title: 'Concept & Focus Work',
    desc: 'Quiet ergonomic desks, dual-monitor plug-ins, and focus zones for wireframing, branding, and typography exploration.'
  },
  {
    num: '02',
    title: 'Ideation & Team Sprints',
    desc: 'Collaborative breakout spaces with full-height writable walls, standing brainstorm tables, and rapid-prototyping areas.'
  },
  {
    num: '03',
    title: 'Client Pitches & Briefs',
    desc: 'High-definition boardroom displays and conference suites that reflect your studio’s creative caliber.'
  },
  {
    num: '04',
    title: 'Media & Asset Creation',
    desc: 'On-site photography, 4K video recording, and audio podcast studios for campaign visual deliverables and launch collateral.'
  }
];

const workspaceOptions = [
  {
    name: 'Hot Desks',
    desc: 'Flexible seating for freelance designers, remote art directors, and day-to-day creative execution.',
    href: '/coworking/'
  },
  {
    name: 'Dedicated Desks',
    desc: 'Your reserved design station with dual-monitor arms, lockable storage, and 24/7 access for deep work.',
    href: '/dedicated/'
  },
  {
    name: 'Private Studio Offices',
    desc: 'Acoustically treated, furnished private offices for boutique agency teams, client reviews, and confidential strategy.',
    href: '/virtual-office/'
  }
];

const studioTiers = [
  {
    num: '01',
    name: 'Photo Studio',
    desc: 'Product staging, commercial headshots, brand lifestyle imagery, and campaign lookbooks.',
    href: '/photo-studio/'
  },
  {
    num: '02',
    name: 'Video Studio',
    desc: 'Commercial video shoots, motion reel reviews, unboxings, customer stories, and social campaign assets.',
    href: '/photo-studio/'
  },
  {
    num: '03',
    name: 'Podcast Studio',
    desc: 'Soundproof audio recording with broadcast microphones for creative agency podcasts and client thought leadership.',
    href: '/podcast-studio/'
  },
  {
    num: '04',
    name: 'Webinar & Event Space',
    desc: 'Hybrid workshop hosting, client masterclasses, design presentations, and live digital launches.',
    href: '/webinars/'
  }
];

const realWorldCases = [
  {
    title: 'Design Sprints & Workshops',
    desc: 'Break out into collaborative zones with magnetic whiteboards and presentation displays for brand discovery sessions.'
  },
  {
    title: 'Client Pitches & Presentations',
    desc: 'Host prospective clients and executive stakeholders in modern conference rooms equipped with high-res video streaming.'
  },
  {
    title: 'Campaign Content Creation',
    desc: 'Stage multi-hour product photo shoots, lighting setups, and promotional videos without paying off-site studio rental premiums.'
  },
  {
    title: 'Print & Exhibit Collateral',
    desc: 'Inspect proofs, banners, acrylic signage, and presentation books directly through our TradeShow Realm on-site partner.'
  }
];

const reasons = [
  {
    num: '01',
    title: 'Spaces Built for the Creative Arc',
    desc: 'From solitary deep-focus sessions to lively team brainstorms, work in environments that match each stage of design.'
  },
  {
    num: '02',
    title: 'High-Impact Client Experiences',
    desc: 'Present decks, design systems, and creative campaigns in professional conference suites that inspire client trust.'
  },
  {
    num: '03',
    title: 'On-Demand Production Studios',
    desc: 'Access lighting grids, 4K video setups, and audio isolation booths without tying up capital in studio equipment leases.'
  },
  {
    num: '04',
    title: 'Cross-Disciplinary Community',
    desc: 'Collaborate with technologists, DTC founders, strategists, and marketing directors working inside the Junction ecosystem.'
  },
  {
    num: '05',
    title: 'Agile & Cost-Effective',
    desc: 'Scale up desk capacity or studio hours when project timelines accelerate, with zero restrictive commercial leases.'
  }
];

const audienceGroups = [
  'Advertising & Branding Agencies',
  'Graphic, UI/UX & Brand Designers',
  'Multimedia, 3D & Motion Designers',
  'Content Creators & Visual Storytellers',
  'Creative Directors & Art Directors',
  'Boutique Design & Marketing Studios',
  'Distributed Creative & Remote Teams'
];

export function CreativeDesignersPageView() {
  return (
    <main id="main" className="cd-page">
      <div className="cd-wrap">
        <nav className="cd-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/use-cases/">Use Cases</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Creative Designers &amp; Agencies</span>
        </nav>

        {/* Hero Section */}
        <section className="cd-hero" aria-labelledby="cd-title">
          <div>
            <p className="cd-eyebrow">BUILT FOR STUDIOS, CREATORS &amp; VISUAL BUILDERS</p>
            <h1 id="cd-title">
              Craft ideas.<br />
              Elevate every <em>campaign.</em>
            </h1>
          </div>
          <div className="cd-hero-copy">
            <p>
              Creative designers and agencies thrive on ideas, collaboration, and execution. Whether you’re crafting brand identities, digital interfaces, or multimedia campaigns, Workspace Junction gives you flexible studios, presentation suites, and high-speed infrastructure.
            </p>
            <div className="cd-actions">
              <BookingButton service="Creative Workspace" className="cd-button wj-button-yellow">
                Explore Creative Spaces <ArrowUpRight size={18} aria-hidden="true" />
              </BookingButton>
              <Link className="cd-text-link" href="#cd-studios">
                View Studios &amp; Suites <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Hero Media Banner */}
        <figure className="cd-hero-image">
          <Image
            src="/media/8a92839374-image-13.png"
            alt="Workspace Junction creative design and collaboration hub"
            width={1170}
            height={406}
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
          />
          <figcaption>
            <span>CREATIVE AGENCY &amp; DESIGN HEADQUARTERS</span>
            <span>Oakbrook Terrace, IL</span>
          </figcaption>
        </figure>

        {/* Creative Workflow Grid */}
        <section className="cd-section" aria-labelledby="cd-workflow-title">
          <div className="cd-section-head">
            <div>
              <p className="cd-eyebrow">THE CREATIVE WORKFLOW</p>
              <h2 id="cd-workflow-title">
                Spaces engineered for<br />
                every phase of design.
              </h2>
            </div>
            <p>
              Designers juggle solo concept work, team sprints, client pitches, and studio shoots. Our environment is structured around the complete lifecycle of creative deliverables.
            </p>
          </div>

          <div className="cd-grid-2x2">
            {workflowPhases.map((phase) => (
              <article key={phase.title} className="cd-card">
                <span className="cd-number">{phase.num}</span>
                <h3>{phase.title}</h3>
                <p>{phase.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Solutions Band: Workstations & Studios */}
      <section className="cd-band" id="cd-studios" aria-labelledby="cd-studios-title">
        <div className="cd-wrap">
          <div className="cd-section-head">
            <div>
              <p className="cd-eyebrow">WORKSPACES &amp; PRODUCTION</p>
              <h2 id="cd-studios-title">
                Equipped for flexibility,<br />
                collaboration, and speed.
              </h2>
            </div>
            <p>
              From personal dual-monitor workstations to broadcast-ready podcast and photo studios.
            </p>
          </div>

          <div className="cd-features-row">
            <div className="cd-col-group">
              <span className="cd-group-tag">FLEXIBLE DESKS &amp; PRIVATE STUDIOS</span>
              <div className="cd-group-cards">
                {workspaceOptions.map((w) => (
                  <article key={w.name} className="cd-subcard">
                    <h4>{w.name}</h4>
                    <p>{w.desc}</p>
                    <Link href={w.href} className="cd-inline-link">
                      Explore option <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <div className="cd-col-group">
              <span className="cd-group-tag">MEDIA PRODUCTION STUDIOS</span>
              <div className="cd-group-cards">
                {studioTiers.map((s) => (
                  <article key={s.name} className="cd-subcard">
                    <h4>{s.name}</h4>
                    <p>{s.desc}</p>
                    <Link href={s.href} className="cd-inline-link">
                      View studio details <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="cd-wrap">
        {/* Split Section 1: Ideation & Collaborative Breakouts */}
        <section className="cd-split-section" aria-labelledby="cd-collab-title">
          <div className="cd-split-media">
            <Image
              src="/media/5da1b9870a-Rectangle-5704-1.png"
              alt="Creative collaboration zone with whiteboard and sprint tables"
              width={572}
              height={503}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="cd-split-content">
            <p className="cd-eyebrow">IDEATION &amp; TEAM BREAKOUTS</p>
            <h2 id="cd-collab-title">
              Where teams connect<br />
              and concepts take shape.
            </h2>
            <p>
              True creative breakthroughs rarely happen in isolation. Our open breakout areas and design-thinking zones give your team room to brainstorm:
            </p>
            <ul className="cd-checklist">
              <li>Full-height writable glass walls for wireframes and roadmaps</li>
              <li>Standing brainstorm tables for fast, active design standups</li>
              <li>Acoustic privacy pods for quick client updates and review calls</li>
              <li>High-speed fiber connectivity for large Figma, Adobe, and 4K file syncs</li>
            </ul>
            <div className="cd-actions">
              <Link href="/coworking/" className="cd-button wj-button-green">
                Explore Collaborative Zones <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Split Section 2: Meeting & Presentation Suites */}
        <section className="cd-split-section reverse" aria-labelledby="cd-meetings-title">
          <div className="cd-split-media">
            <Image
              src="/media/e6ea6af600-Rectangle-5664-3.png"
              alt="Executive boardroom table and presentation display for client pitches"
              width={572}
              height={443}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="cd-split-content">
            <p className="cd-eyebrow">CLIENT PRESENTATION SUITES</p>
            <h2 id="cd-meetings-title">
              Pitch with authority.<br />
              Present without friction.
            </h2>
            <p>
              When it’s time to deliver your agency’s vision, showcase your portfolio in conference rooms designed for effortless client confidence:
            </p>
            <ul className="cd-checklist">
              <li>4K wireless screen casting for crisp presentation decks and UI walk-throughs</li>
              <li>Acoustically insulated boardrooms seating up to 10 stakeholders</li>
              <li>Dedicated video conference audio and auto-framing cameras</li>
              <li>Complimentary barista coffee and tea service for your visiting clients</li>
            </ul>
            <div className="cd-actions">
              <Link href="/meeting-rooms/" className="cd-button wj-button-green">
                Explore Meeting Rooms <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Split Section 3: TradeShow Realm Print & Tangible Deliverables */}
        <section className="cd-split-section" aria-labelledby="cd-print-title">
          <div className="cd-split-media">
            <Image
              src="/media/4a77510d48-Rectangle-5713-2.png"
              alt="Print production, banners, and presentation boards"
              width={575}
              height={466}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="cd-split-content">
            <p className="cd-eyebrow">PRINT &amp; COLLATERAL PRODUCTION</p>
            <h2 id="cd-print-title">
              From digital artboards<br />
              to tangible excellence.
            </h2>
            <p>
              Bring your design concepts into the physical world with on-site print support through our specialized partner, TradeShow Realm:
            </p>
            <ul className="cd-checklist">
              <li>High-resolution presentation boards, proof prints, and campaign books</li>
              <li>Large-format trade show banners, backdrops, and event signage</li>
              <li>Premium business collateral, flyers, brochures, and promo handouts</li>
              <li>Member discounts on rush production and experimental finish proofs</li>
            </ul>
            <div className="cd-actions">
              <Link href="/trade-shows/" className="cd-button wj-button-green">
                Explore Print Services <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Real-World Use Cases 4-Grid */}
        <section className="cd-section" aria-labelledby="cd-usecases-title">
          <div className="cd-section-head">
            <div>
              <p className="cd-eyebrow">AGENCY APPLICATIONS</p>
              <h2 id="cd-usecases-title">
                How creative teams<br />
                maximize the Junction.
              </h2>
            </div>
            <p>
              Purpose-built spaces for high-stakes client pitches, multi-hour photo shoots, and intensive brand launches.
            </p>
          </div>

          <div className="cd-usecases-grid">
            {realWorldCases.map((u, i) => (
              <article key={u.title} className="cd-usecase-card">
                <span className="cd-number">0{i + 1}</span>
                <h3>{u.title}</h3>
                <p>{u.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Why Choose Workspace Junction */}
        <section className="cd-why-section" aria-labelledby="cd-why-title">
          <div className="cd-why-media">
            <Image
              src="/media/581d1f0575-Rectangle-5673.png"
              alt="Designers and creative professionals collaborating at Workspace Junction"
              width={572}
              height={285}
              sizes="(max-width: 700px) 100vw, 600px"
            />
            <div className="cd-why-quote">
              <p>&ldquo;The transition from kitchen-table design to a professional studio completely transformed how our agency pitches and closes enterprise clients.&rdquo;</p>
              <span>— Creative Agency Director</span>
            </div>
          </div>
          <div className="cd-why-content">
            <p className="cd-eyebrow">THE JUNCTION DIFFERENCE</p>
            <h2 id="cd-why-title">Why designers &amp; studios choose us.</h2>
            <div className="cd-reasons-list">
              {reasons.map((r) => (
                <div key={r.num} className="cd-reason-row">
                  <span className="cd-reason-num">{r.num}</span>
                  <div>
                    <h4>{r.title}</h4>
                    <p>{r.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who Benefits Most */}
        <section className="cd-audience-section" aria-labelledby="cd-audience-title">
          <div className="cd-audience-box">
            <div className="cd-audience-image">
              <Image
                src="/media/01d174084f-Rectangle-5670-3.png"
                alt="Creative design agency members in discussion"
                width={672}
                height={409}
                sizes="(max-width: 700px) 100vw, 550px"
              />
            </div>
            <div className="cd-audience-content">
              <p className="cd-eyebrow">DESIGNED FOR VISIONARIES</p>
              <h2 id="cd-audience-title">Who benefits most.</h2>
              <ul className="cd-audience-list">
                {audienceGroups.map((a) => (
                  <li key={a}>
                    <Check size={18} className="cd-check-icon" aria-hidden="true" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              <div className="cd-actions">
                <BookingButton service="Creative Consultation" className="cd-button wj-button-yellow">
                  Schedule Studio Consultation <ArrowUpRight size={17} aria-hidden="true" />
                </BookingButton>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Testimonials */}
      <TestimonialsSection slug="creative-designers-agencies" />

      {/* Closing CTA */}
      <div className="cd-wrap">
        <section className="cd-closing" aria-labelledby="cd-closing-title">
          <p className="cd-eyebrow">POWER YOUR CREATIVE PRACTICE</p>
          <h2 id="cd-closing-title">
            Bring your agency or design practice<br />
            to a space built to create.
          </h2>
          <div className="cd-actions">
            <BookingButton service="Creative Workspace" className="cd-button wj-button-yellow">
              Book a Tour <ArrowUpRight size={18} aria-hidden="true" />
            </BookingButton>
            <Link href="/contact-us/" className="cd-button wj-button-green">
              Talk to Our Team <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
