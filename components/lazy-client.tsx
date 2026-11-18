'use client';

/*
  Route-specific client components, code-split.

  Every client component imported (even indirectly) by a server page module ships its chunk on
  EVERY page that module serves. The catch-all route serves ~150 URLs, so a form library or the
  gallery's pricing data imported there was downloaded on every Figma page. next/dynamic inside
  a client module splits them: the server still renders their HTML, and the browser fetches a
  chunk only on pages that actually render the component.
*/
import dynamic from 'next/dynamic';
// Lazily imported client modules do not get their CSS into the server HTML, so the sheets they
// need on first paint are imported here (they were already route-wide before the split).
import './interactions.css';
import './visit-pages-view.css';

export const InquiryForm = dynamic(() => import('./forms').then(m => m.InquiryForm));
export const VisitPagesView = dynamic(() => import('./visit-pages-view').then(m => m.VisitPagesView));
export const ServicePricingSection = dynamic(() => import('./service-pricing-section').then(m => m.ServicePricingSection));
export const VenueGallery = dynamic(() => import('./venue-gallery').then(m => m.VenueGallery));
