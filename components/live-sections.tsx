import Image from '@/components/consistent-image';
import {ArrowUpRight, Check, Plus, X} from 'lucide-react';
import {Fragment, type ReactNode} from 'react';
import {BookingButton} from './booking';
import {InquiryForm} from './forms';
import {LiveTabs} from './live-tabs';
import {safeContent} from '@/lib/site';
import livePages from '@/data/live-pages.json';
// Transparent cut-out photos (round avatars, isolated objects): show whole, never cover-crop.
import imageCutouts from '@/data/image-cutouts.json';
const CUTOUTS = new Set(imageCutouts as string[]);

/*
  Renders the section structure captured from the live WordPress/Elementor pages
  (data/live-pages.json) in the classic design system. Layout is derived from
  the original containers: sibling containers become columns/cards, a lone
  image beside copy becomes a split, repeating widget patterns become card grids.
*/

export type LNode =
  | {t: 'box'; bg?: string; id?: string; children: LNode[]}
  | {t: 'h'; lv: number; text: string; vis?: number}
  | {t: 'html'; html: string}
  | {t: 'text'; text: string}
  | {t: 'img'; src: string; alt: string; w?: number; h?: number; href?: string}
  | {t: 'btn'; label: string; href?: string; book?: boolean; service?: string}
  | {t: 'list'; items: {text: string; href?: string}[]}
  | {t: 'card'; title?: string; text?: string; img?: {src: string; alt: string; w?: number; h?: number}; href?: string}
  | {t: 'stat'; value: string; label?: string}
  | {t: 'faq'; items: {q: string; a: string}[]}
  | {t: 'tabs'; tabs: {title: string; children: LNode[]}[]}
  | {t: 'video'; url: string}
  | {t: 'gallery'; imgs: {src: string; alt: string; w?: number; h?: number}[]}
  | {t: 'quote'; text: string; name?: string}
  | {t: 'table'; rows: string[][]; head?: boolean}
  | {t: 'form'};

const PAGES = (livePages as unknown as {pages: Record<string, LNode[]>}).pages;
export function liveSectionsFor(path: string): LNode[] | null {
  const s = PAGES[path];
  return s && s.length ? s : null;
}

type Ctx = {service: string; depth: number; narrow?: boolean; hero?: boolean};

const isBox = (n: LNode): n is Extract<LNode, {t: 'box'}> => n.t === 'box';
const textish = (n: LNode) => ['h', 'html', 'text', 'list', 'btn', 'card', 'stat', 'quote'].includes(n.t);
const imgOnly = (n: LNode): boolean => n.t === 'img' || (isBox(n) && !n.bg && n.children.length > 0 && n.children.every(c => c.t === 'img'));

/* Split a long run of leaves into repeating groups (e.g. img,h,html  img,h,html ...). */
function chunkRepeating(nodes: LNode[], maxP = 14): LNode[][] | null {
  if (nodes.length < 6 || nodes.some(isBox)) return null;
  const sig = nodes.map(n => n.t);
  for (let p = 2; p <= maxP; p++) {
    if (sig.length % p !== 0 || sig.length / p < 2) continue;
    const head = sig.slice(0, p).join();
    let ok = true;
    for (let i = p; i < sig.length; i += p) if (sig.slice(i, i + p).join() !== head) {ok = false; break;}
    if (ok && sig.slice(0, p).some(t => t === 'h' || t === 'img')) {
      const out: LNode[][] = [];
      for (let i = 0; i < nodes.length; i += p) out.push(nodes.slice(i, i + p));
      return out;
    }
  }
  return null;
}

/* Intro leaves followed by repeating groups (e.g. heading, buttons, then plan, plan, plan). */
function chunkWithPrefix(nodes: LNode[]): {prefix: LNode[]; groups: LNode[][]} | null {
  if (nodes.some(isBox)) return null;
  for (let start = 1; start <= Math.min(6, nodes.length - 6); start++) {
    const groups = chunkRepeating(nodes.slice(start));
    if (groups && groups[0].length >= 3) return {prefix: nodes.slice(0, start), groups};
  }
  return null;
}

/* One h1 per page: the first heading becomes level 1, any other level-1 heading is demoted. */
function normalizeHeadings(nodes: LNode[]): LNode[] {
  let firstHeadingText: string | null = null;
  const findFirst = (list: LNode[]) => {
    for (const item of list) {
      if (item.t === 'h') {
        if (!firstHeadingText) firstHeadingText = item.text.replace(/^#\s*/, '').trim();
        return;
      }
      if (item.t === 'box') findFirst(item.children);
      if (item.t === 'tabs') item.tabs.forEach(t => findFirst(t.children));
    }
  };
  findFirst(nodes);

  const isEyebrow = firstHeadingText ? /^(welcome to|workspace|unlock growth|everything you need to stand out)/i.test(firstHeadingText) : false;

  let assignedH1 = false;
  let assignedEyebrow = false;
  let last = 1;
  let walkedH1: LNode | null = null;

  /* Document outline: one h1, a tagline directly under it becomes a subtitle paragraph (lv -1),
     and no level is skipped (h2 -> h4 becomes h2 -> h3). `vis` keeps the source size class. */
  const walk = (list: LNode[]): LNode[] => list.map((n, i) => {
    if (n.t === 'h') {
      const clean = n.text.replace(/^#\s*/, '').trim();
      if (isEyebrow && !assignedEyebrow && /^(welcome to|workspace|unlock growth|everything you need to stand out)/i.test(clean)) {
        assignedEyebrow = true;
        return {...n, text: clean, lv: 0};
      }
      if (!assignedH1) {
        assignedH1 = true;
        walkedH1 = n;
        last = 1;
        return {...n, text: clean, lv: 1, vis: 1};
      }
      const prev = list[i - 1];
      if (prev && prev.t === 'h' && last === 1 && i > 0 && prev.text.replace(/^#\s*/, '').trim() !== clean && walkedH1 === prev) return {...n, text: clean, lv: -1, vis: n.lv};
      const lv = Math.min(Math.max(n.lv, 2), last + 1);
      last = lv;
      // promoted by 2+ levels (h4 -> h2) means it is really a section title: size it as one
      return {...n, text: clean, lv, vis: Math.max(n.lv, 2) - lv >= 2 ? lv : Math.max(n.lv, 2)};
    }
    if (n.t === 'box') return {...n, children: walk(n.children)};
    if (n.t === 'tabs') return {...n, tabs: n.tabs.map(t => ({...t, children: walk(t.children)}))};
    return n;
  });
  return walk(nodes);
}

function formatPriceText(text: string) {
  const m = text.match(/^(\$?)(\d+(?:\.\d{2})?)\s*(?:\/|\s+)?(month|mo|hr|hour|day|year|yr)?$/i);
  if (m) {
    const num = m[2];
    const rawPeriod = m[3]?.toLowerCase();
    const period = rawPeriod ? (rawPeriod.startsWith('mo') ? 'month' : rawPeriod.startsWith('h') ? 'hour' : rawPeriod.startsWith('d') ? 'day' : 'year') : '';
    return (
      <span className="lx-price-value">
        <span className="lx-currency">$</span>
        <span className="lx-amount">{num}</span>
        {period && <small className="lx-period"> / {period}</small>}
      </span>
    );
  }
  return text;
}

/* Migrated Figma/Elementor layer names ("Rectangle 5537", "Group 1597886019", "1") are not descriptions. */
const GENERIC_ALT = /^(image|rectangle|group|img|frame|vector|\d+|unnamed)\b/i;
function cleanAlt(alt: string | undefined, fallback: string): string {
  const a = (alt || '').trim();
  return a && !GENERIC_ALT.test(a) ? a : fallback;
}

function Leaf({n, ctx}: {n: LNode; ctx: Ctx}): ReactNode {
  switch (n.t) {
    case 'h': {
      const clean = n.text.replace(/^#\s*/, '').trim();
      if (n.lv === 0) return <p className="eyebrow lx-eyebrow">{clean}</p>;
      const cls = 'lx-h lx-h' + Math.min(Math.max(n.vis ?? n.lv, 1), 6);
      if (n.lv === -1) return <p className={cls + ' lx-subtitle'}>{clean}</p>;
      if (n.lv === 1) return <h1 className={cls}>{clean}</h1>;
      if (n.lv === 2) return <h2 className={cls}>{clean}</h2>;
      if (n.lv === 3) return <h3 className={cls}>{clean}</h3>;
      return <h4 className={cls}>{clean}</h4>;
    }
    case 'html': return <div className="lx-rich" dangerouslySetInnerHTML={{__html: safeContent(n.html)}}/>;
    case 'text': {
      const clean = n.text.trim();
      if (/^(\$?\d+(?:\.\d{2})?)\s*(?:\/|\s+)?(month|mo|hr|hour|day|year|yr)?$/i.test(clean)) {
        return <p className="lx-text lx-price">{formatPriceText(clean)}</p>;
      }
      return <p className="lx-text">{clean}</p>;
    }
    case 'img': {
      const w = n.w && n.w > 0 ? n.w : 1200, h = n.h && n.h > 0 ? n.h : 800;
      const small = !!n.w && n.w <= 240;
      const altText = cleanAlt(n.alt, `${ctx.service || 'Workspace'} space photo`);
      const img = <Image src={n.src} unoptimized={/\.gif$/i.test(n.src)} alt={altText} width={w} height={h} sizes={small ? `${w}px` : '(max-width: 760px) calc(100vw - 40px), (max-width: 1200px) 50vw, 640px'} className={(small ? 'lx-img lx-img-sm' : 'lx-img') + (CUTOUTS.has(n.src) ? ' lx-img-cutout' : '')} style={{['--lx-img-max' as string]: (small ? Math.min(w, 140) : n.w && n.w > 0 ? n.w : null) ? `${small ? Math.min(w, 140) : n.w}px` : undefined}}/>;
      const framed = img; // ConsistentImage serves pre-normalized, opaque media.
      return n.href ? <a href={n.href} className="lx-img-link">{framed}</a> : framed;
    }
    case 'btn': {
      const isPeriodTab = /^(monthly|yearly save|yearly|annual)/i.test(n.label.trim()) && !n.href;
      if (isPeriodTab) {
        return <span className="lx-period-pill">{n.label}</span>;
      }
      const isCardBtn = ctx.narrow && (n.label === 'Learn More' || /^(choose plan|book|select|get started|join|reserve|buy)/i.test(n.label) || n.href?.startsWith('#'));
      return n.book || !n.href || isCardBtn
        ? <BookingButton className="btn btn-primary lx-btn" service={n.service || ctx.service}>{n.label === 'Learn More' ? 'Choose Plan' : n.label} <ArrowUpRight size={17}/></BookingButton>
        : <a href={n.href} className="lx-btn lx-btn-ghost">{n.label} <ArrowUpRight size={17}/></a>;
    }
    case 'list':
      return <ul className="lx-list">{n.items.map((it, i) => <li key={i}>{it.href ? <a href={it.href}>{it.text}</a> : it.text}</li>)}</ul>;
    case 'card': {
      const body = <>{n.img && <Image src={n.img.src} alt={cleanAlt(n.img.alt, n.title ? '' : `${ctx.service || 'Workspace'} space photo`)} width={n.img.w || 160} height={n.img.h || 160} className="lx-card-img"/>}{n.title && <h3 className="lx-h lx-h4">{n.title}</h3>}{n.text && <p className="lx-text">{n.text}</p>}</>;
      return n.href ? <a href={n.href} className="lx-card lx-card-link">{body}<ArrowUpRight size={18} className="lx-card-arrow"/></a> : <div className="lx-card">{body}</div>;
    }
    case 'stat': return <div className="lx-stat"><span className="lx-stat-v">{n.value}</span>{n.label && <span className="lx-stat-l">{n.label}</span>}</div>;
    case 'faq': return <div className="hp-faq-list lx-faq">{n.items.map(it => <details key={it.q}><summary>{it.q}<Plus size={19}/></summary>{it.a && <div className="lx-rich" dangerouslySetInnerHTML={{__html: safeContent(it.a)}}/>}</details>)}</div>;
    case 'tabs': return <LiveTabs tabs={n.tabs.map(t => ({title: t.title, content: <Nodes nodes={t.children} ctx={{...ctx, depth: ctx.depth + 1}}/>}))}/>;
    case 'video': {
      const id = n.url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)?.[1];
      return id ? <div className="lx-video"><iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen/></div> : null;
    }
    case 'gallery': return <div className="lx-gallery">{n.imgs.map(im => <Image key={im.src} src={im.src} alt={cleanAlt(im.alt, `${ctx.service || 'Workspace'} gallery photo`)} width={im.w || 900} height={im.h || 600} sizes="(max-width: 760px) 50vw, 25vw" className="lx-img"/>)}</div>;
    case 'quote': return <blockquote className="lx-quote"><p>{n.text}</p>{n.name && <cite>{n.name}</cite>}</blockquote>;
    case 'table': return <div className="lx-table-wrap"><table className="lx-table">{n.head && n.rows[0] && <thead><tr>{n.rows[0].map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>}<tbody>{(n.head ? n.rows.slice(1) : n.rows).map((r, i) => <tr key={i}>{r.map((c, j) => {const yes=/^[✓✔]$/.test(c);const no=/^[✗✕×]/.test(c);return j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className={yes ? 'lx-yes' : no ? 'lx-no' : ''}>{yes ? <Check size={16} strokeWidth={2.2} aria-label="Included"/> : no ? <>{<X size={16} strokeWidth={2.2} aria-label="Not included"/>}{c.slice(1).trim()&&<span>{c.slice(1).trim()}</span>}</> : c}</td>})}</tr>)}</tbody></table></div>;
    case 'form': return <div className="lx-form"><InquiryForm service={ctx.service}/></div>;
    default: return null;
  }
}

/* A box holding only heading(s)/eyebrow is a title for its siblings, not a column. */
const headingOnly = (b: LNode) => isBox(b) && !b.bg && b.children.length > 0 && b.children.every(x => x.t === 'h');

/* Testimonials detection: group has avatar image, author heading with dash, and quote text */
function isTestimonialGroup(nodes: LNode[]): boolean {
  if (nodes.length < 2 || nodes.length > 4) return false;
  const hasImg = nodes.some(n => n.t === 'img');
  const hasAuthor = nodes.some(n => n.t === 'h' && /^[\s\u2013\u2014-]/.test(n.text));
  const hasQuote = nodes.some(n => (n.t === 'html' || n.t === 'text') && /[“"']/.test(n.t === 'html' ? n.html : n.text));
  return hasImg && hasAuthor && hasQuote;
}

function TestimonialCard({nodes}: {nodes: LNode[]}) {
  const imgNode = nodes.find(n => n.t === 'img') as Extract<LNode, {t: 'img'}> | undefined;
  const hNode = nodes.find(n => n.t === 'h') as Extract<LNode, {t: 'h'}> | undefined;
  const textNode = nodes.find(n => n.t === 'html' || n.t === 'text') as Extract<LNode, {t: 'html' | 'text'}> | undefined;

  const rawTitle = hNode?.text || imgNode?.alt || '';
  const cleanTitle = rawTitle.replace(/^[\s\u2013\u2014-]+/, '').trim();
  const commaIdx = cleanTitle.indexOf(',');
  let name = cleanTitle;
  let role = '';
  if (commaIdx !== -1) {
    name = cleanTitle.slice(0, commaIdx).trim();
    role = cleanTitle.slice(commaIdx + 1).trim();
  }

  const rawHtml = textNode ? (textNode.t === 'html' ? textNode.html : textNode.text) : '';
  const textContent = rawHtml.replace(/<[^>]*>/g, '').trim();
  const cleanQuote = textContent.replace(/^[“"']+|[”"']+$/g, '').trim();

  return (
    <figure className="lx-col lx-testimonial-card">
      <div className="lx-testimonial-quote-wrap">
        <span className="lx-testimonial-mark" aria-hidden="true">&ldquo;</span>
        <blockquote className="lx-testimonial-quote">
          <p>{cleanQuote}</p>
        </blockquote>
      </div>
      <figcaption className="lx-testimonial-footer">
        {imgNode && (
          <Image
            src={imgNode.src}
            alt={name}
            width={52}
            height={52}
            className="lx-testimonial-avatar"
          />
        )}
        <div className="lx-testimonial-meta">
          <cite className="lx-testimonial-name">{name}</cite>
          {role && <span className="lx-testimonial-role">{role}</span>}
        </div>
      </figcaption>
    </figure>
  );
}

function Box({n, ctx}: {n: Extract<LNode, {t: 'box'}>; ctx: Ctx}) {
  const kids = n.children.length > 1 ? n.children.flatMap(k => headingOnly(k) ? (k as Extract<LNode, {t: 'box'}>).children : [k]) : n.children;
  // three or more image-only children: an even photo grid instead of a ragged column
  const photoKids = kids.filter(k => k.t === 'img' || (isBox(k) && !k.bg && k.children.length === 1 && k.children[0].t === 'img'));
  if (!n.bg && kids.length >= 3 && photoKids.length === kids.length && !photoKids.some(k => (k.t === 'img' ? k : (k as Extract<LNode, {t: 'box'}>).children[0] as Extract<LNode, {t: 'img'}>).w! > 0 && ((k.t === 'img' ? k : (k as Extract<LNode, {t: 'box'}>).children[0]) as Extract<LNode, {t: 'img'}>).w! <= 160)) {
    return <div id={n.id} className="lx-photo-grid" style={{['--cols' as string]: kids.length === 4 ? 2 : Math.min(kids.length, 3)}}>
      {photoKids.map((k, i) => <div key={i} className="lx-photo-cell"><Leaf n={k.t === 'img' ? k : (k as Extract<LNode, {t: 'box'}>).children[0]} ctx={{...ctx, narrow: true}}/></div>)}
    </div>;
  }
  const inner = {...ctx, depth: ctx.depth + 1};
  // background image boxes: cover panel (with copy on a shade if it has text)
  if (n.bg) {
    const hasCopy = kids.some(k => textish(k) || isBox(k));
    return <div id={n.id} className={'lx-bg' + (hasCopy ? ' has-copy' : '')}>
      <Image src={n.bg} alt="" fill sizes="(max-width: 1200px) 100vw, 1200px" className="lx-bg-img"/>
      {hasCopy && <div className="lx-bg-copy"><Nodes nodes={kids} ctx={inner}/></div>}
    </div>;
  }
  const boxes = kids.filter(isBox);
  // form alongside contact info reads best as side-by-side split
  if (boxes.length === 2 && boxes.length === kids.length && boxes.some(b => JSON.stringify(b).includes('"t":"form"'))) {
    return <div id={n.id} className="lx-cols lx-split lx-form-split" style={{['--cols' as string]: 2}}>
      {boxes.map((b, i) => <div key={i} className="lx-col"><Box n={b} ctx={inner}/></div>)}
    </div>;
  }
  // columns that hold nothing but buttons become one button group above/below the remaining columns
  const btnOnly = (b: LNode) => isBox(b) && !b.bg && b.children.length > 0 && b.children.every(c => c.t === 'btn');
  const btnBoxes = boxes.filter(btnOnly);
  if (btnBoxes.length >= 2 && btnBoxes.length === kids.length) {
    return <div id={n.id} className="lx-stack"><Nodes nodes={btnBoxes.flatMap(b => (b as Extract<LNode, {t: 'box'}>).children)} ctx={inner}/></div>;
  }
  if (btnBoxes.length && btnBoxes.length < kids.length && kids.length >= 2) {
    const rest = {...n, id: undefined, children: kids.filter(k => !btnOnly(k))};
    const actions = <Nodes nodes={btnBoxes.flatMap(b => (b as Extract<LNode, {t: 'box'}>).children)} ctx={inner}/>;
    const first = btnOnly(kids[0]);
    return <div id={n.id} className="lx-stack lx-stack-lg">{first && actions}<Box n={rest} ctx={ctx}/>{!first && actions}</div>;
  }
  // inside a card or a 3+ column grid there is no room for further columns: stack
  // inside a card: sibling item groups (image + heading, e.g. service tiles) form a small grid instead of one long column
  const itemLike = (b: Extract<LNode, {t: 'box'}>) => b.children.some(x => x.t === 'h') && b.children.some(x => x.t === 'img');
  if (ctx.narrow && boxes.length >= 2 && boxes.length === kids.length && boxes.every(itemLike)) {
    return <div id={n.id} className="lx-cols lx-cards lx-mini-grid" style={{['--cols' as string]: Math.min(boxes.length, 3)}}>
      {boxes.map((b, i) => <div key={i} className="lx-col lx-mini-item"><Box n={b} ctx={inner}/></div>)}
    </div>;
  }
  if (ctx.narrow && boxes.length && !boxes.every(imgOnly)) {
    return <div id={n.id} className="lx-stack"><Nodes nodes={kids} ctx={inner}/></div>;
  }
  // a short heading block next to a complex block reads better stacked (heading above content)
  const complex = (b: Extract<LNode, {t: 'box'}>) => b.children.some(isBox) || !!chunkRepeating(b.children) || b.children.some(c => ['faq', 'table', 'tabs', 'gallery'].includes(c.t));
  if (boxes.length === 2 && boxes.length === kids.length && boxes.filter(complex).length === 1 && !boxes.find(b => !complex(b))!.children.some(c => c.t === 'img' && (c.w || 999) > 240)) {
    return <div id={n.id} className="lx-stack lx-stack-lg">{boxes.map((b, i) => <Box key={i} n={b} ctx={inner}/>)}</div>;
  }
  // columns: all children are containers
  // filter out trailing decorative logo containers from top-level multi-column sections
  const filteredBoxes = boxes.filter(b => !(b.children && b.children.length === 1 && b.children[0].t === 'img' && (b.children[0].w || 0) <= 240 && !b.bg && boxes.length > 2));
  const activeBoxes = filteredBoxes.length >= 2 ? filteredBoxes : boxes;
  if (activeBoxes.length >= 2 && (activeBoxes.length === kids.length || activeBoxes.length === filteredBoxes.length)) {
    const leaves = kids.filter(k => !isBox(k));
    const split = activeBoxes.length === 2 && (imgOnly(activeBoxes[0]) || imgOnly(activeBoxes[1]));
    const deepText = (b: LNode) => /"t":"(h|html|list|text)"/.test(JSON.stringify(b));
    const cards = !ctx.hero && !split && activeBoxes.length >= 2 && activeBoxes.every(deepText);
    // Two very unequal columns (e.g. three packages beside a short CTA) read badly as equal-height cards:
    // give each full width so the long one can lay its repeated items out as a grid.
    const weight = (b: LNode) => JSON.stringify(b).replace(/"(src|alt|bg|href|t|lv|w|h)":("[^"]*"|\d+)/g, '').length;
    if (cards && activeBoxes.length === 2) {
      const [wa, wb] = activeBoxes.map(weight);
      if (Math.max(wa, wb) > 2.5 * Math.min(wa, wb)) return <div id={n.id} className="lx-stack lx-stack-lg lx-uneven">
        {leaves.length > 0 && <div className="lx-stack"><Nodes nodes={leaves.filter(k => kids.indexOf(k) < kids.findIndex(isBox))} ctx={inner}/></div>}
        {activeBoxes.map((b, i) => <div key={i} className={'lx-uneven-part' + ((i === 0 ? wa : wb) < (i === 0 ? wb : wa) ? ' lx-callout' : '')}><Box n={b} ctx={inner}/></div>)}
        {leaves.length > 0 && <div className="lx-stack"><Nodes nodes={leaves.filter(k => kids.indexOf(k) > kids.findIndex(isBox))} ctx={inner}/></div>}
      </div>;
    }
    const grid = <div id={leaves.length ? undefined : n.id} className={'lx-cols' + (split ? ' lx-split' : '') + (cards ? ' lx-cards' : '')} style={{['--cols' as string]: Math.min(activeBoxes.length, 4)}}>
      {activeBoxes.map((b, i) => {
        const bStr = JSON.stringify(b);
        const isPlanCard = cards && (bStr.includes('$') || /bronze|silver|gold|platinum|starter|basic package|professional package|premium package/i.test(bStr));
        const hasBtn = bStr.includes('"t":"btn"');
        const planTitle = b.t === 'box' ? (b.children.find((c): c is Extract<LNode, {t: 'h'}> => c.t === 'h')?.text ?? '') : '';
        return (
          <div key={i} className={cards ? 'lx-col lx-card-col' : 'lx-col'}>
            <Box n={b} ctx={{...inner, narrow: cards || activeBoxes.length >= 3}}/>
            {isPlanCard && !hasBtn && (
              <div className="lx-actions" style={{marginTop: 'auto', paddingTop: '22px', width: '100%'}}>
                <BookingButton className="btn btn-primary lx-btn" service={ctx.service ? `${ctx.service} - ${planTitle || 'Plan'}` : (planTitle || 'Plan')}>
                  Choose Plan <ArrowUpRight size={17}/>
                </BookingButton>
              </div>
            )}
          </div>
        );
      })}
    </div>;
    if (!leaves.length) return grid;
    // Loose headings/copy beside the columns used to be dropped; keep them in source order around the grid.
    const firstBox = kids.findIndex(isBox);
    const before = kids.filter((k, i) => !isBox(k) && i < firstBox);
    const after = kids.filter((k, i) => !isBox(k) && i > firstBox);
    return <div id={n.id} className="lx-stack lx-stack-lg">
      {before.length > 0 && <div className="lx-stack"><Nodes nodes={before} ctx={inner}/></div>}
      {grid}
      {after.length > 0 && <div className="lx-stack"><Nodes nodes={after} ctx={inner}/></div>}
    </div>;
  }
  // repeating leaf patterns -> card grid
  const groups = chunkRepeating(kids);
  if (groups) {
    const isTestimonial = isTestimonialGroup(groups[0]);
    if (isTestimonial) {
      return <div id={n.id} className="lx-cols lx-testimonials-showcase" style={{['--cols' as string]: 3}}>
        {groups.map((g, i) => <TestimonialCard key={i} nodes={g}/>)}
      </div>;
    }
    return <div id={n.id} className={'lx-cols lx-cards'} style={{['--cols' as string]: groups.length <= 5 ? groups.length : groups.length % 4 === 0 ? 4 : 3}}>
      {groups.map((g, i) => <div key={i} className="lx-col lx-card-col"><Nodes nodes={g} ctx={{...inner, narrow: true}}/></div>)}
    </div>;
  }
  // intro copy followed by repeating groups -> intro stack + card grid
  const prefixed = !ctx.narrow ? chunkWithPrefix(kids) : null;
  if (prefixed) {
    const isPrefixedTestimonial = isTestimonialGroup(prefixed.groups[0]);
    if (isPrefixedTestimonial) {
      return <div id={n.id} className="lx-stack lx-stack-lg">
        <div className="lx-stack"><Nodes nodes={prefixed.prefix} ctx={inner}/></div>
        <div className="lx-cols lx-testimonials-showcase" style={{['--cols' as string]: 3}}>
          {prefixed.groups.map((g, i) => <TestimonialCard key={i} nodes={g}/>)}
        </div>
      </div>;
    }
    return <div id={n.id} className="lx-stack lx-stack-lg">
      <div className="lx-stack"><Nodes nodes={prefixed.prefix} ctx={inner}/></div>
      <div className="lx-cols lx-cards" style={{['--cols' as string]: prefixed.groups.length <= 4 ? prefixed.groups.length : 3}}>
        {prefixed.groups.map((g, i) => <div key={i} className="lx-col lx-card-col"><Nodes nodes={g} ctx={{...inner, narrow: true}}/></div>)}
      </div>
    </div>;
  }
  // lone image beside copy -> split
  if (!ctx.narrow && kids.length >= 2 && imgOnly(kids[0]) && kids.slice(1).some(textish) && !kids.slice(1).some(imgOnly)) {
    return <div id={n.id} className="lx-cols lx-split" style={{['--cols' as string]: 2}}><div className="lx-col"><Nodes nodes={[kids[0]]} ctx={inner}/></div><div className="lx-col lx-stack"><Nodes nodes={kids.slice(1)} ctx={inner}/></div></div>;
  }
  return <div id={n.id} className="lx-stack"><Nodes nodes={kids} ctx={inner}/></div>;
}

function Nodes({nodes, ctx}: {nodes: LNode[]; ctx: Ctx}) {
  // consecutive buttons share one row
  const out: ReactNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.t === 'btn') {
      const run: LNode[] = [n];
      while (nodes[i + 1]?.t === 'btn') run.push(nodes[++i]);
      out.push(<div key={'b' + i} className="lx-actions">{run.map((b, j) => <Leaf key={j} n={b} ctx={ctx}/>)}</div>);
      continue;
    }
    if (n.t === 'stat') {
      const run: LNode[] = [n];
      while (nodes[i + 1]?.t === 'stat') run.push(nodes[++i]);
      out.push(<div key={'s' + i} className="lx-stats">{run.map((b, j) => <Leaf key={j} n={b} ctx={ctx}/>)}</div>);
      continue;
    }
    out.push(<Fragment key={i}>{isBox(n) ? <Box n={n} ctx={ctx}/> : <Leaf n={n} ctx={ctx}/>}</Fragment>);
  }
  return <>{out}</>;
}

export function LiveSections({sections, title, service}: {sections: LNode[]; title: string; service: string}) {
  const ctx: Ctx = {service, depth: 0};
  const firstHasHeading = JSON.stringify(sections[0] || {}).includes('"t":"h"');
  const normalized = firstHasHeading ? normalizeHeadings(sections) : normalizeHeadings([{t: 'h', lv: 1, text: title}, ...sections]).slice(1);
  // a section that is only a heading ("Membership Overview") introduces the next section; render them together
  const tree: LNode[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const s = normalized[i], next = normalized[i + 1];
    const leaves = (x: LNode): LNode[] => isBox(x) && !x.bg ? x.children.flatMap(leaves) : [x];
    const only = leaves(s);
    if (i > 0 && next && only.length && only.every(x => x.t === 'h')) {
      const nb = isBox(next) && !next.bg ? next : {t: 'box' as const, children: [next]};
      normalized[i + 1] = {...nb, children: [...only, ...nb.children]};
      continue;
    }
    tree.push(s);
  }
  return <div className="lx-page">
    {!firstHasHeading && <h1 className="lx-sr">{title}</h1>}
    {tree.map((s, i) => {
      const box = isBox(s) ? s : {t: 'box' as const, children: [s]};
      return <section key={i} id={box.id} className={'lx-sec' + (i === 0 ? ' lx-first' : '') + (i % 2 ? ' lx-band' : '')}>
        <div className="ip-wrap"><Box n={{...box, id: undefined}} ctx={i === 0 ? {...ctx, hero: true} : ctx}/></div>
      </section>;
    })}
  </div>;
}
