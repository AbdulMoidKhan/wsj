'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./ts-register.cjs');
const root = path.resolve(__dirname, '../..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

/* The homepage hero (app/_home/junction-page.tsx, .h-hero-main) is the LCP element. */
const heroImageTag = () => {
 const page = source('app/_home/junction-page.tsx');
 const figure = page.match(/<figure className="h-hero-main">([\s\S]*?)<\/figure>/);
 assert.ok(figure, 'homepage hero figure .h-hero-main is present');
 const image = figure[1].match(/<Image\b[\s\S]*?\/>/);
 assert.ok(image, 'hero figure renders a next/image');
 return image[0];
};

test('homepage hero image is fetched early: preloaded or fetchPriority high', () => {
 const tag = heroImageTag();
 assert.ok(/\spreload(?:[\s/]|=\{true\})/.test(tag) || /fetchPriority="high"/.test(tag), 'hero image needs preload or fetchPriority="high"');
 // Next 16 deprecates `priority` in favour of `preload`.
 assert.doesNotMatch(tag, /\spriority[=\s/]/);
 // No other homepage image may claim high priority, or the hint means nothing.
 const claims = source('app/_home/junction-page.tsx').match(/fetchPriority="high"|\spreload[\s/]/g) || [];
 const heroClaims = (tag.match(/fetchPriority="high"|\spreload[\s/]/g) || []).length;
 assert.equal(claims.length, heroClaims, 'only the hero image is preloaded / high priority');
});

test('homepage hero image is never lazy-loaded', () => {
 const tag = heroImageTag();
 assert.doesNotMatch(tag, /loading="lazy"/);
 assert.doesNotMatch(tag, /loading=\{/, 'loading must not be computed for the hero');
});

test('image reveal animation leaves the hero alone', () => {
 const motion = source('components/gsap-motion.tsx');
 const reveal = motion.match(/querySelectorAll<HTMLImageElement>\('([^']+)'\)/);
 assert.ok(reveal, 'gsap-motion image reveal selector found');
 const selector = reveal[1];
 // Homepage images are choreographed by JunctionMotion, never by the generic fade-in ...
 assert.match(selector, /main:not\(\.junction-home\) img/);
 // ... and eager / high-priority images are excluded on every page.
 assert.match(selector, /:not\(\[fetchpriority="high"\]\)/);
 assert.match(selector, /:not\(\[loading="eager"\]\)/);
 // The homepage choreography only scrubs the hero from its visible state; it never gives the
 // hero a hidden starting state (from / fromTo / set, or opacity 0) that would delay LCP.
 const home = source('components/junction-motion.tsx');
 const heroLines = home.split('\n').filter(l => /h-hero-(main|img|side)/.test(l));
 assert.ok(heroLines.length > 0, 'junction-motion still references the hero (update this test if that changes)');
 for (const line of heroLines) {
  assert.doesNotMatch(line, /gsap\.(from|fromTo|set)\(/, line.trim());
  assert.doesNotMatch(line, /(autoAlpha|opacity):\s*0[,}\s]/, line.trim());
 }
});

test('server catalog reads bound API waits and preserve revalidation/fallbacks', async () => {
 const {fetchCatalogService, fetchCatalogServices} = require('../../lib/catalog.ts');
 const originalFetch = global.fetch;
 try {
  let requested;
  global.fetch = async (url, options) => {
   requested = {url, options};
   assert.ok(options.signal instanceof AbortSignal);
   assert.equal(options.signal.aborted, false);
   return {ok: true, json: async () => ({slug: 'coworking'})};
  };
  assert.deepEqual(await fetchCatalogService('coworking', 17), {slug: 'coworking'});
  assert.ok(requested.url.endsWith('/public/catalog/services/coworking'));
  assert.deepEqual(requested.options.next, {revalidate: 17});
  assert.match(source('lib/catalog.ts'), /AbortSignal\.timeout\(3000\)/);
  global.fetch = async () => {throw new Error('API unavailable');};
  assert.equal(await fetchCatalogService('coworking'), null);
  assert.deepEqual(await fetchCatalogServices(), []);
 } finally {global.fetch = originalFetch;}
});

require('../../backend/test/catalog-summary-performance.test.ts');


test('public content readers paginate below the Next cache item limit without losing records', async () => {
 const {publicItems} = require('../../lib/site.ts');
 const originalFetch = global.fetch;
 const requests = [];
 try {
  global.fetch = async url => {
   const request = new URL(url);
   requests.push(request);
   const page = Number(request.searchParams.get('page'));
   const limit = Number(request.searchParams.get('limit'));
   assert.equal(limit, 25);
   const start = (page - 1) * limit;
   return {ok: true, json: async () => ({items: Array.from({length: Math.max(0, Math.min(limit, 65 - start))}, (_, index) => ({id: String(start + index)})), total: 65})};
  };
  const items = await publicItems('performance-pagination-fixture');
  assert.equal(items.length, 65);
  assert.deepEqual(requests.map(request => request.searchParams.get('page')), ['1', '2', '3']);
  assert.equal(new Set(items.map(item => item.id)).size, 65);
  assert.match(source('lib/site.ts'), /page<=40/);
 } finally {global.fetch = originalFetch;}
});


test('catalog booking preserves coworking same-day restrictions and declared dedicated durations', () => {
 const {blocksSameDayBooking} = require('../../lib/booking-policy.ts');
 assert.equal(blocksSameDayBooking('coworking', 'ONE_TIME'), true);
 assert.equal(blocksSameDayBooking('coworking-space', 'ONE_TIME'), true);
 assert.equal(blocksSameDayBooking('dedicated', 'RECURRING'), true);
 assert.equal(blocksSameDayBooking('meeting-rooms', 'ONE_TIME'), false);
 assert.match(source('components/booking-dialog.tsx'), /blockToday=\{blocksSameDayBooking\(detail\?\.slug, plan\?\.billingType\)\}/);
 for (const slug of ['dedicated-desk-classic', 'dedicated-desk-performance']) {
  const seedLine = source('backend/prisma/seed-service-catalog.ts').split('\n').find(line => line.includes("slug: '" + slug + "'"));
  assert.match(seedLine, /durationDays: 30/);
 }
});

// Homepage scrolling stays native; optional scenes cannot create a scroll trap.
test('homepage never runs a second smooth-scroll controller', () => {
 const motion = source('components/gsap-motion.tsx');
 assert.match(motion, /pathname === '\/' \|\| reduced \|\| !canRunRichEffects\(\)/);
 assert.match(motion, /\[reduced, pathname\]/);
});

test('ecosystem sticky layout is gated by hydration, viewport height and motion preference', () => {
 const css = source('app/_home/junction-home.css');
 const explorer = source('components/ecosystem-explorer.tsx');
 assert.match(explorer, /min-height: 740px/);
 assert.match(css, /@media \(min-width: 1100px\) and \(min-height: 740px\) and \(prefers-reduced-motion: no-preference\)/);
 assert.match(css, /\.jx-track\.is-scroll-driven \{ height:/);
 assert.doesNotMatch(css, /\.jx-track \{ height:/);
 assert.match(css, /overflow-x: clip; overflow-y: visible/);
});

test('deferred gallery pin cannot add spacing above a visitor who already passed it', () => {
 const motion = source('components/junction-motion.tsx');
 assert.match(motion, /spaces && rail && spaces\.getBoundingClientRect\(\)\.bottom > 0/);
 assert.match(motion, /tl\.scrollTrigger\?\.isActive && e\.cancelable/);
 assert.match(motion, /e\.preventDefault\(\)/);
 assert.match(motion, /deltaMode === 1/);
 assert.match(motion, /document\.fonts\.ready\.then\(refresh\)/);
});
