const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIRS = [
  path.join(process.cwd(), 'screenshot'),
  path.join(process.cwd(), 'screenshots')
];

for (const dir of OUT_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
}

const PAGES = [
  // --- Header Pages ---
  { name: '01-home', path: '/', section: 'Header / Brand' },
  { name: '02-about-us', path: '/about-us/', section: 'Header & Footer' },
  { name: '03-contact-us', path: '/contact-us/', section: 'Header & Footer' },
  { name: '04-coworking', path: '/coworking/', section: 'Header & Footer' },
  { name: '05-dedicated-desks', path: '/dedicated/', section: 'Header & Footer' },
  { name: '06-business-address', path: '/business-address/', section: 'Header & Footer' },
  { name: '07-event-space', path: '/events/', section: 'Header & Footer' },
  { name: '08-podcast-studio', path: '/podcast-studio/', section: 'Header & Footer' },
  { name: '09-virtual-offices', path: '/virtual-office/', section: 'Header & Footer' },
  { name: '10-meeting-rooms', path: '/meeting-rooms/', section: 'Header & Footer' },
  { name: '11-mailbox', path: '/mail-box/', section: 'Header & Footer' },
  { name: '12-community-network', path: '/community-network/', section: 'Header & Footer' },

  // --- Footer Pages ---
  { name: '13-memberships', path: '/memberships/', section: 'Footer' },
  { name: '14-virtual-mailbox', path: '/virtual-mailbox/', section: 'Footer' },
  { name: '15-digital-services', path: '/digital-services/', section: 'Footer' },
  { name: '16-bpo-services', path: '/bpo-services/', section: 'Footer' },
  { name: '17-printed-services', path: '/printed-services/', section: 'Footer' },
  { name: '18-notary-public', path: '/notary-public/', section: 'Footer' },
  { name: '19-digital-presence', path: '/digital-presence/', section: 'Footer' },
  { name: '20-llc-setup', path: '/llc-setup/', section: 'Footer' },
  { name: '21-photo-studio', path: '/photo-studio/', section: 'Footer' },
  { name: '22-webinars', path: '/webinars/', section: 'Footer' },
  { name: '23-trade-shows', path: '/trade-shows/', section: 'Footer' },
  { name: '24-library', path: '/library/', section: 'Footer' },
  { name: '25-gallery', path: '/gallery/', section: 'Footer' },
  { name: '26-blogs', path: '/blogs/', section: 'Footer' },
  { name: '27-services', path: '/services/', section: 'Footer' },
  { name: '28-use-cases', path: '/use-cases/', section: 'Footer' },
  { name: '29-partners', path: '/partners/', section: 'Footer' },
  { name: '30-terms-and-privacy', path: '/terms-and-privacy/', section: 'Footer' },
  { name: '31-admin-login', path: '/admin/', section: 'Footer' }
];

async function ensurePageFullyLoaded(page) {
  // Wait for network and font rendering
  await page.waitForTimeout(600);

  // Step 1: Incremental scroll through entire document so all intersection observers,
  // lazy images, and Framer Motion / GSAP triggers activate properly.
  const totalHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
  const step = 600;
  for (let top = 0; top < totalHeight; top += step) {
    await page.evaluate(y => window.scrollTo(0, y), top);
    await page.waitForTimeout(100);
  }
  await page.evaluate(bottom => window.scrollTo(0, bottom), totalHeight);
  await page.waitForTimeout(200);

  // Step 2: Ensure all images have decoded
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return img.decode().catch(() => {});
    }));
  });

  // Step 3: Reveal any elements still kept at opacity: 0 by unfinished scroll animations
  // (leaving carousel inactive slides hidden so text doesn't overlap)
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.classList.contains('lv-hero-title') && !el.classList.contains('is-active')) return;
      if (el.classList.contains('lv-slide') && !el.classList.contains('is-active')) return;
      if (el.getAttribute('aria-hidden') === 'true' && el.parentElement?.classList?.contains('lv-hero-stage')) return;

      if (el.style && (el.style.opacity === '0' || el.style.opacity === '0.001')) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
    });
  });

  // Step 4: Scroll back to top and let layout stabilize
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function run() {
  console.log(`Starting thorough screenshot capture for ${PAGES.length} pages...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  const results = [];

  // 1. Capture standalone Header, Footer, and Mega Menu
  try {
    console.log('Capturing standalone Header and Footer components...');
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 35000 });
    await ensurePageFullyLoaded(page);

    // Header component
    const headerEl = page.locator('header.wj-header');
    if (await headerEl.count() > 0) {
      const buf = await headerEl.first().screenshot();
      for (const dir of OUT_DIRS) {
        fs.writeFileSync(path.join(dir, 'header-component.png'), buf);
      }
      console.log('✓ Captured header-component.png');
    }

    // Footer component
    const footerEl = page.locator('footer.wj-footer');
    if (await footerEl.count() > 0) {
      const buf = await footerEl.first().screenshot();
      for (const dir of OUT_DIRS) {
        fs.writeFileSync(path.join(dir, 'footer-component.png'), buf);
      }
      console.log('✓ Captured footer-component.png');
    }

    // Mega menu / Header navigation
    const menuToggle = page.locator('.wj-menu-toggle, .lv-burger');
    if (await menuToggle.count() > 0) {
      await menuToggle.first().click();
      await page.waitForTimeout(500);
      const buf = await page.screenshot({ fullPage: false });
      for (const dir of OUT_DIRS) {
        fs.writeFileSync(path.join(dir, 'header-navigation-menu.png'), buf);
      }
      console.log('✓ Captured header-navigation-menu.png');
      const closeBtn = page.locator('.wj-mega-close');
      if (await closeBtn.count() > 0) await closeBtn.first().click();
      await page.waitForTimeout(300);
    }
  } catch (err) {
    console.error('Error during component capture:', err.message);
  }

  // 2. Capture all full-page screenshots
  for (let i = 0; i < PAGES.length; i++) {
    const item = PAGES[i];
    const url = BASE_URL + item.path;
    const filename = `${item.name}.png`;
    console.log(`[${i + 1}/${PAGES.length}] Capturing ${item.name} (${item.path})...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 });
      await ensurePageFullyLoaded(page);

      const buffer = await page.screenshot({ fullPage: true });
      for (const dir of OUT_DIRS) {
        fs.writeFileSync(path.join(dir, filename), buffer);
      }

      const sizeKb = Math.round(buffer.length / 1024);
      results.push({ ...item, filename, sizeKb, status: 'OK' });
      console.log(`  -> Saved ${filename} (${sizeKb} KB)`);
    } catch (err) {
      console.error(`  -> Failed ${item.path}:`, err.message);
      results.push({ ...item, filename, sizeKb: 0, status: 'FAILED: ' + err.message });
    }
  }

  await browser.close();

  console.log('\n================ CAPTURE COMPLETE ================');
  console.log(`Saved ${results.length} page screenshots to:`);
  console.log(` - ${OUT_DIRS[0]}`);
  console.log(` - ${OUT_DIRS[1]}`);
  console.table(results.map(r => ({
    Page: r.name,
    Path: r.path,
    Section: r.section,
    File: r.filename,
    Size: `${r.sizeKb} KB`,
    Status: r.status
  })));
}

run().catch(err => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
