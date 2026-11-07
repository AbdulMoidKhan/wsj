import {TestimonialsSlider} from './testimonials-slider';
import {fetchTestimonials} from '@/lib/testimonials';

const EXCLUDED_PAGES = new Set(['terms-and-privacy', 'community-network', 'coworking']);

/**
 * Live published testimonials from /api/public/testimonials.
 *
 * Rendered with the rest of the page rather than streamed behind Suspense: the
 * slider carries motion attributes, and GSAP (initialised when the shell
 * hydrates) would otherwise split and transform this markup while React still
 * had it as a dehydrated boundary, producing a hydration mismatch. The fetch is
 * the same memoised, timeout-guarded call the rest of the page already awaits,
 * and it falls back to captured content when the API is unavailable.
 */
export async function TestimonialsSection({slug}: {slug?: string}) {
  if (slug && EXCLUDED_PAGES.has(slug)) return null;
  const items = await fetchTestimonials();
  if (!items.length) return null;

  return (
    <section className="lx-sec lx-band wj-testimonials-sec" aria-label="Client testimonials">
      <div className="ip-wrap">
        <TestimonialsSlider items={items}/>
      </div>
    </section>
  );
}
