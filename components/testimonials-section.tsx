import {Suspense} from 'react';
import {TestimonialsSlider} from './testimonials-slider';
import {fetchTestimonials} from '@/lib/testimonials';

const EXCLUDED_PAGES = new Set(['terms-and-privacy', 'community-network', 'coworking']);

/** Skeleton shown while published testimonials are fetched from the content API. */
function TestimonialsSkeleton() {
  return (
    <div className="lx-vskel" aria-hidden="true">
      <div className="lx-vskel-side">
        <span className="lx-vskel-line lx-vskel-badge"/>
        <span className="lx-vskel-line lx-vskel-title"/>
        <span className="lx-vskel-line lx-vskel-short"/>
        <span className="lx-vskel-line"/>
      </div>
      <div className="lx-vskel-stage">
        <span className="lx-vskel-card"/>
      </div>
    </div>
  );
}

/** Live published testimonials from /api/public/testimonials. */
async function TestimonialsContent() {
  const items = await fetchTestimonials();
  if (!items.length) return null;
  return <TestimonialsSlider items={items}/>;
}

export function TestimonialsSection({slug}: {slug?: string}) {
  if (slug && EXCLUDED_PAGES.has(slug)) return null;

  return (
    <section className="lx-sec lx-band wj-testimonials-sec" aria-label="Client testimonials">
      <div className="ip-wrap">
        <Suspense fallback={<TestimonialsSkeleton/>}>
          <TestimonialsContent/>
        </Suspense>
      </div>
    </section>
  );
}
