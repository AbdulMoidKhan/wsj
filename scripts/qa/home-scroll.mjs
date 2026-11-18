// Local-only homepage scrolling regression checks. Never submits a form or payment.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base = process.env.QA_BASE_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local QA only');
const browser = await chromium.launch();
const results = [];
try {
  for (const sample of [
    {width: 1440, height: 900},
    {width: 1280, height: 650},
    {width: 768, height: 1024},
    {width: 390, height: 844},
    {width: 1440, height: 900, reducedMotion: 'reduce'},
    {width: 1440, height: 900, javaScriptEnabled: false},
  ]) {
    console.log('Checking', JSON.stringify(sample));
    const context = await browser.newContext({viewport: sample, reducedMotion: sample.reducedMotion || 'no-preference', javaScriptEnabled: sample.javaScriptEnabled !== false});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, {waitUntil: 'load'});
    if (sample.javaScriptEnabled !== false) {
      await page.mouse.move(20, 20);
      await page.waitForFunction(() => Boolean(document.documentElement.dataset.motion));
      const pinned = sample.width >= 1024 && sample.height >= 740 && !sample.reducedMotion;
      if (pinned) await page.waitForFunction(() => document.querySelector('.h-spaces')?.classList.contains('is-pinned'));
      await page.waitForFunction(() => !document.documentElement.classList.contains('has-lenis'));
      await page.mouse.wheel(0, 500);
      await page.waitForFunction(() => window.scrollY > 100);
      if (pinned) {
        for (const fraction of [0.25, 0.7, 0.35]) {
          await page.evaluate(fraction => {
            const spacer = document.querySelector('.h-spaces').parentElement;
            const top = spacer.getBoundingClientRect().top + scrollY;
            scrollTo({top: top + (spacer.offsetHeight - innerHeight) * fraction, behavior: 'instant'});
          }, fraction);
          await page.waitForFunction(() => Math.abs(document.querySelector('.h-spaces').getBoundingClientRect().top) < 3);
        }
      }
      if (pinned) {
        const beforeSwipe = await page.evaluate(() => scrollY);
        await page.locator('.h-spaces').hover();
        await page.mouse.wheel(150, 0);
        await page.waitForFunction(before => scrollY > before + 50, beforeSwipe);
      }
      const scrollDriven = sample.width >= 1100 && sample.height >= 740 && !sample.reducedMotion;
      await page.locator('.jx-track').scrollIntoViewIfNeeded();
      if (scrollDriven) {
        await page.getByRole('tab', {name: 'Connect', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('.jx-verb[aria-selected="true"]')?.id === 'jx-tab-connect');
        await page.waitForFunction(() => {
          const track = document.querySelector('.jx-track');
          return -track.getBoundingClientRect().top / (track.offsetHeight - innerHeight) > 0.84;
        });
      } else {
        const connect = page.getByRole('tab', {name: 'Connect', exact: true});
        await connect.hover(); // finish Playwright's own visibility scrolling before measuring
        const before = await page.evaluate(() => scrollY);
        await connect.click();
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - before) < 3, 'Compact tabs must not scroll the document');
      }
      await page.evaluate(() => scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
      await page.waitForFunction(() => document.documentElement.scrollHeight - innerHeight - scrollY < 3);
      await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
      await page.waitForFunction(() => scrollY < 3);
      if (sample.width < 768) {
        await page.getByRole('button', {name: 'Open menu', exact: true}).click();
        await page.getByRole('button', {name: 'Close menu', exact: true}).click();
        await page.waitForFunction(() => !document.querySelector('#wj-mobile-menu') && document.body.style.position !== 'fixed');
        await page.mouse.wheel(0, 300);
        await page.waitForFunction(() => scrollY > 100);
        await page.evaluate(() => scrollTo({top: 0, behavior: 'instant'}));
      }
      if (pinned) {
        await page.setViewportSize({width: 390, height: 844});
        await page.waitForFunction(() => !document.querySelector('.pin-spacer') && !document.querySelector('.jx-track.is-scroll-driven'));
        await page.setViewportSize({width: sample.width, height: sample.height});
        await page.waitForFunction(() => Boolean(document.querySelector('.pin-spacer')));
      }
    }
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      trackHeight: document.querySelector('.jx-track').offsetHeight,
      native: !document.documentElement.classList.contains('has-lenis'),
      pins: document.querySelectorAll('.pin-spacer').length,
    }));
    assert.ok(metrics.overflow <= 1, 'No horizontal document overflow');
    assert.ok(metrics.native, 'Homepage uses native scrolling');
    assert.ok(metrics.pins <= 1, 'No duplicate or stale pin spacers');
    if (sample.javaScriptEnabled === false || sample.height < 740 || sample.reducedMotion) assert.ok(metrics.trackHeight < sample.height * 2, 'No tall inactive scroll track');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    results.push({...sample, ...metrics, passed: true});
    await context.close();
  }
  console.log(JSON.stringify({passed: results.length, results}, null, 2));
} finally {
  await browser.close();
}
