import { chromium } from 'playwright';
import fs from 'node:fs';
const base = 'http://127.0.0.1:4198';
const account = { id: '42', username: 'lumen', displayName: '', avatarUrl: '', boundAt: null };
const photo = { id: 'ua-0', filename: 'a.jpg', name: '山间-0', width: 1600, height: 1067, bytes: 1, createdAt: null, analysis: { status: 'ready', description: '山谷', tags: ['山'] }, variants: { original: { url: '/icon-192.png' }, preview: { url: '/icon-192.png' }, thumb: { url: '/icon-192.png' } } };
const imported = { id: 'upload-badge', name: '山间-0', src: '/icon-192.png', note: '', width: 1600, height: 1067, unalbumId: 'ua-0', analysis: { description: '山谷', tags: ['山'], source: 'unalbum' } };
const image = fs.readFileSync('public/icon-192.png');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
await page.addInitScript(() => localStorage.setItem('finalfolio-locale', 'zh'));
await page.route('**/api/ai/status', (r) => r.fulfill({ json: { enabled: true, prompt: 'p', maxImages: 50, userTotalLimit: 9, dailyLimit: 9, usage: { total: 0, daily: 0, day: '2026-11-21' }, remaining: { total: 9, daily: 9 } } }));
await page.route('**/api/unalbum/status', (r) => r.fulfill({ json: { configured: true, bound: true, account } }));
await page.route('**/api/unalbum/photos**', (r) => r.fulfill({ json: { photos: [photo], nextCursor: null, account } }));
await page.route('**/api/unalbum/thumb/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: image }));
await page.route('**/api/unalbum/import', (r) => r.fulfill({ json: { assets: [imported] } }));
await page.goto(`${base}/auth?next=%2Feditor`);
await page.locator('.auth-form input[autocomplete="username"]').fill('e2e-user@example.com');
await page.locator('.auth-form input[autocomplete="current-password"]').fill('Password123!');
await page.locator('.auth-form button[type="submit"]').click();
await page.waitForURL((u) => u.pathname.startsWith('/editor'), { timeout: 20000 });
await page.waitForTimeout(1400);
await page.locator('.editor-project-action--ai').click();
await page.locator('.ai-dialog').waitFor();
await page.waitForTimeout(800);
await page.locator('.ai-library-item--remote').first().click();
await page.waitForTimeout(1200);
const metrics = await page.evaluate(() => {
  const badge = document.querySelector('.ai-library-item__tag');
  if (!badge) return null;
  const pill = badge.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(badge);
  const text = range.getBoundingClientRect();
  const style = getComputedStyle(badge);
  return {
    pill: { top: pill.top, height: pill.height, width: pill.width },
    text: { top: text.top, height: text.height },
    topGap: text.top - pill.top,
    bottomGap: pill.bottom - text.bottom,
    lineHeight: style.lineHeight,
    fontSize: style.fontSize,
    display: style.display,
  };
});
console.log(metrics);
const badge = page.locator('.ai-library-item__tag').first();
await badge.screenshot({ path: 'docs/evidence/2026-11-21-badge-closeup.png', scale: 'css' });
await page.locator('.ai-library-item').first().screenshot({ path: 'docs/evidence/2026-11-21-ai-badge.png' });
await browser.close();
