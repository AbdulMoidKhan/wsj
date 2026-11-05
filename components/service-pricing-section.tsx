'use client';

import React, {useState, useEffect} from 'react';
import {Check, Crown, ArrowRight, ShieldCheck} from 'lucide-react';
import {BookingButton} from './booking';
import {PUBLIC_API_URL} from '@/lib/public-api';
import {approvedPricingRecords, loadPublishedPricing, publishedPricing, pricingAmount, type PricingRecord} from '@/lib/community-pricing';

export interface PlanData {
  id: string;
  title: string;
  price: number | string;
  period: string;
  featured?: boolean;
  features: string[];
  ctaLabel?: string;
  service?: string;
}

interface Props {
  service: string;
  serviceTitle?: string;
}

const QUOTE_SERVICES: Record<string, string> = {
  'digital-services': 'Digital services',
  'bpo-services': 'Business process outsourcing',
  'printed-services': 'Printing and scanning',
  'notary-public': 'Notary services',
  'digital-presence': 'Digital presence services'
};

export function servicePlansFromCatalog(records: PricingRecord[], service: string): PlanData[] {
  const serviceKey = ({'mail-box': 'virtual-mailbox', 'membership-plans': 'memberships', 'monthly_memberships': 'memberships'} as Record<string, string>)[service] || service;
  return records.filter(p => publishedPricing(p) && p.metadata?.service === serviceKey).map(p => {
    const amount = pricingAmount(p);
    return {id: p.slug || p.id || '', title: p.title || '',
      price: amount === null ? 'Request a quote' : `$${amount.toLocaleString('en-US')}`,
      period: p.metadata?.billingPeriod ? `/${p.metadata.billingPeriod}` : '',
      featured: p.metadata?.featured === true, features: p.metadata?.features || [],
      ctaLabel: p.metadata?.ctaLabel || (amount === null ? 'Request a quote' : 'Inquire about this option'),
      service: p.metadata?.service};
  });
}

function fallbackPlans(service: string): PlanData[] {
  const approved = servicePlansFromCatalog(approvedPricingRecords, service);
  if (approved.length || !QUOTE_SERVICES[service]) return approved;
  return [{id: `${service}-quote`, title: QUOTE_SERVICES[service], price: 'Request a quote', period: '', features: [], ctaLabel: 'Request a quote'}];
}

export function ServicePricingSection({service, serviceTitle}: Props) {
  const [catalog, setCatalog] = useState<{service: string; plans: PlanData[]}>(() => ({service, plans: fallbackPlans(service)}));
  const plans = catalog.service === service ? catalog.plans : fallbackPlans(service);

  useEffect(() => {
    const controller = new AbortController();
    loadPublishedPricing(PUBLIC_API_URL, controller.signal).then(records => {
      if (records !== null && !controller.signal.aborted) {
        // Do not resurrect catalog offers after a successful empty response.
        setCatalog({service, plans: servicePlansFromCatalog(records, service)});
      }
    });
    return () => controller.abort();
  }, [service]);

  if (!plans.length) return null;

  return (
    <section className="lx-sec lx-band wj-service-pricing-sec" id="pricing" aria-labelledby="wj-svc-pricing-heading">
      <div className="ip-wrap">
        <div className="cn-section-header-center">
          <span className="cn-eyebrow">PLANS &amp; PRICING</span>
          <h2 id="wj-svc-pricing-heading" className="cn-title-serif">
            {serviceTitle ? `${serviceTitle} Options` : 'Membership & Pricing Options'}
          </h2>
          <p className="cn-section-sub">
            Clear, transparent solutions designed for flexible productivity and scalable growth.
          </p>
        </div>

        <div className="cn-memberships-grid" style={{marginTop: '36px'}}>
          {plans.map((plan, i) => {
            const isFeatured = plan.featured === true;
            return (
              <div
                key={plan.id || i}
                className={`cn-membership-card ${isFeatured ? 'cn-membership-card-popular' : ''}`}
              >
                {isFeatured && <span className="cn-popular-badge">Most Popular</span>}

                <div className="cn-card-header">
                  <div className={`cn-card-icon-box ${isFeatured ? 'cn-card-icon-box-gold' : ''}`} aria-hidden="true">
                    {isFeatured ? <Crown size={22} /> : <ShieldCheck size={22} />}
                  </div>

                  <h3 className="cn-membership-name">{plan.title}</h3>

                  <div className="cn-price-display">
                    <span className="cn-price-number">{plan.price}</span>
                    {plan.period && <span className="cn-price-period">{plan.period}</span>}
                  </div>
                </div>

                <div className="cn-card-divider" />

                {plan.features.length > 0 && (
                  <ul className="cn-membership-list">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="cn-card-check-item">
                        <span className="cn-card-check-badge" aria-hidden="true">
                          <Check size={13} strokeWidth={3} />
                        </span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="cn-card-footer">
                  <BookingButton
                    service={`${plan.title}${plan.period ? ` (${plan.period.slice(1)})` : ''} - ${serviceTitle || service}`}
                    className={`cn-plan-btn ${isFeatured ? 'cn-plan-btn-gold' : 'cn-plan-btn-dark'}`}
                  >
                    <span>{plan.ctaLabel || 'Book This Option'}</span>
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


