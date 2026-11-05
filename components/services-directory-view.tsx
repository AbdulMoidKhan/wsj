import Image from '@/components/consistent-image';
import Link from 'next/link';
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Check,
  Compass,
  FileCheck,
  FileText,
  Globe2,
  Handshake,
  Laptop,
  Layers,
  Library,
  Mail,
  Mailbox,
  Mic,
  Monitor,
  Printer,
  Radio,
  Store,
  Users,
  Wrench
} from 'lucide-react';
import {TestimonialsSection} from './testimonials-section';
import './services-directory-view.css';

export interface ServiceItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  href: string;
  badge?: string;
  category: 'work-meet' | 'business-services' | 'create-connect';
  categoryLabel: string;
  features: string[];
  icon: typeof Briefcase;
}

export const ALL_SERVICES: ServiceItem[] = [
  // ── 1. WORK & MEET ──────────────────────────────────────────
  {
    id: 'coworking',
    name: 'Coworking Workspaces',
    tagline: 'Flexible desks and shared collaborative space',
    description: 'Hot desks, shared tables, and vibrant lounge areas designed for independent consultants, founders, and remote professionals seeking flexibility without leases.',
    href: '/coworking/',
    badge: 'Flexible space',
    category: 'work-meet',
    categoryLabel: 'Work & Meet',
    features: ['High-speed enterprise WiFi', 'Ergonomic sit/stand desks', 'Complimentary artisan coffee & tea', 'Huddle room & library access'],
    icon: Laptop
  },
  {
    id: 'dedicated',
    name: 'Dedicated Desks',
    tagline: 'Your permanent workstation with 24/7 access',
    description: 'A reserved personal workstation in Oakbrook Terrace — set up once, return daily, and enjoy private storage and dual-monitor setup.',
    href: '/dedicated/',
    badge: 'Reserved',
    category: 'work-meet',
    categoryLabel: 'Work & Meet',
    features: ['24/7 unrestricted access', '27-inch monitor & ergonomic chair', 'Locked file storage cabinet', 'Meeting & boardroom credits'],
    icon: Monitor
  },
  {
    id: 'private-office',
    name: 'Private Studio Offices',
    tagline: 'Lockable, furnished suites for focused teams',
    description: 'Acoustically insulated private office spaces accommodating teams of 1 to 10 with turnkey furnishings and enterprise IT infrastructure.',
    href: '/virtual-office/',
    category: 'work-meet',
    categoryLabel: 'Work & Meet',
    features: ['Private lockable entrance', 'Customizable layout & branding', 'Conference room booking credits', 'Business address & mail included'],
    icon: Building2
  },
  {
    id: 'meeting-rooms',
    name: 'Meeting Rooms & Boardrooms',
    tagline: 'High-tech conference suites for client presentations',
    description: 'Professional boardrooms and presentation suites equipped with 4K casting displays, acoustic wall treatments, and video conference equipment.',
    href: '/meeting-rooms/',
    category: 'work-meet',
    categoryLabel: 'Work & Meet',
    features: ['Seats up to 10 stakeholders', '4K wireless screen presentation', 'Whiteboard ideation walls', 'Client hospitality & coffee service'],
    icon: Users
  },
  {
    id: 'memberships',
    name: 'Workspace Memberships & Passes',
    tagline: 'Flexible day packages and multi-pass bundles',
    description: 'Choose Bronze, Silver, Gold, or Platinum access tiers tailored to your visit frequency, with full amenity access included.',
    href: '/memberships/',
    category: 'work-meet',
    categoryLabel: 'Work & Meet',
    features: ['1, 5, and 10-day pass bundles', 'Unlimited monthly platinum access', 'No long-term commitments', 'Seamless digital check-in'],
    icon: Layers
  },

  // ── 2. BUSINESS SERVICES ────────────────────────────────────
  {
    id: 'business-address',
    name: 'Commercial Business Address',
    tagline: 'Prestigious Oakbrook Terrace corporate presence',
    description: 'Establish local credibility for banking, state registrations, supplier agreements, and client trust without leasing physical real estate.',
    href: '/business-address/',
    badge: 'Essential',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Commercial suite street address', 'Official building directory listing', 'Registered agent compliance ready', 'Client trust & bank verification'],
    icon: Building2
  },
  {
    id: 'virtual-office',
    name: 'Virtual Offices',
    tagline: 'Commercial address, mail handling, and coworking bundled',
    description: 'A complete corporate solution providing an official business address, professional mail management, and monthly day passes to our workspace.',
    href: '/virtual-office/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Oakbrook Terrace business address', 'Package receiving & mail holding', 'Monthly coworking day passes', 'Discounted conference room rates'],
    icon: Briefcase
  },
  {
    id: 'mail-box',
    name: 'Physical Mailbox Rental',
    tagline: 'Secure on-site mailbox with package receiving',
    description: 'Private locked physical mailboxes with dedicated staff handling your incoming deliveries, certified mail, and oversize courier parcels.',
    href: '/mail-box/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Private key-locked mailbox', 'UPS, FedEx, USPS & DHL receiving', 'Immediate email delivery notices', 'Convenient business hours pickup'],
    icon: Mailbox
  },
  {
    id: 'virtual-mailbox',
    name: 'Virtual Mailbox & Scan Service',
    tagline: 'Cloud-managed mail dashboard accessible anywhere',
    description: 'View scans of incoming envelopes online, request mail open-and-scan PDFs, forward packages worldwide, or securely shred unwanted items.',
    href: '/virtual-mailbox/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Same-day envelope scan notifications', 'High-res searchable PDF scans', 'Worldwide package forwarding', 'Compliant document shredding'],
    icon: Mail
  },
  {
    id: 'llc-setup',
    name: 'LLC Formation & Corporate Setup',
    tagline: 'Turnkey Illinois business entity incorporation',
    description: 'End-to-end support for business entity filing, Articles of Organization, EIN registration, operating agreements, and registered agent services.',
    href: '/llc-setup/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Illinois state document filing', 'Federal EIN tax ID registration', 'Custom operating agreement templates', 'Registered agent service pairing'],
    icon: FileText
  },
  {
    id: 'notary-public',
    name: 'Licensed Notary Public',
    tagline: 'On-site commissioned document notarization',
    description: 'Fast, verified document execution for real estate closings, corporate contracts, affidavits, power of attorney, and certified legal forms.',
    href: '/notary-public/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Official State of Illinois notary seal', 'Identity verification & attestation', 'Walk-ins & scheduled appointments', 'Private signing room available'],
    icon: FileCheck
  },
  {
    id: 'bpo-services',
    name: 'BPO & Back-Office Staffing',
    tagline: 'Dedicated operational teams via Orbitus Solutions',
    description: 'Scale administrative capacity with professional customer support, data processing, bookkeeping assistance, and workflow execution.',
    href: '/bpo-services/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Trained administrative personnel', 'Multi-channel customer service', 'Quality assurance & KPI reporting', 'Flexible month-to-month contracts'],
    icon: Users
  },
  {
    id: 'digital-services',
    name: 'Digital Solutions & Web Development',
    tagline: 'Custom websites and automations via Visionaire Tech',
    description: 'Modern, high-converting digital platform development, CRM pipeline automation, custom API connections, and full-stack technical delivery.',
    href: '/digital-services/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Custom Next.js & mobile websites', 'CRM & pipeline automations', 'Payment gateway & Stripe setup', 'Technical SEO & analytics wiring'],
    icon: Wrench
  },
  {
    id: 'digital-presence',
    name: 'Digital Presence & Local SEO',
    tagline: 'Local Chicago search optimization and brand authority',
    description: 'Elevate your online discoverability with Google Business Profile management, local citation audits, and reputational review acceleration.',
    href: '/digital-presence/',
    category: 'business-services',
    categoryLabel: 'Business Services',
    features: ['Google Business Profile dominance', 'Local citation directory sync', 'Review generation workflows', 'Monthly performance analytics'],
    icon: Globe2
  },

  // ── 3. CREATE & CONNECT ─────────────────────────────────────
  {
    id: 'photo-studio',
    name: 'Professional Photo Studio',
    tagline: 'Controlled creative environment with studio lighting',
    description: 'A clean, distraction-free space for product staging, lifestyle photography, executive headshots, and e-commerce catalog shoots.',
    href: '/photo-studio/',
    badge: 'Production',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['High-CRI continuous & strobe lighting', 'Seamless color & white backdrops', 'Product staging & shooting tables', 'Changing area & prep mirror'],
    icon: Camera
  },
  {
    id: 'podcast-studio',
    name: 'Chicagoland Podcast Studio',
    tagline: 'Acoustically isolated 4K broadcast recording suite',
    description: 'Record professional audio and video podcasts, interviews, voiceovers, and YouTube conversations with studio-grade Shure SM7B gear.',
    href: '/podcast-studio/',
    badge: 'Broadcast',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Shure SM7B microphones & Rodecaster', 'Multi-angle 4K studio cameras', 'Soundproof acoustic wall treatments', 'Engineer assistance available'],
    icon: Mic
  },
  {
    id: 'events',
    name: 'Event Space & Venue',
    tagline: 'Modern presentation hall accommodating up to 50 guests',
    description: 'Host corporate conferences, networking mixers, product unveils, and panel discussions in a versatile, presentation-ready venue.',
    href: '/events/',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Capacity for up to 50 attendees', 'Dual 4K presentation screens', 'Wireless handheld & lapel mics', 'Catering prep area & beverage bar'],
    icon: CalendarDays
  },
  {
    id: 'workshops',
    name: 'Workshops & Training Hosting',
    tagline: 'Interactive classroom and corporate seminar suites',
    description: 'Purpose-built learning spaces for educators, corporate trainers, and coaches running immersive skill-building sessions.',
    href: '/workshops/',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Configurable classroom seating', 'Interactive whiteboards & flipcharts', 'High-speed participant WiFi', 'Hybrid in-person + online setup'],
    icon: Compass
  },
  {
    id: 'webinars',
    name: 'Webinars & Live Broadcasts',
    tagline: 'Studio-grade livestreaming and virtual workshops',
    description: 'Broadcast high-stakes virtual webinars, investor pitches, and online masterclasses with dedicated studio lighting and video encoders.',
    href: '/webinars/',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Broadcast cameras & audio switching', 'High-bandwidth streaming pipe', 'Interactive audience Q&A setup', 'Raw master recording delivery'],
    icon: Radio
  },
  {
    id: 'trade-shows',
    name: 'TradeShow Realm Exhibition & Print',
    tagline: 'Complete booth systems, signage, and representation',
    description: 'Stand out at industry expos and conventions with custom booth design, large-format banner printing, acrylic displays, and on-site staff.',
    href: '/trade-shows/',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Retractable banners & step-and-repeats', 'Custom acrylic & 3D tabletop signs', 'Booth layout & strategy review', 'On-site event representation'],
    icon: Store
  },
  {
    id: 'printed-services',
    name: 'Printed Services & Collateral',
    tagline: 'High-speed business card, flyer, and booklet printing',
    description: 'On-demand commercial print production for business cards, lookbooks, flyers, menus, and marketing collateral with fast turnaround.',
    href: '/printed-services/',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['High-speed laser color & monochrome', 'Premium heavy cardstock options', 'Brochures, catalogs & presentation kits', 'Same-day turnaround availability'],
    icon: Printer
  },
  {
    id: 'library',
    name: 'Quiet Reading Room & Library',
    tagline: 'Curated knowledge catalog for professional growth',
    description: 'A serene on-site resource space with handpicked titles across leadership, business strategy, technology, and entrepreneurship.',
    href: '/library/',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Curated physical book collection', 'Online catalog via Libib integration', 'Quiet study & focus carrels', 'Borrowing privileges for members'],
    icon: Library
  },
  {
    id: 'community-network',
    name: 'Workspace Junction Community Network',
    tagline: 'Collaborative ecosystem of builders & innovators',
    description: 'Connect with driven peers across specialized Circles: Founders, Healthcare, Creators, Tech, Leadership, and International Professionals.',
    href: '/community-network/',
    badge: 'Ecosystem',
    category: 'create-connect',
    categoryLabel: 'Create & Connect',
    features: ['Access to 8 specialized Circles', 'Monthly networking & founder mixers', 'Private Slack & discussion forum', 'Partner perks & member discounts'],
    icon: Handshake
  }
];

export function ServicesDirectoryView() {
  const workServices = ALL_SERVICES.filter(s => s.category === 'work-meet');
  const bizServices = ALL_SERVICES.filter(s => s.category === 'business-services');
  const createServices = ALL_SERVICES.filter(s => s.category === 'create-connect');

  return (
    <main id="main" className="sv-page">
      <div className="sv-wrap">
        <nav className="sv-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Services Directory</span>
        </nav>

        {/* Hero Section */}
        <header className="sv-hero" aria-labelledby="sv-title">
          <div>
            <p className="sv-eyebrow">THE COMPLETE WORKSPACE JUNCTION ECOSYSTEM</p>
            <h1 id="sv-title">
              Every tool to work.<br />
              Every space to <em>grow.</em>
            </h1>
          </div>
          <div className="sv-hero-copy">
            <p>
              From flexible coworking desks and executive presentation suites to 4K podcast studios, verified commercial mailboxes, and on-site business services — explore all 23 specialized solutions built to power your workday in Oakbrook Terrace.
            </p>
            <div className="sv-actions">
              <Link href="#work-meet" className="sv-button wj-button-yellow">
                Explore Our Services <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link className="sv-text-link" href="/schedule-a-tour/">
                Book an In-Person Tour <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Banner Photo */}
        <figure className="sv-hero-image">
          <Image
            src="/media/af55bc8a2b-image-17-1.png"
            alt="Workspace Junction flexible open workspace, offices, and studios"
            width={1170}
            height={406}
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
          />
          <figcaption>
            <span>AN ECOSYSTEM BUILT FOR WHAT’S NEXT</span>
            <span>23 Services · Oakbrook Terrace, IL</span>
          </figcaption>
        </figure>

        {/* Category Navigation Pills */}
        <nav className="sv-category-nav" aria-label="Jump to category">
          <a href="#work-meet" className="sv-nav-anchor">
            <span>01</span> Work &amp; Meet <span className="sv-count">({workServices.length})</span>
          </a>
          <a href="#business-services" className="sv-nav-anchor">
            <span>02</span> Business &amp; Operations <span className="sv-count">({bizServices.length})</span>
          </a>
          <a href="#create-connect" className="sv-nav-anchor">
            <span>03</span> Create &amp; Connect <span className="sv-count">({createServices.length})</span>
          </a>
        </nav>

        {/* ── Category 1: Work & Meet ── */}
        <section className="sv-category-section" id="work-meet" aria-labelledby="heading-work-meet">
          <div className="sv-category-header">
            <div>
              <span className="sv-eyebrow">CATEGORY 01</span>
              <h2 id="heading-work-meet">Work &amp; Meet Environments</h2>
            </div>
            <p>
              Spaces designed for productivity, focus, and collaboration — from drop-in day passes to permanent corporate headquarters.
            </p>
          </div>

          <div className="sv-card-grid">
            {workServices.map((svc) => (
              <ServiceCard key={svc.id} item={svc} />
            ))}
          </div>
        </section>
      </div>

      {/* Mid-Page Highlight Dark Band */}
      <section className="sv-highlight-band" aria-labelledby="sv-band-heading">
        <div className="sv-wrap">
          <div className="sv-band-inner">
            <div>
              <span className="sv-eyebrow sv-eyebrow-dark">ONE ROOF. INFINITE POSSIBILITIES.</span>
              <h2 id="sv-band-heading">
                Why commute between five vendors<br />
                when one ecosystem does it all?
              </h2>
            </div>
            <div className="sv-band-stats">
              <div className="sv-stat-item">
                <span className="sv-stat-num">23</span>
                <span className="sv-stat-lbl">Integrated services</span>
              </div>
              <div className="sv-stat-item">
                <span className="sv-stat-num">24/7</span>
                <span className="sv-stat-lbl">Secure access available</span>
              </div>
              <div className="sv-stat-item">
                <span className="sv-stat-num">100%</span>
                <span className="sv-stat-lbl">No long-term lease traps</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sv-wrap">
        {/* ── Category 2: Business & Operations ── */}
        <section className="sv-category-section" id="business-services" aria-labelledby="heading-biz">
          <div className="sv-category-header">
            <div>
              <span className="sv-eyebrow">CATEGORY 02</span>
              <h2 id="heading-biz">Business &amp; Operational Support</h2>
            </div>
            <p>
              The foundational corporate services that keep your business compliant, credible, and operating smoothly every day.
            </p>
          </div>

          <div className="sv-card-grid">
            {bizServices.map((svc) => (
              <ServiceCard key={svc.id} item={svc} />
            ))}
          </div>
        </section>

        {/* ── Category 3: Create & Connect ── */}
        <section className="sv-category-section" id="create-connect" aria-labelledby="heading-create">
          <div className="sv-category-header">
            <div>
              <span className="sv-eyebrow">CATEGORY 03</span>
              <h2 id="heading-create">Create, Broadcast &amp; Connect</h2>
            </div>
            <p>
              Media studios, commercial printing, event hosting, and a collaborative network to amplify your brand voice.
            </p>
          </div>

          <div className="sv-card-grid">
            {createServices.map((svc) => (
              <ServiceCard key={svc.id} item={svc} />
            ))}
          </div>
        </section>

        {/* Industry Use Cases Callout Grid */}
        <section className="sv-usecase-banner" aria-labelledby="sv-usecases-title">
          <div className="sv-usecase-content">
            <span className="sv-eyebrow">TAILORED INDUSTRY SOLUTIONS</span>
            <h2 id="sv-usecases-title">Looking for a specialized setup?</h2>
            <p>
              Explore curated packages and workflows customized for your profession:
            </p>
            <div className="sv-usecase-links">
              <Link href="/creative-designers-agencies/" className="sv-usecase-chip">
                <span>Creative Designers &amp; Agencies</span> <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
              <Link href="/e-commerce-online-business/" className="sv-usecase-chip">
                <span>E-Commerce &amp; DTC Brands</span> <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
              <Link href="/use-cases/" className="sv-usecase-chip">
                <span>View All Industry Solutions</span> <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Testimonials */}
      <TestimonialsSection slug="services" />

      {/* Closing CTA */}
      <div className="sv-wrap">
        <section className="sv-closing" aria-labelledby="sv-closing-title">
          <p className="sv-eyebrow">READY TO MOVE FORWARD?</p>
          <h2 id="sv-closing-title">
            Find the right services<br />
            for what comes next.
          </h2>
          <div className="sv-actions">
            <Link href="/contact-us/" className="sv-button wj-button-yellow">
              Talk to Our Team <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/contact-us/" className="sv-button wj-button-green">
              Ask a Quick Question <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function ServiceCard({item}: {item: ServiceItem}) {
  const Icon = item.icon;
  return (
    <article className="sv-card">
      {item.badge && <span className="sv-card-badge">{item.badge}</span>}

      <div className="sv-card-top">
        <div className="sv-icon-wrap" aria-hidden="true">
          <Icon size={22} strokeWidth={1.8} />
        </div>
      </div>

      <h3 className="sv-card-title">
        <Link href={item.href}>{item.name}</Link>
      </h3>

      <p className="sv-card-tagline">{item.tagline}</p>
      <p className="sv-card-desc">{item.description}</p>

      <ul className="sv-card-features">
        {item.features.map((feat) => (
          <li key={feat}>
            <Check size={14} className="sv-check" aria-hidden="true" />
            <span>{feat}</span>
          </li>
        ))}
      </ul>

      <div className="sv-card-footer">
        <Link href={item.href} className="sv-card-link">
          <span>Explore Details</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
