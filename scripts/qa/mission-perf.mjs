// Mission performance sampler: Lighthouse lab runs (mobile + desktop) over representative
// public routes against a LOCAL production server. Read-only; writes JSON evidence only.
// Usage: QA_BASE_URL=http://localhost:3001 QA_OUT=<abs file.json> [QA_ROUTES=/,/coworking/] node scripts/qa/mission-perf.mjs
import fs from 'node:fs/promises';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import {launch} from 'chrome-launcher';
import {chromium} from '@playwright/test';

const base = process.env.QA_BASE_URL || 'http://localhost:3001';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw Error('Local QA only');
const out = process.env.QA_OUT;
if (!out) throw Error('Set QA_OUT');
const routes = (process.env.QA_ROUTES || '/,/about-us/,/coworking/,/podcast-studio/,/virtual-office/,/meeting-rooms/,/contact-us/,/blogs/').split(',');
const forms = (process.env.QA_FORMS || 'mobile,desktop').split(',');

const bytesBy = (lhr, type) => (lhr.audits['resource-summary']?.details?.items || []).find(i => i.resourceType === type) || {transferSize: 0, requestCount: 0};
const chrome = await launch({chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage']});
const rows = [];
try {
  for (const form of forms) {
    for (const route of routes) {
      // Warm the route once so ISR/first-render cost does not pollute the sample.
      await fetch(base + route).then(r => r.arrayBuffer()).catch(() => {});
      const result = await lighthouse(base + route, {port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']}, form === 'desktop' ? desktopConfig : undefined);
      const l = result.lhr;
      const a = id => l.audits[id]?.numericValue ?? null;
      const row = {
        form, route,
        scores: Object.fromEntries(Object.entries(l.categories).map(([k, v]) => [k, v.score === null ? null : Math.round(v.score * 100)])),
        fcpMs: a('first-contentful-paint'), lcpMs: a('largest-contentful-paint'), cls: a('cumulative-layout-shift'),
        tbtMs: a('total-blocking-time'), siMs: a('speed-index'), ttfbMs: a('server-response-time'),
        mainThreadMs: a('mainthread-work-breakdown'), bootupMs: a('bootup-time'),
        longTasks: (l.audits['long-tasks']?.details?.items || []).length,
        totalKB: Math.round(bytesBy(l, 'total').transferSize / 1024), requests: bytesBy(l, 'total').requestCount,
        scriptKB: Math.round(bytesBy(l, 'script').transferSize / 1024), cssKB: Math.round(bytesBy(l, 'stylesheet').transferSize / 1024),
        imageKB: Math.round(bytesBy(l, 'image').transferSize / 1024), fontKB: Math.round(bytesBy(l, 'font').transferSize / 1024),
        consoleErrors: (l.audits['errors-in-console']?.details?.items || []).map(i => String(i.description || '').slice(0, 160)),
        lcpElement: String(JSON.stringify(l.audits['lcp-breakdown-insight']?.details?.items?.find(i => i.type === 'node') || l.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node || '').match(/"snippet":"((?:[^"\\]|\\.)*)"/)?.[1] || '').slice(0, 160),
        // LCP phases (TTFB / load delay / load duration / render delay), in ms.
        lcpBreakdown: Object.fromEntries((l.audits['lcp-breakdown-insight']?.details?.items?.find(i => i.type === 'table')?.items || []).map(i => [i.subpart, Math.round(i.duration)])),
        renderBlocking: (l.audits['render-blocking-insight']?.details?.items || []).map(i => ({url: String(i.url || '').replace(base, '').slice(-60), kb: Math.round((i.totalBytes || 0) / 1024), ms: Math.round(i.wastedMs || 0)})),
        failing: Object.values(l.audits).filter(x => x.score !== null && x.score < 0.9 && ['binary', 'numeric', 'metricSavings'].includes(x.scoreDisplayMode)).map(x => x.id),
        runtimeError: l.runtimeError?.code || null,
      };
      rows.push(row);
      console.log(JSON.stringify({form, route, ...row.scores, lcp: Math.round(row.lcpMs), tbt: Math.round(row.tbtMs), cls: +row.cls.toFixed(3), js: row.scriptKB}));
    }
  }
} finally {
  await chrome.kill();
}
const {version} = JSON.parse(await fs.readFile(new URL('../../node_modules/lighthouse/package.json', import.meta.url), 'utf8'));
await fs.writeFile(out, JSON.stringify({time: new Date().toISOString(), base, tool: 'lighthouse ' + version + ' (lab, simulated throttling)', rows}, null, 2));
