'use strict';
/* Parent-owned positive regression tests for the three QA-confirmed defects:
 * uncertain write replay, source-unbound resume/interrupted streaks, and the
 * contextual booking workspace mapping bug. Pure: no env, HTTP, DB or browser.
 * Run: node scripts/qa/api-scenarios-safety.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const source = read('scripts/qa/api-scenarios.cjs');

test('fix: a write method never retries a transient failure after the server may have accepted it', async () => {
  const start = source.indexOf('  async function req('), end = source.indexOf('\n  try {\n    // Health', start);
  assert.ok(start >= 0 && end > start, 'req extraction boundaries changed; review harness');
  let calls = 0; const report = { owned: [] }; const active = { retriesNetwork: 0 };
  const sandbox = {
    base: 'http://localhost:4000/api', report, active, FormData, AbortSignal, Headers,
    localURL: s => new URL(s), save: async () => {}, backoff: async () => { throw new Error('backoff must not be called for a non-retryable write'); }, owned: () => {},
    transientNetwork: e => e.cause?.code === 'ECONNRESET', safeErrorCode: () => 'ECONNRESET', RESOURCES: [],
    retryableOnTransient: m => ['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(m),
    raw: async () => { calls++; const e = new TypeError('terminated'); e.cause = { code: 'ECONNRESET' }; throw e; },
  };
  vm.createContext(sandbox); vm.runInContext(source.slice(start, end) + '\nthis.request=req;', sandbox);
  await assert.rejects(() => sandbox.request('/bookings', 'POST', { customerName: 'qa-pure' }));
  assert.equal(calls, 1, 'A write must fail its iteration on the first transient error, not replay');
  assert.equal(active.retriesNetwork, 1, 'The transient failure is still recorded as a diagnostic');
});

test('fix: a transient failure on a read is still retried, since GET cannot duplicate state', async () => {
  const start = source.indexOf('  async function req('), end = source.indexOf('\n  try {\n    // Health', start);
  let calls = 0; const report = { owned: [] }; const active = { retriesNetwork: 0 };
  const sandbox = {
    base: 'http://localhost:4000/api', report, active, FormData, AbortSignal, Headers,
    localURL: s => new URL(s), save: async () => {}, backoff: async () => {}, owned: () => {},
    transientNetwork: e => e.cause?.code === 'ECONNRESET', safeErrorCode: () => 'ECONNRESET', RESOURCES: [],
    retryableOnTransient: m => ['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(m),
    raw: async () => { calls++; if (calls === 1) { const e = new TypeError('terminated'); e.cause = { code: 'ECONNRESET' }; throw e; } return { status: 200, headers: new Headers(), json: async () => ({ status: 'ok' }) }; },
  };
  vm.createContext(sandbox); vm.runInContext(source.slice(start, end) + '\nthis.request=req;', sandbox);
  const result = await sandbox.request('/health', 'GET');
  assert.equal(result.status, 200); assert.equal(calls, 2);
});

test('fix: resume binds to backend source and resets an unconfirmed interrupted iteration', () => {
  assert.match(source, /async function sourceFingerprint\(root\)/);
  assert.match(source, /for \(const dir of \['backend\/src','backend\/prisma'\]\)/);
  assert.match(source, /report\.sourceVersion!==sourceVersion/);
  assert.match(source, /if\(report\.current\)\{const row=report\.scenarios\[report\.current\.scenario\];if\(row\)\{advance\(row,false,0\)/);
});

test('fix: contextual catalog mapping prefers exact and longer phrases over shared words', () => {
  require('./ts-register.cjs');
  const {findCatalogServiceHint} = require('../../lib/catalog-service-hint.ts');
  const services = [
    {slug: 'office', name: 'Office'},
    {slug: 'desk', name: 'Desk'},
    {slug: 'dedicated-desk', name: 'Dedicated Desk'},
    {slug: 'virtual-office', name: 'Virtual Office'},
    {slug: 'meeting-room', name: 'Meeting Room'},
    {slug: 'conference-room', name: 'Conference Room'},
  ];
  for (const [hint, slug] of [['Dedicated Desk', 'dedicated-desk'], ['Virtual Office', 'virtual-office'], ['Conference Room', 'conference-room'], ['Please reserve a Virtual Office for my team', 'virtual-office'], ['VIRTUAL-OFFICE', 'virtual-office']]) {
    assert.equal(findCatalogServiceHint(services, hint)?.slug, slug, hint);
  }
  assert.match(read('components/booking-dialog.tsx'), /findCatalogServiceHint\(items, service\)/);
});

test('catalog mapping never guesses an unrelated or ambiguous service', () => {
  require('./ts-register.cjs');
  const {findCatalogServiceHint} = require('../../lib/catalog-service-hint.ts');
  const services = [{slug: 'meeting-room', name: 'Meeting Room'}, {slug: 'conference-room', name: 'Conference Room'}];
  for (const hint of [undefined, '', 'room', 'I need a quiet room to work', 'Unsupported offer', 'Meeting Room or Conference Room']) {
    assert.equal(findCatalogServiceHint(services, hint), undefined, String(hint));
  }
  assert.equal(findCatalogServiceHint(services, 'Meeting')?.slug, 'meeting-room');
  const custom = [{slug: 'new-service', name: 'A New Service'}];
  assert.equal(findCatalogServiceHint(custom, 'A New Service')?.slug, 'new-service', 'new administrator-defined catalog entries work without a hardcoded service map');
});
