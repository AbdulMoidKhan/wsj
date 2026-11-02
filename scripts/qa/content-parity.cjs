#!/usr/bin/env node
/*
  Content parity gate: snapshots the authentic content of every sitemap route so the
  redesign can prove it changed presentation only.

  Per route it records the document status, final URL, title, meta description,
  canonical, robots, JSON-LD, heading outline, prices and a hash of the normalized
  visible text of #main (falls back to body).

  Usage:
    node scripts/qa/content-parity.cjs --write     capture the baseline
    node scripts/qa/content-parity.cjs             compare against the baseline
    [--base http://localhost:3000] [--routes /,/about-us/] [--concurrency 6]
    [--baseline <file>] [--allow <file>]

  --allow points at a JSON file of {"route": ["field", ...]} differences that a
  reviewed data migration is expected to introduce. Exit code 1 on any other diff.
*/
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {chromium} = require(path.join(process.cwd(), 'node_modules', 'playwright'));

const arg = (name, fallback) => {const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : fallback;};
const flag = name => process.argv.includes('--' + name);
const base = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const baselineFile = arg('baseline', path.join(process.cwd(), 'scripts', 'qa', 'baseline', 'content-parity.json'));
const allowFile = arg('allow', '');
const concurrency = Number(arg('concurrency', '6'));
const write = flag('write');

async function routes() {
  const only = arg('routes', '');
  if (only) return only.split(',');
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  const list = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  return [...new Set(['/', ...list, '/terms-and-privacy/', '/booking-confirmation/'])].sort();
}

const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

async function snapshot(context, route) {
  const page = await context.newPage();
  await page.setViewportSize({width: 1440, height: 900});
  try {
    const res = await page.goto(base + route, {waitUntil: 'load', timeout: 60000});
    await page.waitForLoadState('networkidle', {timeout: 15000}).catch(() => {});
    const dom = await page.evaluate(() => {
      const meta = sel => document.querySelector(sel)?.getAttribute('content') ?? null;
      const norm = s => s.replace(/\s+/g, ' ').trim();
      const root = document.querySelector('#main') || document.body;
      // innerText follows rendering, so collapsed accordions and hidden tabs still count via textContent
      const text = norm(root.textContent || '');
      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
        try {return JSON.stringify(JSON.parse(s.textContent));} catch {return s.textContent.trim();}
      }).sort();
      return {
        title: document.title,
        description: meta('meta[name="description"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
        robots: meta('meta[name="robots"]'),
        ogTitle: meta('meta[property="og:title"]'),
        jsonLd,
        headings: [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => norm(h.textContent || '')).filter(Boolean),
        prices: [...new Set(text.match(/\$\s?[\d,]+(\.\d+)?/g) || [])].sort(),
        text,
      };
    });
    await page.close();
    const finalPath = new URL(page.url()).pathname;
    return {route, status: res ? res.status() : 0, finalPath, ...dom, textHash: hash(dom.text), words: dom.text.split(' ').length, text: undefined};
  } catch (e) {
    await page.close().catch(() => {});
    return {route, status: 0, error: String(e.message).slice(0, 240)};
  }
}

// heading levels are free to change in the redesign; the heading text is not
const FIELDS = ['status', 'finalPath', 'title', 'description', 'canonical', 'robots', 'ogTitle', 'jsonLd', 'headings', 'prices', 'textHash'];

function diff(a, b) {
  const out = [];
  for (const f of FIELDS) {
    const x = JSON.stringify(a[f]), y = JSON.stringify(b[f]);
    if (x !== y) out.push({field: f, before: x?.slice(0, 300), after: y?.slice(0, 300)});
  }
  return out;
}

(async () => {
  const list = await routes();
  const browser = await chromium.launch();
  const context = await browser.newContext({reducedMotion: 'reduce'});
  const results = [];
  let next = 0;
  const started = Date.now();
  await Promise.all(Array.from({length: concurrency}, async () => {
    while (next < list.length) {
      const r = await snapshot(context, list[next++]);
      results.push(r);
      if (results.length % 25 === 0) console.log(`${results.length}/${list.length} captured (${Math.round((Date.now() - started) / 1000)}s)`);
    }
  }));
  await browser.close();
  results.sort((a, b) => a.route.localeCompare(b.route));
  const errors = results.filter(r => r.error || r.status >= 400 || r.status === 0);

  if (write) {
    if (errors.length) {console.error('refusing to write a baseline with failing routes:\n' + errors.map(r => `${r.route} ${r.status} ${r.error || ''}`).join('\n')); process.exit(1);}
    fs.mkdirSync(path.dirname(baselineFile), {recursive: true});
    fs.writeFileSync(baselineFile, JSON.stringify({base, captured: new Date().toISOString(), routes: results}, null, 1));
    console.log(`baseline written: ${results.length} routes, ${results.reduce((s, r) => s + r.prices.length, 0)} price strings -> ${path.relative(process.cwd(), baselineFile)}`);
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  const allow = allowFile ? JSON.parse(fs.readFileSync(allowFile, 'utf8')) : {};
  const before = new Map(baseline.routes.map(r => [r.route, r]));
  const now = new Map(results.map(r => [r.route, r]));
  const problems = [];
  for (const [route, a] of before) {
    const b = now.get(route);
    if (!b) {if (!arg('routes', '')) problems.push({route, diffs: [{field: 'route', before: 'present', after: 'missing from sitemap'}]}); continue;}
    const diffs = diff(a, b).filter(d => !(allow[route] || allow['*'] || []).includes(d.field));
    if (diffs.length) problems.push({route, diffs});
  }
  for (const route of now.keys()) if (!before.has(route)) problems.push({route, diffs: [{field: 'route', before: 'absent', after: 'new route'}]});
  for (const p of problems) {
    console.log(`\n✗ ${p.route}`);
    for (const d of p.diffs) console.log(`   ${d.field}\n     before: ${d.before}\n     after:  ${d.after}`);
  }
  console.log(`\ncontent parity: ${results.length} routes checked, ${problems.length} with differences (${Math.round((Date.now() - started) / 1000)}s)`);
  process.exit(problems.length ? 1 : 0);
})().catch(e => {console.error(e); process.exit(2);});
