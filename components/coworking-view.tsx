'use client';

import React, {useEffect, useRef} from 'react';
import Image from '@/components/consistent-image';
import Link from 'next/link';
import {motion} from 'motion/react';
import {
  ArrowRight,
  Play,
  Laptop,
  Users,
  TrendingUp,
  Calendar,
  Wifi,
  Briefcase,
  Building2,
  Mic,
  MapPin,
  Presentation,
  HeartPulse,
  Check,
  Target,
  BookOpen,
  Handshake
} from 'lucide-react';
import {ServicePricingSection} from './service-pricing-section';

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: {opacity: 0, y: 32},
  show: {opacity: 1, y: 0, transition: {duration: 0.7, ease}}
};

const stagger = {
  hidden: {},
  show: {transition: {staggerChildren: 0.09, delayChildren: 0.05}}
};

const cardIn = {
  hidden: {opacity: 0, y: 26, scale: 0.97},
  show: {opacity: 1, y: 0, scale: 1, transition: {duration: 0.55, ease}}
};

const SPACES = [
  {icon: Laptop, title: 'Hot Desk', desc: 'Drop in and work from any open desk in the shared lounge.', sage: true},
  {icon: Briefcase, title: 'Dedicated Desk', desc: "A reserved desk that's yours every day, no setup required."},
  {icon: Users, title: 'Meeting Rooms', desc: 'Book a room by the hour for client calls and team sessions.'},
  {icon: Building2, title: 'Private Office', desc: 'A lockable office for teams who need focus and privacy.'},
  {icon: Mic, title: 'Podcast Studio', desc: 'A fully equipped studio for recording and content creation.'},
  {icon: MapPin, title: 'Virtual Office', desc: 'A professional business address and mail handling.'},
  {icon: Presentation, title: 'Boardroom', desc: 'A polished space for presentations and board meetings.'},
  {icon: HeartPulse, title: 'Wellness Room', desc: 'A quiet room to recharge, stretch or take a private call.'}
];

export function CoworkingView() {
  const rootRef = useRef<HTMLDivElement>(null);

  const openBooking = (service?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wj:book', {detail: {service: service || 'Coworking',
            trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined}}));
    }
  };

  useEffect(() => {
    let disposed = false;
    let teardown = () => {};
    const root = rootRef.current;
    if (!root) return;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{gsap}, {ScrollTrigger}]) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fine = window.matchMedia('(pointer: fine)').matches;
      const ctx = gsap.context(() => {
        if (!reduced) {
          // Hero entrance: eyebrow/title/desc/actions rise in, image scales into frame
          const tl = gsap.timeline({defaults: {ease: 'expo.out'}});
          tl.from('.cw-hero-eyebrow', {y: 18, autoAlpha: 0, duration: 0.6})
            .from('.cw-hero-title', {y: 28, autoAlpha: 0, duration: 0.8}, '-=0.4')
            .from('.cw-hero-desc', {y: 20, autoAlpha: 0, duration: 0.7}, '-=0.5')
            .from('.cw-hero-actions', {y: 16, autoAlpha: 0, duration: 0.6}, '-=0.45')
            .from('.cw-hero-media', {scale: 0.92, autoAlpha: 0, duration: 1}, '-=0.7');

          // Hero image parallax while scrolling past the hero
          const heroImg = root.querySelector('.cw-hero-img');
          if (heroImg) {
            gsap.to(heroImg, {
              yPercent: 10,
              scale: 1.06,
              ease: 'none',
              scrollTrigger: {trigger: '.cw-hero', start: 'top top', end: 'bottom top', scrub: true}
            });
          }

          // Subtle drift on the amenity icon when its card scrolls into view
          gsap.utils.toArray<HTMLElement>('.cw-space-icon').forEach(icon => {
            gsap.from(icon, {
              rotate: -8,
              scale: 0.7,
              autoAlpha: 0,
              duration: 0.6,
              ease: 'back.out(1.8)',
              scrollTrigger: {trigger: icon, start: 'top 92%', once: true}
            });
          });
        }

        // Magnetic pull on primary buttons (desktop, fine pointer only)
        if (fine && !reduced) {
          root.querySelectorAll<HTMLElement>('.cw-magnetic').forEach(btn => {
            const xTo = gsap.quickTo(btn, 'x', {duration: 0.55, ease: 'elastic.out(1, 0.5)'});
            const yTo = gsap.quickTo(btn, 'y', {duration: 0.55, ease: 'elastic.out(1, 0.5)'});
            const move = (e: PointerEvent) => {
              const r = btn.getBoundingClientRect();
              xTo((e.clientX - r.left - r.width / 2) * 0.28);
              yTo((e.clientY - r.top - r.height / 2) * 0.34);
            };
            const leave = () => {xTo(0); yTo(0);};
            btn.addEventListener('pointermove', move);
            btn.addEventListener('pointerleave', leave);
          });
        }
      }, root);

      teardown = () => ctx.revert();
    }).catch(() => {/* static fallback, no animation */});

    return () => {disposed = true; teardown();};
  }, []);

  return (
    <main id="main" className="cn-page cw-page" ref={rootRef}>
      {/* ==================== Hero ==================== */}
      <section className="cn-hero cn-container cw-hero" aria-label="Coworking Hero">
        <div className="cn-hero-content">
          <span className="cn-eyebrow cw-hero-eyebrow">COWORKING SPACE</span>
          <h1 className="cn-title-serif cn-hero-title cw-hero-title">
            Work, Connect, and Grow<br />
            in a Space Built for You
          </h1>
          <p className="cn-hero-desc cw-hero-desc">
            Flexible desks, private offices and meeting rooms in Oakbrook Terrace — a professional workspace for founders, freelancers and growing teams, without the overhead of a traditional lease.
          </p>
          <div className="cn-hero-actions cw-hero-actions">
            <button type="button" onClick={() => openBooking('Coworking Tour')} className="cn-btn-gold cw-magnetic">
              Book a Tour <ArrowRight size={17} aria-hidden="true" />
            </button>
            <a href="#cw-pricing" className="cn-btn-text-play">
              View Memberships
              <span className="cn-play-icon" aria-hidden="true">
                <Play size={12} fill="currentColor" />
              </span>
            </a>
          </div>
        </div>
        <div className="cn-hero-media cw-hero-media">
          <Image
            src="/media/colorful-coworking-office-scene.png"
            alt="Members working in Workspace Junction's coworking lounge"
            width={580}
            height={430}
            priority
            unoptimized
            className="cn-hero-img cw-hero-img"
          />
        </div>
      </section>

      {/* ==================== About ==================== */}
      <motion.section
        id="about-coworking"
        className="cn-about"
        aria-labelledby="cw-about-heading"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{once: true, amount: 0.25}}
      >
        <div className="cn-container cn-about-grid">
          <motion.div className="cn-about-media" variants={fadeUp}>
            <Image
              src="/media/2225f016d8-coworking-1536x953.jpg"
              alt="Open coworking floor at Workspace Junction"
              width={554}
              height={340}
              unoptimized
              className="cn-about-img"
            />
          </motion.div>
          <div className="cn-about-content">
            <motion.span className="cn-eyebrow" variants={fadeUp}>ABOUT COWORKING</motion.span>
            <motion.h2 id="cw-about-heading" className="cn-title-serif cn-about-title" variants={fadeUp}>
              What is Coworking at Workspace Junction?
            </motion.h2>
            <motion.p className="cn-about-desc" variants={fadeUp}>
              A modern, professional workspace built for entrepreneurs, remote professionals and growing teams who want flexibility without sacrificing comfort or productivity.
            </motion.p>
            <motion.div className="cn-values-row" variants={fadeUp}>
              <div className="cn-value-item">
                <Laptop className="cn-value-icon" aria-hidden="true" />
                <span className="cn-value-title">Work</span>
                <span className="cn-value-sub">Focused desks &amp; rooms</span>
              </div>
              <div className="cn-value-item">
                <Users className="cn-value-icon" aria-hidden="true" />
                <span className="cn-value-title">Connect</span>
                <span className="cn-value-sub">Meet other members</span>
              </div>
              <div className="cn-value-item">
                <TrendingUp className="cn-value-icon" aria-hidden="true" />
                <span className="cn-value-title">Grow</span>
                <span className="cn-value-sub">Scale without a lease</span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ==================== How Coworking Works ==================== */}
      <section className="cn-works" aria-labelledby="cw-works-heading">
        <div className="cn-container">
          <motion.div
            className="cn-works-top"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{once: true, amount: 0.25}}
          >
            <motion.div variants={fadeUp}>
              <span className="cn-eyebrow cn-eyebrow-dark">OUR APPROACH</span>
              <h2 id="cw-works-heading" className="cn-title-serif cn-works-title">
                How Coworking Works
              </h2>
              <p className="cn-works-desc">
                A simple, flexible way to access desks, rooms and amenities whenever you need them.
              </p>
              <a href="#cw-spaces" className="cn-btn-gold cw-magnetic">
                See Our Spaces <ArrowRight size={17} aria-hidden="true" />
              </a>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Image
                src="/media/8c6bb01c87-Meeting-Rooms-1536x1024.jpg"
                alt="Meeting room setup at Workspace Junction"
                width={600}
                height={290}
                unoptimized
                className="cn-works-top-img"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="cn-works-bottom"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{once: true, amount: 0.25}}
          >
            <motion.div variants={fadeUp}>
              <Image
                src="/media/5352fd494c-coworking-scaled.jpg"
                alt="Members collaborating in a coworking lounge"
                width={550}
                height={290}
                unoptimized
                className="cn-works-bottom-img"
              />
            </motion.div>
            <motion.div className="cn-works-features" variants={fadeUp}>
              <div className="cn-works-feature">
                <div className="cn-feature-icon-box" aria-hidden="true">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="cn-feature-title">Flexible Access</h3>
                  <p className="cn-feature-desc">
                    Book day passes, a dedicated desk, or a meeting room on your own schedule.
                  </p>
                </div>
              </div>
              <div className="cn-works-feature">
                <div className="cn-feature-icon-box" aria-hidden="true">
                  <Wifi size={22} />
                </div>
                <div>
                  <h3 className="cn-feature-title">Modern Amenities</h3>
                  <p className="cn-feature-desc">
                    High-speed WiFi, print stations, a wellness room and complimentary coffee, included.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ==================== Spaces & Amenities ==================== */}
      <section id="cw-spaces" className="cn-circles" aria-labelledby="cw-circles-heading">
        <div className="cn-container">
          <motion.div
            className="cn-section-header-center"
            initial={{opacity: 0, y: 20}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, amount: 0.4}}
            transition={{duration: 0.6}}
          >
            <span className="cn-eyebrow">EXPLORE OUR SPACES</span>
            <h2 id="cw-circles-heading" className="cn-title-serif">Spaces &amp; Amenities</h2>
            <p className="cn-section-sub">
              Every space is purpose-built — from a quiet desk for the day to a studio for your next shoot.
            </p>
          </motion.div>

          <motion.div
            className="cn-circles-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{once: true, amount: 0.15}}
          >
            {SPACES.map(space => (
              <motion.div
                key={space.title}
                className={'cn-circle-card' + (space.sage ? ' cn-circle-card-sage' : '')}
                variants={cardIn}
              >
                <space.icon className="cn-circle-icon cw-space-icon" aria-hidden="true" />
                <h3 className="cn-circle-title">{space.title}</h3>
                <p className="cn-circle-desc">{space.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ==================== Member Benefits ==================== */}
      <motion.section
        className="cn-benefits-wrap"
        aria-labelledby="cw-benefits-heading"
        initial={{opacity: 0, y: 30}}
        whileInView={{opacity: 1, y: 0}}
        viewport={{once: true, amount: 0.2}}
        transition={{duration: 0.7}}
      >
        <div className="cn-container">
          <div className="cn-benefits">
            <div>
              <span className="cn-eyebrow cn-eyebrow-dark">WHY WORKSPACE JUNCTION</span>
              <h2 id="cw-benefits-heading" className="cn-title-serif cn-benefits-title">
                Membership Benefits
              </h2>
              <p className="cn-benefits-desc">
                More than a desk — a workspace that supports how you work.
              </p>
              <ul className="cn-checklist">
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                  <span>High-speed WiFi &amp; printing access</span>
                </li>
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                  <span>Complimentary coffee &amp; refreshments</span>
                </li>
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                  <span>Access to the Active Wellness Room</span>
                </li>
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                  <span>Partner discounts &amp; Builders Library access</span>
                </li>
              </ul>
            </div>
            <div>
              <Image
                src="/media/381456c3b6-private-office-1024x683.jpg"
                alt="Private office space at Workspace Junction"
                width={550}
                height={310}
                unoptimized
                loading="eager"
                className="cn-benefits-img"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ==================== Membership Pricing ==================== */}
      <div id="cw-pricing" className="cw-pricing-wrap">
        <ServicePricingSection service="coworking" serviceTitle="Coworking" />
      </div>

      {/* ==================== Events ==================== */}
      <section className="cn-events" aria-labelledby="cw-events-heading">
        <div className="cn-container">
          <motion.div
            className="cn-events-top"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{once: true, amount: 0.25}}
          >
            <motion.div variants={fadeUp}>
              <span className="cn-eyebrow">STAY ENGAGED</span>
              <h2 id="cw-events-heading" className="cn-title-serif cn-events-title">
                Upcoming Events at the Junction
              </h2>
              <p className="cn-events-desc">
                Workshops, meetups and networking are built right into your membership.
              </p>
              <Link prefetch={false} href="/events/" className="cn-btn-dark cw-magnetic">
                View All Events <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Image
                src="/media/00fb7cff28-Meeting-Rooms-1024x683.jpg"
                alt="Workshop in progress at Workspace Junction"
                width={550}
                height={190}
                unoptimized
                loading="eager"
                className="cn-events-img"
              />
            </motion.div>
          </motion.div>

          <motion.div
            className="cn-callout-row"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{once: true, amount: 0.3}}
          >
            <motion.div className="cn-callout-card" variants={cardIn}>
              <div className="cn-callout-icon-box" aria-hidden="true">
                <Users size={24} />
              </div>
              <div>
                <h3 className="cn-callout-title">Why Members Choose Us</h3>
                <p className="cn-callout-desc">
                  Flexible terms, professional amenities and a community that turns a desk into a network.
                </p>
              </div>
            </motion.div>

            <motion.div className="cn-callout-card" variants={cardIn}>
              <div className="cn-callout-icon-box" aria-hidden="true">
                <Target size={24} />
              </div>
              <div>
                <h3 className="cn-callout-title">Need Something Custom?</h3>
                <p className="cn-callout-desc">
                  From team suites to podcast time, we&apos;ll help you build a plan that fits your workflow.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ==================== CTA Banner ==================== */}
      <motion.section
        className="cn-banner-wrap"
        aria-labelledby="cw-banner-heading"
        initial={{opacity: 0, y: 30}}
        whileInView={{opacity: 1, y: 0}}
        viewport={{once: true, amount: 0.25}}
        transition={{duration: 0.7}}
      >
        <div className="cn-container">
          <div className="cn-banner">
            <div>
              <span className="cn-eyebrow cn-eyebrow-dark">JOIN TODAY</span>
              <h2 id="cw-banner-heading" className="cn-title-serif cn-banner-title">
                Become a Member at Workspace Junction
              </h2>
              <p className="cn-banner-desc">
                Tour the space, meet the team, and find the plan that fits the way you work.
              </p>
              <div className="cn-banner-actions">
                <button type="button" onClick={() => openBooking('Coworking Tour')} className="cn-btn-gold cw-magnetic">
                  Book a Tour <ArrowRight size={17} aria-hidden="true" />
                </button>
                <a href="#cw-pricing" className="cn-btn-outline-dark">
                  View Memberships
                </a>
              </div>
            </div>
            <div>
              <Image
                src="/media/b3aa601cb2-hero-office.jpg"
                alt="Workspace Junction coworking floor"
                width={450}
                height={260}
                unoptimized
                loading="eager"
                className="cn-banner-img"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* ==================== More Ways ==================== */}
      <section className="cn-more-ways" aria-labelledby="cw-more-heading">
        <div className="cn-container">
          <div className="cn-more-header">
            <span className="cn-eyebrow">EXPLORE MORE</span>
            <h2 id="cw-more-heading" className="cn-title-serif">More ways to move forward.</h2>
          </div>

          <motion.div
            className="cn-more-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{once: true, amount: 0.2}}
          >
            <motion.div variants={cardIn}>
              <Link prefetch={false} href="/book-an-appointment/" className="cn-more-card">
                <MapPin className="cn-more-icon" aria-hidden="true" />
                <h3 className="cn-more-title">Book a Tour</h3>
                <p className="cn-more-desc">See the space in person and meet the team.</p>
                <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>

            <motion.div variants={cardIn}>
              <Link prefetch={false} href="/events/" className="cn-more-card">
                <Calendar className="cn-more-icon" aria-hidden="true" />
                <h3 className="cn-more-title">Attend an Event</h3>
                <p className="cn-more-desc">Join upcoming workshops and member meetups.</p>
                <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>

            <motion.div variants={cardIn}>
              <Link prefetch={false} href="/dedicated/" className="cn-more-card">
                <Handshake className="cn-more-icon" aria-hidden="true" />
                <h3 className="cn-more-title">Explore Dedicated Desks</h3>
                <p className="cn-more-desc">Reserve a permanent desk of your own.</p>
                <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>

            <motion.div variants={cardIn}>
              <Link prefetch={false} href="/blogs/" className="cn-more-card">
                <BookOpen className="cn-more-icon" aria-hidden="true" />
                <h3 className="cn-more-title">Read the Latest</h3>
                <p className="cn-more-desc">Updates, stories and resources from the Junction.</p>
                <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
