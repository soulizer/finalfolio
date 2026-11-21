import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

const account = {
  id: '42',
  username: 'lumen',
  displayName: 'Lumen Studio',
  avatarUrl: '',
  boundAt: '2026-11-20T08:00:00.000Z',
};

const unalbumPhoto = (index: number, analysis: 'ready' | 'pending' | null) => ({
  id: `ua-${index}`,
  filename: `ua-${index}.jpg`,
  name: `山间-${index}`,
  width: 1600,
  height: 1067,
  bytes: 240000,
  createdAt: '2026-11-19T10:00:00.000Z',
  analysis:
    analysis === 'ready'
      ? {
          status: 'ready',
          description: '晨雾中的山谷，远处有一排松树。',
          tags: ['山谷', '晨雾', '松树'],
          source: 'unalbum',
          analyzedAt: '2026-11-19T10:05:00.000Z',
        }
      : analysis === 'pending'
        ? { status: 'pending', description: '', tags: [] }
        : null,
  variants: {
    original: { url: '/icon-192.png', width: 1600, height: 1067, mimeType: 'image/png' },
    preview: { url: '/icon-192.png' },
    thumb: { url: '/icon-192.png' },
  },
});

const importedAsset = (id: string, name: string) => ({
  id: `upload-${id}`,
  name,
  src: '/icon-192.png',
  note: '',
  width: 1600,
  height: 1067,
  bytes: 240000,
  unalbumId: id,
  analysis: {
    description: '晨雾中的山谷，远处有一排松树。',
    tags: ['山谷', '晨雾', '松树'],
    source: 'unalbum',
  },
});

async function mockUnalbumPage(page: import('@playwright/test').Page) {
  const image = fs.readFileSync('public/icon-192.png');
  await page.route('**/api/unalbum/status', (route) =>
    route.fulfill({ json: { configured: true, bound: true, account } }),
  );
  await page.route('**/api/unalbum/photos**', (route) =>
    route.fulfill({
      json: { photos: [unalbumPhoto(0, 'ready'), unalbumPhoto(1, 'pending')], nextCursor: null, account },
    }),
  );
  await page.route('**/api/unalbum/thumb/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: image }),
  );
  await page.route('**/api/unalbum/import', async (route) => {
    const body = route.request().postDataJSON() as { ids: string[] };
    const id = body.ids[0];
    const name = id === 'ua-0' ? '山间-0' : '山间-1';
    await route.fulfill({ json: { assets: [importedAsset(id, name)] } });
  });
}

test('UnAlbum stays hidden when the server is not configured', async ({ page }) => {
  await signIn(page, '/editor');
  await expect(page.locator('.editor-panel--photos')).toBeVisible();
  await expect(page.locator('.asset-tile--remote')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add from UnAlbum' })).toHaveCount(0);

  const status = await page.request.get('/api/unalbum/status');
  expect(status.ok()).toBe(true);
  expect(await status.json()).toEqual({ configured: false, bound: false, account: null });
});

test('published UnAlbum photos appear directly in the gallery and import on click', async ({ page }) => {
  await mockUnalbumPage(page);
  await signIn(page, '/editor');

  // No extra entry point: the photos are in the media library itself.
  const remote = page.locator('.asset-tile--remote');
  await expect(remote).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Add from UnAlbum' })).toHaveCount(0);
  await expect(page.locator('.unalbum-dialog')).toHaveCount(0);
  await expect(remote.first()).toContainText('From UnAlbum');
  await expect(remote.first().locator('img')).toHaveAttribute('src', /\/api\/unalbum\/thumb\/ua-0/);

  await remote.first().locator('.asset-tile__main').click();
  await expect(
    page.locator('.asset-tile').filter({ hasNot: page.locator('.asset-tile--remote') }).filter({ hasText: '山间-0' }),
  ).toHaveCount(1);
  await expect(remote).toHaveCount(1);
});

test('AI arrangement lists UnAlbum photos inline and imports on selection', async ({ page }) => {
  await page.route('**/api/ai/status', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        prompt: 'Mock prompt.',
        maxImages: 50,
        userTotalLimit: 5,
        dailyLimit: 2,
        usage: { total: 0, daily: 0, day: '2026-11-20' },
        remaining: { total: 5, daily: 2 },
      },
    }),
  );
  await mockUnalbumPage(page);
  await signIn(page, '/editor');
  await expect(page.locator('.asset-tile--remote')).toHaveCount(2);

  await page.locator('.editor-project-action--ai').click();
  const dialog = page.locator('.ai-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Use photos from UnAlbum' })).toHaveCount(0);

  const remote = dialog.locator('.ai-library-item--remote');
  await expect(remote).toHaveCount(2);
  await remote.first().click();
  await expect(dialog.locator('.ai-library-item.is-selected').filter({ hasText: '山间-0' })).toHaveCount(1);
  await expect(remote).toHaveCount(1);
});

test('auth page offers UnAlbum sign-in only when configured', async ({ page }) => {
  await page.route('**/api/unalbum/status', (route) =>
    route.fulfill({ json: { configured: true, bound: false, account: null } }),
  );
  await page.route('**/api/unalbum/login', (route) =>
    route.fulfill({ json: { authorizeUrl: 'https://unalbum.example/oauth/authorize?state=test' } }),
  );
  await page.route('https://unalbum.example/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>UnAlbum authorize</title>ok' }),
  );

  await page.goto('/auth');
  const button = page.getByRole('button', { name: 'Sign in with UnAlbum' });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page).toHaveURL(/unalbum\.example\/oauth\/authorize/);
});
