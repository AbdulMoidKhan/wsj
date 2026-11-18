import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {R2StorageService, assertManagedKey, buildObjectKey, detectMimeType, safeFileStem, MEDIA_CATEGORIES} from '../src/storage';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(8)]);

// Offline tests: no request reaches R2 (validation fails first, or only URL building is used).
const withEnv = (vars: Record<string, string | undefined>, fn: () => unknown) => async () => {
  const saved = Object.fromEntries(Object.keys(vars).map(k => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try { await fn(); } finally { for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v); }
};
const FAKE = {R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret', R2_BUCKET_NAME: 'bucket', R2_ENDPOINT: 'https://example.invalid', R2_PUBLIC_URL: 'https://media.example.com/', R2_REGION: 'auto'};

test('detects supported file signatures', () => {
  assert.equal(detectMimeType(PNG), 'image/png');
  assert.equal(detectMimeType(JPG), 'image/jpeg');
  assert.equal(detectMimeType(Buffer.from('RIFF0000WEBPVP8 ')), 'image/webp');
  assert.equal(detectMimeType(MP4), 'video/mp4');
  assert.equal(detectMimeType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(detectMimeType(Buffer.from('<html>')), null);
});

test('object keys are unique, categorised and URL safe', () => {
  assert.equal(safeFileStem('../../etc/passwd'), 'passwd');
  assert.equal(safeFileStem('C:\\Users\\x\\Café Photo (1).JPG'), 'cafe-photo-1');
  assert.equal(safeFileStem('???.png'), 'file');
  const now = new Date(Date.UTC(2026, 10, 12));
  const a = buildObjectKey('blogs', 'Hero Shot.png', 'image/png', now), b = buildObjectKey('blogs', 'Hero Shot.png', 'image/png', now);
  assert.match(a, /^blogs\/2026\/11\/[0-9a-f-]{36}-hero-shot\.png$/);
  assert.notEqual(a, b);
  assert.deepEqual([...MEDIA_CATEGORIES], ['blogs', 'sliders', 'use-cases', 'services', 'images', 'videos', 'static']);
});

test('only keys inside managed category prefixes are accepted', () => {
  assert.equal(assertManagedKey('images/2026/11/x.png'), 'images/2026/11/x.png');
  for (const key of ['test.jpg', '/images/x.png', 'images/../x.png', 'images//x.png', 'other/x.png', 'images', '', 'images/a\\b.png'])
    assert.throws(() => assertManagedKey(key), key);
});

test('uploadFile rejects disallowed types, spoofed content and oversized files before any network call', withEnv(FAKE, async () => {
  const s = new R2StorageService();
  await assert.rejects(s.uploadFile({category: 'images', buffer: MP4, originalName: 'a.mp4', contentType: 'video/mp4'}), /not allowed for images/);
  await assert.rejects(s.uploadFile({category: 'images', buffer: Buffer.from('<html>'), originalName: 'a.png', contentType: 'image/png'}), /does not match/);
  await assert.rejects(s.uploadFile({category: 'blogs', buffer: Buffer.alloc(0), originalName: 'a.png', contentType: 'image/png'}), /empty/);
  await assert.rejects(s.uploadFile({category: 'nope' as never, buffer: PNG, originalName: 'a.png', contentType: 'image/png'}), /Unknown media category/);
  await assert.rejects(s.generatePresignedUploadUrl({category: 'blogs', originalName: 'a.png', contentType: 'image/png', contentLength: 16 * 1024 * 1024}), /limit/);
}));

test('deleteFile requires a reference check and refuses referenced or unmanaged keys', withEnv(FAKE, async () => {
  const s = new R2StorageService();
  await assert.rejects(s.deleteFile('test.jpg', {isReferenced: () => false}), /outside the managed/);
  await assert.rejects(s.deleteFile('images/2026/11/x.png', {} as never), /reference check/);
  await assert.rejects(s.deleteFile('images/2026/11/x.png', {isReferenced: () => true}), /still referenced/);
}));

test('public URLs come from R2_PUBLIC_URL; missing configuration is reported by name, never by value', async () => {
  await withEnv(FAKE, () => {
    const s = new R2StorageService();
    assert.equal(s.getPublicUrl('images/2026/11/a b.png'), 'https://media.example.com/images/2026/11/a%20b.png');
    assert.equal(s.isConfigured(), true);
  })();
  await withEnv({...FAKE, R2_SECRET_ACCESS_KEY: undefined, R2_PUBLIC_URL: undefined}, () => {
    const s = new R2StorageService();
    assert.equal(s.isConfigured(), false);
    assert.throws(() => s.getPublicUrl('images/x.png'), (e: Error) => /R2_SECRET_ACCESS_KEY/.test(e.message) && !/test-key/.test(e.message));
  })();
});
