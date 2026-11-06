const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VIEWPORTS = [
  { name: '320px', width: 320, height: 640 },
  { name: '375px', width: 375, height: 812 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1440px', width: 1440, height: 900 },
  { name: '1920px', width: 1920, height: 1080 }
];

const CORE_ROUTES = [
  '/',
  '/about-us/',
  '/contact-us/',
  '/coworking/',
  '/dedicated/',
  '/meeting-rooms/',
  '/podcast-studio/',
  '/photo-studio/',
  '/events/',
  '/memberships/',
  '/membership-plans/',
  '/business-address/',
  '/virtual-office/',
  '/mail-box/',
  '/virtual-mailbox/',
  '/gallery/',
  '/services/',
  '/use-cases/',
  '/use-cases/business-consultants/',
  '/use-cases/freelancers-solopreneurs/',
  '/use-cases/law-firms-attorneys/',
  '/creative-designers-agencies/',
  '/e-commerce-online-business/',
  '/community-network/',
  '/partners/',
  '/library/',
  '/trade-shows/',
  '/workshops/',
  '/webinars/',
  '/llc-setup/',
  '/notary-public/',
  '/printed-services/',
  '/digital-presence/',
  '/digital-services/',
  '/bpo-services/',
  '/book-an-appointment/',
  '/schedule-a-tour/',
  '/membership-checkout/',
  '/booking-confirmation/',
  '/terms-and-privacy/',
  '/blogs/',
  '/category/workshops/',
  '/benefits-of-joining-a-coworking-space/'
];

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
  fs.mkdirSync(screenshotDir, { recursive: true });

  console.log(`Starting comprehensive audit on ${CORE_ROUTES.length} routes across ${VIEWPORTS.length} viewports...`);

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    for (const route of CORE_ROUTES) {
      const url = `${BASE_URL}${route}`;
      try {
        const response = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        const status = response ? response.status() : 0;
        await page.waitForTimeout(400);

        const auditData = await page.evaluate((vpWidth) => {
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const bodyScrollW = document.body.scrollWidth;
          const hasHOverflow = scrollW > docW + 1 || bodyScrollW > docW + 1;

          // Find elements causing horizontal overflow
          const overflowingElements = [];
          if (hasHOverflow) {
            document.querySelectorAll('body *').forEach(el => {
              // skip script/style/defs
              if (['SCRIPT','STYLE','NOSCRIPT','HEAD','DEFS'].includes(el.tagName)) return;
              const r = el.getBoundingClientRect();
              const cs = window.getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden') return;
              if (r.right > docW + 2) {
                // Check if an ancestor has overflow:hidden
                let clipped = false;
                let p = el.parentElement;
                while (p && p !== document.body) {
                  const pcs = window.getComputedStyle(p);
                  if (pcs.overflow === 'hidden' || pcs.overflowX === 'hidden' || pcs.overflow === 'clip') {
                    clipped = true;
                    break;
                  }
                  p = p.parentElement;
                }
                if (!clipped) {
                  overflowingElements.push({
                    tag: el.tagName,
                    class: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
                    right: Math.round(r.right),
                    width: Math.round(r.width)
                  });
                }
              }
            });
          }

          // Check broken images
          const brokenImages = [];
          document.querySelectorAll('img').forEach(img => {
            if (img.complete && img.naturalWidth === 0 && img.src && !img.src.includes('data:')) {
              brokenImages.push({ src: img.src.slice(0, 80), alt: img.alt || '' });
            }
          });

          // Check container alignment: header vs main vs footer left offset
          const header = document.querySelector('.wj-header .container, .lv-head-row');
          const mainContainer = document.querySelector('#main .hp-shell, #main .container, #main .ip-wrap, #main .lx-shell');
          const footerContainer = document.querySelector('.wj-footer .container');

          const headerLeft = header ? Math.round(header.getBoundingClientRect().left) : null;
          const mainLeft = mainContainer ? Math.round(mainContainer.getBoundingClientRect().left) : null;
          const footerLeft = footerContainer ? Math.round(footerContainer.getBoundingClientRect().left) : null;

          // Card height consistency in rows
          const cardDefects = [];
          const cardGrids = document.querySelectorAll('.price-grid, .pricing-grid, .lv-service-grid, .archive-grid, .journal-grid, .ip-service-grid, .lx-grid');
          cardGrids.forEach(grid => {
            const cards = Array.from(grid.children).filter(c => {
              const cs = window.getComputedStyle(c);
              return cs.display !== 'none' && cs.visibility !== 'hidden';
            });
            // group by top coordinate (same visual row)
            const rows = {};
            cards.forEach(c => {
              const r = c.getBoundingClientRect();
              const top = Math.round(r.top / 8) * 8;
              if (!rows[top]) rows[top] = [];
              rows[top].push({ el: c, height: Math.round(r.height), bottom: Math.round(r.bottom) });
            });
            Object.values(rows).forEach(rowCards => {
              if (rowCards.length > 1) {
                const heights = rowCards.map(rc => rc.height);
                const minH = Math.min(...heights);
                const maxH = Math.max(...heights);
                if (maxH - minH > 24) {
                  cardDefects.push({
                    gridClass: grid.className.slice(0, 40),
                    heightDiff: maxH - minH,
                    minH,
                    maxH
                  });
                }
              }
            });
          });

          // Check overlapping sibling elements
          const overlaps = [];
          const containers = document.querySelectorAll('.lv-split, .lx-split, .hp-faq-grid, .lv-intro-grid, .ip-hero-grid');
          containers.forEach(container => {
            const kids = Array.from(container.children).filter(k => {
              const cs = window.getComputedStyle(k);
              return cs.display !== 'none' && cs.position !== 'absolute';
            });
            for (let i = 0; i < kids.length; i++) {
              for (let j = i + 1; j < kids.length; j++) {
                const a = kids[i].getBoundingClientRect();
                const b = kids[j].getBoundingClientRect();
                const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (ox > 10 && oy > 10) {
                  overlaps.push({
                    container: container.className.slice(0, 40),
                    overlapSize: `${Math.round(ox)}x${Math.round(oy)}`
                  });
                }
              }
            }
          });

          return {
            docW,
            scrollW,
            hasHOverflow,
            overflowingCount: overflowingElements.length,
            overflowingElements: overflowingElements.slice(0, 5),
            brokenImagesCount: brokenImages.length,
            brokenImages: brokenImages.slice(0, 3),
            headerLeft,
            mainLeft,
            footerLeft,
            cardDefects: cardDefects.slice(0, 3),
            overlaps: overlaps.slice(0, 3)
          };
        }, vp.width);

        // Take screenshot for sample pages at 375px and 1440px
        if (['375px', '1440px'].includes(vp.name) && ['/', '/coworking/', '/meeting-rooms/', '/events/', '/contact-us/', '/blogs/', '/memberships/'].includes(route)) {
          const safeName = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-|-$/g, '');
          const screenshotPath = path.join(screenshotDir, `${safeName}_${vp.name}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: false });
        }

        results.push({
          route,
          status,
          viewport: vp.name,
          ...auditData
        });

        if (auditData.hasHOverflow || auditData.overflowingCount > 0 || auditData.cardDefects.length > 0 || auditData.overlaps.length > 0) {
          console.log(`[DEFECT] ${route} @ ${vp.name}: overflow=${auditData.hasHOverflow} (scrollW=${auditData.scrollW} vs docW=${auditData.docW}), cardDefects=${auditData.cardDefects.length}, overlaps=${auditData.overlaps.length}`);
          if (auditData.overflowingElements.length) {
            console.log('   Elements:', JSON.stringify(auditData.overflowingElements));
          }
        }
      } catch (err) {
        console.error(`[ERROR] ${route} @ ${vp.name}:`, err.message);
        results.push({ route, viewport: vp.name, error: err.message });
      }
    }
    await context.close();
  }

  await browser.close();
  const summaryFile = path.join(process.cwd(), 'test-results', 'audit-summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  console.log(`Audit complete. Summary saved to ${summaryFile}`);
}

runAudit().catch(console.error);

