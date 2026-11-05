'use client';

import React, {useState, useEffect} from 'react';
import {Check, Crown, Users, Building2, ArrowRight} from 'lucide-react';
import {BookingButton} from './booking';
import {communityPlansFromCatalog, loadPublishedPricing, type MembershipPlanItem} from '@/lib/community-pricing';
import {PUBLIC_API_URL} from '@/lib/public-api';

interface Props {
  initialPlans: MembershipPlanItem[];
}

export function CommunityMembershipSection({initialPlans}: Props) {
  const [plans, setPlans] = useState<MembershipPlanItem[]>(initialPlans);
  const [isAnnual, setIsAnnual] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadPublishedPricing(PUBLIC_API_URL, controller.signal).then(records => {
      if (records !== null && !controller.signal.aborted) setPlans(communityPlansFromCatalog(records));
    });
    return () => controller.abort();
  }, []);

  if (!plans.length) return null;

  return (
    <section id="membership-options" className="cn-memberships" aria-labelledby="cn-memberships-heading">
      <div className="cn-container">
        <div className="cn-section-header-center">
          <span className="cn-eyebrow">GET INVOLVED</span>
          <h2 id="cn-memberships-heading" className="cn-title-serif">Membership Options</h2>
          <p className="cn-section-sub">
            Choose the membership tier that aligns with your profession, schedule, and growth goals.
          </p>

          {/* Billing Interval Toggle */}
          <div className="cn-billing-toggle-wrap" role="group" aria-label="Billing frequency toggle">
            <button
              type="button"
              className={`cn-toggle-btn ${!isAnnual ? 'is-active' : ''}`}
              onClick={() => setIsAnnual(false)}
              aria-pressed={!isAnnual}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`cn-toggle-btn ${isAnnual ? 'is-active' : ''}`}
              onClick={() => setIsAnnual(true)}
              aria-pressed={isAnnual}
            >
              Annual
            </button>
          </div>
        </div>

        <div className="cn-memberships-grid">
          {plans.map((plan) => {
            const isPro = plan.popular === true;
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
            const periodLabel = isAnnual ? '/year' : '/month';

            return (
              <div
                key={plan.id}
                className={`cn-membership-card ${isPro ? 'cn-membership-card-popular' : ''}`}
              >
                {isPro && <span className="cn-popular-badge">Most Popular</span>}

                <div className="cn-card-header">
                  <div className={`cn-card-icon-box ${isPro ? 'cn-card-icon-box-gold' : ''}`} aria-hidden="true">
                    {plan.tier === 'community' && <Users size={22} />}
                    {plan.tier === 'pro' && <Crown size={22} />}
                    {plan.tier === 'founder' && <Building2 size={22} />}
                  </div>

                  <h3 className="cn-membership-name">
                    {plan.name}
                    {plan.tier === 'community' && (
                      <span className="cn-membership-sublabel">(Individuals)</span>
                    )}
                  </h3>

                  <div className="cn-price-display">
                    {price !== null && <span className="cn-price-currency">$</span>}
                    <span className="cn-price-number">{price === null ? 'Request a quote' : price.toLocaleString()}</span>
                    {price !== null && <span className="cn-price-period">{periodLabel}</span>}
                  </div>
                  <span className="cn-price-subtext">
                    {price === null ? 'Contact us for availability and pricing' : isAnnual ? 'Billed annually' : 'Billed monthly'}
                  </span>
                </div>

                <div className="cn-card-divider" />

                <ul className="cn-membership-list">
                  {(isAnnual ? plan.annualFeatures || [] : plan.features).map((feat, i) => (
                    <li key={i} className="cn-card-check-item">
                      <span className="cn-card-check-badge" aria-hidden="true">
                        <Check size={13} strokeWidth={3} />
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="cn-card-footer">
                  <BookingButton
                    service={`${(isAnnual ? plan.annualTitle : plan.monthlyTitle) || plan.name} (${isAnnual ? 'Annual' : 'Monthly'})`}
                    className={`cn-plan-btn ${isPro ? 'cn-plan-btn-gold' : 'cn-plan-btn-dark'}`}
                  >
                    <span>{plan.ctaLabel}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </BookingButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}


