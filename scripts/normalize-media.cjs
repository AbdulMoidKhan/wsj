/** Offline-only: regenerate approved notch crops; never modifies source images. */
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
async function main() {
  const notches = JSON.parse(await fs.readFile(path.join(root, 'data/image-notches.json'), 'utf8'));
  const output = path.join(root, 'public/media/consistent');
  await fs.mkdir(output, { recursive: true });
  const manifest = {};
  for (const [source, rectangle] of Object.entries(notches)) {
    assert.match(source, /^\/media\/[\w.-]+$/);
    const input = path.join(root, 'public', source.slice(1));
    const bytes = await fs.readFile(input);
    const original = await sharp(bytes).metadata();
    assert(original.width && original.height && (!original.pages || original.pages === 1), `Invalid source ${source}`);
    const { x, y, w, h } = rectangle;
    assert([x,y,w,h].every(Number.isFinite) && x >= 0 && y >= 0 && w > 0 && h > 0 && x+w <= 1 && y+h <= 1, `Invalid map ${source}`);
    // Inward rounding guarantees extraction stays inside the known clean rectangle.
    const left = Math.ceil(x * original.width);
    const top = Math.ceil(y * original.height);
    const width = Math.floor((x+w) * original.width) - left;
    const height = Math.floor((y+h) * original.height) - top;
    assert(width > 0 && height > 0 && left+width <= original.width && top+height <= original.height, `Invalid bounds ${source}`);
    const crop = { left, top, width, height };
    const name = `${path.parse(source).name}.webp`;
    const destination = path.join(output, name);
    const expected = await sharp(bytes).extract(crop).ensureAlpha().raw().toBuffer();
    await sharp(bytes).extract(crop).webp({ lossless: true, effort: 6 }).toFile(destination);
    const metadata = await sharp(destination).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    const actual = await sharp(destination).ensureAlpha().raw().toBuffer();
    assert(expected.equals(actual), `Lossless pixel verification failed: ${source}`);
    let minAlpha = 255;
    for (let i = 3; i < actual.length; i += 4) minAlpha = Math.min(minAlpha, actual[i]);
    assert.equal(minAlpha, 255, `Mapped crop still contains transparency: ${source}`);
    assert(bytes.equals(await fs.readFile(input)), `Source changed: ${source}`);
    manifest[source] = { src: `/media/consistent/${name}`, width, height, originalWidth: original.width, originalHeight: original.height, crop, sourceSha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    console.log(`${source}: ${original.width}x${original.height} -> ${width}x${height}; bounds/pixels/opacity/source verified`);
  }
  await fs.writeFile(path.join(root, 'lib/consistent-media.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Verified ${Object.keys(manifest).length} lossless WebP crops.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
