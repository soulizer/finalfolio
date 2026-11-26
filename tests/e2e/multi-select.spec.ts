import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

const status = {
  enabled: true,
  prompt: 'Mock prompt for AI arrangement.',
  maxImages: 50,
  userTotalLimit: 5,
  dailyLimit: 2,
  usage: { total: 0, daily: 0, day: '2026-11-17' },
  remaining: { total: 5, daily: 2 },
};

const photoBuffer = () => fs.readFileSync('public/icon-192.png');

/**
 * The editor paints the project's photos first and then merges the account
 * library asynchronously. Counting tiles before that merge undercounts the
 * library, and every later `before + n` assertion drifts. Wait until the tile
 * count stops moving before measuring anything.
 */
async function waitForLibrary(page: import('@playwright/test').Page) {
  let previous = -1;
  await expect
    .poll(
      async () => {
        const count = await page.locator('.asset-tile').count();
        const stable = count === previous;
        previous = count;
        return stable;
      },
      { intervals: [250], timeout: 20_000 },
    )
    .toBe(true);
  return page.locator('.asset-tile').count();
}

async function uploadPhotos(page: import('@playwright/test').Page, count: number, prefix: string) {
  const input = page.locator('.editor-panel--photos input[type="file"]');
  const before = await waitForLibrary(page);
  for (let index = 0; index < count; index += 1) {
    // The input disables itself while the previous upload is still running.
    await expect(input).toBeEnabled();
    await input.setInputFiles({
      name: `${prefix}-${index}.png`,
      mimeType: 'image/png',
      buffer: photoBuffer(),
    });
    await expect(page.locator('.asset-tile')).toHaveCount(before + index + 1, { timeout: 20_000 });
  }
  return before + count;
}

test('gallery selection works without a mode toggle', async ({ page }) => {
  await signIn(page, '/editor');
  await uploadPhotos(page, 7, 'pick');

  // Non-ASCII filenames survive multipart decoding; this used to render as
  // mojibake because the header was read as latin1.
  const input = page.locator('.editor-panel--photos input[type="file"]');
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name: '晨雾中的山谷.png', mimeType: 'image/png', buffer: photoBuffer() });
  await expect(page.locator('.asset-tile').filter({ hasText: '晨雾中的山谷' })).toHaveCount(1);

  const removed = 6;
  const ownCount = 7;

  const tiles = page.locator('.asset-tile');
  const photosPanel = page.locator('.editor-panel--photos');
  const search = page.getByLabel('Search photos');

  // The old "Select" mode entry point is gone, and nothing is pre-selected.
  await expect(photosPanel.getByRole('button', { name: 'Select', exact: true })).toHaveCount(0);
  await expect(page.locator('.asset-batch-bar')).toHaveCount(0);

  // Scope the test to its own photos so it never deletes assets other specs
  // created in the shared library.
  await search.fill('pick-');
  await expect(tiles).toHaveCount(ownCount);

  // A plain click assigns the photo to a frame; it must not start a selection.
  await tiles.first().locator('.asset-tile__main').click();
  await expect(page.locator('.asset-batch-bar')).toHaveCount(0);

  // The pick control appears on hover and starts the selection.
  await tiles.first().hover();
  await tiles.first().getByRole('button', { name: 'Select for bulk actions' }).click();
  await expect(page.locator('.asset-batch-bar')).toContainText('1 selected');
  await expect(tiles.first()).toHaveClass(/is-picked/);

  // Selection is the check control only; no extra ink border or inset ring.
  const pickedStyle = await tiles.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderColor: style.borderColor, boxShadow: style.boxShadow };
  });
  expect(pickedStyle.borderColor).not.toBe('rgb(17, 17, 17)');
  expect(pickedStyle.boxShadow).not.toContain('2px inset');
  expect(pickedStyle.boxShadow).not.toContain('1px inset');

  // Shift extends the range from the first pick, Ctrl removes one tile.
  await tiles.nth(ownCount - 1).click({ modifiers: ['Shift'] });
  await expect(page.locator('.asset-batch-bar')).toContainText(`${ownCount} selected`);
  await tiles.nth(1).click({ modifiers: ['Control'] });
  await expect(page.locator('.asset-batch-bar')).toContainText(`${ownCount - 1} selected`);

  // The selection stays intact while the search filter changes.
  await search.fill('pick-0');
  await expect(tiles).toHaveCount(1);
  await expect(page.locator('.asset-batch-bar')).toContainText(`${ownCount - 1} selected`);
  await search.fill('pick-');
  await expect(tiles).toHaveCount(ownCount);

  // Trash deletes the picked photos after the shared confirmation dialog.
  await page.locator('.asset-batch-bar').getByRole('button', { name: 'Delete selected photos' }).click();
  const dialog = page.locator('.confirm-dialog');
  await expect(dialog).toContainText(`Delete ${removed} photos from every folio and the library?`);
  await dialog.getByRole('button', { name: 'Delete photos' }).click();
  await expect(tiles).toHaveCount(ownCount - removed, { timeout: 20_000 });
  await expect(page.locator('.asset-batch-bar')).toHaveCount(0);
});

test('AI arrangement selects photos with Shift, Ctrl and a rubber band', async ({ page }) => {
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: status }));
  await signIn(page, '/editor');
  const total = await uploadPhotos(page, 4, 'ai-pick');
  expect(total).toBeGreaterThanOrEqual(4);

  await page.getByRole('button', { name: 'Lay out with AI' }).click();
  const dialog = page.locator('.ai-dialog');
  await expect(dialog).toBeVisible();
  const items = dialog.locator('.ai-library-item');
  await expect(items).toHaveCount(total);

  // The account-library refresh (4s interval while uploads reconcile) replaces
  // the list with the server's updatedAt-desc order, which can prepend the
  // newest photo after the dialog opens — a click resolved before that would
  // anchor a Shift range at a stale index. Wait until the newest upload sits
  // first, which is exactly the final server order, so no later refresh can
  // reorder the grid mid-interaction.
  await expect(items.first()).toContainText('ai-pick-3', { timeout: 20_000 });
  const counter = dialog.locator('.ai-photo-actions .panel-tag');
  const selectedCount = () => dialog.locator('.ai-library-item.is-selected').count();

  await items.nth(0).click();
  await expect.poll(selectedCount).toBe(1);

  // Shift picks the first photo through the fourth in one gesture.
  await items.nth(3).click({ modifiers: ['Shift'] });
  await expect.poll(selectedCount).toBe(4);

  // Ctrl removes a single photo from the middle of the range.
  await items.nth(1).click({ modifiers: ['Control'] });
  await expect.poll(selectedCount).toBe(3);
  await expect(counter).toHaveText(/^3\/\d+$/);

  // Rubber-band selection adds every photo the rectangle touches, and the drag
  // must not leave behind a stray click that would toggle a tile. The rectangle
  // only covers the first three tiles, so photos outside it stay untouched.
  const grid = dialog.locator('.ai-library-grid');
  const box = await grid.boundingBox();
  expect(box).not.toBeNull();
  const bandEnd = await items.nth(2).boundingBox();
  expect(bandEnd).not.toBeNull();
  const dragBand = async () => {
    await page.mouse.move(box!.x + 4, box!.y + 4);
    await page.mouse.down();
    await page.mouse.move(bandEnd!.x + bandEnd!.width - 2, bandEnd!.y + bandEnd!.height - 2, { steps: 10 });
    await page.mouse.up();
  };

  await dragBand();
  await expect.poll(selectedCount).toBe(4);

  // A drag that stops on a tile keeps the selection instead of toggling it off.
  await items.nth(2).click({ modifiers: ['Control'] });
  await expect.poll(selectedCount).toBe(3);
  await dragBand();
  await expect.poll(selectedCount).toBe(4);
});
