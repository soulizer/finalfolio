import fs from 'node:fs';
import path from 'node:path';
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

  // Selecting a layout exposes the three placement actions.
  await page.locator('.layout-card').nth(1).locator('.layout-card__pick').click();
  const layoutActions = page.locator('.layout-selection-actions');
  await expect(layoutActions.getByRole('button', { name: 'Insert above' })).toBeVisible();
  await expect(layoutActions.getByRole('button', { name: 'Replace this page' })).toBeVisible();
  await expect(layoutActions.getByRole('button', { name: 'Insert below' })).toBeVisible();

  // Per-page paper colour popover opens next to the dot with round swatches.
  const firstDot = page.locator('.page-chip__color-action').first();
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

test('a failed URL import keeps the URL so it can be retried', async ({ page }) => {
  await signIn(page, '/editor');
  await page.route('**/api/uploads/from-url', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unable to fetch this image.' }),
    }),
  );

  await page.getByRole('button', { name: 'Add from URL' }).click();
  const form = page.locator('.import-url-form');
  const field = form.getByLabel('Add from URL');
  await field.fill('https://example.com/missing.jpg');
  await form.getByRole('button', { name: /Import/ }).click();

  // The failure is reported, but the row stays open with the URL intact so
  // the same import can be retried without re-pasting it.
  await expect(page.locator('.panel-note--status')).toContainText('Unable to fetch this image.');
  await expect(form).toBeVisible();
  await expect(field).toHaveValue('https://example.com/missing.jpg');
});

test('saved layouts share the layout grid and fold behind More layouts', async ({ page }) => {
  await signIn(page, '/editor');

  const commonGrid = page.locator('.layout-grid').first();
  await expect(commonGrid.locator('.layout-card').first()).toBeVisible();
  const commonCount = await commonGrid.locator('.layout-card').count();
  expect(commonCount).toBe(6);

  // Saved layouts use the same A4 cards as the built-in layouts.
  const customCard = page.locator('.layout-card--custom').first();
  await expect(customCard).toBeVisible();
  await expect(customCard.locator('.layout-thumb--custom')).toBeVisible();

  const moreButton = page.getByRole('button', { name: /More layouts/ });
  await expect(moreButton).toBeVisible();
  await moreButton.click();
  await expect(page.getByRole('button', { name: 'Show fewer layouts' })).toBeVisible();
  expect(await page.locator('.layout-card').count()).toBeGreaterThan(commonCount);

  await page.getByRole('button', { name: 'Show fewer layouts' }).click();
  expect(await page.locator('.layout-card').count()).toBe(commonCount);
});

test('custom layouts can be renamed and the name persists', async ({ page }) => {
  await signIn(page, '/editor');

  const customCard = page.locator('.layout-card--custom').first();
  await customCard.locator('.layout-card__pick').click();
  await page.locator('.layout-selection-actions').getByRole('button', { name: 'Edit layout' }).click();

  const dialog = page.locator('.layout-editor-dialog');
  await expect(dialog).toBeVisible();
  const nameInput = dialog.locator('label:has(span:text-is("Template name")) input');
  const nextName = `Studio Notes ${Date.now()}`;
  await nameInput.fill(nextName);
  await dialog.getByRole('button', { name: 'Save layout' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.layout-card__name', { hasText: nextName })).toBeVisible();

  await page.reload();
  await expect(page.locator('.layout-card__name', { hasText: nextName })).toBeVisible();
});

test('saving a new custom layout adds it to the visible grid', async ({ page }) => {
  await signIn(page, '/editor');

  await page.getByRole('button', { name: 'New custom layout' }).click();
  const dialog = page.locator('.layout-editor-dialog');
  await expect(dialog).toBeVisible();

  const nameInput = dialog.locator('label:has(span:text-is("Template name")) input');
  await nameInput.fill('Fresh Layout');
  await dialog.getByRole('button', { name: 'Save layout' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.layout-grid').first().locator('.layout-card__name', { hasText: 'Fresh Layout' })).toBeVisible();
});

test('layout editor warns before discarding unsaved edits', async ({ page }) => {
  await signIn(page, '/editor');

  await page.locator('.layout-card--custom').first().locator('.layout-card__pick').click();
  await page.locator('.layout-selection-actions').getByRole('button', { name: 'Edit layout' }).click();
  const dialog = page.locator('.layout-editor-dialog');
  await expect(dialog).toBeVisible();

  const nameInput = dialog.locator('label:has(span:text-is("Template name")) input');
  await nameInput.fill('Draft name');
  await dialog.getByRole('button', { name: 'Close' }).click();

  const confirm = page.locator('.confirm-dialog');
  await expect(confirm).toContainText('Discard unsaved layout changes?');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeVisible();
});

test('inserting a saved layout keeps the layout selected', async ({ page }) => {
  await signIn(page, '/editor');

  const customCard = page.locator('.layout-card--custom').first();
  await customCard.locator('.layout-card__pick').click();
  await page.locator('.layout-selection-actions').getByRole('button', { name: 'Insert below' }).click();

  await expect(page.locator('.layout-selection-actions').getByRole('button', { name: 'Edit layout' })).toBeVisible();
  await expect(page.locator('.layout-card--custom.is-active')).toHaveCount(1);
});

test('custom layouts can be deleted without touching the current page', async ({ page }) => {
  await signIn(page, '/editor');

  const customCard = page.locator('.layout-card--custom').first();
  const name = (await customCard.locator('.layout-card__name').innerText()).trim();
  await customCard.locator('.layout-card__pick').click();
  await page.locator('.layout-selection-actions').getByRole('button', { name: 'Edit layout' }).click();

  const dialog = page.locator('.layout-editor-dialog');
  await dialog.getByRole('button', { name: 'Delete layout' }).click();
  const confirm = page.locator('.confirm-dialog');
  await expect(confirm).toContainText('Delete this layout?');
  await confirm.getByRole('button', { name: 'Delete layout' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.layout-card__name', { hasText: name })).toHaveCount(0);
});

test('applying a layout from the card keeps the current page and adds pages below', async ({ page }) => {
  await signIn(page, '/editor');

  const pageChips = page.locator('.page-chip');
  await expect(pageChips.first()).toBeVisible();
  const initialCount = await pageChips.count();

  const gridCard = page.locator('.layout-card').nth(3);
  await gridCard.locator('.layout-card__pick').click();
  await page.locator('.layout-selection-actions').getByRole('button', { name: 'Insert below' }).click();
  await expect(pageChips).toHaveCount(initialCount + 1);

  const essayCard = page.locator('.layout-card').nth(1);
  await essayCard.locator('.layout-card__pick').click();
  await page.locator('.layout-selection-actions').getByRole('button', { name: 'Replace this page' }).click();
  await expect(page.locator('.layout-card').nth(1)).toHaveClass(/is-active/);
});

test('empty frame upload CTA assigns the chosen photo', async ({ page }) => {
  await signIn(page, '/editor');

  const cta = page.locator('.asset-slot__upload').first();
  await expect(cta).toBeVisible();
  await cta.click();
  await page.locator('input[type="file"][hidden]').setInputFiles({
    name: 'quick-upload.png',
    mimeType: 'image/png',
    buffer: fs.readFileSync(path.resolve('public/icon-192.png')),
  });
  await expect(page.locator('.asset-frame[data-has-asset="true"]').first()).toBeVisible();
});

test('pages can be reordered by dragging', async ({ page }) => {
  await signIn(page, '/editor');

  const chips = page.locator('.page-chip');
  await expect(chips.first()).toBeVisible();
  const movedTitle = await chips.first().locator('.page-chip__title').innerText();

  // Dropping on the right half inserts after the hovered page; the strip shows
  // a gap at the insertion point while dragging.
  await chips.first().locator('.page-chip__select').dragTo(chips.nth(2), {
    targetPosition: { x: 170, y: 40 },
  });
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

test('every built-in layout commits in-place copy without a popover', async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, '/editor');

  const moreLayouts = page.getByRole('button', { name: /More layouts/ });
  if (await moreLayouts.isVisible().catch(() => false)) {
    await moreLayouts.click();
  }
  const cards = page.locator('.layout-grid .layout-card');
  const names = await cards.locator('.layout-card__name').allInnerTexts();
  expect(names.length).toBeGreaterThanOrEqual(6);

  for (const [index, name] of names.entries()) {
    const card = cards.nth(index);
    await card.locator('.layout-card__pick').click();
    const replace = page.locator('.layout-selection-actions').getByRole('button', { name: 'Replace this page' });
    if (await replace.isEnabled()) {
      await replace.click();
    }

    const editable = page.locator('.magazine-sheet--editor .magazine-editable:visible').first();
    await expect(editable).toBeVisible();
    await editable.click();
    await page.keyboard.press('ControlOrMeta+a');
    const marker = `Inline ${name} ${index}`;
    await page.keyboard.type(marker);
    await page.keyboard.press('Escape');

    await expect(page.locator('.text-edit-popover')).toHaveCount(0);
    // Some templates render the copy in caps, so match the committed text
    // case-insensitively while still proving the typed value was persisted.
    await expect(page.locator('.magazine-sheet--editor .magazine-editable:visible').first()).toContainText(
      new RegExp(marker, 'i'),
    );
  }
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

test('odd page counts offer one-click page parity fixes', async ({ page }) => {
  await signIn(page, '/editor');
  const firstPage = page.locator('.page-chip').first();
  await firstPage.locator('.page-chip__select').click();
  await firstPage.getByRole('button', { name: 'Duplicate page' }).click();

  const parity = page.locator('.editor-page-parity');
  await expect(parity).toBeVisible();
  await parity.getByRole('button', { name: 'Add a page' }).click();
  await expect(parity).toHaveCount(0);

  await page.locator('.page-chip.is-active').getByRole('button', { name: 'Duplicate page' }).click();
  await expect(page.locator('.editor-page-parity')).toBeVisible();
  await page.locator('.editor-page-parity').getByRole('button', { name: 'Delete last page' }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Delete page' }).click();
  await expect(page.locator('.editor-page-parity')).toHaveCount(0);
});

test('editor controls share one dense control height', async ({ page }) => {
  await signIn(page, '/editor');
  await expect(page.locator('.editor-sidebar .button--small').first()).toBeVisible();
  const heights = await page
    .locator('.editor-sidebar .button--small, .editor-sidebar .editor-icon-button')
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.offsetParent !== null)
        .map((element) => Math.round(element.getBoundingClientRect().height)),
    );
  expect([...new Set(heights)]).toEqual([36]);

  // Fields inside the dense sidebar resolve to the same tier as its buttons,
  // because the sidebar re-scopes --control-height instead of re-declaring it.
  const fieldHeights = await page
    .locator('.editor-sidebar .field input, .editor-sidebar .field select')
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.offsetParent !== null)
        .map((element) => Math.round(element.getBoundingClientRect().height)),
    );
  expect(fieldHeights.length).toBeGreaterThan(0);
  expect([...new Set(fieldHeights)]).toEqual([36]);

  // Panel chevrons are the one icon tier: 24px everywhere.
  const toggleHeights = await page.locator('.editor-panel__toggle').evaluateAll((elements) =>
    elements
      .filter((element) => element.offsetParent !== null)
      .map((element) => Math.round(element.getBoundingClientRect().height)),
  );
  expect([...new Set(toggleHeights)]).toEqual([24]);

  // Every single-line field in the editor shares one outline token.
  const borders = await page
    .locator(
      ".editor-shell input:not([type='checkbox']):not([type='range']):not([type='file']):not([type='color']), .editor-shell select",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.offsetParent !== null)
        .map((element) => getComputedStyle(element).borderTopColor),
    );
  expect(borders.length).toBeGreaterThan(0);
  expect([...new Set(borders)]).toEqual(['rgba(17, 17, 17, 0.16)']);
});
