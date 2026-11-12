import Image from '@/components/consistent-image';
import Link from 'next/link';
import {cache, Fragment, type ReactNode} from 'react';
import {
  Armchair, ArrowUpRight, Bell, BookOpen, BriefcaseBusiness, CalendarCheck, Camera, ChartNoAxesCombined,
  CircleCheck, Clock, CodeXml, Coffee, FileCheck, Globe, GraduationCap, Handshake, Headphones, Laptop,
  LockKeyhole, Mail, MapPin, Megaphone, Mic, Monitor, Newspaper, Package, Palette, PenTool, Presentation,
  Printer, Scale, ScanLine, Send, ShieldCheck, Users, Wifi, Workflow, type LucideIcon,
} from 'lucide-react';
import {BookingButton} from '@/components/booking';
import {InquiryForm} from '@/components/lazy-client';
import {fetchCatalogService, findPlan, money} from '@/lib/catalog';
import {approvedPricingRecords, pricingAmount, publishedPricing} from '@/lib/community-pricing';
import {address, loadBusiness} from '@/lib/site';
import livePages from '@/data/live-pages.json';
import type {
  AboutSection, Action, BandSection, BannerSection, ChecksSection, ClosingSection, FaqSection, FigmaPage,
  GallerySection, GridSection, HeroSection, IconName, Img, InquirySection, IntroSection, Item, MediaSection,
  PlanCard, PriceRef, PricingSection, Section, SeriesSection, StorySection,
} from '@/lib/figma-pages/types';
import {SeriesFilter} from './series-filter';

/* Renders the "REDESIGN / … — Homepage Style" frames of the Figma file
   qjuAqpLbKBpRwAg5ZP3Q8R from the section data in lib/figma-pages. Styles live in
   app/figma-pages.css, scoped to #main.fx-page. */

const ICONS: Record<IconName, LucideIcon> = {
  armchair: Armchair, wifi: Wifi, coffee: Coffee, users: Users, monitor: Monitor, clock: Clock,
  'shield-check': ShieldCheck, mail: Mail, presentation: Presentation, 'calendar-check': CalendarCheck,
  'map-pin': MapPin, 'lock-keyhole': LockKeyhole, 'arrow-up-right': ArrowUpRight, mic: Mic, camera: Camera,
  headphones: Headphones, package: Package, send: Send, bell: Bell, 'scan-line': ScanLine, 'book-open': BookOpen,
  handshake: Handshake, globe: Globe, laptop: Laptop, printer: Printer, 'briefcase-business': BriefcaseBusiness,
  scale: Scale, megaphone: Megaphone, 'chart-no-axes-combined': ChartNoAxesCombined, palette: Palette,
  'code-xml': CodeXml, workflow: Workflow, newspaper: Newspaper, 'graduation-cap': GraduationCap,
  'file-check': FileCheck, 'pen-tool': PenTool,
};

function Icon({name, size = 24}: {name?: IconName; size?: number}) {
  if (!name) return null;
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={1.6} aria-hidden="true" focusable="false" />;
}

function Badge({icon, white}: {icon?: IconName; white?: boolean}) {
  if (!icon) return null;
  return <span className={'fx-badge' + (white ? ' fx-badge-white' : '')} aria-hidden="true"><Icon name={icon} size={30} /></span>;
}

/** Figma titles use explicit line breaks; CSS keeps them on wide screens only. */
function Lines({text}: {text: string}) {
  const parts = text.split('\n');
  return <>{parts.map((part, i) => <Fragment key={i}>{i > 0 && <br className="fx-br" />}{i > 0 && ' '}{part}</Fragment>)}</>;
}

/* ---------- prices ---------- */

const catalogService = cache((slug: string) => fetchCatalogService(slug));

interface ResolvedPrice { amount: string; plan?: string }

/** Catalog first (the booking source of truth), then the approved pricing records.
 *  A ref with a `period` targets an approved record directly (matrix cells). */
async function resolvePrice(ref?: PriceRef): Promise<ResolvedPrice | null> {
  if (!ref) return null;
  if (!ref.period) {
    const plan = findPlan(await catalogService(ref.service), ref.plan);
    if (plan) return {amount: money(plan.unitAmountCents, plan.currency), plan: plan.slug};
  }
  const name = ref.plan.toLowerCase();
  const period = ref.period?.toLowerCase();
  const candidates = approvedPricingRecords.filter(record => publishedPricing(record) && record.metadata?.service === ref.service && (record.title || '').toLowerCase().includes(name));
  const periodOf = (r: (typeof candidates)[number]) => (r.metadata?.billingPeriod || '').toLowerCase();
  const record = period ? (candidates.find(r => periodOf(r) === period) || candidates.find(r => periodOf(r).includes(period))) : candidates[0];
  const amount = pricingAmount(record);
  return amount === null ? null : {amount: money(Math.round(amount * 100))};
}

async function PriceText({price, fallback = 'On request'}: {price?: PriceRef; fallback?: string}) {
  const resolved = await resolvePrice(price);
  return <>{resolved?.amount ?? fallback}</>;
}

/* ---------- actions ---------- */

type Tone = 'yellow' | 'green' | 'ghost' | 'light';

/** CTAs use the global button contract (wj-button yellow / green); secondary links
 *  use the ghost / light styles from figma-pages.css. `book` opens the booking dialog. */
function Act({action, tone, service, wide}: {action: Action; tone: Tone; service?: string; wide?: boolean}) {
  const label = <>{action.label} <ArrowUpRight size={16} aria-hidden="true" /></>;
  const extra = wide ? ' fx-btn-wide' : '';
  if (action.book !== undefined) {
    const variant = tone === 'yellow' || tone === 'light' ? 'yellow' : 'green';
    return <BookingButton className={'wj-button-' + variant + ' fx-cta' + extra} service={action.book || service} plan={action.plan}>{label}</BookingButton>;
  }
  const href = action.href || '/contact-us/';
  const cls = tone === 'yellow' || tone === 'green' ? 'wj-button wj-button-' + tone + ' fx-cta' : 'fx-btn fx-btn-' + tone;
  return <Link prefetch={false} href={href} className={cls + extra}>{label}</Link>;
}

/* ---------- shared bits ---------- */

function Media({img, sizes, priority, className}: {img: Img; sizes: string; priority?: boolean; className?: string}) {
  return (
    <div className={'fx-media ' + (className || '')}>
      {/* The first hero image is the LCP element: preloaded AND fetched at high priority so it
          is not starved by font/CSS preloads on slow mobile connections. It is decoded in sync so
          it paints in the same frame as the text: with the default async decode the already-
          downloaded image waited for a later frame, i.e. until hydration's long tasks finished. */}
      <Image src={img.src} alt={img.alt} fill sizes={sizes} preload={priority} fetchPriority={priority ? 'high' : undefined} decoding={priority ? 'sync' : undefined} className="fx-cover" />
    </div>
  );
}

function SectionHead({s, split}: {s: {id?: string; eyebrow?: string; title: string; lead?: string}; split?: boolean}) {
  return (
    <div className={'fx-head' + (split ? ' fx-head-split' : '')}>
      {s.eyebrow && <p className="fx-eyebrow">{s.eyebrow}</p>}
      <div className="fx-head-row">
        <h2 id={s.id ? s.id + '-title' : undefined} className="fx-h2"><Lines text={s.title} /></h2>
        {s.lead && <p className="fx-lead">{s.lead}</p>}
      </div>
    </div>
  );
}

function Shell({s, className, children, label}: {s: {id?: string; bg?: string; title?: string}; className?: string; children: ReactNode; label?: string}) {
  const labelled = s.id && s.title ? s.id + '-title' : undefined;
  return (
    <section id={s.id} className={'fx-sec fx-bg-' + (s.bg || 'white') + ' ' + (className || '')} aria-labelledby={labelled} aria-label={labelled ? undefined : label || s.title || undefined}>
      <div className="fx-shell">{children}</div>
    </section>
  );
}

function ItemCard({item, variant = 'card'}: {item: Item; variant?: 'card' | 'photo' | 'value' | 'tile'}) {
  if (variant === 'photo') {
    return (
      <article className="fx-card fx-card-photo">
        {item.image && <Media img={item.image} sizes="(max-width:767px) 100vw, 620px" className="fx-card-img" />}
        <div className="fx-card-body"><Badge icon={item.icon} /><h3 className="fx-h3">{item.title}</h3>{item.text && <p>{item.text}</p>}</div>
      </article>
    );
  }
  if (variant === 'tile') {
    const body = <><Icon name={item.icon} size={26} /><span className="fx-tile-title">{item.title}</span></>;
    return item.href ? <Link prefetch={false} href={item.href} className="fx-tile">{body}</Link> : <div className="fx-tile">{body}</div>;
  }
  if (variant === 'value') {
    return (
      <article className="fx-card fx-card-value">
        <span className="fx-num" aria-hidden="true">{item.tag}</span>
        <h3 className="fx-h4">{item.title}</h3>{item.text && <p>{item.text}</p>}
      </article>
    );
  }
  const body = (
    <>
      <Badge icon={item.icon} />
      <h3 className="fx-h3">{item.title}</h3>
      {item.text && <p className="fx-pre">{item.text}</p>}
    </>
  );
  if (item.href) return <Link prefetch={false} href={item.href} className="fx-card fx-card-link">{body}<span className="fx-card-arrow" aria-hidden="true"><ArrowUpRight size={18} /></span></Link>;
  return <article className="fx-card">{body}</article>;
}

/* ---------- sections ---------- */

async function Hero({s, first}: {s: HeroSection; first: boolean}) {
  const strip = s.strip ? (s.strip.price ? <>{s.strip.prefix}<PriceText price={s.strip.price} />{s.strip.suffix}</> : s.strip.text) : null;
  return (
    <section className="fx-hero fx-bg-cream" aria-labelledby="fx-title">
      <div className="fx-shell">
        {s.crumbs && (
          <nav className="fx-crumbs" aria-label="Breadcrumb">
            <Link prefetch={false} href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{s.crumbs}</span>
          </nav>
        )}
        <div className="fx-hero-grid">
          <div className="fx-hero-copy">
            {s.eyebrow && <p className="fx-eyebrow fx-eyebrow-ink">{s.eyebrow}</p>}
            <h1 id="fx-title" className={'fx-display fx-display-' + (s.size || 'lg')}><Lines text={s.title} /></h1>
            {s.lead && <p className="fx-lead fx-hero-lead">{s.lead}</p>}
            {s.chips && <ul className="fx-chips" aria-label="Highlights">{s.chips.map(c => <li key={c.label}><Icon name={c.icon} size={16} />{c.label}</li>)}</ul>}
            <div className="fx-actions">
              {s.actions.map((a, i) => <Act key={a.label} action={a} tone={i === 0 ? 'yellow' : 'ghost'} />)}
            </div>
            {strip && <p className="fx-note">Oakbrook Terrace, IL</p>}
          </div>
          <Media img={s.image} sizes="(max-width:1023px) 100vw, 660px" priority={first} className="fx-hero-media" />
        </div>
        {strip && (
          <div className="fx-strip">
            <span className="fx-eyebrow fx-eyebrow-ink">WORK. CONNECT. GROW.</span>
            <span>{strip}</span>
            <span className="fx-strip-place">Oakbrook Terrace, IL</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Intro({s}: {s: IntroSection}) {
  return (
    <Shell s={s} className="fx-intro">
      <div className={'fx-split' + (s.imageSide === 'right' ? ' fx-split-rev' : '')}>
        <Media img={s.image} sizes="(max-width:1023px) 100vw, 592px" className="fx-intro-media" />
        <div className="fx-stack">
          <Badge icon={s.icon} />
          {s.eyebrow && <p className="fx-eyebrow">{s.eyebrow}</p>}
          <h2 id={s.id ? s.id + '-title' : undefined} className="fx-h2">{s.title}</h2>
          {s.lead && <p className="fx-lead">{s.lead}</p>}
          <hr className="fx-rule" />
          <ul className="fx-checks">{s.checks.map(c => <li key={c}><CircleCheck size={18} aria-hidden="true" />{c}</li>)}</ul>
        </div>
      </div>
    </Shell>
  );
}

function About({s}: {s: AboutSection}) {
  return (
    <Shell s={s} className="fx-about">
      <div className="fx-split fx-split-center">
        <div className="fx-stack">
          <Badge icon={s.icon} />
          {s.eyebrow && <p className="fx-eyebrow">{s.eyebrow}</p>}
          <h2 id={s.id ? s.id + '-title' : undefined} className="fx-h2">{s.title}</h2>
          {s.lead && <p className="fx-lead fx-lead-lg">{s.lead}</p>}
        </div>
        <ul className="fx-highlights">
          {s.highlights.map(h => (
            <li key={h.title}><Badge icon={h.icon} white /><span><strong className="fx-h3">{h.title}</strong><span>{h.text}</span></span></li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

function Grid({s}: {s: GridSection}) {
  return (
    <Shell s={s} className="fx-grid-sec">
      <SectionHead s={s} split={s.split} />
      <div className={'fx-grid fx-cols-' + s.cols}>
        {s.items.map(item => <ItemCard key={item.title} item={item} variant={s.variant} />)}
      </div>
      {s.tiles && <div className="fx-tiles">{s.tiles.map(t => <ItemCard key={t.title} item={t} variant="tile" />)}</div>}
    </Shell>
  );
}

function Gallery({s}: {s: GallerySection}) {
  const [a, b] = s.images;
  return (
    <Shell s={s} className="fx-gallery-sec">
      <SectionHead s={s} split={!!s.lead && !s.eyebrow} />
      {s.captions ? (
        <div className="fx-grid fx-cols-2">
          {s.captions.map(c => <ItemCard key={c.title} item={c} variant="photo" />)}
        </div>
      ) : s.images.length === 1 ? (
        <Media img={a} sizes="(max-width:1279px) 100vw, 1248px" className={'fx-wide' + (s.wide ? ' fx-wide-tall' : '')} />
      ) : (
        <div className={'fx-pair' + (s.smallFirst ? ' fx-pair-rev' : '')}>
          <Media img={a} sizes={'(max-width:767px) 100vw, ' + (s.smallFirst ? 484 : 740) + 'px'} />
          <Media img={b} sizes={'(max-width:767px) 100vw, ' + (s.smallFirst ? 740 : 484) + 'px'} />
        </div>
      )}
    </Shell>
  );
}

function MediaList({s}: {s: MediaSection}) {
  return (
    <Shell s={s} className="fx-media-sec">
      <SectionHead s={s} />
      <div className={'fx-split fx-split-center' + (s.imageSide === 'right' ? ' fx-split-rev' : '')}>
        <Media img={s.image} sizes="(max-width:1023px) 100vw, 640px" className="fx-media-photo" />
        <ul className="fx-media-list">
          {s.items.map(i => <li key={i.title}><Badge icon={i.icon} /><span><strong className="fx-h3">{i.title}</strong><span>{i.text}</span></span></li>)}
        </ul>
      </div>
    </Shell>
  );
}

function Checks({s}: {s: ChecksSection}) {
  return (
    <Shell s={s} className="fx-checks-sec">
      <SectionHead s={s} />
      <ul className="fx-checklist">{s.items.map(i => <li key={i.title}><Icon name={i.icon || 'file-check'} size={22} />{i.title}</li>)}</ul>
    </Shell>
  );
}

function Band({s}: {s: BandSection}) {
  return (
    <Shell s={s} className="fx-band-sec" label={s.heading}>
      {s.title && <SectionHead s={s} />}
      <div className="fx-band">
        <div className="fx-band-copy">
          {!s.title && s.eyebrow && <p className="fx-eyebrow fx-eyebrow-amber">{s.eyebrow}</p>}
          {s.title ? <h3 className="fx-band-title">{s.heading}</h3> : <h2 className="fx-band-title fx-band-title-xl">{s.heading}</h2>}
          <p className={s.title ? '' : 'fx-band-text-lg'}>{s.text}</p>
          {s.note && <p className="fx-band-note">{s.note}</p>}
        </div>
        {s.action && <Act action={s.action} tone="light" />}
      </div>
    </Shell>
  );
}

function Story({s}: {s: StorySection}) {
  return (
    <Shell s={s} className="fx-story">
      <div className="fx-story-head">
        <div>
          {s.eyebrow && <p className="fx-eyebrow fx-eyebrow-ink">{s.eyebrow}</p>}
          <h2 id={s.id ? s.id + '-title' : undefined} className="fx-h2 fx-h2-xl"><Lines text={s.title} /></h2>
        </div>
        <div className="fx-stack">{s.body.map(p => <p key={p.slice(0, 24)} className="fx-lead fx-lead-lg">{p}</p>)}</div>
      </div>
      <Media img={s.image} sizes="(max-width:1279px) 100vw, 1248px" className="fx-wide fx-story-img" />
    </Shell>
  );
}

function Banner({s}: {s: BannerSection}) {
  return (
    <Shell s={s} className="fx-banner-sec">
      <div className="fx-banner">
        <Media img={s.image} sizes="(max-width:1023px) 100vw, 688px" className="fx-banner-img" />
        <div className="fx-stack fx-banner-copy">
          {s.eyebrow && <p className="fx-eyebrow fx-eyebrow-ink">{s.eyebrow}</p>}
          <h2 id={s.id ? s.id + '-title' : undefined} className="fx-h2"><Lines text={s.title} /></h2>
          {s.lead && <p className="fx-lead">{s.lead}</p>}
          <div className="fx-actions"><Act action={s.action} tone="yellow" /></div>
        </div>
      </div>
    </Shell>
  );
}

/* FAQ answers that the frame shows collapsed come from the migrated live page content. */
function norm(text: string) { return text.replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase(); }
const liveAnswers: Map<string, string> = (() => {
  const answers = new Map<string, string>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const n = node as {t?: string; items?: unknown};
    if (n.t === 'faq' && Array.isArray(n.items)) {
      for (const item of n.items as {q?: string; a?: string}[]) if (item.q && item.a && !answers.has(norm(item.q))) answers.set(norm(item.q), item.a);
    }
    Object.values(n).forEach(walk);
  };
  walk(livePages);
  return answers;
})();
function plain(html: string) {
  return html.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();
}

function Faq({s}: {s: FaqSection}) {
  const items = s.items.map(i => {
    const live = liveAnswers.get(norm(i.q));
    return {q: i.q, a: i.a ?? (live ? plain(live) : undefined)};
  });
  if (s.open) {
    return (
      <Shell s={s} className="fx-faq-open">
        <SectionHead s={s} />
        <dl className="fx-qa">{items.map(i => <div key={i.q}><dt className="fx-h3">{i.q}</dt><dd>{i.a}</dd></div>)}</dl>
      </Shell>
    );
  }
  return (
    <Shell s={s} className="fx-faq">
      <div className="fx-faq-grid">
        <SectionHead s={s} />
        <div className="fx-accordion">
          {items.map(i => (
            <details key={i.q}>
              <summary><span>{i.q}</span><span className="fx-plus" aria-hidden="true" /></summary>
              <div className="fx-answer">
                {i.a ? i.a.split('\n\n').map(p => <p key={p.slice(0, 24)}>{p}</p>) : <p>Our team is happy to answer this. <Link prefetch={false} href="/contact-us/">Get in touch</Link>.</p>}
              </div>
            </details>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function Series({s}: {s: SeriesSection}) {
  return (
    <Shell s={s} className="fx-series">
      <SectionHead s={s} />
      <SeriesFilter
        filters={s.filters}
        notice={<div className="fx-notice"><Badge icon="calendar-check" white /><div><h3 className="fx-h3">{s.notice.title}</h3><p>{s.notice.text}</p></div></div>}
        items={s.items.map(i => ({tag: i.tag || '', key: i.title, node: (
          <article className="fx-event">
            <div className="fx-event-tag"><Badge icon={i.icon} /><p className="fx-eyebrow">{i.tag}</p></div>
            <h3 className="fx-h3 fx-h3-lg">{i.title}</h3>
            <p className="fx-lead fx-lead-lg">{i.text}</p>
            <p className="fx-meta">{i.meta}</p>
            {i.action && <Act action={i.action} tone="green" />}
          </article>
        )}))}
      />
    </Shell>
  );
}

async function Inquiry({s}: {s: InquirySection}) {
  const business = await loadBusiness();
  return (
    <Shell s={s} className="fx-inquiry">
      <SectionHead s={s} split />
      <div className="fx-inquiry-grid">
        <div className="fx-form-card">
          <p className="fx-eyebrow">{s.formEyebrow}</p>
          <h3 className="fx-h3 fx-h3-lg">{s.formTitle}</h3>
          <InquiryForm />
        </div>
        <aside className="fx-help" aria-label={s.asideTitle}>
          <Badge icon="calendar-check" white />
          <h3 className="fx-h3 fx-h3-xl">{s.asideTitle}</h3>
          <p>{s.asideText}</p>
          <ul className="fx-contact">
            <li><Icon name="mail" /><span><strong>Email us</strong><a href={'mailto:' + (business.email || 'grow@workspacejunction.com')}>{business.email || 'grow@workspacejunction.com'}</a></span></li>
            <li><Icon name="users" /><span><strong>Talk to our team</strong><a href={'tel:' + (business.phoneHref || '+17739861908')}>{business.phone || '(773) 986-1908'}</a></span></li>
            <li><Icon name="map-pin" /><span><strong>Visit the Junction</strong><span>{business.address || address}</span></span></li>
          </ul>
          <div className="fx-help-note"><h4 className="fx-h4">{s.notice.title}</h4><p>{s.notice.text}</p></div>
        </aside>
      </div>
    </Shell>
  );
}

/* ---------- pricing ---------- */

async function PlanPrice({plan, big}: {plan: PlanCard; big?: boolean}) {
  return (
    <div className={'fx-price' + (big ? ' fx-price-xl' : '')}>
      <span className="fx-price-amount">{plan.quote ?? <PriceText price={plan.price} />}</span>
      {plan.unit && <span className="fx-price-unit">{plan.unit}</span>}
    </div>
  );
}

async function PlanCta({plan, service, light}: {plan: PlanCard; service: string; light?: boolean}) {
  const cta = plan.cta;
  if (cta?.href) return <Act action={cta} tone={light ? 'light' : 'ghost'} wide />;
  const resolved = cta?.plan ? null : await resolvePrice(plan.price);
  const action: Action = {label: cta?.label || 'Inquire about this option', book: cta?.book ?? service, plan: cta?.plan || resolved?.plan};
  return <Act action={action} tone={light ? 'light' : 'green'} wide />;
}

function Checklist({items, small, cols}: {items: string[]; small?: boolean; cols?: boolean}) {
  return <ul className={'fx-checks' + (small ? ' fx-checks-sm' : '') + (cols ? ' fx-checks-cols' : '')}>{items.map(f => <li key={f}><CircleCheck size={18} aria-hidden="true" />{f}</li>)}</ul>;
}

async function PlanCardView({plan, service}: {plan: PlanCard; service: string}) {
  return (
    <article className={'fx-plan' + (plan.featured ? ' fx-plan-dark' : '')}>
      <p className="fx-eyebrow fx-eyebrow-amber">{plan.label}</p>
      <h3 className="fx-plan-name">{plan.name}</h3>
      <PlanPrice plan={plan} />
      {plan.alt && <div className="fx-price fx-price-alt"><span className="fx-price-amount"><PriceText price={plan.alt.price} /></span><span className="fx-price-unit">{plan.alt.unit}</span></div>}
      {plan.desc && <p className="fx-plan-desc">{plan.desc}</p>}
      <hr className="fx-rule" />
      {plan.features && <Checklist items={plan.features} small />}
      {plan.note && <p className="fx-plan-note">{plan.note}</p>}
      <PlanCta plan={plan} service={service} light={plan.featured} />
    </article>
  );
}

async function Pricing({s}: {s: PricingSection}) {
  const plans = s.plans || [];
  const id = s.id || 'pricing';
  let body: ReactNode = null;
  if (s.layout === 'cards') {
    body = (
      <>
        <div className={'fx-plans fx-plans-' + plans.length}>{plans.map(p => <PlanCardView key={p.name} plan={p} service={s.service} />)}</div>
        {s.included && (
          <div className="fx-included">
            <h3 className="fx-h3 fx-h3-lg">{s.included.title}</h3>
            <Checklist items={s.included.items} small cols />
          </div>
        )}
      </>
    );
  } else if (s.layout === 'rooms') {
    body = (
      <div className="fx-plans fx-plans-rooms">
        {plans.map(p => (
          <article key={p.name} className="fx-room">
            {p.image && <Media img={p.image} sizes="(max-width:767px) 100vw, 608px" className="fx-room-img" />}
            <div className="fx-room-body">
              <div className="fx-room-head"><h3 className="fx-plan-name">{p.name}</h3><PlanPrice plan={p} /></div>
              {p.desc && <p className="fx-pre">{p.desc}</p>}
              <PlanCta plan={p} service={s.service} />
            </div>
          </article>
        ))}
      </div>
    );
  } else if (s.layout === 'feature' || s.layout === 'location') {
    const p = plans[0];
    body = (
      <div className="fx-feature">
        {s.layout === 'location' && s.location && (
          <article className="fx-location">
            <Media img={s.location.image} sizes="(max-width:767px) 100vw, 608px" className="fx-location-img" />
            <div className="fx-location-body"><p className="fx-eyebrow">{s.location.eyebrow}</p><p className="fx-address">{s.location.lines.map(l => <span key={l}>{l}</span>)}</p></div>
          </article>
        )}
        <article className="fx-plan fx-plan-dark fx-plan-feature">
          <p className="fx-eyebrow fx-eyebrow-amber">{p.label}</p>
          <PlanPrice plan={p} big />
          {p.desc && <p className="fx-plan-desc fx-lead-lg">{p.desc}</p>}
          {p.features && <Checklist items={p.features} small />}
          {p.note && <p className="fx-plan-note">{p.note}</p>}
          <PlanCta plan={p} service={s.service} light />
        </article>
        {s.layout === 'feature' && s.aside && (
          <aside className="fx-feature-aside" aria-label={s.aside.title.replace('\n', ' ')}>
            <Badge icon={s.aside.icon} />
            <h3 className="fx-h3 fx-h3-xl"><Lines text={s.aside.title} /></h3>
            <ul className="fx-icon-list">{s.aside.items.map(i => <li key={i.title}><Icon name={i.icon} size={22} />{i.title}</li>)}</ul>
          </aside>
        )}
      </div>
    );
  } else if (s.layout === 'matrix') {
    const cols = s.columns || [];
    body = (
      <>
        <div className="fx-table-wrap" role="region" aria-label={s.title + ' rates'} tabIndex={0}>
          <table className="fx-table">
            <thead><tr>{cols.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {(s.rows || []).map(r => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  {r.cells.map((c, i) => <td key={i} data-label={cols[i + 1]}>{typeof c === 'string' ? c : <PriceText price={c} />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.notes && <div className={'fx-grid fx-notes fx-cols-' + Math.min(3, s.notes.length)}>{s.notes.map(n => <ItemCard key={n.title} item={n} />)}</div>}
        {s.cta && <div className="fx-actions fx-actions-center"><Act action={s.cta} tone="green" service={s.service} /></div>}
      </>
    );
  } else if (s.layout === 'quote' && s.quote) {
    body = (
      <div className="fx-band fx-band-quote">
        <div className="fx-band-copy">
          <p className="fx-eyebrow fx-eyebrow-amber">{s.quote.eyebrow}</p>
          <h3 className="fx-band-title fx-band-title-xl">{s.quote.title}</h3>
          <p className="fx-band-text-lg">{s.quote.text}</p>
        </div>
        <Act action={s.quote.action} tone="light" service={s.service} />
      </div>
    );
  }
  return (
    <Shell s={{...s, id}} className="fx-pricing">
      <SectionHead s={{...s, id}} split={!!s.lead} />
      {body}
      {s.perk && (
        <div className="fx-band fx-perk">
          <div className="fx-band-copy"><p className="fx-eyebrow fx-eyebrow-amber">{s.perk.eyebrow}</p><h3 className="fx-band-title">{s.perk.title}</h3><p>{s.perk.text}</p></div>
          <Act action={s.perk.action} tone="light" />
        </div>
      )}
      {s.footnote && <p className="fx-footnote">{s.footnote}</p>}
    </Shell>
  );
}

function Closing({s}: {s: ClosingSection}) {
  if (s.centered) {
    return (
      <section className="fx-sec fx-bg-sage fx-closing-centered" aria-labelledby="fx-closing-title">
        <div className="fx-shell fx-stack fx-center">
          {s.eyebrow && <p className="fx-eyebrow fx-eyebrow-ink">{s.eyebrow}</p>}
          <h2 id="fx-closing-title" className="fx-h2">{s.title}</h2>
          {s.lead && <p className="fx-lead">{s.lead}</p>}
          <div className="fx-actions fx-actions-center">{s.actions.map((a, i) => <Act key={a.label} action={a} tone={i === 0 ? 'yellow' : 'ghost'} />)}</div>
        </div>
      </section>
    );
  }
  return (
    <section className="fx-sec fx-bg-cream fx-closing" aria-labelledby="fx-closing-title">
      <div className="fx-shell">
        <div className="fx-closing-panel">
          <div className="fx-stack">
            {s.eyebrow && <p className="fx-eyebrow fx-eyebrow-amber">{s.eyebrow}</p>}
            <h2 id="fx-closing-title" className="fx-h2 fx-h2-sm">{s.title}</h2>
            {s.lead && <p className="fx-lead">{s.lead}</p>}
          </div>
          <div className="fx-closing-action">
            <span className="fx-badge fx-badge-white fx-badge-round" aria-hidden="true"><ArrowUpRight size={28} strokeWidth={1.6} /></span>
            {s.actions.map(a => <Act key={a.label} action={a} tone="green" />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionView({s, index}: {s: Section; index: number}) {
  switch (s.kind) {
    case 'hero': return <Hero s={s} first={index === 0} />;
    case 'intro': return <Intro s={s} />;
    case 'about': return <About s={s} />;
    case 'grid': return <Grid s={s} />;
    case 'gallery': return <Gallery s={s} />;
    case 'media': return <MediaList s={s} />;
    case 'checks': return <Checks s={s} />;
    case 'band': return <Band s={s} />;
    case 'story': return <Story s={s} />;
    case 'banner': return <Banner s={s} />;
    case 'faq': return <Faq s={s} />;
    case 'series': return <Series s={s} />;
    case 'inquiry': return <Inquiry s={s} />;
    case 'pricing': return <Pricing s={s} />;
    case 'closing': return <Closing s={s} />;
  }
}

export function FigmaPageView({page}: {page: FigmaPage}) {
  return (
    <main id="main" className="fx-page" data-figma-node={page.node}>
      {page.sections.map((s, i) => <SectionView key={s.kind + i} s={s} index={i} />)}
    </main>
  );
}
