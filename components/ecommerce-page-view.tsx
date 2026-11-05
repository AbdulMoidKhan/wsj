import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, Check} from 'lucide-react';
import {BookingButton} from './booking';
import {TestimonialsSection} from './testimonials-section';
import './ecommerce-page-view.css';

const challenges = [
  {
    title: 'Professional Presence Without a Storefront',
    desc: 'Establish instant trust with partners, suppliers, and customers with a real commercial address in Oakbrook Terrace and dedicated mail handling.'
  },
  {
    title: 'Product Media & Commercial Presentation',
    desc: 'Studio-grade lighting, 4K camera gear, and acoustic backdrops for high-converting product photos, unboxing videos, and launch demos.'
  },
  {
    title: 'Back-Office & Logistics Organization',
    desc: 'Quiet meeting rooms, executive boardrooms, and high-speed enterprise WiFi to manage supplier negotiations, inventory sync, and fulfillment flows.'
  },
  {
    title: 'Flexible Growth Through Demand Surges',
    desc: 'Easily add desk passes, private office days, or studio blocks during Q4 surges, Black Friday launches, and campaign rollouts — without long-term leases.'
  }
];

const workspaces = [
  {
    name: 'Hot Desks',
    desc: 'Flexible shared workspace for day-to-day store management, marketing campaigns, and customer support coordination.',
    href: '/coworking/'
  },
  {
    name: 'Dedicated Desks',
    desc: 'Your reserved workstation with dual-monitor setup, locked storage, and consistent 24/7 access for deep operational focus.',
    href: '/dedicated/'
  },
  {
    name: 'Private Offices',
    desc: 'Furnished, acoustically private lockable offices for confidential supplier calls, partner strategy, and team operations.',
    href: '/virtual-office/'
  }
];

const studios = [
  {
    name: 'Product Photo Studio',
    desc: 'High-CRI studio lighting, seamless backdrops, and product staging tables for catalog-ready lifestyle and e-commerce imagery.',
    href: '/photo-studio/'
  },
  {
    name: 'Video & Demo Studio',
    desc: 'Multi-angle 4K video recording, teleprompters, and studio sound for high-impact unboxings, ads, and product video demos.',
    href: '/photo-studio/'
  },
  {
    name: 'Podcast & Livestream Hub',
    desc: 'Broadcast-grade Shure microphones, acoustic treatment, and live streaming gear for founder stories, launch webinars, and Q&A sessions.',
    href: '/podcast-studio/'
  }
];

const reasons = [
  {
    num: '01',
    title: 'Flexible on Your Terms',
    desc: 'Scale up your workspace, media time, and team access during peak sales seasons, and step back when demand normalizes.'
  },
  {
    num: '02',
    title: 'All-In-One Production Hub',
    desc: 'Desks, meeting suites, photo studios, and printing support under one roof — save hours of commuting between separate vendors.'
  },
  {
    num: '03',
    title: 'Credibility for Digital Brands',
    desc: 'Give your online business a verified commercial address and executive meeting rooms that build immediate trust with suppliers and banks.'
  },
  {
    num: '04',
    title: 'Studio Quality Without Capital Expense',
    desc: 'Produce visuals that drive conversions without spending tens of thousands of dollars on cameras, lighting grids, and soundproofing.'
  },
  {
    num: '05',
    title: 'Supportive Creator & Founder Network',
    desc: 'Connect with fellow e-commerce founders, marketing specialists, and supply chain partners thriving in the Junction community.'
  }
];

const audiences = [
  'E-Commerce Brand Founders',
  'Marketplace & Amazon FBA Sellers',
  'Direct-to-Consumer (DTC) Brands',
  'Niche Online Retailers & Curators',
  'Brand Creators & Affiliate Marketers',
  'Digital Product Launch Teams'
];

const useCases = [
  {
    title: 'Product Launch Campaigns',
    desc: 'Record and livestream product demos, unboxings, and interactive sales webinars from our professional studio environments.'
  },
  {
    title: 'Commercial Catalog Production',
    desc: 'Book multi-hour photo studio blocks to capture crisp, conversion-optimized product photos and lifestyle shots.'
  },
  {
    title: 'Fulfillment & Logistics Planning',
    desc: 'Use boardroom displays and whiteboards for quarterly supplier reviews, margin modeling, and inventory logistics.'
  },
  {
    title: 'Supplier & Investor Meetings',
    desc: 'Host commercial partners, wholesale buyers, or investors in fully serviced, presentation-ready conference suites.'
  }
];

export function EcommercePageView() {
  return (
    <main id="main" className="ecom-page">
      <div className="ecom-wrap">
        <nav className="ecom-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/use-cases/">Use Cases</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">E-Commerce &amp; Online Business</span>
        </nav>

        {/* Hero Section */}
        <section className="ecom-hero" aria-labelledby="ecom-title">
          <div>
            <p className="ecom-eyebrow">BUILT FOR DIGITAL COMMERCE &amp; DTC FOUNDERS</p>
            <h1 id="ecom-title">
              Sell everywhere.<br />
              Grow from <em>here.</em>
            </h1>
          </div>
          <div className="ecom-hero-copy">
            <p>
              Running an online brand means managing marketing, product media, fulfillment, and customer growth all at once. Workspace Junction gives digital entrepreneurs flexible workspaces, content studios, and business services — without restrictive leases.
            </p>
            <div className="ecom-actions">
              <BookingButton service="E-Commerce Workspace" className="ecom-button wj-button-yellow">
                Explore Solutions <ArrowUpRight size={18} aria-hidden="true" />
              </BookingButton>
              <Link className="ecom-text-link" href="#ecom-solutions">
                View Spaces &amp; Studios <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Hero Banner Image */}
        <figure className="ecom-hero-image">
          <Image
            src="/media/391719a9df-image-16.png"
            alt="Workspace Junction e-commerce workspace and digital operations hub"
            width={1170}
            height={406}
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
          />
          <figcaption>
            <span>DIGITAL COMMERCE HEADQUARTERS</span>
            <span>Oakbrook Terrace, IL</span>
          </figcaption>
        </figure>

        {/* Real-World Challenges Grid */}
        <section className="ecom-section" aria-labelledby="ecom-challenges-title">
          <div className="ecom-section-head">
            <div>
              <p className="ecom-eyebrow">REAL-WORLD E-COMMERCE DEMANDS</p>
              <h2 id="ecom-challenges-title">
                The infrastructure your<br />
                digital store deserves.
              </h2>
            </div>
            <p>
              Digital brands need more than a home office. We provide the tools, spaces, and services to turn your online store into a scalable, credible enterprise.
            </p>
          </div>

          <div className="ecom-grid-2x2">
            {challenges.map((c, i) => (
              <article key={c.title} className="ecom-card">
                <span className="ecom-number">0{i + 1}</span>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Solutions Band 1: Workspaces & Content Studios */}
      <section className="ecom-band" id="ecom-solutions" aria-labelledby="ecom-solutions-title">
        <div className="ecom-wrap">
          <div className="ecom-section-head">
            <div>
              <p className="ecom-eyebrow">WORKSPACES &amp; STUDIOS</p>
              <h2 id="ecom-solutions-title">
                Environments built to<br />
                create, operate, and scale.
              </h2>
            </div>
            <p>
              From day desks for daily store operations to complete photo and video studios for your next hero product shoot.
            </p>
          </div>

          <div className="ecom-features-row">
            <div className="ecom-col-group">
              <span className="ecom-group-tag">FOCUS &amp; OPERATIONS</span>
              <div className="ecom-group-cards">
                {workspaces.map((w) => (
                  <article key={w.name} className="ecom-subcard">
                    <h4>{w.name}</h4>
                    <p>{w.desc}</p>
                    <Link href={w.href} className="ecom-inline-link">
                      Explore workspace <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <div className="ecom-col-group">
              <span className="ecom-group-tag">CONTENT &amp; PRODUCTION</span>
              <div className="ecom-group-cards">
                {studios.map((s) => (
                  <article key={s.name} className="ecom-subcard">
                    <h4>{s.name}</h4>
                    <p>{s.desc}</p>
                    <Link href={s.href} className="ecom-inline-link">
                      Book studio time <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="ecom-wrap">
        {/* Support Services: TradeShow Realm & Virtual Mail */}
        <section className="ecom-split-section" aria-labelledby="ecom-services-title">
          <div className="ecom-split-media">
            <Image
              src="/media/e8c204ecf6-Rectangle-5706.png"
              alt="TradeShow Realm printing and packaging display materials"
              width={572}
              height={521}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="ecom-split-content">
            <p className="ecom-eyebrow">PRINT &amp; PACKAGING COLLATERAL</p>
            <h2 id="ecom-services-title">
              Tangible branding that<br />
              elevates unboxings.
            </h2>
            <p>
              Through our on-site TradeShow Realm partnership, e-commerce brands access commercial printing and packaging solutions at startup-friendly pricing:
            </p>
            <ul className="ecom-checklist">
              <li>Product flyers, brochures &amp; package inserts</li>
              <li>Custom branded unboxing packaging &amp; labels</li>
              <li>Trade show banners, backdrops &amp; pop-up displays</li>
              <li>Promotional handouts for retail pop-ups and expos</li>
            </ul>
            <div className="ecom-actions">
              <Link href="/trade-shows/" className="ecom-button wj-button-green">
                Explore Print Services <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className="ecom-split-section reverse" aria-labelledby="ecom-mail-title">
          <div className="ecom-split-media">
            <Image
              src="/media/c326caa369-Rectangle-5676-2-1024x415.png"
              alt="Virtual office and mailbox facilities at Workspace Junction"
              width={800}
              height={324}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="ecom-split-content">
            <p className="ecom-eyebrow">BUSINESS ADDRESS &amp; VIRTUAL MAIL</p>
            <h2 id="ecom-mail-title">
              Credibility without a<br />
              commercial lease.
            </h2>
            <p>
              Protect your home address, maintain privacy, and build trust with suppliers, wholesale partners, and financial institutions with a verified commercial address:
            </p>
            <ul className="ecom-checklist">
              <li>Official commercial business address in Oakbrook Terrace</li>
              <li>Secure mailbox rental &amp; package handling</li>
              <li>Mail forwarding and instant scan-to-email options</li>
              <li>Professional meeting rooms for supplier discussions</li>
            </ul>
            <div className="ecom-actions">
              <Link href="/business-address/" className="ecom-button wj-button-green">
                Explore Business Address <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Real-World Use Cases */}
        <section className="ecom-section" aria-labelledby="ecom-usecases-title">
          <div className="ecom-section-head">
            <div>
              <p className="ecom-eyebrow">PRACTICAL APPLICATIONS</p>
              <h2 id="ecom-usecases-title">
                How founders put the<br />
                Junction to work.
              </h2>
            </div>
            <p>
              Tailored setups designed around real milestones — from crowdfunding launches to seasonal fulfillment peaks.
            </p>
          </div>

          <div className="ecom-usecases-grid">
            {useCases.map((u, i) => (
              <article key={u.title} className="ecom-usecase-card">
                <span className="ecom-number">0{i + 1}</span>
                <h3>{u.title}</h3>
                <p>{u.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Why Choose Workspace Junction (Side-by-side with photo) */}
        <section className="ecom-why-section" aria-labelledby="ecom-why-title">
          <div className="ecom-why-media">
            <Image
              src="/media/bb8ee464ef-Rectangle-5673-3.png"
              alt="Workspace Junction modern coworking and collaboration hub"
              width={633}
              height={252}
              sizes="(max-width: 700px) 100vw, 600px"
            />
            <div className="ecom-why-quote">
              <p>&ldquo;From our first product photo shoot to daily store analytics, having a dedicated space accelerated our growth tenfold.&rdquo;</p>
              <span>— Digital Brand Founder</span>
            </div>
          </div>
          <div className="ecom-why-content">
            <p className="ecom-eyebrow">THE WORKSPACE ADVANTAGE</p>
            <h2 id="ecom-why-title">Why e-commerce owners choose us.</h2>
            <div className="ecom-reasons-list">
              {reasons.map((r) => (
                <div key={r.num} className="ecom-reason-row">
                  <span className="ecom-reason-num">{r.num}</span>
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
        <section className="ecom-audience-section" aria-labelledby="ecom-audience-title">
          <div className="ecom-audience-box">
            <div className="ecom-audience-image">
              <Image
                src="/media/01d174084f-Rectangle-5670-3.png"
                alt="Entrepreneurs and creative teams working together"
                width={672}
                height={409}
                sizes="(max-width: 700px) 100vw, 550px"
              />
            </div>
            <div className="ecom-audience-content">
              <p className="ecom-eyebrow">MADE FOR DIGITAL BUILDERS</p>
              <h2 id="ecom-audience-title">Who benefits most.</h2>
              <ul className="ecom-audience-list">
                {audiences.map((a) => (
                  <li key={a}>
                    <Check size={18} className="ecom-check-icon" aria-hidden="true" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              <div className="ecom-actions">
                <BookingButton service="E-Commerce Consultation" className="ecom-button wj-button-yellow">
                  Schedule a Consultation <ArrowUpRight size={17} aria-hidden="true" />
                </BookingButton>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Testimonials Section */}
      <TestimonialsSection slug="e-commerce-online-business" />

      {/* Closing CTA */}
      <div className="ecom-wrap">
        <section className="ecom-closing" aria-labelledby="ecom-closing-title">
          <p className="ecom-eyebrow">READY TO SCALE YOUR STORE?</p>
          <h2 id="ecom-closing-title">
            Take your e-commerce brand<br />
            to the next level.
          </h2>
          <div className="ecom-actions">
            <BookingButton service="E-Commerce Workspace" className="ecom-button wj-button-yellow">
              Book a Tour <ArrowUpRight size={18} aria-hidden="true" />
            </BookingButton>
            <Link href="/contact-us/" className="ecom-button wj-button-green">
              Talk to Our Team <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
