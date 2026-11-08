'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./ts-register.cjs');
const THREE = require('three');
const {mergeGeometries} = require('three/examples/jsm/utils/BufferGeometryUtils.js');
const {createOfficeKit} = require('../../components/office-models.ts');
const root = path.resolve(__dirname, '../..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');

test('identical decorative objects share buffers but never mutable transforms', () => {
 const palette = {metal: new THREE.MeshStandardMaterial(), pearl: new THREE.MeshStandardMaterial(), forest: new THREE.MeshStandardMaterial()};
 let merges = 0;
 const kit = createOfficeKit(THREE, parts => {merges++; return mergeGeometries(parts, false);}, palette);
 const geometries = new Set();
 try {
  for (const make of Object.values(kit)) {
   const first = make(), firstMergeCount = merges, second = make();
   assert.notEqual(first, second);
   assert.equal(merges, firstMergeCount, 'second instance must not rebuild the model');
   assert.ok(first.children.length > 0);
   first.children.forEach((mesh, index) => {
    const other = second.children[index];
    assert.notEqual(mesh, other);
    assert.equal(mesh.geometry, other.geometry);
    assert.equal(mesh.material, other.material);
    geometries.add(mesh.geometry);
   });
   first.position.x = 3;
   first.rotation.y = 1;
   first.scale.setScalar(2);
   assert.equal(second.position.x, 0);
   assert.equal(second.rotation.y, 0);
   assert.equal(second.scale.x, 1);
   const bounds = new THREE.Box3().setFromObject(second);
   assert.ok(!bounds.isEmpty());
   assert.ok(Number.isFinite(bounds.max.x));
  }
 } finally {
  geometries.forEach(geometry => geometry.dispose());
  Object.values(palette).forEach(material => material.dispose());
 }
});

test('scene teardown cancels pending startup and disposes shared buffers once', () => {
 const scene = source('components/scene-backdrop.tsx');
 assert.match(scene, /if \(!disposed\) start\(\)/);
 assert.match(scene, /cancelIdleCallback\?\.\(idle\)/);
 assert.match(scene, /clearTimeout\(timer\)/);
 assert.match(scene, /geometries\.forEach\(geometry => geometry\.dispose\(\)\)/);
});

test('current carousel uses prebuilt responsive LCP image and low-priority secondary slides', () => {
 const carousel = source('components/home-live.tsx'), hero = source('components/home-hero-image.tsx');
 assert.match(carousel, /<HomeHeroImage alt=\{s\.alt\} sizes="100vw" className="lv-slide-img"/);
 assert.match(carousel, /fetchPriority="low"/);
 assert.match(hero, /imageSrcSet=\{srcSet\('webp'\)\}/);
 assert.match(hero, /imageSizes=\{sizes\}/);
 assert.match(hero, /loading="eager" fetchPriority="high"/);
 assert.match(hero, /className=\{className\}/);
 for (const width of [384, 640, 828, 867]) for (const format of ['webp', 'avif']) {
  assert.ok(fs.statSync(path.join(root, `public/media/optimized/home-hero-${width}.${format}`)).size > 0);
 }
 assert.doesNotMatch(source('app/page.tsx'), /height=\{74\} priority className="lv-podcast-logo"/);
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
