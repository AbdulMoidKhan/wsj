// Mission responsive + motion-safety sweep (read-only, LOCAL only).
// For every public sitemap route (or QA_ROUTES) at the mission viewport set it records:
// horizontal overflow, console/page errors, and content still hidden by motion after the
// page has been scrolled end to end. A second pass runs with prefers-reduced-motion: reduce.
// Usage: QA_BASE_URL=http://localhost:3001 QA_OUT=<abs file.json> node scripts/qa/mission-responsive.mjs
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base = process.env.QA_BASE_URL || 'http://localhost:3001';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const out = process.env.QA_OUT;
if (!out) throw Error('Set QA_OUT');
const widths = (process.env.QA_WIDTHS || '320,360,375,390,414,480,768,820,1024,1280,1440,1920').split(',').map(Number);
let routes = process.env.QA_ROUTES?.split(',');
if (!routes) {
  const xml = await (await fetch(base + '/sitemap.xml')).text();
  routes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
}

const browser = await chromium.launch();
const rows = [];
async function sweep(reducedMotion) {
  const context = await browser.newContext({reducedMotion});
  const page = await context.newPage();
  let errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text().slice(0, 160));});
  for (const route of routes) {
    // Full width set for a representative core; two widths for the long tail keeps runtime sane.
    const core = /^\/(?:|about-us\/|contact-us\/|coworking\/|podcast-studio\/|virtual-office\/|meeting-rooms\/|memberships\/|blogs\/|gallery\/|dedicated\/|events\/)$/.test(route);
    if (reducedMotion === 'reduce' && !core) continue; // reduced-motion pass: core routes
    const set = reducedMotion === 'reduce' ? [390, 1440] : core ? widths : [375, 1440];
    for (const width of set) {
      errors = [];
      await page.setViewportSize({width, height: width < 768 ? 812 : 900});
      const res = await page.goto(base + route, {waitUntil: 'load', timeout: 45000}).catch(e => ({status: () => 'ERR ' + e.message.slice(0, 60)}));
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60));}
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 900));
      }).catch(() => {});
      const m = await page.evaluate(() => {
        const doc = document.documentElement;
        // Content flung past offscreen may legitimately wait to reveal on approach (or the 4 s
        // fallback). A defect is content that is ON SCREEN after scrolling settles yet still hidden.
        const hiddenEls = [...document.querySelectorAll('main [data-mo-pending], main [data-anim], main [data-anim-stagger-group] > *')]
          .filter(el => getComputedStyle(el).opacity === '0' || getComputedStyle(el).visibility === 'hidden');
        const hidden = hiddenEls.filter(el => {const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.height > 0;}).length;
        const pendingOffscreen = hiddenEls.length - hidden;
        const offenders = [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed')
          .slice(0, 3).map(el => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]);
        return {overflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth), stuckHidden: hidden, pendingOffscreen, offenders, h1: document.querySelectorAll('h1').length};
      }).catch(() => ({overflowPx: -1, stuckHidden: -1, offenders: [], h1: -1}));
      rows.push({route, width, reducedMotion, status: res?.status?.(), ...m, errors: [...new Set(errors)]});
    }
  }
  await context.close();
}
try {
  await sweep('no-preference');
  await sweep('reduce');
} finally {
  await browser.close();
}
const bad = rows.filter(r => r.overflowPx > 0 || r.stuckHidden > 0 || r.errors.length || r.status !== 200 || r.h1 !== 1);
await fs.writeFile(out, JSON.stringify({time: new Date().toISOString(), base, routes: routes.length, samples: rows.length, problems: bad.length, rows}, null, 2));
console.log(JSON.stringify({routes: routes.length, samples: rows.length, problems: bad.length}));
for (const r of bad.slice(0, 60)) console.log(JSON.stringify({route: r.route, width: r.width, rm: r.reducedMotion, status: r.status, overflowPx: r.overflowPx, offenders: r.offenders, stuckHidden: r.stuckHidden, h1: r.h1, errors: r.errors.slice(0, 2)}));
