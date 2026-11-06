const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const VIEWPORTS = [
  { name: '320px', width: 320, height: 600 },
  { name: '375px', width: 375, height: 812 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1440px', width: 1440, height: 900 },
  { name: '1920px', width: 1920, height: 1080 }
];

const ROUTES = [
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
  '/virtual-mailbox-in-chicago-best-mail-service/'
];

(async () => {
  const browser = await chromium.launch();
  const report = {};

  for (const vp of VIEWPORTS) {
    console.log(`\n=================== Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ===================`);
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    for (const r of ROUTES) {
      try {
        await page.goto(BASE_URL + r, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(100);

        const defects = await page.evaluate((width) => {
          const issues = [];
          const docW = document.documentElement.clientWidth;
          const scrollW = document.documentElement.scrollWidth;
          const bodyW = document.body.scrollWidth;

          if (scrollW > docW + 1 || bodyW > docW + 1) {
            issues.push({ type: 'horizontal-overflow', scrollW, docW, bodyW });
          }

          // Check visible overflowing elements
          const badEls = [];
          document.querySelectorAll('#main *, .wj-header *, .wj-footer *').forEach(el => {
            if (['SCRIPT','STYLE','NOSCRIPT','svg','path'].includes(el.tagName)) return;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.right > docW + 2) {
              // check if ancestor has overflow:hidden
              let cur = el.parentElement;
              let hidden = false;
              while (cur && cur !== document.body) {
                const s = window.getComputedStyle(cur);
                if (s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflow === 'clip') {
                  hidden = true;
                  break;
                }
                cur = cur.parentElement;
              }
              if (!hidden) {
                badEls.push({
                  tag: el.tagName,
                  className: (el.className && typeof el.className === 'string') ? el.className : '',
                  right: Math.round(r.right),
                  width: Math.round(r.width)
                });
              }
            }
          });

          if (badEls.length > 0) {
            issues.push({ type: 'overflowing-elements', count: badEls.length, sample: badEls.slice(0, 3) });
          }

          // Overlapping content elements
          const overlaps = [];
          const splitContainers = document.querySelectorAll('.lv-split, .lx-split, .lv-intro-grid, .hp-faq-grid, .ip-hero-grid, .lx-cols');
          splitContainers.forEach(container => {
            const kids = Array.from(container.children).filter(k => {
              const s = window.getComputedStyle(k);
              return s.display !== 'none' && s.visibility !== 'hidden' && s.position !== 'absolute';
            });
            for (let i = 0; i < kids.length; i++) {
              for (let j = i + 1; j < kids.length; j++) {
                const a = kids[i].getBoundingClientRect();
                const b = kids[j].getBoundingClientRect();
                const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (ox > 12 && oy > 12) {
                  overlaps.push({
                    parent: container.className,
                    kidA: kids[i].className || kids[i].tagName,
                    kidB: kids[j].className || kids[j].tagName,
                    overlap: `${Math.round(ox)}x${Math.round(oy)}`
                  });
                }
              }
            }
          });
          if (overlaps.length > 0) {
            issues.push({ type: 'sibling-overlap', overlaps });
          }

          // Alignment checks: container margins
          const header = document.querySelector('.wj-header .container, .lv-head-row');
          const mainShell = document.querySelector('#main .hp-shell, #main .container, #main .ip-wrap, #main .lx-shell');
          const footer = document.querySelector('.wj-footer .container');
          const align = {
            headerLeft: header ? Math.round(header.getBoundingClientRect().left) : null,
            mainLeft: mainShell ? Math.round(mainShell.getBoundingClientRect().left) : null,
            footerLeft: footer ? Math.round(footer.getBoundingClientRect().left) : null
          };

          if (align.headerLeft !== null && align.mainLeft !== null && Math.abs(align.headerLeft - align.mainLeft) > 16 && width >= 1024) {
            issues.push({ type: 'container-misaligned', ...align });
          }

          // Check card alignment (height differentials > 40px in same row)
          const cardRows = [];
          document.querySelectorAll('.pricing-grid, .price-grid, .lv-service-grid, .ip-service-grid, .archive-grid, .journal-grid').forEach(grid => {
            const cards = Array.from(grid.children).filter(c => {
              const s = window.getComputedStyle(c);
              return s.display !== 'none' && s.visibility !== 'hidden';
            });
            const rowMap = {};
            cards.forEach(c => {
              const r = c.getBoundingClientRect();
              const rowKey = Math.round(r.top / 12) * 12;
              if (!rowMap[rowKey]) rowMap[rowKey] = [];
              rowMap[rowKey].push({ height: Math.round(r.height), el: c.className });
            });
            Object.entries(rowMap).forEach(([k, list]) => {
              if (list.length > 1) {
                const heights = list.map(x => x.height);
                const diff = Math.max(...heights) - Math.min(...heights);
                if (diff > 48) {
                  cardRows.push({ grid: grid.className, diff, heights });
                }
              }
            });
          });
          if (cardRows.length > 0) {
            issues.push({ type: 'uneven-cards', count: cardRows.length, sample: cardRows.slice(0, 2) });
          }

          return issues;
        }, vp.width);

        if (defects.length > 0) {
          console.log(`[ISSUE] ${r} @ ${vp.name}:`, JSON.stringify(defects));
          if (!report[r]) report[r] = {};
          report[r][vp.name] = defects;
        }
      } catch (err) {
        console.error(`Error inspecting ${r} @ ${vp.name}:`, err.message);
      }
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync('test-results/defects-report.json', JSON.stringify(report, null, 2));
  console.log('\nAudit complete! Report written to test-results/defects-report.json');
})();

