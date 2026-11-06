const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(process.cwd(), 'test-results', 'visual-audit');
fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGET_PAGES = [
  { name: 'homepage', path: '/' },
  { name: 'coworking', path: '/coworking/' },
  { name: 'meeting-rooms', path: '/meeting-rooms/' },
  { name: 'podcast-studio', path: '/podcast-studio/' },
  { name: 'events', path: '/events/' },
  { name: 'memberships', path: '/memberships/' },
  { name: 'about-us', path: '/about-us/' },
  { name: 'contact-us', path: '/contact-us/' },
  { name: 'services', path: '/services/' },
  { name: 'use-cases', path: '/use-cases/' },
  { name: 'blogs', path: '/blogs/' },
  { name: 'blog-post', path: '/virtual-mailbox-in-chicago-best-mail-service/' },
  { name: 'terms', path: '/terms-and-privacy/' },
  { name: 'booking-confirmation', path: '/booking-confirmation/' }
];

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 }
];

(async () => {
  const browser = await chromium.launch();
  const findings = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    for (const target of TARGET_PAGES) {
      const url = BASE_URL + target.path;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 20000 });
        await page.waitForTimeout(300);

        // Take full screenshot for visual audit
        const screenshotPath = path.join(OUT_DIR, `${target.name}-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Collect precise layout metrics
        const metrics = await page.evaluate(({ width, name }) => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const hasHOverflow = scrollW > docW + 1;

          // Header alignment
          const headerContainer = document.querySelector('.wj-header .container, .lv-head-row');
          const headerLeft = headerContainer ? Math.round(headerContainer.getBoundingClientRect().left) : null;
          const headerRight = headerContainer ? Math.round(headerContainer.getBoundingClientRect().right) : null;

          // First content container
          const mainContainer = document.querySelector('#main .hp-shell, #main .container, #main .ip-wrap, #main .lx-shell');
          const mainLeft = mainContainer ? Math.round(mainContainer.getBoundingClientRect().left) : null;
          const mainRight = mainContainer ? Math.round(mainContainer.getBoundingClientRect().right) : null;

          // Footer container
          const footerContainer = document.querySelector('.wj-footer .container');
          const footerLeft = footerContainer ? Math.round(footerContainer.getBoundingClientRect().left) : null;
          const footerRight = footerContainer ? Math.round(footerContainer.getBoundingClientRect().right) : null;

          // Check all sections vertical gaps
          const sectionGaps = [];
          const sections = Array.from(document.querySelectorAll('#main > section, #main > div, #main > .hp-section, #main > .lx-sec, #main > .ip-wrap'));
          for (let i = 0; i < sections.length - 1; i++) {
            const ra = sections[i].getBoundingClientRect();
            const rb = sections[i + 1].getBoundingClientRect();
            const gap = Math.round(rb.top - ra.bottom);
            if (gap > 140 || gap < -5) {
              sectionGaps.push({ from: sections[i].className.slice(0, 30), to: sections[i + 1].className.slice(0, 30), gap });
            }
          }

          // Check buttons: text alignment, padding, min-height
          const buttonIssues = [];
          document.querySelectorAll('#main a.btn, #main button.btn, #main .btn').forEach(btn => {
            const r = btn.getBoundingClientRect();
            const s = window.getComputedStyle(btn);
            if (r.width > 0 && r.height > 0) {
              if (width <= 414 && r.height < 40) {
                buttonIssues.push({ text: btn.textContent.trim().slice(0, 20), height: Math.round(r.height), issue: 'touch-target-small' });
              }
              if (s.display === 'inline-flex' && s.alignItems !== 'center') {
                buttonIssues.push({ text: btn.textContent.trim().slice(0, 20), issue: 'button-not-vertically-aligned' });
              }
            }
          });

          // Check headings: Playfair Display font check
          const nonPlayfairHeadings = [];
          document.querySelectorAll('#main h1, #main h2, #main h3').forEach(h => {
            const s = window.getComputedStyle(h);
            const r = h.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && !s.fontFamily.includes('Playfair') && !h.closest('.lv-think, .lv-stats, .wj-closing')) {
              nonPlayfairHeadings.push({ tag: h.tagName, text: h.textContent.trim().slice(0, 35), font: s.fontFamily });
            }
          });

          // Card height differences in grids
          const cardGrids = [];
          document.querySelectorAll('.pricing-grid, .price-grid, .lv-service-grid, .archive-grid, .journal-grid, .lx-grid, .ip-service-grid').forEach(grid => {
            const kids = Array.from(grid.children).filter(k => {
              const s = window.getComputedStyle(k);
              return s.display !== 'none' && s.visibility !== 'hidden';
            });
            const rowMap = {};
            kids.forEach(k => {
              const r = k.getBoundingClientRect();
              const rowKey = Math.round(r.top / 16) * 16;
              if (!rowMap[rowKey]) rowMap[rowKey] = [];
              rowMap[rowKey].push({ height: Math.round(r.height), el: k });
            });
            Object.values(rowMap).forEach(row => {
              if (row.length > 1) {
                const hs = row.map(x => x.height);
                const diff = Math.max(...hs) - Math.min(...hs);
                if (diff > 30) {
                  cardGrids.push({ grid: grid.className.slice(0, 35), diff, heights: hs });
                }
              }
            });
          });

          return {
            hasHOverflow,
            docW,
            scrollW,
            headerLeft,
            mainLeft,
            footerLeft,
            headerRight,
            mainRight,
            footerRight,
            sectionGaps,
            buttonIssues: buttonIssues.slice(0, 3),
            nonPlayfairHeadings: nonPlayfairHeadings.slice(0, 3),
            cardGrids: cardGrids.slice(0, 3)
          };
        }, { width: vp.width, name: target.name });

        findings.push({ page: target.name, viewport: vp.name, ...metrics });
        console.log(`[PASS] ${target.name} @ ${vp.name} captured.`);
        if (metrics.hasHOverflow || metrics.sectionGaps.length > 0 || metrics.cardGrids.length > 0 || (metrics.headerLeft && metrics.mainLeft && Math.abs(metrics.headerLeft - metrics.mainLeft) > 16 && vp.width >= 1024)) {
          console.log(`   Notice: overflow=${metrics.hasHOverflow}, misalignedContainer=${Math.abs((metrics.headerLeft||0) - (metrics.mainLeft||0))}, gaps=${metrics.sectionGaps.length}, cardDiffs=${metrics.cardGrids.length}`);
        }
      } catch (err) {
        console.error(`Error on ${target.name} @ ${vp.name}:`, err.message);
      }
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, 'analysis.json'), JSON.stringify(findings, null, 2));
  console.log(`\nAnalysis and screenshots complete! Saved to ${OUT_DIR}`);
})();

