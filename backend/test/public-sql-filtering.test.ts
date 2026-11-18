/*
 * F-003: public content eligibility, totals and pagination run in SQL on the Content scheduling
 * columns. These tests drive the real PublicController / ContentController with an in-memory
 * evaluator of the Prisma filters they build (content-memory-db.ts), and prove parity with the
 * pre-F-003 JavaScript path (contentEligible + sort + slice) that production runs today.
 */
import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NotFoundException} from '@nestjs/common';
import {PublicController, clearPublicCache} from '../src/public';
import {ContentController} from '../src/admin';
import {contentEligible, scheduleColumns, eligibilityWhere, SCHEDULE_NEVER, SCHEDULE_ALREADY_OVER} from '../src/content-safety';
import {memoryContent, withScheduleColumns, matches} from './content-memory-db';

const epoch = Date.parse('2026-11-09T12:00:00Z');
const iso = (offset: number) => new Date(epoch + offset).toISOString();
let seq = 0;
function item(slug: string, metadata: unknown = {}, extra: Record<string, unknown> = {}) {
  seq++;
  return {id: `id-${String(seq).padStart(4, '0')}`, slug, title: slug.toUpperCase(), kind: 'blog', status: 'PUBLISHED',
    excerpt: null, content: {html: `<p>${slug}</p>`}, metadata, sortOrder: 0,
    createdAt: new Date(epoch - seq * 1000), updatedAt: new Date(epoch), ...extra};
}
async function at<T>(now: number, run: () => Promise<T>): Promise<T> {
  const original = Date.now; Date.now = () => now; clearPublicCache();
  try { return await run(); } finally { Date.now = original; clearPublicCache(); }
}
function controller(rows: any[]) {
  const content = memoryContent(rows);
  return new PublicController({content} as never);
}
/** Pre-F-003 behaviour (production 396ad2a): load every published row, filter in JS, slice. */
function legacyList(rows: any[], resource: string, now: number, page = 1, limit = 25) {
  const original = Date.now; Date.now = () => now;
  try {
    const kind = resource;
    const candidates = rows.filter(r => r.kind === kind && r.status === 'PUBLISHED')
      .sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime());
    const eligible = candidates.filter(r => contentEligible(resource, r));
    const skip = (page - 1) * limit;
    return {slugs: eligible.slice(skip, skip + limit).map(r => r.slug), total: eligible.length};
  } finally { Date.now = original; }
}

test('historical content without scheduling metadata stays visible, response contract unchanged', async () => {
  const rows = [item('old-a'), item('old-b', {featured: true}), item('draft', {}, {status: 'DRAFT'})];
  const res = await at(epoch, () => controller(rows).list('blog', {}));
  assert.equal(res.total, 2);
  assert.deepEqual(res.items.map((i: any) => i.slug), ['old-a', 'old-b']);
  for (const key of ['publishAt', 'startsAt', 'endsAt', 'enabled', 'requiresReview']) assert.ok(!(key in res.items[0]), `${key} must not leak into public responses`);
  assert.deepEqual(Object.keys(res.items[0]).sort(), Object.keys(rows[0]).sort());
});

test('future publication dates are hidden until the boundary, then counted and returned', async () => {
  const rows = [item('live', {publishAt: iso(-60_000)}), item('future', {publishAt: iso(60_000)}), item('offset', {publishAt: '2026-11-09T16:59:00+05:00'})];
  const before = await at(epoch, () => controller(rows).list('blog', {}));
  assert.deepEqual(before.items.map((i: any) => i.slug), ['live', 'offset']);
  assert.equal(before.total, 2);
  const after = await at(epoch + 60_000, () => controller(rows).list('blog', {}));
  assert.deepEqual(after.items.map((i: any) => i.slug), ['live', 'future', 'offset']);
  await at(epoch, () => assert.rejects(controller(rows).detail('blog', 'future'), NotFoundException));
  assert.equal((await at(epoch + 60_000, () => controller(rows).detail('blog', 'future'))).slug, 'future');
});

test('disabled content is excluded; only a JSON boolean false disables (same as the app)', async () => {
  const rows = [item('on'), item('off', {enabled: false}), item('string-false', {enabled: 'false'}), item('explicit-on', {enabled: true})];
  const res = await at(epoch, () => controller(rows).list('blog', {}));
  assert.deepEqual(res.items.map((i: any) => i.slug), ['on', 'string-false', 'explicit-on']);
  await at(epoch, () => assert.rejects(controller(rows).detail('blog', 'off'), NotFoundException));
});

test('popup eligibility honours startsAt/endsAt windows; other kinds ignore windows', async () => {
  const popups = [
    item('active', {startsAt: iso(-1000), endsAt: iso(1000)}, {kind: 'popups'}),
    item('expired', {startsAt: iso(-5000), endsAt: iso(-1000)}, {kind: 'popups'}),
    item('upcoming', {startsAt: iso(1000)}, {kind: 'popups'}),
    item('blog-window', {startsAt: iso(1000), endsAt: iso(-1000)}),
  ];
  assert.deepEqual((await at(epoch, () => controller(popups).list('popups', {}))).items.map((i: any) => i.slug), ['active']);
  assert.deepEqual((await at(epoch + 1000, () => controller(popups).list('popups', {}))).items.map((i: any) => i.slug), ['upcoming']);
  assert.deepEqual((await at(epoch, () => controller(popups).list('blog', {}))).items.map((i: any) => i.slug), ['blog-window']);
});

test('present but unparseable schedules stay hidden exactly like contentEligible()', async () => {
  const rows = [item('garbage', {publishAt: 'tomorrow'}), item('number', {publishAt: 1730000000000}), item('feb30', {publishAt: '2026-02-30T00:00:00Z'}),
    item('empty', {publishAt: ''}), item('null', {publishAt: null}), item('zero', {publishAt: 0})];
  const sql = (await at(epoch, () => controller(rows).list('blog', {}))).items.map((i: any) => i.slug);
  assert.deepEqual(sql, legacyList(rows, 'blog', epoch).slugs);
  assert.deepEqual(scheduleColumns({publishAt: 'tomorrow', startsAt: 'x', endsAt: 'y'}), {publishAt: SCHEDULE_NEVER, startsAt: SCHEDULE_NEVER, endsAt: SCHEDULE_ALREADY_OVER, enabled: true, requiresReview: false});
  assert.deepEqual(scheduleColumns(null), {publishAt: null, startsAt: null, endsAt: null, enabled: true, requiresReview: false});
  assert.deepEqual(scheduleColumns(['x']), {publishAt: null, startsAt: null, endsAt: null, enabled: true, requiresReview: false});
});

test('pricing requiring review is hidden only for the pricing resource', async () => {
  const rows = [item('ok', {}, {kind: 'pricing'}), item('review', {requiresReview: true}, {kind: 'pricing'}), item('review-string', {requiresReview: 'true'}, {kind: 'pricing'})];
  assert.deepEqual((await at(epoch, () => controller(rows).list('pricing', {}))).items.map((i: any) => i.slug), ['ok', 'review-string']);
});

test('sort order (sortOrder asc, createdAt desc) and pagination totals are computed in SQL', async () => {
  const rows = Array.from({length: 23}, (_, i) => item(`p${String(i).padStart(2, '0')}`, i % 5 === 4 ? {enabled: false} : {}, {sortOrder: i % 3}));
  const ctl = controller(rows);
  const pages = [];
  for (let page = 1; page <= 4; page++) pages.push(await at(epoch, () => ctl.list('blog', {page, limit: 6})));
  const expected = legacyList(rows, 'blog', epoch, 1, 100);
  assert.equal(expected.total, 19);
  for (const p of pages) assert.equal(p.total, 19);
  assert.deepEqual(pages.flatMap(p => p.items.map((i: any) => i.slug)), expected.slugs);
  assert.deepEqual(pages.map(p => p.items.length), [6, 6, 6, 1]);
  assert.deepEqual((await at(epoch, () => ctl.list('blog', {page: 9, limit: 6}))).items, []);
});

test('randomised parity: SQL path == production JS path for every page, kind and instant', async () => {
  let s = 42; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const values = [undefined, null, '', 0, true, 'tomorrow', '2026-02-30T00:00:00Z', iso(-90_000), iso(-1), iso(0), iso(1), iso(90_000), '2026-11-09T17:00:00+05:00'];
  const rows: any[] = [];
  for (let i = 0; i < 400; i++) {
    const m: any = {};
    for (const k of ['publishAt', 'startsAt', 'endsAt']) { const v = pick(values); if (v !== undefined) m[k] = v; }
    const e = pick([undefined, true, false, 'false']); if (e !== undefined) m.enabled = e;
    const r = pick([undefined, true, false, 'true']); if (r !== undefined) m.requiresReview = r;
    rows.push(item(`r${i}`, pick([m, m, m, m, null, [], 'scalar']), {kind: pick(['blog', 'popups', 'pricing']), status: pick(['PUBLISHED', 'PUBLISHED', 'DRAFT']), sortOrder: Math.floor(rnd() * 4)}));
  }
  let checks = 0;
  for (const now of [epoch - 100_000, epoch - 1, epoch, epoch + 1, epoch + 100_000]) {
    for (const resource of ['blog', 'popups', 'pricing']) {
      for (const limit of [7, 25]) {
        const legacy = legacyList(rows, resource, now, 1, 1000);
        for (let page = 1; page <= Math.ceil(legacy.total / limit) + 1; page++) {
          const got = await at(now, () => controller(rows).list(resource, {page, limit}));
          const want = legacyList(rows, resource, now, page, limit);
          assert.equal(got.total, want.total, `${resource} @${now - epoch} total`);
          assert.deepEqual(got.items.map((i: any) => i.slug), want.slugs, `${resource} @${now - epoch} page ${page}`);
          checks++;
        }
      }
      for (const r of rows.filter(x => x.kind === resource && x.status === 'PUBLISHED')) {
        assert.equal(matches(eligibilityWhere(resource, new Date(now)), withScheduleColumns(r)), (() => { const o = Date.now; Date.now = () => now; try { return contentEligible(resource, r); } finally { Date.now = o; } })(), `${r.slug} ${JSON.stringify(r.metadata)}`);
      }
    }
  }
  assert.ok(checks > 100);
});

test('admin create/update write the scheduling columns derived from metadata', async () => {
  const writes: any[] = [];
  const db: any = {
    content: {
      create: async (args: any) => { writes.push(['create', args.data]); return {id: 'n1', ...args.data}; },
      update: async (args: any) => { writes.push(['update', args.data]); return {id: args.where.id, ...args.data}; },
      findFirst: async () => ({id: 'n1', kind: 'popups', slug: 's', metadata: {}}),
    },
    audit: {create: async () => ({})},
  };
  const admin = new ContentController(db);
  const req = {user: {id: 'u1', role: 'ADMIN'}};
  await admin.create('popups', {title: 'P', slug: 'p', metadata: {publishAt: iso(5000), startsAt: iso(6000), endsAt: iso(7000), enabled: false}} as any, req);
  await admin.update('popups', 'n1', {metadata: {requiresReview: true}} as any, req);
  await admin.update('popups', 'n1', {title: 'no metadata change'} as any, req);
  assert.deepEqual(writes[0][1].publishAt, new Date(iso(5000)));
  assert.deepEqual(writes[0][1].endsAt, new Date(iso(7000)));
  assert.equal(writes[0][1].enabled, false);
  assert.equal(writes[1][1].requiresReview, true);
  assert.equal(writes[1][1].publishAt, null);
  assert.ok(!('publishAt' in writes[2][1]), 'updates without metadata must not touch the scheduling columns');
});
