import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, Check, Plus} from 'lucide-react';
import {BookingButton} from './booking';
import {TestimonialsSection} from './testimonials-section';
import {ServicePricingSection} from './service-pricing-section';
import livePages from '@/data/live-pages.json';
import {safeContent} from '@/lib/site';
import './workshops-page-view.css';

type ContentNode = {
  t: string;
  text?: string;
  html?: string;
  children?: ContentNode[];
  items?: {q?: string; a?: string; text?: string}[];
};

function flatten(nodes: ContentNode[]): ContentNode[] {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}

const rawContent = livePages.pages as unknown as Record<string, ContentNode[]>;
const rawWorkshopNodes = flatten(rawContent['/workshops/'] || []);
const workshopFaqs = rawWorkshopNodes
  .filter(n => n.t === 'faq')
  .flatMap(n => n.items || [])
  .filter(item => item.q && item.a);

const workshopFormats = [
  {
    num: '01',
    badge: 'HOSTED BY WORKSPACE JUNCTION',
    title: 'Community Impact Workshops',
    desc: 'Curated knowledge-sharing sessions organized by Workspace Junction and community partners. Focused on practical business skills, digital marketing, wellness, tech automations, and founder strategy.',
    action: 'Ask about upcoming workshops',
    image: '/media/aa8ed0d1a3-s1-1.png'
  },
  {
    num: '02',
    badge: 'HOSTED BY YOU OR YOUR TEAM',
    title: 'Private Hosted Training Suites',
    desc: 'Turnkey event space rental for corporate trainers, educators, consultants, and organizations delivering dedicated certification sessions, team off-sites, and client seminars to their own audience.',
    action: 'Inquire to host a workshop',
    image: '/media/3940d5aba2-s2-1.png'
  }
];

const topicAreas = [
  {
    num: '01',
    title: 'Entrepreneurship & Startup Strategy',
    desc: 'Validating business models, financial planning, investor pitch prep, and early-stage execution roadmap.'
  },
  {
    num: '02',
    title: 'Digital Marketing & Growth',
    desc: 'High-converting social campaigns, email funnel architecture, brand storytelling, and client acquisition.'
  },
  {
    num: '03',
    title: 'Sales & Business Development',
    desc: 'Enterprise negotiation tactics, consultative sales pipelines, pipeline tracking, and client retention.'
  },
  {
    num: '04',
    title: 'Technology, AI & Automation',
    desc: 'Applying generative AI tools, CRM automations, no-code integrations, and productivity systems to daily workflows.'
  },
  {
    num: '05',
    title: 'Leadership & Team Building',
    desc: 'Executive presence, active team management, emotional intelligence, and building collaborative culture.'
  },
  {
    num: '06',
    title: 'Creative, Visual & Media Production',
    desc: 'Hands-on podcast recording, studio lighting, camera framing, and digital brand asset production.'
  }
];

const targetAudiences = [
  'Entrepreneurs & Startup Founders',
  'Freelancers & Independent Consultants',
  'Small Business Owners & Managers',
  'Corporate Training Facilitators',
  'Course Creators, Coaches & Speakers',
  'Students & Lifelong Professional Learners'
];

const hostingUseCases = [
  'Corporate & Executive Team Off-sites',
  'Professional Certification Programs',
  'Client Strategy & Onboarding Seminars',
  'Community Wellness & Leadership Talks',
  'Financial Literacy & Legal Seminars',
  'Creative Technical & Coding Bootcamps'
];

export function WorkshopsPageView() {
  return (
    <main id="main" className="ws-page">
      <div className="ws-wrap">
        <nav className="ws-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Workshops</span>
        </nav>

        {/* Hero Section */}
        <header className="ws-hero" aria-labelledby="ws-title">
          <div>
            <p className="ws-eyebrow">PROFESSIONAL LEARNING &amp; SKILL BUILDING</p>
            <h1 id="ws-title">
              Learn together.<br />
              Lead what’s <em>next.</em>
            </h1>
          </div>
          <div className="ws-hero-copy">
            <p>
              Workspace Junction hosts interactive professional workshops and hands-on learning sessions in Oakbrook Terrace — designed to help entrepreneurs, creators, and teams acquire actionable skills and connect with driven peers.
            </p>
            <div className="ws-actions">
              <BookingButton service="Upcoming workshops" className="ws-button wj-button-yellow">
                Ask about upcoming workshops <ArrowUpRight size={18} aria-hidden="true" />
              </BookingButton>
              <a className="ws-text-link" href="#pricing">
                View Hosting Rates <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        {/* Hero Banner Photo */}
        <figure className="ws-hero-image">
          <Image
            src="/media/59d7534285-w1.png"
            alt="Workspace Junction interactive workshop and collaborative training session in Oakbrook Terrace"
            width={1170}
            height={406}
            priority
            sizes="(max-width: 700px) 100vw, 1200px"
          />
          <figcaption>
            <span>INTERACTIVE WORKSHOP SUITES</span>
            <span>Oakbrook Terrace, IL</span>
          </figcaption>
        </figure>

        {/* What to Expect / Value Proposition */}
        <section className="ws-section" aria-labelledby="ws-expect-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-eyebrow">WHAT YOU CAN EXPECT</p>
              <h2 id="ws-expect-title">
                Hands-on learning designed<br />
                for immediate application.
              </h2>
            </div>
            <p>
              Our workshops bypass passive lectures in favor of real-world frameworks, interactive peer discussions, and direct feedback from practitioners who do the work every day.
            </p>
          </div>

          <div className="ws-grid-2x2">
            <article className="ws-card">
              <span className="ws-number">01</span>
              <h3>Actionable Frameworks</h3>
              <p>Walk away with tactical roadmaps, templates, and proven systems ready to execute directly inside your business.</p>
            </article>
            <article className="ws-card">
              <span className="ws-number">02</span>
              <h3>Practitioner-Led Sessions</h3>
              <p>Learn directly from founders, attorneys, digital marketers, and engineers actively working in their respective industries.</p>
            </article>
            <article className="ws-card">
              <span className="ws-number">03</span>
              <h3>Intimate Cohort Sizes</h3>
              <p>Small, focused groups of 10 to 35 participants ensure personalized engagement, active questions, and real collaboration.</p>
            </article>
            <article className="ws-card">
              <span className="ws-number">04</span>
              <h3>Turnkey Presentation Tech</h3>
              <p>High-resolution presentation screens, whiteboard ideation walls, wireless audio, and dedicated streaming equipment.</p>
            </article>
          </div>
        </section>

        {/* Two Ways to Engage (Cards) */}
        <section className="ws-formats-section" aria-labelledby="ws-formats-title">
          <div className="ws-section-head">
            <div>
              <p className="ws-eyebrow">TWO WAYS TO PARTICIPATE</p>
              <h2 id="ws-formats-title">
                Attend community sessions.<br />
                Or host your own.
              </h2>
            </div>
            <p>
              Whether you want to gain new capabilities or share your domain expertise with a curated audience, our flexible venue adapts to your format.
            </p>
          </div>

          <div className="ws-formats-grid">
            {workshopFormats.map((f) => (
              <div key={f.title} className="ws-format-card">
                <div className="ws-format-media">
                  <Image
                    src={f.image}
                    alt={f.title}
                    width={572}
                    height={331}
                    sizes="(max-width: 700px) 100vw, 550px"
                  />
                  <span className="ws-format-badge">{f.badge}</span>
                </div>
                <div className="ws-format-body">
                  <span className="ws-number">{f.num}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <BookingButton service={f.title} className="ws-button wj-button-green">
                    {f.action} <ArrowUpRight size={17} aria-hidden="true" />
                  </BookingButton>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Dark Forest Section: Workshop Curriculum & Topics */}
      <section className="ws-band" aria-labelledby="ws-topics-title">
        <div className="ws-wrap">
          <div className="ws-section-head">
            <div>
              <p className="ws-eyebrow">CURATED TOPICS</p>
              <h2 id="ws-topics-title">
                Skills that move businesses<br />
                and careers forward.
              </h2>
            </div>
            <p>
              Sessions cover modern business strategy, technical workflows, client development, and leadership principles.
            </p>
          </div>

          <div className="ws-topics-grid">
            {topicAreas.map((t) => (
              <article key={t.num} className="ws-topic-card">
                <span className="ws-number">{t.num}</span>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Dedicated Pricing Section with Standardized Cards */}
      <div className="ws-pricing-wrap">
        <ServicePricingSection service="workshops" serviceTitle="Workshop Space Rental" />
        
        {/* Membership Discount Callout */}
        <div className="ws-wrap">
          <div className="ws-member-perk">
            <div className="ws-perk-copy">
              <span className="ws-eyebrow">MEMBER EXCLUSIVE PERK</span>
              <h3>Workspace Junction Members Save 20%</h3>
              <p>Active Coworking and Dedicated Desk members receive 20% off all private workshop bookings, complimentary AV setup, and priority calendar scheduling.</p>
            </div>
            <Link href="/memberships/" className="ws-button wj-button-green">
              Explore Memberships <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="ws-wrap">
        {/* Host a Workshop Detailed Section */}
        <section className="ws-split-section" aria-labelledby="ws-host-title">
          <div className="ws-split-media">
            <Image
              src="/media/17c38f02de-2-4.png"
              alt="Speaker presenting a workshop in the Workspace Junction seminar space"
              width={600}
              height={585}
              sizes="(max-width: 700px) 100vw, 550px"
            />
          </div>
          <div className="ws-split-content">
            <p className="ws-eyebrow">FACILITATORS &amp; SPEAKERS</p>
            <h2 id="ws-host-title">
              Share your expertise.<br />
              We handle the logistics.
            </h2>
            <p>
              Workspace Junction welcomes corporate trainers, industry experts, educators, and organizations. From technical AV configuration to attendee seating, our on-site team ensures your presentation runs flawlessly:
            </p>
            <ul className="ws-checklist">
              {hostingUseCases.map((useCase) => (
                <li key={useCase}>
                  <Check size={16} className="ws-check" aria-hidden="true" />
                  <span>{useCase}</span>
                </li>
              ))}
            </ul>
            <div className="ws-actions">
              <BookingButton service="Host a Workshop" className="ws-button wj-button-yellow">
                Inquire About Hosting <ArrowUpRight size={18} aria-hidden="true" />
              </BookingButton>
            </div>
          </div>
        </section>

        {/* Who Attends */}
        <section className="ws-audience-section" aria-labelledby="ws-audience-title">
          <div className="ws-audience-box">
            <div className="ws-audience-image">
              <Image
                src="/media/9b20f6a7ee-1-6.png"
                alt="Workshop participants collaborating and discussing ideas"
                width={573}
                height={391}
                sizes="(max-width: 700px) 100vw, 550px"
              />
            </div>
            <div className="ws-audience-content">
              <p className="ws-eyebrow">WHO THESE WORKSHOPS ARE FOR</p>
              <h2 id="ws-audience-title">Built for lifelong builders.</h2>
              <p>Whether scaling a company, learning a new technology, or broadening your professional network, our sessions bring together ambitious individuals:</p>
              <ul className="ws-audience-list">
                {targetAudiences.map((aud) => (
                  <li key={aud}>
                    <Check size={18} className="ws-check-gold" aria-hidden="true" />
                    <span>{aud}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Workshop FAQ Accordion */}
        {workshopFaqs.length > 0 && (
          <section className="ws-faq-section" aria-labelledby="ws-faq-title">
            <div className="ws-faq-header">
              <p className="ws-eyebrow">GOOD TO KNOW</p>
              <h2 id="ws-faq-title">
                Common questions about<br />
                attending and hosting.
              </h2>
              <p>Find answers to common questions or reach out to our team for custom requests.</p>
              <Link href="/contact-us/" className="ws-text-link">
                Contact our events team <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="ws-faq-list">
              {workshopFaqs.map((faq, idx) => (
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
      <TestimonialsSection slug="workshops" />

      {/* Closing Banner */}
      <div className="ws-wrap">
        <section className="ws-closing" aria-labelledby="ws-closing-title">
          <p className="ws-eyebrow">CONTINUOUS GROWTH</p>
          <h2 id="ws-closing-title">
            Elevate your skills in an environment<br />
            built for productive momentum.
          </h2>
          <div className="ws-actions">
            <BookingButton service="Workshops Consultation" className="ws-button wj-button-yellow">
              Ask about upcoming workshops <ArrowUpRight size={18} aria-hidden="true" />
            </BookingButton>
            <Link href="/contact-us/" className="ws-button wj-button-green">
              Talk to Our Team <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
