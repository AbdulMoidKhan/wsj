import {localMedia, publicItems, text} from '@/lib/site';
import fallbackData from '@/data/testimonials.json';

/**
 * Testimonials live in the shared `Content` table (kind `testimonials`) and are served by the
 * existing public/admin content APIs. The captured records in data/testimonials.json are used
 * only when the API cannot be reached, matching the offline fallback used elsewhere.
 */
export type Testimonial = {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  quote: string;
};

type Row = {id: string; slug: string; title: string; excerpt?: string; content?: unknown; metadata?: Record<string, unknown>};
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const testimonialFallback: Testimonial[] = (fallbackData as Array<Record<string, string>>).map(item => ({
  id: item.slug,
  name: item.name,
  role: item.role || '',
  company: item.company || '',
  avatar: item.avatar || '',
  quote: item.quote,
}));

function toTestimonial(row: Row): Testimonial {
  const m = row.metadata || {};
  const html = row.content && typeof row.content === 'object' && 'html' in (row.content as object) ? String((row.content as {html?: unknown}).html ?? '') : '';
  return {
    id: row.id || row.slug,
    name: text(row.title),
    role: text(str(m.role) || str(m.designation)),
    company: text(str(m.company)),
    avatar: localMedia(str(m.avatar) || str(m.featuredImage)),
    quote: text(str(row.excerpt) || str(m.quote) || html),
  };
}

/** Published testimonials in admin sort order; falls back to captured content when API is down. */
export async function fetchTestimonials(): Promise<Testimonial[]> {
  const rows = (await publicItems('testimonials')) as Row[] | null;
  if (rows === null) return testimonialFallback;
  const filtered = rows
    .map(toTestimonial)
    .filter(item => item.name && item.quote && !['ascsc', 'cascasc', 'test', 'asdasd'].includes(item.name.toLowerCase()) && !['ascsc', 'cascasc', 'test', 'asdasd'].includes(item.quote.toLowerCase()));
  return filtered.length >= 2 ? filtered : testimonialFallback;
}
