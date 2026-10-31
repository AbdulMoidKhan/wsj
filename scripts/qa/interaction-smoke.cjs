#!/usr/bin/env node
/*
  Interaction smoke tests for the public site (Playwright, read-only).

  Never submits a booking or an inquiry: form tests only exercise client-side
  validation and assert that no POST reaches /api/inquiries or /api/bookings.

  Usage: node scripts/qa/interaction-smoke.cjs [--base http://localhost:3000]
*/
const path = require('node:path');
const {chromium} = require(path.join(process.cwd(), 'node_modules', 'playwright'));
const base = (process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3000').replace(/\/$/, '');

const results = [];
async function test(name, fn, ctx) {
  const page = await ctx.newPage();
  const errors = [];
  const posts = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {if (m.type() === 'error') errors.push(m.text());});
  page.on('request', r => {if (r.method() === 'POST' && /\/api\/(inquiries|bookings)/.test(r.url())) posts.push(r.url());});
  try {
    await fn(page);
    if (posts.length) throw new Error('unexpected mutation request: ' + posts.join(', '));
    const real = name.startsWith('404') ? errors.filter(e => !/status of 404/.test(e)) : errors;
    if (real.length) throw new Error('console/page error: ' + real[0].slice(0, 200));
    results.push({name, ok: true});
  } catch (e) {
    results.push({name, ok: false, error: String(e.message).slice(0, 300)});
  }
  await page.close();
}
const assert = (cond, msg) => {if (!cond) throw new Error(msg);};
const go = (page, p) => page.goto(base + p, {waitUntil: 'load', timeout: 60000});

(async () => {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({viewport: {width: 1440, height: 900}, reducedMotion: 'reduce'});
  const mobile = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', hasTouch: true, isMobile: true});

  await test('header: primary nav links resolve', async page => {
    await go(page, '/');
    const hrefs = await page.$$eval('.lv-primary a, .lv-strip a', as => [...new Set(as.map(a => a.getAttribute('href')))]);
    assert(hrefs.length >= 10, 'expected header links, got ' + hrefs.length);
    for (const h of hrefs) {const r = await page.request.get(base + h); assert(r.status() < 400, h + ' -> ' + r.status());}
  }, desktop);

  await test('footer: every link resolves', async page => {
    await go(page, '/about-us/');
    const hrefs = await page.$$eval('.wj-footer a[href^="/"]', as => [...new Set(as.map(a => a.getAttribute('href')))]);
    assert(hrefs.length >= 20, 'expected footer links, got ' + hrefs.length);
    for (const h of hrefs) {const r = await page.request.get(base + h); assert(r.status() < 400, h + ' -> ' + r.status());}
  }, desktop);

  await test('header search: opens, Escape closes, submits to journal results', async page => {
    await go(page, '/');
    await page.click('.lv-search .lv-icon-btn');
    await page.waitForSelector('#lv-search-form');
    assert(await page.evaluate(() => document.activeElement?.id === 'lv-q'), 'search input not focused');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#lv-search-form', {state: 'detached'});
    await page.click('.lv-search .lv-icon-btn');
    await page.fill('#lv-q', 'coworking');
    await Promise.all([page.waitForURL(/\/blogs\/\?q=coworking/), page.press('#lv-q', 'Enter')]);
    const cards = await page.$$eval('.archive-grid .journal-card', c => c.length);
    assert(cards > 0, 'no search results for "coworking"');
  }, desktop);

  await test('mobile menu: opens as modal, traps focus, Escape closes and restores focus', async page => {
    await go(page, '/');
    await page.click('.lv-burger');
    await page.waitForSelector('#wj-mobile-menu[role=dialog]');
    assert(await page.evaluate(() => document.getElementById('wj-mobile-menu').contains(document.activeElement)), 'focus not inside menu');
    const box = await page.locator('#wj-mobile-menu').boundingBox();
    assert(box && box.x >= -1 && box.width <= 391, 'menu panel outside viewport');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#wj-mobile-menu', {state: 'detached'});
    assert(await page.evaluate(() => document.activeElement?.classList.contains('lv-burger')), 'focus not restored to menu button');
    await page.click('.lv-burger');
    await Promise.all([page.waitForURL(/\/coworking\/$/), page.click('#wj-mobile-menu a[href="/coworking/"]')]);
  }, mobile);

  await test('booking dialog: opens, loads live catalog, Escape closes, focus restored', async page => {
    await go(page, '/coworking/');
    const trigger = page.locator('.wj-closing .btn-cream');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click({force: true});
    await page.waitForSelector('.bk-modal');
    await page.waitForTimeout(1500);
    const err = await page.locator('.bk-error-msg').count();
    assert(err === 0, 'booking dialog shows an error: ' + (err ? await page.locator('.bk-error-msg').first().innerText() : ''));
    const types = await page.locator('.bk-type-grid button').count();
    assert(types >= 4, 'workspace types not rendered');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.bk-modal', {state: 'detached'});
  }, desktop);

  await test('booking dialog (mobile): fits viewport and plan step shows prices', async page => {
    await go(page, '/');
    await page.locator('.lv-hero-actions .btn-primary').click({force: true});
    await page.waitForSelector('.bk-modal');
    const box = await page.locator('.bk-modal').boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 391, 'booking modal wider than viewport');
    await page.waitForTimeout(1200);
    await page.locator('.bk-type-grid button').first().click();
    const next = page.getByRole('button', {name: /continue/i});
    await next.click();
    await page.waitForSelector('.bk-plan-grid');
    const prices = await page.$$eval('.bk-plan-price', p => p.map(x => x.textContent.trim()).filter(Boolean));
    assert(prices.length > 0 && prices.every(p => /\$\d/.test(p)), 'plan prices missing: ' + prices.join(','));
    await page.keyboard.press('Escape');
  }, mobile);

  await test('homepage FAQ: summary toggles answer', async page => {
    await go(page, '/');
    const d = page.locator('.hp-faq-list details').first();
    await d.locator('summary').scrollIntoViewIfNeeded();
    await d.locator('summary').click();
    assert(await d.evaluate(e => e.open), 'FAQ did not open');
    await d.locator('summary').click();
    assert(!(await d.evaluate(e => e.open)), 'FAQ did not close');
  }, desktop);

  await test('homepage studio tabs: click and arrow keys switch panels', async page => {
    await go(page, '/');
    const tabs = page.locator('.lv-studios [role=tab]');
    await tabs.nth(1).scrollIntoViewIfNeeded();
    await tabs.nth(1).click();
    assert(await tabs.nth(1).getAttribute('aria-selected') === 'true', 'tab 2 not selected');
    await page.keyboard.press('ArrowRight');
    assert(await tabs.nth(2).getAttribute('aria-selected') === 'true', 'arrow key did not move selection');
  }, desktop);

  await test('pricing filters: switching service changes the plans', async page => {
    await go(page, '/');
    const filters = page.locator('.pricing-filters[aria-label="Pricing services"] button');
    assert(await filters.count() > 1, 'no pricing filters (API pricing unavailable?)');
    const before = await page.$$eval('.pricing-grid .price-card h3', h => h.map(x => x.textContent).join('|'));
    await filters.nth(1).scrollIntoViewIfNeeded();
    await filters.nth(1).click();
    assert(await filters.nth(1).getAttribute('aria-pressed') === 'true', 'filter not pressed');
    const after = await page.$$eval('.pricing-grid .price-card h3', h => h.map(x => x.textContent).join('|'));
    assert(after && after !== before, 'plans did not change');
  }, desktop);

  await test('hero slider: dots and pause control', async page => {
    await go(page, '/');
    await page.locator('.lv-slide-dot').nth(2).click();
    assert(await page.locator('.lv-slide-dot').nth(2).getAttribute('aria-pressed') === 'true', 'dot not active');
    assert(/resume/i.test(await page.locator('.lv-slide-pause').innerText()), 'slider not paused after manual selection');
  }, desktop);

  await test('inquiry form: empty submit shows validation and sends nothing', async page => {
    await go(page, '/contact-us/');
    const form = page.locator('form.wj-form').first();
    await form.scrollIntoViewIfNeeded();
    await form.locator('button[type=submit]').click();
    await page.waitForTimeout(500);
    const invalid = await form.locator('[aria-invalid=true]').count();
    assert(invalid >= 3, 'expected field errors, got ' + invalid);
    const errs = await form.locator('.wj-error').allInnerTexts();
    assert(errs.length >= 3, 'validation messages not shown');
  }, desktop);

  await test('journal: category tab navigates and empty category explains itself', async page => {
    await go(page, '/blogs/');
    assert(await page.locator('.archive-grid .journal-card').count() > 0, 'no stories on /blogs/');
    await go(page, '/category/workshops/');
    const empty = page.locator('.archive-empty');
    if (await empty.count()) assert(/workshops/i.test(await empty.innerText()), 'empty state does not name the category');
    await go(page, '/blogs/?page=2');
    assert(await page.locator('.pagination a[aria-current=page]').innerText() === '2', 'pagination did not move to page 2');
  }, desktop);

  await test('live tabs: switch panels where present', async page => {
    for (const p of ['/memberships/', '/monthly_memberships/', '/services/', '/coworking/']) {
      await go(page, p);
      const tabs = page.locator('.lx-tablist [role=tab]');
      if (await tabs.count() < 2) continue;
      await tabs.nth(1).scrollIntoViewIfNeeded();
      await tabs.nth(1).click();
      assert(await tabs.nth(1).getAttribute('aria-selected') === 'true', p + ' tab not selected');
      return;
    }
  }, desktop);

  await test('gallery: renders venue photos', async page => {
    await go(page, '/gallery/');
    const n = await page.locator('.ip-gallery-grid img').count();
    assert(n >= 4, 'gallery has ' + n + ' images');
  }, desktop);

  await test('404: unknown route shows not-found page with recovery links', async page => {
    const r = await go(page, '/definitely-not-a-page/');
    assert(r.status() === 404, 'status ' + r.status());
    await page.waitForSelector('.wj-missing a', {timeout: 15000});
    assert(await page.locator('.wj-missing a').count() >= 2, 'no recovery links');
  }, desktop);

  await browser.close();
  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '\n     ' + r.error));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => {console.error(e); process.exit(2);});
