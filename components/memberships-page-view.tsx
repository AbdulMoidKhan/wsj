import Image from '@/components/consistent-image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  Plus
} from 'lucide-react';
import {BookingButton} from './booking';
import {CommunityMembershipSection} from './community-membership-section';
import {TestimonialsSection} from './testimonials-section';
import type {MembershipPlanItem} from '@/lib/community-pricing';
import livePages from '@/data/live-pages.json';
import {safeContent} from '@/lib/site';
import './memberships-page-view.css';

type ContentNode = {
  t: string;
  text?: string;
  html?: string;
  children?: ContentNode[];
  rows?: string[][];
  items?: {q?: string; a?: string; text?: string}[];
};

function flatten(nodes: ContentNode[]): ContentNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}

const rawContent = livePages.pages as unknown as Record<string, ContentNode[]>;
const rawMemNodes = flatten(rawContent['/memberships/'] || []);
const membershipFaqs = rawMemNodes
  .filter(n => n.t === 'faq')
  .flatMap(n => n.items || [])
  .filter(item => item.q && item.a);

const passCards = [
  {
    num: '01',
    tier: 'Bronze',
    badge: 'Single Day',
    pass: '1 Day Pass',
    price: '$50',
    period: 'per day',
    tagline: 'Best for occasional visits & focused sprints',
    hours: '8 AM – 6 PM Access',
    popular: false,
    description: 'Single-day access to our open coworking space in Oakbrook Terrace. Ideal for focused work sessions without ongoing commitments.',
    features: [
      'High-speed enterprise business WiFi',
      'Ergonomic sit/stand desk seating',
      'Complimentary artisan coffee & tea',
      'Quiet phone booth & huddle room access',
      'Active wellness & movement room',
      'Community library access'
    ]
  },
  {
    num: '02',
    tier: 'Silver',
    badge: 'Flexible Flex',
    pass: '5 Day Pass Bundle',
    price: '$100',
    period: '5 visits / month',
    tagline: 'Ideal for hybrid workers & freelancers',
    hours: '8 AM – 6 PM Access',
    popular: false,
    description: 'Five flexible coworking days per month for professionals who want productive workspace without committing to daily leases.',
    features: [
      '5 flexible day passes every month',
      'High-speed enterprise business WiFi',
      'Ergonomic workstation seating',
      'Coffee, tea & refreshment bar',
      'Phone booths & focus pods',
      'Library and huddle room privileges'
    ]
  },
  {
    num: '03',
    tier: 'Gold',
    badge: 'Most Popular',
    pass: '10 Day Pass Bundle',
    price: '$150',
    period: '10 visits / month',
    tagline: 'Consistent productivity for hybrid teams',
    hours: '8 AM – 6 PM Access',
    popular: true,
    description: 'Ten coworking visits per month designed for entrepreneurs and growing teams seeking regular focus time in an executive environment.',
    features: [
      '10 flexible day passes every month',
      '2 hours conference room booking credit',
      'Boardroom booking access with 10% discount',
      'Full amenity access (coffee, wellness room)',
      'High-speed fiber internet & printing add-on',
      'Member partner perks & event invitations'
    ]
  },
  {
    num: '04',
    tier: 'Platinum',
    badge: 'Unlimited',
    pass: 'Unlimited Monthly Access',
    price: '$250',
    period: 'full monthly access',
    tagline: 'Your everyday flexible headquarters',
    hours: '24/7 Unrestricted Access',
    popular: false,
    description: 'Unlimited coworking access in Oakbrook Terrace for professionals who thrive in a consistent, collaborative workspace with round-the-clock entry.',
    features: [
      '24/7 keycard access (any day, any hour)',
      'Official commercial mailing address & mailbox',
      '4 hours / month conference room credits',
      'Boardroom credits with 10% discount',
      'Exclusive networking events & webinars included',
      'Digital presence and business support perks'
    ]
  }
];

const comparisonData = [
  {feature: 'Desks Access', bronze: '8 AM – 6 PM', silver: '8 AM – 6 PM', gold: '8 AM – 6 PM', platinum: '24/7 Full Access'},
  {feature: 'High-Speed Enterprise WiFi', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'},
  {feature: 'Artisan Coffee & Tea Station', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'},
  {feature: 'Printing & Scanning', bronze: 'Add-on', silver: 'Add-on', gold: 'Add-on', platinum: 'Add-on'},
  {feature: 'Huddle Room Access', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'},
  {feature: 'Conference Room (6-person)', bronze: 'no', silver: 'no', gold: '2 hrs / mo credit', platinum: '4 hrs / mo credit'},
  {feature: 'Boardroom (8–10 persons)', bronze: 'no', silver: 'no', gold: '2 hrs credit (10% off)', platinum: '4 hrs credit (10% off)'},
  {feature: 'Commercial Business Address', bronze: 'no', silver: 'no', gold: 'no', platinum: 'yes'},
  {feature: 'Private Mailbox & Receiving', bronze: 'no', silver: 'no', gold: 'no', platinum: 'yes'},
  {feature: 'Active Wellness Room', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'},
  {feature: 'Partner Discount Network', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'},
  {feature: 'Quiet Library Access', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'},
  {feature: 'Networking Events & Mixers', bronze: 'Add-on', silver: 'Add-on', gold: 'Add-on', platinum: 'yes'},
  {feature: 'Webinars & Masterclasses', bronze: 'no', silver: 'no', gold: 'no', platinum: 'yes'},
  {feature: 'Acoustic Telephone Booths', bronze: 'yes', silver: 'yes', gold: 'yes', platinum: 'yes'}
];

export function MembershipsPageView({communityPlans}: {communityPlans: MembershipPlanItem[]}) {
  return (
    <main id="main" className="mem-page">
      <div className="mem-wrap">
        <nav className="mem-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Memberships &amp; Passes</span>
        </nav>

        {/* Hero Section */}
        <header className="mem-hero" aria-labelledby="mem-title">
          <div>
            <p className="mem-eyebrow">WORKSPACE PASSES &amp; COMMUNITY ACCESS</p>
            <h1 id="mem-title">
              Your space.<br />
              Your <em>pace.</em>
            </h1>
          </div>
          <div className="mem-hero-copy">
            <p>
              Choose the access that fits the way you work. Compare day passes, multi-visit bundles, and 24/7 unlimited monthly coworking tiers in Oakbrook Terrace — all without rigid commercial leases.
            </p>
            <div className="mem-actions">
              <BookingButton service="Membership Consultation" className="mem-button wj-button-yellow">
                Find Your Ideal Pass <ArrowUpRight size={18} aria-hidden="true" />
              </BookingButton>
              <a className="mem-text-link" href="#pass-comparison">
                Compare Pass Features <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        {/* Hero Image */}
        <figure className="mem-hero-image" data-parallax="0.08" data-lag="0.1" data-skew="true">
          <Image
            src="/media/af55bc8a2b-image-17-1.png"
            alt="Workspace Junction modern coworking desks, private suites and lounge"
            width={1170}
            height={406}
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
          />
          <figcaption>
            <span>FLEXIBLE WORKSPACE ACCESS</span>
            <span>Oakbrook Terrace, IL</span>
          </figcaption>
        </figure>

        {/* ── SECTION 1: Standardized 4-Card Pass Grid ── */}
        <section className="mem-section" aria-labelledby="mem-passes-title">
          <div className="mem-section-head">
            <div>
              <p className="mem-eyebrow" data-anim="fade-up">FLEXIBLE WORKSPACE PASSES</p>
              <h2 id="mem-passes-title" data-anim="split-lines">
                Come for a day.<br />
                Stay for what’s next.
              </h2>
            </div>
            <p data-anim="fade-up" data-anim-delay="0.1">
              From single-day drop-ins to 24/7 unrestricted monthly access. Transparent published rates confirmed personally by our on-site team.
            </p>
          </div>

          <div className="mem-passes-grid" data-anim-stagger-group="true" data-anim-stagger="0.07">
            {passCards.map((p) => (
              <article key={p.tier} className={`mem-pass-card ${p.popular ? 'is-popular' : ''}`} data-tilt="5">
                {p.popular && <span className="mem-pass-badge">{p.badge}</span>}

                <div className="mem-card-header">
                  <span className="mem-number">{p.num}</span>
                  <h3 className="mem-card-title">{p.tier}</h3>
                  <div className="mem-price-display">
                    <span className="mem-price-number">{p.price}</span>
                    <span className="mem-price-period">/ {p.period}</span>
                  </div>
                  <p className="mem-card-tagline">{p.pass} · {p.hours}</p>
                </div>

                <div className="mem-card-divider" />

                <p className="mem-card-desc">{p.description}</p>

                <div className="mem-features-block">
                  <span className="mem-features-label">WHAT’S INCLUDED:</span>
                  <ul className="mem-card-features">
                    {p.features.map((feat) => (
                      <li key={feat}>
                        <span className="mem-check-badge" aria-hidden="true">
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mem-card-footer">
                  {/* Opens the booking popup, which now runs the real checkout
                      against the structured billing catalog. */}
                  <BookingButton
                    service="Memberships"
                    data-magnetic="0.25"
                    className={`mem-plan-btn ${p.popular ? 'wj-button-yellow' : 'wj-button-green'}`}
                  >
                    <span>Join {p.tier}</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </BookingButton>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── SECTION 2: Polished Side-by-Side Comparison Table ── */}
        <section className="mem-section" id="pass-comparison" aria-labelledby="mem-table-title" data-anim="fade-up">
          <div className="mem-section-head">
            <div>
              <p className="mem-eyebrow">SIDE-BY-SIDE MATRIX</p>
              <h2 id="mem-table-title" data-anim="split-lines">
                Compare pass features<br />
                at a glance.
              </h2>
            </div>
            <p>
              Review all inclusions, hours, meeting room credits, and business support amenities across each pass tier.
            </p>
          </div>

          <div className="mem-table-container" role="region" aria-label="Workspace pass comparison table" tabIndex={0}>
            <table className="mem-table">
              <thead>
                <tr>
                  <th scope="col" className="mem-th-feature">Access &amp; Inclusions</th>
                  <th scope="col" className="mem-th-col">Bronze <span>$50 / day</span></th>
                  <th scope="col" className="mem-th-col">Silver <span>$100 / mo</span></th>
                  <th scope="col" className="mem-th-col is-popular">Gold <span>$150 / mo</span></th>
                  <th scope="col" className="mem-th-col">Platinum <span>$250 / mo</span></th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, idx) => (
                  <tr key={row.feature} className={idx % 2 === 0 ? 'even' : 'odd'}>
                    <th scope="row" className="mem-td-feature">{row.feature}</th>
                    <td className="mem-td-val"><TableCell val={row.bronze} /></td>
                    <td className="mem-td-val"><TableCell val={row.silver} /></td>
                    <td className="mem-td-val is-popular"><TableCell val={row.gold} /></td>
                    <td className="mem-td-val"><TableCell val={row.platinum} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── SECTION 3: Community Memberships (Monthly/Annual) ── */}
      <section className="mem-community-section" aria-labelledby="mem-comm-title">
        <div className="mem-wrap">
          <div className="mem-section-head">
            <div>
              <p className="mem-eyebrow">COMMUNITY &amp; CIRCLES ACCESS</p>
              <h2 id="mem-comm-title">
                Connection beyond<br />
                the desk.
              </h2>
            </div>
            <p>
              Looking for professional networking, mastermind circles, and curated events? Community memberships provide an ecosystem to connect and scale.
            </p>
          </div>
        </div>

        <div className="mem-community-pricing-box">
          <CommunityMembershipSection initialPlans={communityPlans} />
        </div>
      </section>

      <div className="mem-wrap">
        {/* Dedicated Desk & Private Office Upgrades Callout */}
        <section className="mem-upgrade-section" aria-labelledby="mem-upgrade-title">
          <div className="mem-upgrade-box">
            <div className="mem-upgrade-copy">
              <span className="mem-eyebrow">NEED PERMANENT SPACE?</span>
              <h2 id="mem-upgrade-title">A dedicated desk or private office.</h2>
              <p>
                If your business requires a consistent personal desk setup with dual monitors or a secure private office suite for your growing team, explore our dedicated workspace options.
              </p>
              <div className="mem-actions">
                <Link href="/dedicated/" className="mem-button wj-button-yellow">
                  Explore Dedicated Desks <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <Link href="/virtual-office/" className="mem-button wj-button-green">
                  Explore Private Offices <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="mem-upgrade-image">
              <Image
                src="/media/dfcf491571-image.png"
                alt="Workspace Junction private office suites and executive desks"
                width={506}
                height={619}
                sizes="(max-width: 700px) 100vw, 450px"
              />
            </div>
          </div>
        </section>

        {/* FAQ Accordion */}
        {membershipFaqs.length > 0 && (
          <section className="mem-faq-section" aria-labelledby="mem-faq-title">
            <div className="mem-faq-header">
              <p className="mem-eyebrow">GOOD TO KNOW</p>
              <h2 id="mem-faq-title">
                Frequently asked<br />
                membership questions.
              </h2>
              <p>Everything you need to know about access hours, guest policies, passes, and payments.</p>
              <Link href="/contact-us/" className="mem-text-link">
                Speak with our team <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="mem-faq-list">
              {membershipFaqs.map((faq, idx) => (
                <details key={faq.q || idx}>
                  <summary>
                    <span>{faq.q}</span>
                    <Plus size={18} aria-hidden="true" />
                  </summary>
                  <div dangerouslySetInnerHTML={{__html: safeContent(faq.a || '')}} />
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Testimonials */}
      <TestimonialsSection slug="memberships" />

      {/* Closing Banner */}
      <div className="mem-wrap">
        <section className="mem-closing" aria-labelledby="mem-closing-title">
          <p className="mem-eyebrow">MAKE YOUR NEXT MOVE</p>
          <h2 id="mem-closing-title">
            Find the workspace cadence<br />
            that accelerates your business.
          </h2>
          <div className="mem-actions">
            <BookingButton service="Membership Consultation" className="mem-button wj-button-yellow">
              Consult with Our Team <ArrowUpRight size={18} aria-hidden="true" />
            </BookingButton>
            <Link href="/contact-us/" className="mem-button wj-button-green">
              Schedule a Walkthrough <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function TableCell({val}: {val: string}) {
  if (val === 'yes') {
    return (
      <span className="mem-table-check" aria-label="Included">
        <Check size={16} strokeWidth={2.5} />
      </span>
    );
  }
  if (val === 'no') {
    return <span className="mem-table-dash" aria-label="Not included">—</span>;
  }
  return <span className="mem-table-text">{val}</span>;
}
