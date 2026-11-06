const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const PAGES = [
  '/',
  '/coworking/',
  '/meeting-rooms/',
  '/podcast-studio/',
  '/events/',
  '/memberships/',
  '/about-us/',
  '/contact-us/',
  '/services/',
  '/use-cases/',
  '/blogs/',
  '/virtual-mailbox-in-chicago-best-mail-service/',
  '/terms-and-privacy/',
  '/booking-confirmation/'
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];

(async () => {
  const browser = await chromium.launch();
  const allIssues = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    for (const p of PAGES) {
      await page.goto(BASE_URL + p, { waitUntil: 'load' });
      await page.waitForTimeout(200);

      const pageIssues = await page.evaluate(({ pagePath, vpName, vpWidth }) => {
        const issues = [];
        const R = e => e.getBoundingClientRect();
        const cs = e => window.getComputedStyle(e);
        const vis = e => {
          const r = R(e), s = cs(e);
          return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden';
        };

        // 1. Check card CTA bottom alignment in card grids
        const cardGrids = document.querySelectorAll('.pricing-grid, .price-grid, .lv-service-grid, .archive-grid, .journal-grid, .ip-service-grid, .lx-cards, .lx-grid');
        cardGrids.forEach(grid => {
          const cards = Array.from(grid.children).filter(vis);
          // Group cards by row (similar top)
          const rows = {};
          cards.forEach(card => {
            const topKey = Math.round(R(card).top / 16) * 16;
            if (!rows[topKey]) rows[topKey] = [];
            rows[topKey].push(card);
          });

          Object.entries(rows).forEach(([rowKey, rowCards]) => {
            if (rowCards.length > 1) {
              // check if cards have CTAs or bottom links
              const ctas = rowCards.map(c => {
                const btn = c.querySelector('button, a.btn, .btn, .text-link, .hp-link, [class*="action"]');
                return btn && vis(btn) ? R(btn).bottom : null;
              });
              const validCtas = ctas.filter(Boolean);
              if (validCtas.length > 1) {
                const maxCta = Math.max(...validCtas);
                const minCta = Math.min(...validCtas);
                if (maxCta - minCta > 12) {
                  issues.push({
                    type: 'unaligned-card-ctas',
                    grid: grid.className.slice(0, 40),
                    diff: Math.round(maxCta - minCta),
                    message: `Cards in same row have unaligned CTA buttons (${Math.round(maxCta - minCta)}px difference)`
                  });
                }
              }

              // Check if cards in same row have different heights
              const heights = rowCards.map(c => Math.round(R(c).height));
              const maxH = Math.max(...heights);
              const minH = Math.min(...heights);
              if (maxH - minH > 16) {
                issues.push({
                  type: 'unequal-card-heights',
                  grid: grid.className.slice(0, 40),
                  diff: maxH - minH,
                  message: `Cards in same row have unequal heights (diff: ${maxH - minH}px)`
                });
              }
            }
          });
        });

        // 2. Check heading & paragraph left alignment within copy blocks
        const copyBlocks = document.querySelectorAll('.lv-copy, .lx-col, .hp-section-head, .ip-section-heading, .lv-intro > div, .wj-closing-inner > div');
        copyBlocks.forEach(block => {
          const kids = Array.from(block.querySelectorAll(':scope > h1, :scope > h2, :scope > h3, :scope > p, :scope > .eyebrow, :scope > .hp-eyebrow')).filter(vis);
          if (kids.length > 1) {
            const lefts = kids.map(k => Math.round(R(k).left));
            const minL = Math.min(...lefts);
            const maxL = Math.max(...lefts);
            if (maxL - minL > 4) {
              issues.push({
                type: 'misaligned-text-block',
                block: block.className.slice(0, 40),
                diff: maxL - minL,
                message: `Headings/paragraphs within copy block are misaligned horizontally (diff: ${maxL - minL}px)`
              });
            }
          }
        });

        // 3. Check button vertical centering and alignment
        document.querySelectorAll('a.btn, button.btn, .btn').forEach(btn => {
          if (!vis(btn)) return;
          const s = cs(btn);
          if (s.display === 'inline-flex' || s.display === 'flex') {
            if (s.alignItems !== 'center') {
              issues.push({
                type: 'button-flex-not-centered',
                text: btn.textContent.trim().slice(0, 25),
                alignItems: s.alignItems
              });
            }
          }
        });

        // 4. Check typography consistency: font families
        const headings = document.querySelectorAll('#main h1, #main h2, #main h3');
        headings.forEach(h => {
          if (!vis(h)) return;
          const s = cs(h);
          if (!s.fontFamily.includes('Playfair') && !h.closest('.lv-think, .lv-stats, .wj-closing, .hp-eyebrow, .eyebrow')) {
            issues.push({
              type: 'non-playfair-heading',
              tag: h.tagName,
              text: h.textContent.trim().slice(0, 30),
              font: s.fontFamily.slice(0, 40)
            });
          }
        });

        // 5. Check image aspect ratios / distortion
        document.querySelectorAll('#main img').forEach(img => {
          if (!vis(img)) return;
          const r = R(img);
          const s = cs(img);
          // If image has explicit natural dimensions, check if squished (not object-fit cover/contain)
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            if (s.objectFit === 'fill' && Math.abs((r.width / r.height) - (img.naturalWidth / img.naturalHeight)) > 0.3) {
              issues.push({
                type: 'distorted-image',
                src: img.src.slice(0, 50),
                renderedRatio: (r.width / r.height).toFixed(2),
                naturalRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
              });
            }
          }
        });

        // 6. Check empty sections or whitespace (>200px gap)
        const allSections = Array.from(document.querySelectorAll('#main > section, #main > div, #main > article'));
        for (let i = 0; i < allSections.length - 1; i++) {
          if (!vis(allSections[i]) || !vis(allSections[i + 1])) continue;
          const ra = R(allSections[i]);
          const rb = R(allSections[i + 1]);
          const gap = Math.round(rb.top - ra.bottom);
          if (gap > 180) {
            issues.push({
              type: 'excessive-whitespace-gap',
              between: `${allSections[i].className.slice(0, 30)} -> ${allSections[i+1].className.slice(0, 30)}`,
              gap
            });
          }
        }

        return issues;
      }, { pagePath: p, vpName: vp.name, vpWidth: vp.width });

      if (pageIssues.length > 0) {
        console.log(`\n[PAGE ISSUE] ${p} @ ${vp.name}: ${pageIssues.length} issues`);
        pageIssues.forEach(iss => console.log(`   - ${iss.type}: ${iss.message || JSON.stringify(iss)}`));
        allIssues.push({ page: p, viewport: vp.name, issues: pageIssues });
      }
    }
    await page.close();
  }

  await browser.close();
  fs.writeFileSync('test-results/deep-audit-issues.json', JSON.stringify(allIssues, null, 2));
  console.log('\nDeep audit complete! Saved to test-results/deep-audit-issues.json');
})();

