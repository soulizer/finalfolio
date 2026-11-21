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

const importedAsset = {
  id: 'upload-unalbum-1',
  name: '山间-0',
  src: '/icon-192.png',
  note: '',
  width: 1600,
  height: 1067,
  bytes: 240000,
  analysis: {
    description: '晨雾中的山谷，远处有一排松树。',
    tags: ['山谷', '晨雾', '松树'],
    source: 'unalbum',
  },
};

test('UnAlbum stays hidden when the server is not configured', async ({ page }) => {
  await signIn(page, '/editor');
  await expect(page.locator('.editor-panel--photos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add from UnAlbum' })).toHaveCount(0);

  const status = await page.request.get('/api/unalbum/status');
  expect(status.ok()).toBe(true);
  expect(await status.json()).toEqual({ configured: false, bound: false, account: null });
});

test('gallery imports photos from a connected UnAlbum account', async ({ page }) => {
  await page.route('**/api/unalbum/status', (route) =>
    route.fulfill({ json: { configured: true, bound: true, account } }),
  );
  await page.route('**/api/unalbum/photos**', (route) =>
    route.fulfill({
      json: { photos: [unalbumPhoto(0, 'ready'), unalbumPhoto(1, 'pending')], nextCursor: null, account },
    }),
  );
  await page.route('**/api/unalbum/import', async (route) => {
    const body = route.request().postDataJSON() as { ids: string[] };
    expect(body.ids).toEqual(['ua-0']);
    await route.fulfill({ json: { assets: [importedAsset] } });
  });

  await signIn(page, '/editor');
  await page.getByRole('button', { name: 'Add from UnAlbum' }).click();

  const dialog = page.locator('.unalbum-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Signed in as @lumen');
  const tiles = dialog.locator('.unalbum-tile');
  await expect(tiles).toHaveCount(2);
  // Upstream analysis is surfaced so it is clear no re-analysis will happen,
  // and photos still being analysed are labelled instead of pretending to be
  // ready.
  await expect(tiles.nth(0).locator('.unalbum-tile__tag')).toHaveText('Analyzed');
  await expect(tiles.nth(1).locator('.unalbum-tile__tag')).toHaveText('Analyzing');

  await tiles.nth(0).click();
  await expect(dialog.getByRole('button', { name: 'Add 1 photo' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Add 1 photo' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.asset-tile').filter({ hasText: '山间-0' })).toHaveCount(1);
  await expect(page.locator('.editor-shell')).toContainText('Added 1 photo from UnAlbum.');
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
