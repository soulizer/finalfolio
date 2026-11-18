import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './server/app.js';
import { chromium } from './node_modules/playwright/index.mjs';

const tempRoot = '/tmp/opencode/direct-ui';
fs.rmSync(tempRoot, { recursive: true, force: true });
fs.cpSync('/opt/finalfolio/app/data/site', path.join(tempRoot, 'site'), { recursive: true });
fs.cpSync('/opt/finalfolio/app/data/security', path.join(tempRoot, 'security'), { recursive: true });
const app = createApp({ dataRoot: tempRoot, distDir: path.join(process.cwd(), 'dist'), port: 0 });
const server = await app.start();
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const user = await app.authStore.createUser({ email: 'direct-ui@example.com', password: 'Password123!' }, { acceptCurrentTerms: true, termsAcceptedLanguage: 'en' });
  const token = await app.authStore.issueVerificationToken(user.id);
  await app.authStore.verifyUserWithToken(token.id);
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,200)));
  p.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,200)); });
  p.on('response', async r => { const u=r.url(); if (u.includes('/api/uploads')) console.log('API', r.request().method(), u.slice(base.length), r.status()); });
  await p.goto(base + '/auth');
  await p.locator('input[autocomplete="username"]').fill('direct-ui@example.com');
  await p.locator('input[autocomplete="current-password"]').fill('Password123!');
  await p.locator('button[type="submit"]').first().click();
  await p.waitForTimeout(1200);
  await p.goto(base + '/editor', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
  await p.locator('.editor-panel--photos input[type="file"]').setInputFiles([{ name: 'direct.png', mimeType: 'image/png', buffer: png }]);
  await p.waitForTimeout(8000);
  console.log('tiles:', await p.locator('.asset-tile').count());
  console.log('messages:', await p.locator('.editor-shell').innerText().then(t=>t.slice(0,400)));
  await p.screenshot({ path: '/tmp/opencode/shots/direct-ui.png' });
  await b.close();
} finally {
  await new Promise(r => server.close(() => r()));
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
