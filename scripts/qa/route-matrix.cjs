#!/usr/bin/env node
/*
  Route matrix QA: every sitemap route x every viewport.

  For each route/viewport it records:
    - HTTP status of the document
    - browser console errors and uncaught page errors
    - failed same-origin requests (requestfailed or HTTP >= 400)
    - broken images (in the DOM, finished loading, naturalWidth 0) after scrolling the page
    - document-level horizontal overflow (scrollWidth > clientWidth)
    - number of <h1> elements

  Read-only: it never submits forms or creates bookings.

  Usage:
    node scripts/qa/route-matrix.cjs [--base http://localhost:3000] [--out <file>]
                                     [--widths 1920,1440,1024,768,390,375] [--routes /,/about-us/]
                                     [--concurrency 4]
  Exit code 1 when any route has a blocking failure (status >= 400, page error,
  console error, failed request, broken image or overflow).
*/
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require(path.join(process.cwd(), 'node_modules', 'playwright'));

const arg = (name, fallback) => {const i = process.argv.indexOf('--' + name); return i > -1 ? process.argv[i + 1] : fallback;};
const base = arg('base', 'http://localhost:3000').replace(/\/$/, '');
const out = arg('out', path.join(process.cwd(), 'test-results', 'route-matrix.json'));
const widths = arg('widths', '1920,1440,1024,768,390,375').split(',').map(Number);
const concurrency = Number(arg('concurrency', '4'));
const heights = {1920: 1080, 1440: 900, 1024: 768, 768: 1024, 390: 844, 375: 667};

async function routes() {
  const only = arg('routes', '');
  if (only) return only.split(',');
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  const list = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  return [...new Set(['/', ...list, '/terms-and-privacy/', '/booking-confirmation/', '/__qa-missing-route__/'])];
}

async function check(context, route, width) {
  const page = await context.newPage();
  await page.setViewportSize({width, height: heights[width] || 900});
  const consoleErrors = [], pageErrors = [], failed = [];
  page.on('console', m => {if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240));});
  page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 240)));
  page.on('requestfailed', r => {
    const f = r.failure()?.errorText || '';
    if (r.url().startsWith(base) && !/ERR_ABORTED|NS_BINDING_ABORTED/.test(f)) failed.push(r.method() + ' ' + r.url().replace(base, '') + ' ' + f);
  });
  page.on('response', r => {
    if (r.url().startsWith(base) && r.status() >= 400 && r.request().resourceType() !== 'document') failed.push(r.status() + ' ' + r.url().replace(base, ''));
  });
  let status = 0;
  try {
    const res = await page.goto(base + route, {waitUntil: 'load', timeout: 60000});
    status = res ? res.status() : 0;
    // walk the page so lazy images and scroll-triggered content load
    await page.evaluate(async () => {
      const step = Math.max(400, innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90));}
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 600));
    });
    await page.waitForLoadState('networkidle', {timeout: 15000}).catch(() => {});
    const dom = await page.evaluate(() => {
      const el = document.documentElement;
      const broken = [...document.images]
        .filter(i => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src) && getComputedStyle(i).display !== 'none')
        .map(i => decodeURIComponent((i.currentSrc || i.src).replace(location.origin, '')).slice(0, 160));
      // text contrast against the nearest opaque background (skips text over images)
      const lum = c => {const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return {l: [r, g, b].map(v => {v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);}).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0), a};};
      const bgOf = e => {while (e) {const s = getComputedStyle(e); if (s.backgroundImage !== 'none' && !s.backgroundImage.includes('gradient')) return null; const L = lum(s.backgroundColor); if (L && L.a > .85) return L.l; e = e.parentElement;} return 1;};
      const lowContrast = [], tinyText = [];
      for (const t of document.querySelectorAll('#main :is(h1,h2,h3,h4,p,li,a,span,summary,dt,dd,label), footer :is(p,a,h2,span,address)')) {
        if (![...t.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
        const s = getComputedStyle(t); const r = t.getBoundingClientRect();
        if (s.visibility === 'hidden' || +s.opacity < .5 || r.width < 2 || r.height < 2 || t.closest('[aria-hidden=true],.wj-honeypot')) continue;
        const fg = lum(s.color), bg = bgOf(t), size = parseFloat(s.fontSize);
        if (fg && bg != null) {const cr = (Math.max(fg.l, bg) + .05) / (Math.min(fg.l, bg) + .05); const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700); if (cr < (large ? 3 : 4.5)) lowContrast.push(cr.toFixed(2) + ' ' + t.tagName + ' "' + t.textContent.trim().slice(0, 40) + '"');}
        if (size < 12) tinyText.push(size + 'px ' + t.tagName + ' "' + t.textContent.trim().slice(0, 30) + '"');
      }
      return {overflow: el.scrollWidth - el.clientWidth, h1: document.querySelectorAll('h1').length, broken, title: document.title, lowContrast: [...new Set(lowContrast)].slice(0, 12), tinyText: [...new Set(tinyText)].slice(0, 12)};
    });
    await page.close();
    return {route, width, status, ...dom, consoleErrors, pageErrors, failed: [...new Set(failed)]};
  } catch (e) {
    await page.close().catch(() => {});
    return {route, width, status, error: String(e.message).slice(0, 240), consoleErrors, pageErrors, failed};
  }
}

(async () => {
  const list = await routes();
  const browser = await chromium.launch();
  const context = await browser.newContext({reducedMotion: 'reduce'});
  const jobs = list.flatMap(route => widths.map(width => ({route, width})));
  const results = [];
  let next = 0;
  const started = Date.now();
  await Promise.all(Array.from({length: concurrency}, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await check(context, job.route, job.width);
      results.push(r);
      if (results.length % 25 === 0) console.log(`${results.length}/${jobs.length} checked (${Math.round((Date.now() - started) / 1000)}s)`);
    }
  }));
  await browser.close();
  const expectMissing = r => r.route === '/__qa-missing-route__/';
  const problems = results.filter(r => {
    const statusBad = expectMissing(r) ? r.status !== 404 : r.status >= 400 || r.status === 0;
    // the intentional 404 route logs its own 404 document request as a console error
    const consoleBad = expectMissing(r) ? r.consoleErrors.some(m => !/404/.test(m)) : r.consoleErrors.length > 0;
    return r.error || statusBad || r.pageErrors.length || consoleBad || r.failed.length || (r.broken || []).length || (r.lowContrast || []).length || r.overflow > 0;
  });
  const summary = {
    base, routes: list.length, widths, checks: results.length, seconds: Math.round((Date.now() - started) / 1000),
    problems: problems.length,
    overflow: results.filter(r => r.overflow > 0).map(r => `${r.width} ${r.route} +${r.overflow}px`),
    brokenImages: results.filter(r => (r.broken || []).length).map(r => `${r.width} ${r.route} ${r.broken.join(', ')}`),
    consoleErrors: results.filter(r => r.consoleErrors.length && !expectMissing(r)).map(r => `${r.width} ${r.route} ${r.consoleErrors[0]}`),
    pageErrors: results.filter(r => r.pageErrors.length).map(r => `${r.width} ${r.route} ${r.pageErrors[0]}`),
    failedRequests: results.filter(r => r.failed.length).map(r => `${r.width} ${r.route} ${r.failed.join(' | ')}`),
    badStatus: results.filter(r => expectMissing(r) ? r.status !== 404 : r.status >= 400 || r.status === 0).map(r => `${r.width} ${r.route} ${r.status} ${r.error || ''}`),
    lowContrast: results.filter(r => (r.lowContrast || []).length).map(r => `${r.width} ${r.route} ${r.lowContrast.slice(0, 3).join(' ; ')}`),
    tinyText: results.filter(r => (r.tinyText || []).length).map(r => `${r.width} ${r.route} ${r.tinyText.slice(0, 3).join(' ; ')}`),
    h1NotOne: results.filter(r => r.h1 !== 1 && !r.error).map(r => `${r.width} ${r.route} h1=${r.h1}`),
  };
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, JSON.stringify({summary, results}, null, 1));
  console.log(JSON.stringify(summary, null, 1).slice(0, 6000));
  process.exit(problems.length ? 1 : 0);
})().catch(e => {console.error(e); process.exit(2);});
