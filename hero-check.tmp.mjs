import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })).newPage();
await page.addInitScript(() => localStorage.setItem('finalfolio-locale', 'zh'));
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const info = await page.evaluate(() => {
  const h1 = document.querySelector('.hero h1');
  const cs = getComputedStyle(h1);
  const lh = Number.parseFloat(cs.lineHeight);
  return { text: h1.textContent, fs: cs.fontSize, lh, width: h1.getBoundingClientRect().width, lines: Math.round(h1.getBoundingClientRect().height / lh), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
console.log(JSON.stringify(info));
await page.screenshot({ path: '/tmp/opencode/shots/hero-zh-after.png' });
await browser.close();
