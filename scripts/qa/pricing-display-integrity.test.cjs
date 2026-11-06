'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const approved = require('../../data/approved-pricing.json');
let fetchImpl;
function load(file, dependencies) {
  const module = {exports: {}};
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  vm.runInNewContext(output, {module, exports: module.exports, require: name => name in dependencies ? dependencies[name] : {}, process, AbortSignal, fetch: (...args) => fetchImpl(...args)}, {filename: file});
  return module.exports;
}
const pricing = load('lib/community-pricing.ts', {'@/data/approved-pricing.json': approved});
const services = load('components/service-pricing-section.tsx', {'@/lib/community-pricing': pricing});

test('approved community catalog preserves prices and only approved feature inheritance', () => {
  const plans = pricing.communityPlansFromCatalog(approved);
  assert.equal(plans.length, 3);
  assert.equal(plans[0].monthlyPrice, 29);
  assert.equal(plans[0].annualPrice, 299);
  assert.equal(plans[1].features[0], 'Everything in Community Membership');
  assert.equal(plans[2].features[0], 'Everything in Professional Membership');
  assert.equal(plans[1].features.length, 5);
  assert.equal(plans[2].features.length, 5);
  assert.equal(plans[2].annualFeatures.length, 5);
  assert.equal(plans[1].name, 'Professional Membership');
});
test('empty and unpublished catalogs do not resurrect memberships', () => {
  assert.equal(pricing.communityPlansFromCatalog([]).length, 0);
  assert.equal(pricing.communityPlansFromCatalog(approved.map(p => ({...p, status: 'DRAFT'}))).length, 0);
  assert.equal(pricing.communityPlansFromCatalog(approved.map(p => ({...p, metadata: {...p.metadata, enabled: false}}))).length, 0);
});
test('missing annual interval remains unavailable rather than using a fixed price', () => {
  const plans = pricing.communityPlansFromCatalog(approved.filter(p => p.metadata?.billingPeriod !== 'year'));
  assert.equal(plans[0].annualPrice, null);
});
test('amount fallback and absent price never become invented zero-dollar offers', () => {
  assert.equal(pricing.pricingAmount({metadata: {amount: 17}}), 17);
  assert.equal(pricing.pricingAmount({metadata: {price: 0}}), 0);
  assert.equal(pricing.pricingAmount({metadata: {}}), null);
  const plans = services.servicePlansFromCatalog([
    {title: 'Original offer', metadata: {service: 'test', billingPeriod: 'hour', amount: 17}},
    {title: 'Quote', metadata: {service: 'test'}},
    {title: 'Draft', status: 'DRAFT', metadata: {service: 'test', price: 4}}
  ], 'test');
  assert.equal(plans.length, 2);
  assert.equal(plans[0].price, '$17');
  assert.equal(plans[0].title, 'Original offer');
  assert.equal(plans[0].period, '/hour');
  assert.equal(plans[1].price, 'Request a quote');
});
test('transport distinguishes authoritative empty, offline, malformed, and paginated responses', async () => {
  fetchImpl = async () => ({ok: true, json: async () => ({items: [], total: 0})});
  assert.equal((await pricing.loadPublishedPricing('/configured')).length, 0);
  fetchImpl = async () => {throw Error('offline');};
  assert.equal(await pricing.loadPublishedPricing('/configured'), null);
  fetchImpl = async () => ({ok: true, json: async () => ({unexpected: []})});
  assert.equal(await pricing.loadPublishedPricing('/configured'), null);
  const urls = [];
  fetchImpl = async url => {
    urls.push(url);
    return {ok: true, json: async () => ({items: [{slug: String(urls.length)}], total: 2})};
  };
  assert.equal((await pricing.loadPublishedPricing('https://configured.example/api')).length, 2);
  assert.equal(urls[1], 'https://configured.example/api/public/pricing?limit=100&page=2');
});
