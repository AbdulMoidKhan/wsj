import Image from 'next/image';
import {ArrowUpRight, Check, Plus, X} from 'lucide-react';
import {Fragment, type ReactNode} from 'react';
import {BookingButton} from './booking';
import {InquiryForm} from './forms';
import {LiveTabs} from './live-tabs';
import {safeContent} from '@/lib/site';
import livePages from '@/data/live-pages.json';

/*
  Renders the section structure captured from the live WordPress/Elementor pages
  (data/live-pages.json) in the classic design system. Layout is derived from
  the original containers: sibling containers become columns/cards, a lone
  image beside copy becomes a split, repeating widget patterns become card grids.
*/

export type LNode =
  | {t: 'box'; bg?: string; id?: string; children: LNode[]}
  | {t: 'h'; lv: number; text: string}
  | {t: 'html'; html: string}
  | {t: 'text'; text: string}
  | {t: 'img'; src: string; alt: string; w?: number; h?: number; href?: string}
  | {t: 'btn'; label: string; href?: string; book?: boolean}
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
function chunkRepeating(nodes: LNode[], maxP = 5): LNode[][] | null {
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
    const groups = chunkRepeating(nodes.slice(start), 8);
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

  const walk = (list: LNode[]): LNode[] => list.map(n => {
    if (n.t === 'h') {
      const clean = n.text.replace(/^#\s*/, '').trim();
      if (isEyebrow && !assignedEyebrow && /^(welcome to|workspace|unlock growth|everything you need to stand out)/i.test(clean)) {
        assignedEyebrow = true;
        return {...n, text: clean, lv: 0};
      }
      if (!assignedH1) {
        assignedH1 = true;
        return {...n, text: clean, lv: 1};
      }
      return {...n, text: clean, lv: Math.max(n.lv, 2)};
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
      const cls = 'lx-h lx-h' + Math.min(Math.max(n.lv, 1), 6);
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
      const img = <Image src={n.src} alt={altText} width={w} height={h} sizes={small ? `${w}px` : '(max-width: 760px) calc(100vw - 40px), (max-width: 1200px) 50vw, 640px'} className={small ? 'lx-img lx-img-sm' : 'lx-img'} style={{['--lx-img-max' as string]: (small ? Math.min(w, 140) : n.w && n.w > 0 ? n.w : null) ? `${small ? Math.min(w, 140) : n.w}px` : undefined}}/>;
      return n.href ? <a href={n.href} className="lx-img-link">{img}</a> : img;
    }
    case 'btn': {
      const isPeriodTab = /^(monthly|yearly save|yearly|annual)/i.test(n.label.trim()) && !n.href;
      if (isPeriodTab) {
        return <span className="lx-period-pill">{n.label}</span>;
      }
      return n.book || !n.href
        ? <BookingButton className="btn btn-primary lx-btn" service={ctx.service}>{n.label} <ArrowUpRight size={17}/></BookingButton>
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

function Box({n, ctx}: {n: Extract<LNode, {t: 'box'}>; ctx: Ctx}) {
  const kids = n.children;
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
    const split = activeBoxes.length === 2 && (imgOnly(activeBoxes[0]) || imgOnly(activeBoxes[1]));
    const deepText = (b: LNode) => /"t":"(h|html|list|text)"/.test(JSON.stringify(b));
    const cards = !ctx.hero && !split && activeBoxes.length >= 2 && activeBoxes.every(deepText);
    return <div id={n.id} className={'lx-cols' + (split ? ' lx-split' : '') + (cards ? ' lx-cards' : '')} style={{['--cols' as string]: Math.min(activeBoxes.length, 4)}}>
      {activeBoxes.map((b, i) => <div key={i} className={cards ? 'lx-col lx-card-col' : 'lx-col'}><Box n={b} ctx={{...inner, narrow: cards || activeBoxes.length >= 3}}/></div>)}
    </div>;
  }
  // repeating leaf patterns -> card grid
  const groups = chunkRepeating(kids);
  if (groups) return <div id={n.id} className="lx-cols lx-cards" style={{['--cols' as string]: groups.length <= 5 ? groups.length : groups.length % 4 === 0 ? 4 : 3}}>
    {groups.map((g, i) => <div key={i} className="lx-col lx-card-col"><Nodes nodes={g} ctx={{...inner, narrow: true}}/></div>)}
  </div>;
  // intro copy followed by repeating groups -> intro stack + card grid
  const prefixed = !ctx.narrow ? chunkWithPrefix(kids) : null;
  if (prefixed) return <div id={n.id} className="lx-stack lx-stack-lg">
    <div className="lx-stack"><Nodes nodes={prefixed.prefix} ctx={inner}/></div>
    <div className="lx-cols lx-cards" style={{['--cols' as string]: prefixed.groups.length <= 4 ? prefixed.groups.length : 3}}>
      {prefixed.groups.map((g, i) => <div key={i} className="lx-col lx-card-col"><Nodes nodes={g} ctx={{...inner, narrow: true}}/></div>)}
    </div>
  </div>;
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
  const tree = firstHasHeading ? normalizeHeadings(sections) : normalizeHeadings([{t: 'h', lv: 1, text: title}, ...sections]).slice(1);
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
