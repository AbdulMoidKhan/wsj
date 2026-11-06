const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const files = [
  '3675f6dc28-slide-1.png',
  'ec32287da6-slide-2.png',
  '48d393a566-slide-3.png'
];

async function run() {
  for (const f of files) {
    const src = path.join(root, 'public/media', f);
    const meta = await sharp(src).metadata();
    console.log('Original', f, meta.width, 'x', meta.height);
    const out = path.join(root, 'public/media', f.replace('.png', '-highres.png'));
    await sharp(src)
      .resize(meta.width * 2, meta.height * 2, {
        kernel: sharp.kernel.lanczos3
      })
      .sharpen({ sigma: 1.2, m1: 0.8, m2: 2.0 })
      .png({ compressionLevel: 8 })
      .toFile(out);
    console.log('Created', out);
  }
}
run().catch(e => console.error(e));
