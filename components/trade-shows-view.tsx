import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, Check, Plus} from 'lucide-react';
import {BookingButton} from './booking';
import {TestimonialsSection} from './testimonials-section';
import './trade-shows-view.css';

const tradeServices = [
  {
    num: '01',
    title: 'Booth Consultation & Strategy',
    desc: 'Expert guidance on booth sizing, foot-traffic flow, presentation angles, and exhibition hall compliance rules.'
  },
  {
    num: '02',
    title: 'Large-Format Displays & Signage',
    desc: 'Retractable banner stands, step-and-repeats, hanging fabric headers, and custom acrylic display stands.'
  },
  {
    num: '03',
    title: 'Marketing Collateral & Handouts',
    desc: 'High-impact brochures, product lookbooks, flyers, takeaway cards, and promotional merchandise kits.'
  },
  {
    num: '04',
    title: 'On-Site Setup & Representation',
    desc: 'Turnkey booth assembly, staff representation, lead generation qualification, and post-event reporting.'
  }
];

const packages = [
  {
    id: 'starter-booth',
    num: '01',
    name: 'Starter Booth Package',
    badge: 'First-Time Exhibitors',
    tagline: 'Best for small spaces & tabletop displays',
    price: '$750 – $1,200',
    period: 'per event project',
    popular: false,
    description: 'Designed for startups and growing businesses attending trade shows that need clean, professional visual materials without complex booth construction.',
    features: [
      'Trade show consultation & layout advice',
      'Premium retractable banner stand (33"x81")',
      'Custom printed table throw / runner',
      '500 high-gloss marketing brochures / flyers',
      'Acrylic tabletop sign & business card holder',
      'Pre-press file review & print quality check'
    ],
    addons: [
      'Additional banner stand: +$195',
      '1,000 extra flyers: +$120',
      'Branded name badges & lanyards: Inquire'
    ]
  },
  {
    id: 'professional-booth',
    num: '02',
    name: 'Professional Trade Show Package',
    badge: 'Most Popular',
    tagline: 'Polished presence for serious lead generation',
    price: '$2,500 – $4,000',
    period: 'per event project',
    popular: true,
    description: 'A complete exhibition system for companies ready to establish authority, attract qualified foot traffic, and convert event leads into revenue.',
    features: [
      'Comprehensive booth layout & traffic strategy',
      '10ft seamless tension fabric backdrop display',
      'Two premium retractable banner stands',
      'Custom 3D acrylic display & logo signage',
      '1,000 premium brochures or product lookbooks',
      'Custom branded podium / counter wrap',
      'On-site delivery & setup instructions'
    ],
    addons: [
      'LED spotlight package: +$180',
      'Custom merchandise / swag kits: Inquire',
      'Digital tablet kiosk stand: +$250'
    ]
  },
  {
    id: 'full-representation',
    num: '03',
    name: 'Full Event Representation Package',
    badge: 'Turnkey Solution',
    tagline: 'Complete booth management & event staffing',
    price: '$6,000 – $12,000+',
    period: 'per event project',
    popular: false,
    description: 'A white-glove, end-to-end solution where TradeShow Realm designs, produces, ships, installs, and staffs your booth with trained brand ambassadors.',
    features: [
      'Full booth architecture design & 3D rendering',
      'Complete modular booth display & illuminated signage',
      'Full marketing collateral suite (catalogues, flyers, badges)',
      'Freight logistics, on-site assembly & teardown',
      'Dedicated TradeShow Realm brand ambassador on site',
      'Live attendee qualification & lead scanning',
      'Post-event lead digest & performance summary'
    ],
    addons: [
      'Multi-day staffing coverage: Included',
      'Video reel & interactive screen loop: Included',
      'VIP client hospitality coordination: Inquire'
    ]
  }
];

const memberAdvantages = [
  '20% exclusive discount on all print and display production',
  'Priority rush production for upcoming expo deadlines',
  'Hands-on mockup reviews in the on-site Display Studio',
  'Complimentary proofing and file prep by print specialists',
  'Bundled event launch and collateral distribution packages'
];

const exhibitors = [
  'Tech Startups & SaaS Platforms',
  'DTC Brands & Product Innovators',
  'Commercial Contractors & Builders',
  'Healthcare & Wellness Practices',
  'Real Estate & Financial Advisory Firms',
  'Educational Programs & Nonprofits'
];

export function TradeShowsPageView() {
  return (
    <main id="main" className="ts-page">
      <div className="ts-wrap">
        <nav className="ts-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Trade Shows</span>
        </nav>

        {/* Hero Section */}
        <header className="ts-hero" aria-labelledby="ts-title">
          <div>
            <p className="ts-eyebrow">TRADESHOW REALM AT WORKSPACE JUNCTION</p>
            <h1 id="ts-title">
              Small brand.<br />
              Big <em>presence.</em>
            </h1>
          </div>
          <div className="ts-hero-copy">
            <p>
              From custom booth design and large-format printing to on-site representation and attendee lead generation — TradeShow Realm helps startups and growing businesses stand out on the exhibition floor at startup-friendly pricing.
            </p>
            <div className="ts-actions">
              <BookingButton service="Trade Show Consultation" className="ts-button wj-button-yellow">
                Plan Your Trade Show <ArrowUpRight size={18} aria-hidden="true" />
              </BookingButton>
              <a className="ts-text-link" href="#pricing">
                Explore Packages &amp; Pricing <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        {/* Hero Banner Photo */}
        <figure className="ts-hero-image">
          <Image
            src="/media/fd433fef4f-image-3.png"
            alt="An exhibition hall with branded trade show booths and visitors"
            width={1170}
            height={406}
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
          />
          <figcaption>
            <span>FROM FIRST IMPRESSION TO LASTING CONNECTION</span>
            <span>TradeShow Realm · Oakbrook Terrace, IL</span>
          </figcaption>
        </figure>

        {/* Concept to Execution Services (2x2 Grid) */}
        <section className="ts-section" aria-labelledby="ts-services-title">
          <div className="ts-section-head">
            <div>
              <p className="ts-eyebrow">FROM CONCEPT TO EXECUTION</p>
              <h2 id="ts-services-title">
                Everything you need to<br />
                stand out at your next event.
              </h2>
            </div>
            <p>
              We help businesses prepare for conventions, expos, and conferences with high-grade physical displays, persuasive print collateral, and strategic booth planning.
            </p>
          </div>

          <div className="ts-grid-2x2">
            {tradeServices.map((svc) => (
              <article key={svc.num} className="ts-card">
                <span className="ts-number">{svc.num}</span>
                <h3>{svc.title}</h3>
                <p>{svc.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Dark Forest Section: Why TradeShow Realm */}
      <section className="ts-band" aria-labelledby="ts-band-title">
        <div className="ts-wrap">
          <div className="ts-section-head">
            <div>
              <p className="ts-eyebrow">BUILT FOR STARTUPS &amp; GROWING BUSINESSES</p>
              <h2 id="ts-band-title">
                More than printing.<br />
                A complete presence.
              </h2>
            </div>
            <p>
              Operating directly inside the Workspace Junction ecosystem allows TradeShow Realm to pass operational efficiency directly to you — delivering commercial-grade materials often 60–80% below traditional convention vendors.
            </p>
          </div>

          <div className="ts-band-stats">
            <div className="ts-stat-item">
              <span className="ts-stat-num">60–80%</span>
              <span className="ts-stat-lbl">Lower cost than convention hall vendors</span>
            </div>
            <div className="ts-stat-item">
              <span className="ts-stat-num">100%</span>
              <span className="ts-stat-lbl">Turnkey delivery &amp; pre-press review</span>
            </div>
            <div className="ts-stat-item">
              <span className="ts-stat-num">On-Site</span>
              <span className="ts-stat-lbl">Display studio &amp; physical sample review</span>
            </div>
          </div>
        </div>
      </section>

      <div className="ts-wrap">
        {/* Experience Center / Display Studio Split Section */}
        <section className="ts-split-section" aria-labelledby="ts-studio-title">
          <div className="ts-split-media">
            <Image
              src="/media/6c98c77f3e-Rectangle-5665-4.png"
              alt="Creative professionals comparing color swatches and print materials in display studio"
              width={555}
              height={414}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="ts-split-content">
            <p className="ts-eyebrow">THE TRADESHOW REALM EXPERIENCE CENTER</p>
            <h2 id="ts-studio-title">
              See it. Feel it.<br />
              Make it yours.
            </h2>
            <p>
              Visit our on-site Trade Show Display Studio in Oakbrook Terrace to compare acrylic signage, fabric banner finishes, lighting hardware, and booth setups in person before committing to production:
            </p>
            <ul className="ts-checklist">
              {memberAdvantages.map((adv) => (
                <li key={adv}>
                  <Check size={16} className="ts-check" aria-hidden="true" />
                  <span>{adv}</span>
                </li>
              ))}
            </ul>
            <div className="ts-actions">
              <BookingButton service="Display Studio Visit" className="ts-button wj-button-green">
                Visit the Display Studio <ArrowUpRight size={17} aria-hidden="true" />
              </BookingButton>
              <a
                className="ts-text-link"
                href="https://go.fliplink.me/view/F7287294-2BD7-41B0-B6FB-BBB0F18B9E4D"
                target="_blank"
                rel="noopener noreferrer"
              >
                Browse Digital Catalog <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        {/* ── PRICING SECTION: Clean Standardized Boxed Cards ── */}
        <section className="ts-pricing-section" id="pricing" aria-labelledby="ts-pricing-title">
          <div className="ts-section-head">
            <div>
              <p className="ts-eyebrow">TRADESHOW REALM PACKAGES</p>
              <h2 id="ts-pricing-title">
                A presence for<br />
                every stage.
              </h2>
            </div>
            <p>
              Choose a starting tier, then tailor materials and on-site support to your event. Request a custom quote to confirm timeline, hardware options, and final pricing.
            </p>
          </div>

          <div className="ts-pricing-grid">
            {packages.map((pkg) => (
              <article key={pkg.id} className={`ts-plan-card ${pkg.popular ? 'is-popular' : ''}`}>
                {pkg.popular && <span className="ts-plan-badge">{pkg.badge}</span>}

                <div className="ts-card-header">
                  <span className="ts-number">{pkg.num}</span>
                  <h3 className="ts-card-title">{pkg.name}</h3>
                  <div className="ts-price-display">
                    <span className="ts-price-number">{pkg.price}</span>
                    <span className="ts-price-period">/ {pkg.period}</span>
                  </div>
                  <p className="ts-card-tagline">{pkg.tagline}</p>
                </div>

                <div className="ts-card-divider" />

                <p className="ts-card-desc">{pkg.description}</p>

                <div className="ts-features-block">
                  <span className="ts-features-label">WHAT’S INCLUDED:</span>
                  <ul className="ts-card-features">
                    {pkg.features.map((feat) => (
                      <li key={feat}>
                        <span className="ts-check-badge" aria-hidden="true">
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {pkg.addons.length > 0 && (
                  <details className="ts-addons-details">
                    <summary>
                      <span>Popular Add-ons</span>
                      <Plus size={16} aria-hidden="true" />
                    </summary>
                    <ul>
                      {pkg.addons.map((add) => (
                        <li key={add}>{add}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="ts-card-footer">
                  <BookingButton
                    service={pkg.name}
                    className={`ts-plan-btn ${pkg.popular ? 'wj-button-yellow' : 'wj-button-green'}`}
                  >
                    <span>Request a Quote</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </BookingButton>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Who Exhibits / Target Audience */}
        <section className="ts-audience-section" aria-labelledby="ts-aud-title">
          <div className="ts-audience-box">
            <div className="ts-audience-content">
              <p className="ts-eyebrow">DESIGNED FOR GROWING BUSINESSES</p>
              <h2 id="ts-aud-title">Who benefits most from TradeShow Realm.</h2>
              <p>
                Whether launching your first product at a local trade show or managing a nationwide expo tour, we provide the hardware and creative backing to ensure your team closes deals:
              </p>
              <div className="ts-audience-chips">
                {exhibitors.map((ex) => (
                  <div key={ex} className="ts-audience-chip">
                    <Check size={16} className="ts-check" aria-hidden="true" />
                    <span>{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Testimonials Section */}
      <TestimonialsSection slug="trade-shows" />

      {/* Closing CTA */}
      <div className="ts-wrap">
        <section className="ts-closing" aria-labelledby="ts-closing-title">
          <p className="ts-eyebrow">YOUR NEXT EVENT STARTS HERE</p>
          <h2 id="ts-closing-title">
            Make your brand impossible to ignore<br />
            at your next conference or expo.
          </h2>
          <div className="ts-actions">
            <BookingButton service="Trade Show Consultation" className="ts-button wj-button-yellow">
              Plan Your Trade Show <ArrowUpRight size={18} aria-hidden="true" />
            </BookingButton>
            <Link href="/contact-us/" className="ts-button wj-button-green">
              Talk to Our Team <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
