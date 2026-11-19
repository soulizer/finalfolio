import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
await page.addInitScript(() => localStorage.setItem('finalfolio-locale', 'zh'));
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle' });
for (let y = 0; y < 6500; y += 700) { await page.evaluate((t) => window.scrollTo(0, t), y); await page.waitForTimeout(90); }
await page.waitForTimeout(1200);
const data = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight === 'normal' ? null : Number.parseFloat(cs.lineHeight);
    const fs = Number.parseFloat(cs.fontSize);
    return { text: (el.textContent || '').trim().slice(0, 26), fs: Math.round(fs * 10) / 10, lh: lh ? Math.round(lh * 10) / 10 : null, ratio: lh ? Math.round((lh / fs) * 100) / 100 : null, lines: Math.round(el.getBoundingClientRect().height / (lh || fs)) };
  };
  return {
    'hero h1': pick('.hero h1'),
    'hero lede': pick('.hero__lede'),
    'editorial note': pick('.editorial-note p'),
    'feature h2': pick('.feature-card h2'),
    'feature p': pick('.feature-card p'),
    'brief h2': pick('.product-brief__intro h2'),
    'brief p': pick('.product-brief__intro > p:last-child'),
    'brief card title': pick('.product-brief-card strong'),
    'brief card copy': pick('.product-brief-card p'),
    'workflow h2': pick('.split-panel__copy h2'),
    'workflow p': pick('.split-panel__copy > p'),
    'workflow li': pick('.workflow-list li'),
    'quote h2': pick('.quote-panel h2'),
    'quote p': pick('.quote-panel > p'),
    'cta h2': pick('.cta-panel h2'),
    'cta p': pick('.cta-panel > div > p'),
    'footnote': pick('.site-legal-footer__note'),
    'proof caption': pick('.hero-proof__caption strong'),
    'page h2': pick('.hero-proof .magazine-page h2'),
  };
});
console.log(JSON.stringify(data, null, 1));
await browser.close();
