import {localMedia, publicItems, text} from '@/lib/site';

/**
 * Use cases are stored in the shared `Content` table (kind `use-cases`) and served by the
 * existing public/admin content APIs. Published records drive /use-cases/ and the homepage
 * strip; curated defaults are only used when the API itself is unreachable, matching the
 * offline fallback the homepage already applies to CMS services.
 */
export type UseCase = {
  id: string;
  slug: string;
  number: string;
  title: string;
  description: string;
  /** Where the card links: the use case detail page. */
  href: string;
  /** Optional related service page configured in the admin (shown as a CTA on the detail page). */
  serviceHref: string;
  image: string;
  alt: string;
  body: string;
  homepage: boolean;
};

/** Migrated originals, kept as the offline fallback only (identical to the launched page). */
const fallbackSource: Array<Omit<UseCase, 'href' | 'body'> & {body?: string}> = [
  {id: 'creative-designers-agencies', slug: 'creative-designers-agencies', number: '01', title: 'Creative designers & agencies', description: 'A focused base for client work, collaboration, presentations and content production.', serviceHref: '/creative-designers-agencies/', image: '/media/c982925218-Group-1597884977.jpg', alt: 'Creative workspace at Workspace Junction', homepage: true},
  {id: 'e-commerce-online-business', slug: 'e-commerce-online-business', number: '02', title: 'E-commerce & online business', description: 'Bring your brand to life with room for product shoots, operations, meetings and growth.', serviceHref: '/e-commerce-online-business/', image: '/media/af55bc8a2b-image-17-1.png', alt: 'Workspace for growing online businesses', homepage: true},
  {id: 'independent-professionals', slug: 'independent-professionals', number: '03', title: 'Independent professionals', description: 'A professional place to focus, meet clients and build a stronger everyday routine.', serviceHref: '/coworking/', image: '/media/b0cc56da0a-aboutus.png', alt: 'Shared workspace for independent professionals', homepage: true},
  {id: 'remote-teams-collaborators', slug: 'remote-teams-collaborators', number: '04', title: 'Remote teams & collaborators', description: 'Come together for planning, presentations and the conversations that work better in person.', serviceHref: '/meeting-rooms/', image: '/media/c982925218-Group-1597884977.jpg', alt: 'Meeting space for teams', homepage: true},
  {id: 'creators-storytellers', slug: 'creators-storytellers', number: '05', title: 'Creators & storytellers', description: 'Make space for photography, podcasts and the ideas that deserve to be seen and heard.', serviceHref: '/photo-studio/', image: '/media/b0cc56da0a-aboutus.png', alt: 'Creative production space', homepage: true},
  {id: 'founders-growing-businesses', slug: 'founders-growing-businesses', number: '06', title: 'Founders & growing businesses', description: 'Connect your workspace, business presence and practical support under one roof.', serviceHref: '/virtual-office/', image: '/media/af55bc8a2b-image-17-1.png', alt: 'Business workspace at Workspace Junction', homepage: true},
];

export const useCaseFallback: UseCase[] = fallbackSource.map(item => ({...item, body: '', href: '/use-cases/' + item.slug + '/'}));

type Row = {id: string; slug: string; title: string; excerpt?: string; content?: unknown; metadata?: Record<string, unknown>};
const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Only site-relative paths or absolute http(s) links reach the markup. */
function safeHref(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') || value.startsWith('#')) return value;
  return '/use-cases/';
}

function toUseCase(row: Row, index: number): UseCase {
  const m = row.metadata || {};
  const html = row.content && typeof row.content === 'object' && 'html' in (row.content as object) ? String((row.content as {html?: unknown}).html ?? '') : '';
  const description = text(str(row.excerpt) || str(m.description) || html).slice(0, 240);
  const image = localMedia(str(m.featuredImage) || str(m.image));
  const related = str(m.href) || str(m.path);
  return {
    id: row.id || row.slug,
    slug: row.slug,
    number: str(m.number) || String(index + 1).padStart(2, '0'),
    title: text(row.title),
    description,
    href: '/use-cases/' + row.slug + '/',
    serviceHref: related ? safeHref(related) : '',
    image,
    alt: str(m.alt) || text(row.title),
    body: html,
    homepage: m.hideFromHomepage !== true,
  };
}

export type UseCaseResult = {items: UseCase[]; offline: boolean};

/**
 * Published use cases from the API, newest configuration first (sortOrder, then creation).
 * `offline` is true only when the API could not be reached, so callers can show the curated
 * fallback instead of an empty page.
 */
export async function fetchUseCases(): Promise<UseCaseResult> {
  const rows = (await publicItems('use-cases')) as Row[] | null;
  if (rows === null) return {items: useCaseFallback, offline: true};
  return {items: rows.map(toUseCase).filter(item => item.title), offline: false};
}

/** One published use case by slug, or null when it is missing, unpublished or the API is down. */
export async function fetchUseCase(slug: string): Promise<UseCase | null> {
  try {
    const response = await fetch((process.env.API_URL || 'http://localhost:4000/api') + '/public/use-cases/' + encodeURIComponent(slug), {next: {revalidate: 30}, signal: AbortSignal.timeout(2500)});
    if (response.ok) return toUseCase((await response.json()) as Row, 0);
    if (response.status !== 404) return useCaseFallback.find(item => item.slug === slug) || null;
    return null;
  } catch {
    return useCaseFallback.find(item => item.slug === slug) || null;
  }
}

/** Homepage strip: published use cases that are not explicitly hidden from the homepage. */
export async function fetchHomepageUseCases(limit = 6): Promise<UseCase[]> {
  const {items} = await fetchUseCases();
  /* Published records are never hidden for missing artwork; the card falls back to a plain tile. */
  return items.filter(item => item.homepage).slice(0, limit);
}
