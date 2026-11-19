import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4177';
const routes = [
  ['/', 'home'],
  ['/auth?next=%2Faccount', 'auth'],
  ['/account', 'account'],
  ['/editor', 'editor'],
  ['/admin', 'admin'],
];
const viewports = [
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 1000, isMobile: false, hasTouch: false },
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const report = {};

async function settle(page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1600);
}

for (const scheme of ['light', 'dark']) {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      deviceScaleFactor: 1,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE}/auth?next=%2Faccount`);
    await page.getByLabel('Email or username').fill('e2e-admin@example.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((u) => !u.pathname.includes('auth'), { timeout: 20000 });

    for (const [route, name] of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(700);
      if (name === 'editor') {
        await page.locator('.editor-panel').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      }
      await settle(page);
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right > vw + 1.5 || rect.left < -1.5) {
            const style = getComputedStyle(el);
            if (style.position === 'fixed' || style.visibility === 'hidden') continue;
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 2).join('.') : '',
              right: Math.round(rect.right),
            });
          }
        }
        const hiddenReveal = Array.from(document.querySelectorAll('[data-reveal]')).filter(
          (el) => getComputedStyle(el).opacity !== '1',
        ).length;
        return { viewport: vw, scrollWidth: doc.scrollWidth, overflow: doc.scrollWidth - vw, hiddenReveal, offenders: offenders.slice(0, 5) };
      });
      report[`${scheme}:${viewport.name}:${name}`] = { ...metrics, errors: [...errors] };
      await page.screenshot({
        path: `/tmp/opencode/shots/final-${scheme}-${viewport.name}-${name}.png`,
        fullPage: false,
      });
    }
    await context.close();
  }
}

const zhContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const zhPage = await zhContext.newPage();
await zhPage.addInitScript(() => localStorage.setItem('finalfolio-locale', 'zh'));
await zhPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await settle(zhPage);
await zhPage.screenshot({ path: '/tmp/opencode/shots/final-zh-home-full.png', fullPage: true });
report.zh = await zhPage.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const fs = Number.parseFloat(cs.fontSize);
    const lh = Number.parseFloat(cs.lineHeight);
    return { ratio: Math.round((lh / fs) * 100) / 100 };
  };
  return {
    h1: pick('.hero h1'),
    h2: pick('.product-brief__intro h2'),
    feature: pick('.feature-card h2'),
    quote: pick('.quote-panel h2'),
  };
});
await zhContext.close();

console.log(JSON.stringify(report, null, 1));
await browser.close();
