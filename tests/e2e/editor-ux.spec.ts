import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('editor leads with photos and the new layout picker', async ({ page }) => {
  await signIn(page, '/editor');

  // Photos panel now leads the content sidebar.
  const sidebarSections = page.locator('.editor-sidebar--content > .editor-panel');
  await expect(sidebarSections.first()).toHaveClass(/editor-panel--photos/);

  // URL import is available behind a compact toggle and validates empty input.
  await page.getByRole('button', { name: 'Add from URL' }).click();
  const importForm = page.locator('.import-url-form');
  await expect(importForm).toBeVisible();
  await expect(importForm.getByRole('button', { name: /Import/ })).toBeDisabled();

  // The layout picker renders A4-proportion schematics, three per row.
  await expect(page.locator('.layout-card').first()).toBeVisible();
  const thumbRatio = await page.locator('.layout-thumb__page').first().evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width / rect.height;
  });
  expect(Math.abs(thumbRatio - 210 / 297)).toBeLessThan(0.02);

  // Hovering a layout exposes the two direct actions.
  const secondCard = page.locator('.layout-card').nth(1);
  await secondCard.hover();
  await expect(secondCard.getByRole('button', { name: 'Replace this page' })).toBeVisible();
  await expect(secondCard.getByRole('button', { name: 'Add page below' })).toBeVisible();

  // Per-page paper colour popover opens next to the dot with round swatches.
  const firstDot = page.locator('.page-chip__dot').first();
  await expect(firstDot).toBeVisible();
  await firstDot.click();
  const popover = page.locator('.page-color-popover');
  await expect(popover).toBeVisible();
  const radius = await popover
    .locator('.page-color-popover__swatch')
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius === '999px' || radius === '50%').toBeTruthy();
  await popover.locator('.page-color-popover__swatch').nth(2).click();
  await expect(popover).toHaveCount(0);
});

test('applying a layout from the card keeps the current page and adds pages below', async ({ page }) => {
  await signIn(page, '/editor');

  const pageChips = page.locator('.page-chip');
  await expect(pageChips.first()).toBeVisible();
  const initialCount = await pageChips.count();

  const gridCard = page.locator('.layout-card').nth(3);
  await gridCard.hover();
  await gridCard.getByRole('button', { name: 'Add page below' }).click();
  await expect(pageChips).toHaveCount(initialCount + 1);

  const essayCard = page.locator('.layout-card').nth(1);
  await essayCard.hover();
  await essayCard.getByRole('button', { name: 'Replace this page' }).click();
  await expect(page.locator('.layout-card').nth(1)).toHaveClass(/is-active/);
});

test('pages can be reordered by dragging', async ({ page }) => {
  await signIn(page, '/editor');

  const chips = page.locator('.page-chip');
  await expect(chips.first()).toBeVisible();
  const movedTitle = await chips.first().locator('.page-chip__main strong').innerText();

  await chips.first().locator('.page-chip__main').dragTo(chips.nth(2));
  await expect(chips.nth(2)).toContainText(movedTitle);
});

test('typing directly on the page commits copy without a popover', async ({ page }) => {
  await signIn(page, '/editor');

  const heading = page.locator('.magazine-sheet--editor h2 .magazine-editable').first();
  await expect(heading).toHaveAttribute('contenteditable', 'true');
  await heading.click();
  await page.keyboard.press('ControlOrMeta+a');
  const marker = `Inline edit ${Date.now()}`;
  await page.keyboard.type(marker);
  await page.keyboard.press('Escape');
  await expect(page.locator('.text-edit-popover')).toHaveCount(0);
  await expect(page.locator('.magazine-sheet--editor h2')).toContainText(marker);

  // The panel field reflects the in-place edit.
  const titleField = page.locator('label:has(span:text-is("Title")) textarea').first();
  await expect(titleField).toHaveValue(marker);
});

test('language toggle switches the editor and homepage to Chinese', async ({ page }) => {
  await signIn(page, '/');
  await page.getByRole('button', { name: '切换到中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('link', { name: '开始创作' }).first()).toBeVisible();

  await page.goto('/editor');
  await expect(page.getByText('页面顺序').first()).toBeVisible();
  await expect(page.getByText('照片').first()).toBeVisible();
  await expect(page.getByText('页面排版').first()).toBeVisible();

  // Persisted choice survives a reload.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});
