#!/usr/bin/env node
/*
 * Read-only reconciliation for migration 20261109000000_performance_audit_indexes.
 * Issues SELECT statements only.
 *
 * Compares what the database columns say with what the running application
 * actually decides (backend/dist/content-safety.js contentEligible, which still
 * reads Content.metadata), and checks Booking cents against the float amounts.
 *
 * Usage:
 *   RECON_DATABASE_URL=postgresql://... APP_DIR=/path/to/checkout node scripts/devops/migration-reconcile.cjs
 * APP_DIR must contain a built backend (backend/dist) and backend/node_modules.
 * Prints one JSON document. Exit 0 always for "pre" runs; exit 1 if any post-migration
 * invariant fails (STRICT=1).
 */
'use strict';
const path = require('path');
const url = process.env.RECON_DATABASE_URL;
const appDir = process.env.APP_DIR;
if (!url || !appDir) { console.error('RECON_DATABASE_URL and APP_DIR are required'); process.exit(2); }
const { PrismaClient } = require(path.join(appDir, 'backend/node_modules/@prisma/client'));
const { contentEligible } = require(path.join(appDir, 'backend/dist/content-safety.js'));
const db = new PrismaClient({ datasources: { db: { url } } });

// Expected column value, same rules as the content_schedule_sync trigger (sentinels hide unparseable values).
const iso = (v, unparseable) => (!v ? null : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : unparseable));
const NEVER = '9999-12-31T23:59:59.999Z', OVER = '1970-01-01T00:00:00.000Z';
const meta = (m) => (m && typeof m === 'object' && !Array.isArray(m) ? m : {});

(async () => {
  const out = { database: url.replace(/\/\/[^@]+@/, '//***@'), observedAt: new Date().toISOString(), failures: [] };
  const now = Date.now();
  const cols = await db.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_schema='public' and table_name in ('Content','Booking') and column_name in ('publishAt','startsAt','endsAt','enabled','requiresReview','subtotalPriceCents','totalPriceCents')`);
  const has = new Set(cols.map((c) => c.column_name));
  out.migrated = has.has('publishAt') && has.has('totalPriceCents');

  const sel = out.migrated
    ? `select id, kind, status::text as status, metadata,
         to_char("publishAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as p,
         to_char("startsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as s,
         to_char("endsAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as e,
         enabled, "requiresReview" as rr from "Content" order by id`
    : `select id, kind, status::text as status, metadata from "Content" order by id`;
  const rows = await db.$queryRawUnsafe(sel);
  out.contentRows = rows.length;
  out.metadataMd5 = (await db.$queryRawUnsafe(`select md5(string_agg(id || ':' || metadata::text, '|' order by id)) as m from "Content"`))[0].m;

  // Application-truth eligibility (what the API serves), per kind.
  const elig = {};
  for (const r of rows) {
    if (r.status !== 'PUBLISHED') continue;
    const k = (elig[r.kind] ||= { published: 0, eligible: 0 });
    k.published++;
    if (contentEligible(r.kind, r)) k.eligible++;
  }
  out.appEligibility = elig;
  out.appEligibleTotal = Object.values(elig).reduce((a, b) => a + b.eligible, 0);

  if (out.migrated) {
    const utcMismatches = [], sqlVsApp = [];
    for (const r of rows) {
      const m = meta(r.metadata);
      for (const [field, col] of [['publishAt', 'p'], ['startsAt', 's'], ['endsAt', 'e']]) {
        const expected = iso(m[field], field === 'endsAt' ? OVER : NEVER);
        if (expected !== r[col]) utcMismatches.push({ id: r.id, field, metadata: m[field] ?? null, column: r[col], jsParsedUtc: expected });
      }
      if (r.status !== 'PUBLISHED') continue;
      const t = (v) => (v ? Date.parse(v) : null);
      const sqlEligible = r.enabled && !(r.kind === 'pricing' && r.rr) && (t(r.p) === null || t(r.p) <= now) &&
        (r.kind !== 'popups' || ((t(r.s) === null || t(r.s) <= now) && (t(r.e) === null || t(r.e) > now)));
      const appEligible = contentEligible(r.kind, r);
      if (sqlEligible !== appEligible) sqlVsApp.push({ id: r.id, kind: r.kind, metadata: r.metadata, sqlEligible, appEligible });
    }
    out.utcColumnVsMetadataMismatches = utcMismatches;
    out.sqlColumnEligibilityVsAppMismatches = sqlVsApp;
    out.contentColumnSummary = (await db.$queryRawUnsafe(`select count(*)::int total, count("publishAt")::int with_publish_at, count("startsAt")::int with_starts_at, count("endsAt")::int with_ends_at, count(*) filter (where not enabled)::int disabled, count(*) filter (where "requiresReview")::int requires_review from "Content"`))[0];
    if (utcMismatches.length) out.failures.push(`${utcMismatches.length} Content timestamp columns differ from JS-parsed metadata`);
    if (sqlVsApp.length) out.failures.push(`${sqlVsApp.length} rows where column-based eligibility differs from application eligibility`);
  }

  // Bookings: float -> cents.
  const bsel = out.migrated
    ? `select id, status::text as status, "subtotalPrice" as sp, "totalPrice" as tp, "subtotalPriceCents" as spc, "totalPriceCents" as tpc from "Booking" order by id`
    : `select id, status::text as status, "subtotalPrice" as sp, "totalPrice" as tp from "Booking" order by id`;
  const bookings = await db.$queryRawUnsafe(bsel);
  const sum = (k) => bookings.reduce((a, b) => a + (Number.isFinite(b[k]) ? b[k] : 0), 0);
  out.bookings = { count: bookings.length, sumTotalFloat: Number(sum('tp').toFixed(6)), sumSubtotalFloat: Number(sum('sp').toFixed(6)),
    byStatus: (await db.$queryRawUnsafe(`select status::text, count(*)::int n, round(sum("totalPrice")::numeric, 2)::text total from "Booking" group by 1 order by 1`)) };
  if (out.migrated) {
    const centsIssues = [];
    for (const b of bookings) {
      for (const [f, c] of [['sp', 'spc'], ['tp', 'tpc']]) {
        const jsRound = Number.isFinite(b[f]) ? Math.round(b[f] * 100) : null;
        const exact = Number.isFinite(b[f]) && Math.abs(b[f] * 100 - Math.round(b[f] * 100)) < 1e-6;
        if (b[c] === null || b[c] !== jsRound || !exact) centsIssues.push({ id: b.id, field: f === 'sp' ? 'subtotal' : 'total', float: b[f], cents: b[c], jsMathRound: jsRound, wholeCentValue: exact });
      }
    }
    out.bookings.sumTotalCents = bookings.reduce((a, b) => a + (b.tpc ?? 0), 0);
    out.bookings.sumSubtotalCents = bookings.reduce((a, b) => a + (b.spc ?? 0), 0);
    out.bookings.centsIssues = centsIssues;
    if (out.bookings.sumTotalCents !== Math.round(out.bookings.sumTotalFloat * 100)) out.failures.push('sum(totalPriceCents) != round(sum(totalPrice)*100)');
    if (centsIssues.length) out.failures.push(`${centsIssues.length} booking amounts need manual cents review`);
  }
  console.log(JSON.stringify(out, null, 1));
  await db.$disconnect();
  process.exit(process.env.STRICT === '1' && out.failures.length ? 1 : 0);
})().catch(async (e) => { console.error('reconcile error:', e.message); await db.$disconnect().catch(() => {}); process.exit(1); });
