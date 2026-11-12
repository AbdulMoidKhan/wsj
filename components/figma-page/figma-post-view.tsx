import Image from '@/components/consistent-image';
import Link from 'next/link';
import {ArrowUpRight, BookOpen, Laptop, Mail} from 'lucide-react';
import {SourceContent} from '@/components/service-page';
import {text, type Entry} from '@/lib/site';

/* Blog article template from the Figma frames "REDESIGN / Blog Detail — Blog #2/#3/#4"
   (6263:177782, 6263:214188, 6263:215244). The three frames share one body and
   differ only in the header: wide (cream header + full-width cover), dark (forest
   header + inset cover) and split (copy beside a square cover). */

type Variant = 'wide' | 'dark' | 'split';
const DESIGNED: Record<string, Variant> = {
  'coworking-spaces-podcast-studio-in-chicago': 'wide',
  'virtual-mailbox-in-chicago-best-mail-service': 'dark',
  'virtual-office-in-chicago-best-business-solution': 'split',
};
const ORDER: Variant[] = ['wide', 'dark', 'split'];

function variantFor(slug: string): Variant {
  if (DESIGNED[slug]) return DESIGNED[slug];
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ORDER[hash % ORDER.length];
}

function longDate(value?: string) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}) : '';
}

export function FigmaPostView({p, category, related}: {p: Entry; category?: string; related: Entry[]}) {
  const title = text(p.title);
  const cover = p.featuredImage;
  const variant: Variant = cover ? variantFor(p.slug) : 'wide';
  const summary = text(p.seo?.description || p.excerpt || '').slice(0, 220);
  const date = longDate(p.date);
  const header = (
    <div className="fx-article-intro">
      <p className="fx-eyebrow">THE JUNCTION JOURNAL{category ? <>&nbsp;&nbsp;/&nbsp;&nbsp;{category.toUpperCase()}</> : null}</p>
      <h1 id="fx-title" className="fx-article-title">{title}</h1>
      {summary && <p className="fx-article-summary">{summary}</p>}
      <p className="fx-article-meta">{date && <><time dateTime={p.date}>{date.toUpperCase()}</time>&nbsp;&nbsp;·&nbsp;&nbsp;</>}{(p.author || 'Workspace Junction').toUpperCase()}</p>
    </div>
  );
  return (
    <main id="main" className={'fx-page fx-post fx-post-' + variant} data-figma-node="6263:177782">
      <header className={'fx-article-head fx-bg-' + (variant === 'dark' ? 'forest' : 'cream')} aria-labelledby="fx-title">
        <div className="fx-shell">
          <nav className="fx-crumbs" aria-label="Breadcrumb"><Link prefetch={false} href="/">Home</Link><span aria-hidden="true">/</span><Link prefetch={false} href="/blogs/">Blogs</Link></nav>
          {variant === 'split' && cover ? (
            <div className="fx-article-split">
              {header}
              <div className="fx-media fx-article-square"><Image src={cover} alt="" fill preload fetchPriority="high" decoding="sync" sizes="(max-width:1023px) 100vw, 554px" className="fx-cover" /></div>
            </div>
          ) : header}
        </div>
      </header>
      {variant === 'wide' && cover && (
        <div className="fx-media fx-article-cover-wide"><Image src={cover} alt="" fill preload fetchPriority="high" decoding="sync" sizes="100vw" className="fx-cover" /></div>
      )}
      {variant === 'dark' && cover && (
        <div className="fx-bg-sage fx-article-inset"><div className="fx-shell"><div className="fx-media fx-article-cover-inset"><Image src={cover} alt="" fill preload fetchPriority="high" decoding="sync" sizes="(max-width:1279px) 100vw, 1248px" className="fx-cover" /></div></div></div>
      )}
      <article className="fx-article-body" aria-labelledby="fx-title">
        <div className="fx-article-col">
          <p className="fx-eyebrow">THE JUNCTION JOURNAL</p>
          <SourceContent p={p} />
        </div>
      </article>
      {related.length > 0 && (
        <section className="fx-sec fx-bg-sage" aria-labelledby="fx-related-title">
          <div className="fx-shell">
            <div className="fx-head fx-head-split">
              <p className="fx-eyebrow">THE JUNCTION JOURNAL</p>
              <div className="fx-head-row"><h2 id="fx-related-title" className="fx-h2">More from the Junction.</h2><p className="fx-lead">Explore more workspace and business guides.</p></div>
            </div>
            <div className="fx-grid fx-cols-3">
              {related.map((r, i) => {
                const Glyph = [BookOpen, Mail, Laptop][i % 3];
                const when = longDate(r.date);
                return (
                  <Link prefetch={false} key={r.path} href={r.path} className="fx-card fx-card-link">
                    <span className="fx-badge" aria-hidden="true"><Glyph size={28} strokeWidth={1.6} /></span>
                    <h3 className="fx-h3">{text(r.title)}</h3>
                    <p>The Junction Journal{when ? ' · ' + when : ''}</p>
                    <span className="fx-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      <section className="fx-sec fx-bg-cream fx-closing" aria-labelledby="fx-closing-title">
        <div className="fx-shell">
          <div className="fx-closing-panel fx-closing-slim">
            <div className="fx-stack">
              <h2 id="fx-closing-title" className="fx-h2 fx-h2-sm">Keep exploring the Junction.</h2>
              <p className="fx-lead">Find flexible workspace, studios and business services in Oakbrook Terrace.</p>
            </div>
            <div className="fx-closing-action"><Link prefetch={false} href="/services/" className="wj-button wj-button-green fx-cta">Explore Services <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          </div>
        </div>
      </section>
    </main>
  );
}
