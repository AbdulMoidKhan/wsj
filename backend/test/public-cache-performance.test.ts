import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NotFoundException} from '@nestjs/common';
import {PublicController, clearPublicCache, getCachedPublic, setCachedPublic} from '../src/public';

const epoch = Date.parse('2026-11-08T12:00:00Z');
const iso = (offset: number) => new Date(epoch + offset).toISOString();
const row = (slug: string, metadata: Record<string, unknown> = {}) => ({
  id: slug, slug, title: slug, kind: 'popups', status: 'PUBLISHED', metadata,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

async function withClock(run: (advance: (offset: number) => void) => Promise<void>) {
  const original = Date.now;
  let now = epoch;
  Date.now = () => now;
  clearPublicCache();
  try { await run(offset => { now = epoch + offset; }); }
  finally { Date.now = original; clearPublicCache(); }
}

function harness(rows: ReturnType<typeof row>[] = []) {
  clearPublicCache();
  const calls = {list: [] as any[], detail: [] as any[], health: [] as any[]};
  const db = {
    content: {
      async findMany(args: any) { calls.list.push(args); return rows; },
      async findFirst(args: any): Promise<ReturnType<typeof row> | null> {
        calls.detail.push(args);
        return rows.find(item => item.slug === args.where.slug) || null;
      },
    },
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown> {
      calls.health.push({strings: [...strings], raw: [...strings.raw], values});
      return [{result: 1}];
    },
  };
  // Only in-memory stand-ins: no Prisma instance, database, environment or network.
  return {controller: new PublicController(db as never), db, calls};
}

test('health awaits a tagged SELECT 1 readiness check on every call and preserves its response', async () => {
  const {controller, db, calls} = harness();
  assert.deepEqual(await controller.health(), {status: 'ok'});
  assert.deepEqual(await controller.health(), {status: 'ok'});
  assert.deepEqual(calls.health, Array(2).fill({strings: ['SELECT 1'], raw: ['SELECT 1'], values: []}));
  const readiness = deferred<unknown>();
  db.$queryRaw = () => readiness.promise;
  let completed = false;
  const pending = controller.health().then(result => { completed = true; return result; });
  await Promise.resolve();
  assert.equal(completed, false);
  readiness.resolve([]);
  assert.deepEqual(await pending, {status: 'ok'});
});

test('health propagates a database failure instead of reporting ready', async () => {
  const {controller, db} = harness();
  const failure = new Error('mock database unavailable');
  db.$queryRaw = async () => { throw failure; };
  await assert.rejects(controller.health(), error => error === failure);
});

test('popup list and detail caches expire exactly at endsAt, before the 45-second TTL', async () => {
  await withClock(async advance => {
    const {controller, calls} = harness([row('ending', {endsAt: iso(1000)})]);
    const list = await controller.list('popups', {});
    const detail = await controller.detail('popups', 'ending');
    advance(999);
    assert.strictEqual(await controller.list('popups', {}), list);
    assert.strictEqual(await controller.detail('popups', 'ending'), detail);
    advance(1000);
    assert.deepEqual(await controller.list('popups', {}), {items: [], total: 0, page: 1, limit: 25});
    await assert.rejects(controller.detail('popups', 'ending'), NotFoundException);
    assert.equal(calls.list.length, 2);
    assert.equal(calls.detail.length, 2);
  });
});

test('list expiry includes scheduled publishAt on candidates outside the returned page', async () => {
  await withClock(async advance => {
    const {controller, calls} = harness([row('visible'), row('scheduled', {publishAt: iso(1000)})]);
    const first = await controller.list('blog', {limit: 1});
    assert.equal(first.total, 1);
    advance(999);
    assert.strictEqual(await controller.list('blog', {limit: 1}), first);
    advance(1000);
    const next = await controller.list('blog', {limit: 1});
    assert.equal(next.total, 2);
    assert.deepEqual(next.items.map((item: any) => item.slug), ['visible']);
    assert.equal(calls.list.length, 2);
  });
});

test('popup lists expire at successive publishAt and startsAt boundaries for hidden candidates', async () => {
  await withClock(async advance => {
    const {controller, calls} = harness([
      row('scheduled', {publishAt: iso(1000), startsAt: iso(2000), endsAt: iso(3000)}),
    ]);
    assert.equal((await controller.list('popups', {})).total, 0);
    advance(1000);
    assert.equal((await controller.list('popups', {})).total, 0);
    advance(2000);
    assert.equal((await controller.list('popups', {})).total, 1);
    advance(3000);
    assert.equal((await controller.list('popups', {})).total, 0);
    assert.equal(calls.list.length, 4);
  });
});

test('scheduled details become visible at publishAt and startsAt without negative caching', async () => {
  await withClock(async advance => {
    const {controller, calls} = harness([row('scheduled', {publishAt: iso(1000), startsAt: iso(2000)})]);
    await assert.rejects(controller.detail('popups', 'scheduled'), NotFoundException);
    advance(1000);
    await assert.rejects(controller.detail('popups', 'scheduled'), NotFoundException);
    advance(2000);
    assert.equal((await controller.detail('popups', 'scheduled')).slug, 'scheduled');
    assert.equal(calls.detail.length, 3);
  });
});

test('earliest boundary across all list candidates wins regardless of row order', async () => {
  await withClock(async advance => {
    const {controller, calls} = harness([
      row('later', {publishAt: iso(5000)}), row('earlier', {publishAt: iso(1000)}),
    ]);
    assert.equal((await controller.list('pages', {})).total, 0);
    advance(1000);
    assert.deepEqual((await controller.list('pages', {})).items.map((item: any) => item.slug), ['earlier']);
    assert.equal(calls.list.length, 2);
  });
});

for (const method of ['list', 'detail'] as const) {
  test(`clear during an in-flight ${method} prevents stale results from repopulating the cache`, async () => {
    await withClock(async () => {
      const old = row('sample', {version: 'old'});
      const fresh = row('sample', {version: 'fresh'});
      const {controller, db} = harness();
      const pending = deferred<any>();
      let reads = 0;
      if (method === 'list') db.content.findMany = async () => (++reads === 1 ? pending.promise : [fresh]);
      else db.content.findFirst = async () => (++reads === 1 ? pending.promise : fresh);
      const read = () => method === 'list' ? controller.list('popups', {}) : controller.detail('popups', 'sample');
      const oldRead = read();
      clearPublicCache();
      // A fresh request can complete before the older read. The old read must
      // neither replace this entry nor populate one if none exists.
      const freshResult = await read();
      pending.resolve(method === 'list' ? [old] : old);
      const oldResult = await oldRead;
      assert.equal((method === 'list' ? oldResult.items[0] : oldResult).metadata.version, 'old');
      assert.strictEqual(await read(), freshResult);
      assert.equal(reads, 2);

      clearPublicCache();
      const pendingAgain = deferred<any>();
      if (method === 'list') db.content.findMany = async () => pendingAgain.promise;
      else db.content.findFirst = async () => pendingAgain.promise;
      const staleRead = read();
      clearPublicCache();
      pendingAgain.resolve(method === 'list' ? [old] : old);
      await staleRead;
      assert.equal(getCachedPublic(method === 'list' ? 'list:popups:{}' : 'detail:popups:sample'), null);
    });
  });
}

test('normal list/detail cache hits, full 45-second TTL, publicSafe and query contracts are unchanged', async () => {
  await withClock(async advance => {
    const raw = row('sample', {apiKey: 'hidden', nested: {smtpPassword: 'hidden', keep: true}});
    const {controller, calls} = harness([raw]);
    const query = {page: 1, limit: 2, search: '  sample  '};
    const list = await controller.list('blog', query);
    const detail = await controller.detail('blog', 'sample');
    assert.deepEqual(list, {items: [{...raw, metadata: {nested: {keep: true}}}], total: 1, page: 1, limit: 2});
    assert.deepEqual(detail.metadata, {nested: {keep: true}});
    assert.deepEqual(calls.list, [{
      where: {kind: 'blog', status: 'PUBLISHED', title: {contains: 'sample', mode: 'insensitive'}},
      orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}],
    }]);
    assert.deepEqual(calls.detail, [{where: {kind: 'blog', slug: 'sample', status: 'PUBLISHED'}}]);
    advance(44999);
    assert.strictEqual(await controller.list('blog', query), list);
    assert.strictEqual(await controller.detail('blog', 'sample'), detail);
    advance(45000);
    assert.notStrictEqual(await controller.list('blog', query), list);
    assert.notStrictEqual(await controller.detail('blog', 'sample'), detail);
    assert.equal(calls.list.length, 2);
    assert.equal(calls.detail.length, 2);
  });
});

test('eligibility still rejects disabled, invalid schedules and review pricing, and ignores non-popup windows', async () => {
  await withClock(async advance => {
    const {controller} = harness([
      row('disabled', {enabled: false}), row('invalid', {publishAt: 'not a date'}),
      row('review', {requiresReview: true}), row('ordinary', {startsAt: iso(1000), endsAt: iso(2000)}),
    ]);
    const pricing = await controller.list('pricing', {});
    assert.deepEqual(pricing.items.map((item: any) => item.slug), ['ordinary']);
    advance(2000);
    assert.strictEqual(await controller.list('pricing', {}), pricing);
    await assert.rejects(controller.detail('pricing', 'review'), NotFoundException);
    assert.deepEqual((await controller.list('popups', {})).items.map((item: any) => item.slug), ['review']);
  });
});

test('resource/subtype filters and invalid resource behavior remain unchanged', async () => {
  await withClock(async () => {
    const {controller, calls} = harness([row('sample')]);
    await controller.list('coworking', {});
    await controller.detail('coworking', 'sample');
    const subtype = {OR: [{kind: 'coworking'}, {kind: 'services', metadata: {path: ['type'], equals: 'csb_studios'}}]};
    assert.deepEqual(calls.list[0].where, {...subtype, status: 'PUBLISHED'});
    assert.deepEqual(calls.detail[0].where, {...subtype, slug: 'sample', status: 'PUBLISHED'});
    await assert.rejects(controller.list('unknown-resource', {}), NotFoundException);
    await assert.rejects(controller.detail('unknown-resource', 'sample'), NotFoundException);
    assert.equal(calls.list.length, 1);
    assert.equal(calls.detail.length, 1);
  });
});

test('cache helpers retain custom TTL and the 500-entry cap', async () => {
  await withClock(async advance => {
    setCachedPublic('custom', {ok: true});
    advance(9);
    assert.deepEqual(getCachedPublic('custom', 10), {ok: true});
    advance(10);
    assert.equal(getCachedPublic('custom', 10), null);
    clearPublicCache();
    for (let i = 0; i <= 500; i++) setCachedPublic(`entry:${i}`, i);
    assert.equal(getCachedPublic('entry:0'), null);
    assert.equal(getCachedPublic('entry:1'), 1);
    assert.equal(getCachedPublic('entry:500'), 500);
  });
});
