#!/usr/bin/env node
/*
  Design-rule audit (read-only, Playwright).

  Measures concrete design-system rules on every sitemap route:
    - heading outline: exactly one h1, no skipped levels (h2 -> h4)
    - typography: h1/h2/h3/body sizes inside the token ranges, heading font = Playfair
    - card rows: sibling cards in the same grid row share height and bottom-aligned CTAs
    - large images: rounded corners (>= 16px) on content photos
    - text hygiene: no literal "u2013", "&amp;", "&#8217;", "bussiness"
    - forms (mobile): inputs >= 44px tall and >= 16px text
  Usage: node scripts/qa/design-audit.cjs [--base http://localhost:3100] [--routes a,b] [--width 1440] [--out file]
*/
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require(path.join(process.cwd(), 'node_modules', 'playwright'));
const arg = (n, d) => {const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d;};
const base = arg('base', 'http://localhost:3100').replace(/\/$/, '');
const width = Number(arg('width', '1440'));
const out = arg('out', path.join(process.cwd(), 'test-results', 'design-audit.json'));
const conc = Number(arg('concurrency', '4'));

async function routes() {
  const only = arg('routes', '');
  if (only) return only.split(',');
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  return [...new Set(['/', ...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname), '/terms-and-privacy/'])];
}

function audit() {
  const W = innerWidth, issues = [];
  const vis = e => {const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && !e.closest('[aria-hidden=true],.lv-sr,.lx-sr,[hidden],details:not([open]) > :not(summary)');};
  // heading outline (main content only)
  const hs = [...document.querySelectorAll('#main h1, #main h2, #main h3, #main h4, #main h5, #main h6')].filter(h => !h.closest('[aria-hidden=true],[hidden],.bk-overlay'));
  const h1 = document.querySelectorAll('h1').length;
  if (h1 !== 1) issues.push(['h1-count', h1]);
  let prev = 1;
  for (const h of hs) {const lv = +h.tagName[1]; if (lv > prev + 1) issues.push(['heading-skip', `h${prev}->h${lv} "${h.textContent.trim().slice(0, 40)}"`]); prev = lv;}
  // typography ranges (desktop only)
  const fs = e => parseFloat(getComputedStyle(e).fontSize);
  const t = {h1: [...document.querySelectorAll('#main h1')].filter(vis), h2: [...document.querySelectorAll('#main h2')].filter(vis), h3: [...document.querySelectorAll('#main h3')].filter(vis)};
  const ranges = W >= 1200 ? {h1: [40, 60], h2: [26, 40], h3: [17, 28]} : null;
  if (ranges) for (const k of Object.keys(ranges)) for (const e of t[k]) {
    const v = fs(e); const [lo, hi] = ranges[k];
    if (e.closest('.lv-hero-copy,.wj-closing,.bk-overlay')) continue;
    // small card meta labels (testimonial names, 'Includes:') keep the source h4 style by design
    if (e.closest('.lx-card-col,.lx-card,.price-card,.journal-card,.ip-service-card,.vg-card') && (k !== 'h1')) {if (v < 14) issues.push(['type-card-' + k, `${v}px "${e.textContent.trim().slice(0, 40)}"`]); continue;}
    if (v < lo - 0.5 || v > hi + 0.5) issues.push(['type-' + k, `${v}px "${e.textContent.trim().slice(0, 40)}"`]);
    if (!/Playfair/.test(getComputedStyle(e).fontFamily) && !(k === 'h2' && e.matches('.lx-first h1 + .lx-h'))) issues.push(['font-' + k, `"${e.textContent.trim().slice(0, 40)}"`]);
  }
  // card rows: same top => same height & CTA bottom
  const groups = new Map();
  for (const c of document.querySelectorAll('#main :is(.lx-card-col,.price-card,.ip-service-card,.journal-card,.lv-tier,.vg-card)')) {
    if (!vis(c)) continue; const r = c.getBoundingClientRect(); const key = c.parentElement;
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push({c, r});
  }
  for (const list of groups.values()) {
    const rows = new Map();
    for (const it of list) {const k = Math.round(it.r.top / 4); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(it);}
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const hgt = row.map(i => Math.round(i.r.height));
      if (Math.max(...hgt) - Math.min(...hgt) > 3) issues.push(['card-height', hgt.join('/') + ' ' + row[0].c.className.split(' ').slice(0, 2).join('.')]);
      const ctas = row.map(i => {const b = [...i.c.querySelectorAll('.btn,.lx-btn,.lx-actions,.ip-text-link,.text-link,.lv-tier-cta')].filter(vis).pop(); if (!b) return null; const cardBottom = i.c.getBoundingClientRect().bottom, ctaBottom = b.getBoundingClientRect().bottom; /* only cards whose CTA closes the card */ return cardBottom - ctaBottom < 80 ? Math.round(ctaBottom) : null;});
      if (ctas.every(v => v !== null) && Math.max(...ctas) - Math.min(...ctas) > 3) issues.push(['cta-align', ctas.join('/')]);
    }
  }
  // images
  for (const img of document.querySelectorAll('#main img')) {
    if (!vis(img)) continue; const r = img.getBoundingClientRect(); if (r.width < 240 || r.height < 160) continue;
    let e = img, rad = 0; for (let i = 0; i < 4 && e; i++, e = e.parentElement) {rad = Math.max(rad, parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0); if (rad) break;}
    if (rad < 12 && !img.closest('.lv-hero-stage,.lx-bg')) issues.push(['image-radius', `${rad}px ${Math.round(r.width)}x${Math.round(r.height)} ${decodeURIComponent((img.getAttribute('src') || '').replace(/.*url=/, '').replace(/&.*/, '')).slice(0, 60)}`]);
    if (img.naturalWidth && img.naturalHeight && getComputedStyle(img).objectFit === 'fill') {const ar = img.naturalWidth / img.naturalHeight, br = r.width / r.height; if (Math.abs(ar - br) / ar > 0.04) issues.push(['image-distorted', `${ar.toFixed(2)} vs ${br.toFixed(2)}`]);}
  }
  // text hygiene
  const txt = document.querySelector('#main')?.innerText || '';
  for (const [re, name] of [[/\\?u20(13|14)/, 'u2013'], [/&amp;|&#\d+;|&[a-z]+;/, 'html-entity'], [/bussiness/i, 'bussiness']]) {const m = txt.match(re); if (m) issues.push(['text-' + name, txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ')]);}
  // forms (mobile widths)
  if (W <= 480) for (const f of document.querySelectorAll('#main :is(input:not([type=checkbox]):not([type=radio]):not([type=hidden]),select,textarea)')) {
    if (!vis(f) || f.closest('.wj-honeypot')) continue; const r = f.getBoundingClientRect(); const s = parseFloat(getComputedStyle(f).fontSize);
    if (r.height < 43.5 || s < 16) issues.push(['form-field', `${Math.round(r.height)}px tall, ${s}px text ${f.name || f.id}`]);
  }
  return issues;
}

(async () => {
  const list = await routes();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  const results = {}; let next = 0;
  await Promise.all(Array.from({length: conc}, async () => {
    const page = await ctx.newPage();
    while (next < list.length) {
      const r = list[next++];
      try {
        await page.goto(base + r, {waitUntil: 'load', timeout: 60000});
        await page.evaluate(async () => {for (let y = 0; y < document.body.scrollHeight; y += 700) {scrollTo(0, y); await new Promise(z => setTimeout(z, 40));} scrollTo(0, 0);});
        await page.waitForTimeout(400);
        results[r] = await page.evaluate(audit);
      } catch (e) {results[r] = [['error', String(e.message).slice(0, 120)]];}
    }
    await page.close();
  }));
  await browser.close();
  const counts = {};
  for (const iss of Object.values(results)) for (const [k] of iss) counts[k] = (counts[k] || 0) + 1;
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, JSON.stringify({width, routes: list.length, counts, results}, null, 1));
  console.log(JSON.stringify({width, routes: list.length, routesWithIssues: Object.values(results).filter(v => v.length).length, counts}, null, 1));
})().catch(e => {console.error(e); process.exit(2);});
