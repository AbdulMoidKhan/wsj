#!/usr/bin/env node
/*
  Layout-defect scan (read-only, Playwright). Detects the visual defect classes reported on /coworking/:
    overlap        - an image/figure overlapping sibling copy in a side-by-side layout
    overwide       - an element wider than its column (spills into the neighbour)
    empty-band     - a section whose visible content is only a heading (or nearly nothing)
    heading-card   - a white card containing nothing but a heading
    narrow-lone    - a lone large image/figure using < 70% of the row with nothing beside it
    ragged-images  - 3+ images stacked in one column with unequal widths (should be a grid)
    cutout-cropped - a transparent cut-out image cover-cropped (object-fit: cover)
    unbalanced     - side-by-side columns where one is > 2.6x taller (large empty area)
    big-gap        - > 260px vertical gap between consecutive content blocks inside a section
  Usage: node scripts/qa/layout-defects.cjs [--base http://localhost:3100] [--width 1440] [--routes a,b] [--out f]
*/
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require(path.join(process.cwd(), 'node_modules', 'playwright'));
const arg = (n, d) => {const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d;};
const base = arg('base', 'http://localhost:3100').replace(/\/$/, '');
const width = Number(arg('width', '1440'));
const out = arg('out', path.join(process.cwd(), 'test-results', 'layout-defects.json'));

async function routes() {
  const only = arg('routes', '');
  if (only) return only.split(',');
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  return [...new Set(['/', ...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname), '/terms-and-privacy/'])];
}

function scan() {
  const W = innerWidth, res = [];
  const R = e => e.getBoundingClientRect();
  const vis = e => {const r = R(e), s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden' && !e.closest('[hidden],[aria-hidden=true]');};
  const label = e => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : e.tagName) + ' @' + Math.round(R(e).top + scrollY);
  const textOf = e => (e.innerText || '').replace(/\s+/g, ' ').trim();
  const main = document.querySelector('#main'); if (!main) return res;

  // overlap / overwide between grid/flex siblings
  for (const parent of main.querySelectorAll('.lx-cols,.lx-split,.lv-split,.lv-intro-grid,.ip-hero-grid,.ip-overview-grid,.lx-photo-grid,.hp-faq-grid,.lv-podcast-photos,.lv-service-grid,.pricing-grid,.ip-service-grid,.lx-gallery,.vg-grid,.archive-grid,.journal-grid,.lv-tier-grid,.lv-stats,.lx-stats')) {
    const s = getComputedStyle(parent);
    if (!/grid|flex/.test(s.display) || parent.children.length < 2) continue;
    if (s.display.includes('flex') && s.flexDirection.startsWith('column')) continue;
    const kids = [...parent.children].filter(vis);
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = R(kids[i]), b = R(kids[j]);
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 8 && oy > 8 && !kids[i].contains(kids[j]) && getComputedStyle(kids[i]).position !== 'absolute' && getComputedStyle(kids[j]).position !== 'absolute')
        res.push(['overlap', `${label(kids[i])} x ${label(kids[j])} (${Math.round(ox)}x${Math.round(oy)})`]);
    }
    for (const k of kids) {const inner = [...k.querySelectorAll('img,figure,.lx-crop')].filter(vis).filter(x => !x.closest('.lv-value,.lv-value-badge') && getComputedStyle(x).position !== 'absolute'); for (const im of inner) {const r = R(im), c = R(k); if (r.right - c.right > 12 && getComputedStyle(k).overflow === 'visible') res.push(['overwide', `${label(im)} ${Math.round(r.width)}px in ${Math.round(c.width)}px column`]);}}
  }
  // sections
  for (const sec of main.querySelectorAll(':scope > section, :scope .lx-sec, :scope .hp-section, :scope .ip-wrap > section')) {
    if (!vis(sec)) continue;
    const t = textOf(sec), imgs = [...sec.querySelectorAll('img')].filter(vis).length, ctrls = sec.querySelectorAll('a,button,input,details').length;
    const heads = [...sec.querySelectorAll('h1,h2,h3,h4')].filter(vis).map(textOf).join(' ');
    if (!imgs && !ctrls && t.length && t.length <= heads.length + 3) res.push(['empty-band', `"${t.slice(0, 50)}" ${Math.round(R(sec).height)}px`]);
    // big vertical gaps between direct content blocks
    const blocks = [...sec.querySelectorAll('.lx-stack > *, .ip-wrap > *')].filter(vis).filter(e => e.parentElement.closest('section') === sec);
    for (const p of new Set(blocks.map(b => b.parentElement))) {
      const ch = [...p.children].filter(vis).sort((x, y) => R(x).top - R(y).top);
      for (let i = 1; i < ch.length; i++) {const g = R(ch[i]).top - R(ch[i - 1]).bottom; if (g > 260 && Math.abs(R(ch[i]).left - R(ch[i - 1]).left) < 40 && !(ch[i].classList.contains('lx-actions') && i === ch.length - 1 && ch[i].closest('.lx-card-col,.lx-mini-item,.price-card'))) res.push(['big-gap', `${Math.round(g)}px before ${label(ch[i])}`]);}
    }
  }
  // heading-only white cards
  for (const c of main.querySelectorAll('.lx-card-col,.lx-card,.lx-callout,.ip-topic')) {
    if (!vis(c)) continue; const bg = getComputedStyle(c).backgroundColor; if (/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) continue;
    const t = textOf(c), h = [...c.querySelectorAll('h1,h2,h3,h4,h5')].map(textOf).join(' ');
    if (t && t.length <= h.length + 3 && !c.querySelector('img,a,button')) res.push(['heading-card', `"${t.slice(0, 50)}"`]);
  }
  // lone narrow images
  for (const im of main.querySelectorAll('.lx-img:not(.lx-img-sm), .lx-crop, .ip-hero-media')) {
    if (!vis(im) || im.closest('.lx-card-col,.lx-photo-grid,.lx-gallery,.lx-bg,.vg-card')) continue;
    const r = R(im); if (r.width < 300) continue;
    let row = im.parentElement; while (row && row !== main && R(row).width < W * 0.7) row = row.parentElement;
    const sibs = row ? [...row.querySelectorAll('h1,h2,h3,p,ul,img,.lx-crop')].filter(e => e !== im && !im.contains(e) && vis(e) && R(e).bottom > r.top + 20 && R(e).top < r.bottom - 20 && (R(e).left >= r.right - 4 || R(e).right <= r.left + 4)) : [];
    const cw = Math.min(W, document.querySelector('#main .ip-wrap, #main .hp-shell')?.getBoundingClientRect().width || W);
    if (!sibs.length && r.width < cw * 0.7) res.push(['narrow-lone', `${Math.round(r.width)}px of ${Math.round(cw)}px ${label(im)}`]);
  }
  // ragged image stacks
  for (const col of main.querySelectorAll('.lx-col, .lx-stack')) {
    const direct = [...col.querySelectorAll(':scope > .lx-stack > .lx-img, :scope > .lx-img, :scope > .lx-col > .lx-stack > .lx-img')].filter(vis);
    if (direct.length >= 3) {const ws = direct.map(e => Math.round(R(e).width)); if (Math.max(...ws) - Math.min(...ws) > 30 || new Set(direct.map(e => Math.round(R(e).left))).size === 1) res.push(['ragged-images', `${direct.length} images widths ${ws.join('/')} ${label(col)}`]);}
  }
  // cut-out images cover-cropped
  for (const im of main.querySelectorAll('img')) {
    if (!vis(im) || !/\.png/i.test(im.currentSrc || im.src)) continue;
    const s = getComputedStyle(im); if (s.objectFit !== 'cover') continue;
    const r = R(im); if (!im.naturalWidth || r.width < 80) continue;
    const ar = im.naturalWidth / im.naturalHeight, br = r.width / r.height;
    if (im.classList.contains('lx-img-cutout') || (Math.abs(ar - br) / ar > 0.35 && /Image-26|\b4\.png|image-8|avatar/i.test(im.currentSrc))) res.push(['cutout-cropped', `${(im.getAttribute('alt') || '').slice(0, 30)} ${decodeURIComponent((im.currentSrc || '').replace(/.*url=/, '').replace(/&.*/, '')).split('/').pop()}`]);
  }
  // unbalanced side-by-side columns
  for (const g of main.querySelectorAll('.lx-cols, .lv-split, .ip-hero-grid, .ip-overview-grid')) {
    if (!vis(g)) continue; const cols = [...g.children].filter(vis); if (cols.length !== 2) continue;
    const [a, b] = cols.map(R); if (Math.abs(a.top - b.top) > 40) continue; // stacked, not side by side
    const ha = cols[0].scrollHeight, hb = cols[1].scrollHeight; const content = e => [...e.querySelectorAll('*')].filter(vis).reduce((m, x) => Math.max(m, R(x).bottom), R(e).top) - R(e).top;
    const ca = content(cols[0]), cb = content(cols[1]);
    if (Math.max(ca, cb) > 500 && Math.max(ca, cb) > 2.6 * Math.min(ca, cb)) res.push(['unbalanced', `${Math.round(ca)}px vs ${Math.round(cb)}px ${label(g)}`]);
    void ha; void hb;
  }
  return [...new Map(res.map(r => [r.join('|'), r])).values()];
}

(async () => {
  const list = await routes();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  const results = {}; let next = 0;
  await Promise.all(Array.from({length: 5}, async () => {
    const page = await ctx.newPage();
    while (next < list.length) {
      const r = list[next++];
      try {
        await page.goto(base + r, {waitUntil: 'load', timeout: 60000});
        await page.evaluate(async () => {for (let y = 0; y < document.body.scrollHeight; y += 700) {scrollTo(0, y); await new Promise(z => setTimeout(z, 40));} scrollTo(0, 0);});
        await page.waitForTimeout(500);
        results[r] = await page.evaluate(scan);
      } catch (e) {results[r] = [['error', String(e.message).slice(0, 100)]];}
    }
    await page.close();
  }));
  await browser.close();
  const counts = {};
  for (const v of Object.values(results)) for (const [k] of v) counts[k] = (counts[k] || 0) + 1;
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, JSON.stringify({width, counts, results}, null, 1));
  console.log(JSON.stringify({width, routes: list.length, routesWithDefects: Object.values(results).filter(v => v.length).length, counts}, null, 1));
})().catch(e => {console.error(e); process.exit(2);});
