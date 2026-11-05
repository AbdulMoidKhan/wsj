'use client';

import React from 'react';
import Image from '@/components/consistent-image';
import Link from 'next/link';
import {
  ArrowRight,
  Play,
  Users,
  Lightbulb,
  TrendingUp,
  Calendar,
  BookOpen,
  HeartPulse,
  Monitor,
  Share2,
  Cpu,
  Compass,
  Heart,
  Globe,
  Check,
  Target,
  MapPin,
  Handshake
} from 'lucide-react';
import {CommunityMembershipSection} from './community-membership-section';
import './community-refinement.css';
import type {MembershipPlanItem} from '@/lib/community-pricing';

interface Props {
  plans: MembershipPlanItem[];
}

export function CommunityNetworkView({plans}: Props) {
  const openBooking = (service?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('wj:book', {
          detail: {
            service: service || 'Community Network',
            trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined
          }
        })
      );
    }
  };

  return (
    <main id="main" className="cn-page cn-refined">
      <nav className="cn-container cn-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span aria-current="page">Community Network</span></nav>
      {/* ==========================================================================
          Section 1: Hero
          ========================================================================== */}
      <section className="cn-hero cn-container" aria-label="Community Network Hero">
        <div className="cn-hero-content">
          <span className="cn-eyebrow">COMMUNITY NETWORK</span>
          <h1 className="cn-title-serif cn-hero-title">
            Good people.<br />
            Great possibilities.
          </h1>
          <p className="cn-hero-desc">
            A collaborative network designed to connect people, spark ideas, and create opportunities through shared space, events, and growth.
          </p>
          <div className="cn-hero-actions">
            <button
              type="button"
              onClick={() => openBooking('Community Network Membership')}
              className="cn-btn-gold"
            >
              Join the Network <ArrowRight size={17} aria-hidden="true" />
            </button>
            <a href="#about-network" className="cn-btn-text-play">
              Learn More
              <span className="cn-play-icon" aria-hidden="true">
                <Play size={12} fill="currentColor" />
              </span>
            </a>
          </div>
        </div>
        <div className="cn-hero-media">
          <Image
            src="/media/custom-cn/cn-hero.png"
            alt="Community members collaborating at Workspace Junction"
            width={580}
            height={430}
            priority
            unoptimized
            className="cn-hero-img"
          />
        </div>
      </section>

      {/* ==========================================================================
          Section 2: What is the Community Network
          ========================================================================== */}
      <section id="about-network" className="cn-about" aria-labelledby="cn-about-heading">
        <div className="cn-container cn-about-grid">
          <div className="cn-about-media">
            <Image
              src="/media/custom-cn/cn-what-is.png"
              alt="Workspace Junction community gathering and presentation"
              width={554}
              height={340}
              unoptimized
              className="cn-about-img"
            />
          </div>
          <div className="cn-about-content">
            <span className="cn-eyebrow">ABOUT THE NETWORK</span>
            <h2 id="cn-about-heading" className="cn-title-serif cn-about-title">
              What is the Workspace Junction Community Network?
            </h2>
            <p className="cn-about-desc">
              A growing community of entrepreneurs, professionals, creatives, and organizations who come together at Workspace Junction to work, learn, collaborate, and build meaningful connections.
            </p>
            <div className="cn-values-row">
              <div className="cn-value-item">
                <Users className="cn-value-icon" aria-hidden="true" />
                <span className="cn-value-title">Connect</span>
                <span className="cn-value-sub">Meet like-minded peers</span>
              </div>
              <div className="cn-value-item">
                <Lightbulb className="cn-value-icon" aria-hidden="true" />
                <span className="cn-value-title">Collaborate</span>
                <span className="cn-value-sub">Explore new ideas</span>
              </div>
              <div className="cn-value-item">
                <TrendingUp className="cn-value-icon" aria-hidden="true" />
                <span className="cn-value-title">Grow</span>
                <span className="cn-value-sub">Access opportunities</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          Section 3: How the Community Works (Dark Green)
          ========================================================================== */}
      <section className="cn-works" aria-labelledby="cn-works-heading">
        <div className="cn-container">
          <div className="cn-works-top">
            <div>
              <span className="cn-eyebrow cn-eyebrow-dark">OUR APPROACH</span>
              <h2 id="cn-works-heading" className="cn-title-serif cn-works-title">
                How the Community Works
              </h2>
              <p className="cn-works-desc">
                A simple, flexible way to plug into a supportive ecosystem that helps you work, learn, and grow together.
              </p>
              <a href="#community-circles" className="cn-btn-gold">
                See How It Works <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
            <div>
              <Image
                src="/media/custom-cn/cn-how-it-works-top.png"
                alt="Team discussion around table"
                width={600}
                height={290}
                unoptimized
                className="cn-works-top-img"
              />
            </div>
          </div>

          <div className="cn-works-bottom">
            <div>
              <Image
                src="/media/custom-cn/cn-how-it-works-bottom.png"
                alt="Professionals working and smiling together"
                width={550}
                height={290}
                unoptimized
                className="cn-works-bottom-img"
              />
            </div>
            <div className="cn-works-features">
              <div className="cn-works-feature">
                <div className="cn-feature-icon-box" aria-hidden="true">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="cn-feature-title">Connect &amp; Collaborate</h3>
                  <p className="cn-feature-desc">
                    Join curated meetups, working sessions, and industry discussions.
                  </p>
                </div>
              </div>
              <div className="cn-works-feature">
                <div className="cn-feature-icon-box" aria-hidden="true">
                  <Calendar size={22} />
                </div>
                <div>
                  <h3 className="cn-feature-title">Events &amp; Workshops</h3>
                  <p className="cn-feature-desc">
                    Attend practical, high-impact events designed for real growth.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          Section 4: Community Circles
          ========================================================================== */}
      <section id="community-circles" className="cn-circles" aria-labelledby="cn-circles-heading">
        <div className="cn-container">
          <div className="cn-section-header-center">
            <span className="cn-eyebrow">EXPLORE OUR NETWORK</span>
            <h2 id="cn-circles-heading" className="cn-title-serif">Community Circles</h2>
            <p className="cn-section-sub">
              Focused groups that bring together people with shared interests, industries, and goals.
            </p>
          </div>

          <div className="cn-circles-grid">
            {/* 1. Founder's Circle (sage green highlight) */}
            <div className="cn-circle-card cn-circle-card-sage">
              <BookOpen className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Founder&apos;s Circle</h3>
              <p className="cn-circle-desc">
                A space for entrepreneurs to share, learn, and scale.
              </p>
            </div>

            {/* 2. Healthcare Circle */}
            <div className="cn-circle-card">
              <HeartPulse className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Healthcare Circle</h3>
              <p className="cn-circle-desc">
                Professionals in healthcare, research, and community health.
              </p>
            </div>

            {/* 3. Content & Media Circle */}
            <div className="cn-circle-card">
              <Monitor className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Content &amp; Media Circle</h3>
              <p className="cn-circle-desc">
                Creators, podcasters, and media professionals building together.
              </p>
            </div>

            {/* 4. Business & Growth Circle */}
            <div className="cn-circle-card">
              <Share2 className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Business &amp; Growth Circle</h3>
              <p className="cn-circle-desc">
                Strategy, marketing, and operations support for growing businesses.
              </p>
            </div>

            {/* 5. Innovation & Tech Circle */}
            <div className="cn-circle-card">
              <Cpu className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Innovation &amp; Tech Circle</h3>
              <p className="cn-circle-desc">
                For builders, product thinkers, and tech enthusiasts.
              </p>
            </div>

            {/* 6. Wellness & Leadership Circle */}
            <div className="cn-circle-card">
              <Compass className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Wellness &amp; Leadership Circle</h3>
              <p className="cn-circle-desc">
                Personal and professional growth, work-life balance, and leadership.
              </p>
            </div>

            {/* 7. Faith & Community Circle */}
            <div className="cn-circle-card">
              <Heart className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">Faith &amp; Community Circle</h3>
              <p className="cn-circle-desc">
                Values-driven professionals creating positive impact in the community.
              </p>
            </div>

            {/* 8. International Professionals Circle */}
            <div className="cn-circle-card">
              <Globe className="cn-circle-icon" aria-hidden="true" />
              <h3 className="cn-circle-title">International Professionals Circle</h3>
              <p className="cn-circle-desc">
                A welcoming space for professionals new to the U.S. to connect and grow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          Section 5: Member Benefits (Dark Green Banner)
          ========================================================================== */}
      <section className="cn-benefits-wrap" aria-labelledby="cn-benefits-heading">
        <div className="cn-container">
          <div className="cn-benefits">
            <div>
              <span className="cn-eyebrow cn-eyebrow-dark">WHY JOIN</span>
              <h2 id="cn-benefits-heading" className="cn-title-serif cn-benefits-title">
                Member Benefits
              </h2>
              <p className="cn-benefits-desc">
                More than a workspace. A community that supports your goals.
              </p>
              <ul className="cn-checklist">
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span>Access to community circles</span>
                </li>
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span>Invitations to exclusive events</span>
                </li>
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span>Collaboration &amp; partnership opportunities</span>
                </li>
                <li className="cn-check-item">
                  <span className="cn-check-badge" aria-hidden="true">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span>A supportive, professional network</span>
                </li>
              </ul>
            </div>
            <div>
              <Image
                src="/media/custom-cn/cn-member-benefits.png"
                alt="Workspace Junction member community lounge"
                width={550}
                height={310}
                unoptimized
                loading="eager"
                className="cn-benefits-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          Section 6: Dynamic Membership Options with Toggle & Buttons
          ========================================================================== */}
      <CommunityMembershipSection initialPlans={plans} />

      {/* ==========================================================================
          Section 7: Upcoming Community Events & Callout Boxes
          ========================================================================== */}
      <section className="cn-events" aria-labelledby="cn-events-heading">
        <div className="cn-container">
          <div className="cn-events-top">
            <div>
              <span className="cn-eyebrow">STAY ENGAGED</span>
              <h2 id="cn-events-heading" className="cn-title-serif cn-events-title">
                Upcoming Community Events
              </h2>
              <p className="cn-events-desc">
                A mix of workshops, meetups, and networking gatherings designed to help you learn, connect, and grow.
              </p>
              <Link prefetch={false} href="/events/" className="cn-btn-dark">
                View All Events <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <div>
              <Image
                src="/media/custom-cn/cn-upcoming-events.png"
                alt="Upcoming community workshop at Workspace Junction"
                width={550}
                height={190}
                unoptimized
                loading="eager"
                className="cn-events-img"
              />
            </div>
          </div>

          <div className="cn-callout-row">
            <div className="cn-callout-card">
              <div className="cn-callout-icon-box" aria-hidden="true">
                <Users size={24} />
              </div>
              <div>
                <h3 className="cn-callout-title">Why This Community Matters</h3>
                <p className="cn-callout-desc">
                  A diverse, purpose-driven network that turns shared space into real opportunities.
                </p>
              </div>
            </div>

            <div className="cn-callout-card">
              <div className="cn-callout-icon-box" aria-hidden="true">
                <Target size={24} />
              </div>
              <div>
                <h3 className="cn-callout-title">Create Your Circle</h3>
                <p className="cn-callout-desc">
                  Have an idea for a new group or meetup? We&apos;ll help you bring it to life at Workspace Junction.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          Section 8: Become Part Banner
          ========================================================================== */}
      <section className="cn-banner-wrap" aria-labelledby="cn-banner-heading">
        <div className="cn-container">
          <div className="cn-banner">
            <div>
              <span className="cn-eyebrow cn-eyebrow-dark">JOIN TODAY</span>
              <h2 id="cn-banner-heading" className="cn-title-serif cn-banner-title">
                Become Part of the Workspace Junction Community Network
              </h2>
              <p className="cn-banner-desc">
                Connect with professionals, build meaningful relationships, and grow your ideas in a welcoming space.
              </p>
              <div className="cn-banner-actions">
                <button
                  type="button"
                  onClick={() => openBooking('Community Network Membership')}
                  className="cn-btn-gold"
                >
                  Join the Network <ArrowRight size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => openBooking('Tour Booking')}
                  className="cn-btn-outline-dark"
                >
                  Book a Tour
                </button>
              </div>
            </div>
            <div>
              <Image
                src="/media/custom-cn/cn-become-part.png"
                alt="Workspace Junction modern coworking floor"
                width={450}
                height={260}
                unoptimized
                loading="eager"
                className="cn-banner-img"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          Section 9: More Ways to Move Forward
          ========================================================================== */}
      <section className="cn-more-ways" aria-labelledby="cn-more-heading">
        <div className="cn-container">
          <div className="cn-more-header">
            <span className="cn-eyebrow">EXPLORE MORE</span>
            <h2 id="cn-more-heading" className="cn-title-serif">More ways to move forward.</h2>
          </div>

          <div className="cn-more-grid">
            <Link prefetch={false} href="/book-an-appointment/" className="cn-more-card">
              <MapPin className="cn-more-icon" aria-hidden="true" />
              <h3 className="cn-more-title">Book a Tour</h3>
              <p className="cn-more-desc">See the space in person and meet the team.</p>
              <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
            </Link>

            <Link prefetch={false} href="/events/" className="cn-more-card">
              <Calendar className="cn-more-icon" aria-hidden="true" />
              <h3 className="cn-more-title">Attend an Event</h3>
              <p className="cn-more-desc">Join upcoming workshops and community meetups.</p>
              <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
            </Link>

            <Link prefetch={false} href="/partners/" className="cn-more-card">
              <Handshake className="cn-more-icon" aria-hidden="true" />
              <h3 className="cn-more-title">Collaborate</h3>
              <p className="cn-more-desc">Explore partnership and collaboration opportunities.</p>
              <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
            </Link>

            <Link prefetch={false} href="/blogs/" className="cn-more-card">
              <BookOpen className="cn-more-icon" aria-hidden="true" />
              <h3 className="cn-more-title">Read the Latest</h3>
              <p className="cn-more-desc">Updates, stories, and resources from our community.</p>
              <span className="cn-more-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
