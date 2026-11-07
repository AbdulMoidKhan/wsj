'use strict';
// Read-only local profiling. Never prints SQL, parameters, credentials or content.
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const out = process.argv[2];
if (!out || !path.isAbsolute(out) || fs.existsSync(out)) throw Error('Provide a fresh absolute JSON output path');
require('./ts-register.cjs');
require(path.join(root, 'backend/node_modules/dotenv')).config({path: path.join(root, 'backend/.env'), quiet: true});
if (!['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error('Local database only');
const {Db} = require(path.join(root, 'backend/src/core.ts'));
const {PublicController, clearPublicCache} = require(path.join(root, 'backend/src/public.ts'));
const {CatalogService, clearCatalogCache} = require(path.join(root, 'backend/src/catalog.ts'));
const db = new Db({log: [{emit: 'event', level: 'query'}]});
let queries = [];
db.$on('query', event => queries.push(event.duration));
const stats = values => {
 const sorted = [...values].sort((a, b) => a - b);
 const middle = Math.floor(sorted.length / 2);
 return {median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, p95: sorted[Math.ceil(sorted.length * .95) - 1]};
};
(async () => {
 try {
  await db.$connect();
  const controller = new PublicController(db), rows = [];
  for (const resource of ['pages', 'blog', 'settings', 'pricing']) {
   const cold = [], warm = [], queryCounts = [], queryMs = [];
   let bytes = 0, total = 0;
   for (let i = 0; i < 10; i++) {
    clearPublicCache(); queries = [];
    const start = performance.now();
    const value = await controller.list(resource, {limit: 1, page: 1});
    cold.push(performance.now() - start);
    queryCounts.push(queries.length);
    queryMs.push(queries.reduce((sum, duration) => sum + duration, 0));
    bytes = Buffer.byteLength(JSON.stringify(value)); total = value.total;
   }
   for (let i = 0; i < 30; i++) {
    const start = performance.now();
    await controller.list(resource, {limit: 1, page: 1});
    warm.push(performance.now() - start);
   }
   rows.push({resource, total, bytes, coldMs: stats(cold), warmMs: stats(warm), queryCounts, dbQueryMs: stats(queryMs)});
   console.log(JSON.stringify(rows.at(-1)));
  }
  const catalog = new CatalogService(db, {});
  for (const [name, read] of [['catalog/services', () => catalog.publicServices()], ['catalog/services/coworking', () => catalog.publicService('coworking')]]) {
   const cold = [], warm = [], queryCounts = [], queryMs = [];
   let bytes = 0;
   for (let i = 0; i < 10; i++) {
    clearCatalogCache(); queries = [];
    const start = performance.now(), value = await read();
    cold.push(performance.now() - start); queryCounts.push(queries.length);
    queryMs.push(queries.reduce((sum, duration) => sum + duration, 0));
    bytes = Buffer.byteLength(JSON.stringify(value));
   }
   for (let i = 0; i < 30; i++) {const start = performance.now(); await read(); warm.push(performance.now() - start);}
   rows.push({resource: name, bytes, coldMs: stats(cold), warmMs: stats(warm), queryCounts, dbQueryMs: stats(queryMs)});
   console.log(JSON.stringify(rows.at(-1)));
  }
  // Compare the optimized summary with the unchanged full-row projection against
  // the same local dataset. Never save or print either response body.
  const assert = require('node:assert/strict');
  const fullServices = await catalog.activeServices();
  let catalogSummaryEquivalent = null;
  if (fullServices.length) {
   const summary = await catalog.publicServices();
   assert.deepEqual(summary.items, fullServices.map(service => catalog.serviceSummary(service)));
   catalogSummaryEquivalent = true;
  }
  console.log(JSON.stringify({catalogSummaryEquivalent}));
  fs.writeFileSync(out, JSON.stringify({conditions: 'Read-only direct PublicController calls, local PostgreSQL; 10 cleared-cache and 30 warm-cache samples per resource. NOT HTTP latency.', catalogSummaryEquivalent, rows}, null, 2), {flag: 'wx'});
 } finally { await db.$disconnect(); }
})().catch(error => {console.error('Profile failed: ' + (error.code || error.name)); process.exitCode = 1;});
