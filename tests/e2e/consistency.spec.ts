import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('the homepage workflow rail does not move the active card', async ({ page }) => {
  await signIn(page, '/');
  const rail = page.locator('.browser-stage__rail-card');
  await expect(rail.first()).toBeVisible();
  const count = await rail.count();
  expect(count).toBeGreaterThan(1);

  for (let index = 0; index < count; index += 1) {
    const card = rail.nth(index);
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toHaveCSS('transform', 'none');
  }
});

test('layout cards show one hover surface and no native tooltip', async ({ page }) => {
  await signIn(page, '/editor');
  const cards = page.locator('.layout-card__pick');
  await expect(cards.first()).toBeVisible();

  const titles = await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('title')));
  expect(titles.every((title) => title === null)).toBe(true);

  await cards.nth(1).hover();
  await expect(page.locator('.template-hover-preview')).toHaveCount(1);
  await expect(page.locator('.template-hover-preview')).toBeVisible();
});

test('every selected layout can be edited, including a built-in one', async ({ page }) => {
  await signIn(page, '/editor');
  await expect(page.locator('.layout-card__pick').first()).toBeVisible();

  // Default selection is the built-in cover: the action must still be usable.
  const edit = page.locator('.layout-selection-actions__edit');
  await expect(edit).toBeEnabled();
  await edit.click();

  const dialog = page.locator('[role="dialog"]').filter({ hasText: /custom layout|编辑排版/ }).first();
  await expect(dialog).toBeVisible();
  // The copy is seeded from the visible page, so it opens with a real frame.
  await expect(dialog.locator('.layout-editor-frame-card')).toHaveCount(1);
  await expect(dialog.locator('.layout-editor-frame-card input').first()).toHaveValue('Hero');

  await dialog.getByRole('button', { name: /Cancel|Close/ }).first().click();
  await expect(dialog).toHaveCount(0);
});

test('collapsing the image frame section keeps Page content open', async ({ page }) => {
  await signIn(page, '/editor');
  const panel = page
    .locator('.editor-panel')
    .filter({ has: page.locator('.editor-panel__label', { hasText: 'Page content' }) })
    .first();

  const frameSummary = panel.locator('.editor-subsection summary').first();
  await expect(frameSummary).toContainText(/Image frame/);
  await frameSummary.click();
  await expect(panel.locator('.editor-subsection').first()).toHaveJSProperty('open', false);
  await expect(panel).not.toHaveClass(/is-collapsed/);
  await expect(panel.locator('textarea').first()).toBeVisible();

  await frameSummary.click();
  await expect(panel.locator('.editor-subsection').first()).toHaveJSProperty('open', true);
});

test('changing a font role updates the page copy immediately', async ({ page }) => {
  await signIn(page, '/editor');
  const deck = page.locator('.editor-font-fields .field select').nth(1);
  const intro = page.locator('.magazine-sheet--editor .magazine-cover__deck');
  await expect(intro).toBeVisible();

  const before = await intro.evaluate((element) => getComputedStyle(element).fontFamily);
  await deck.selectOption({ label: '得意黑' });
  await expect
    .poll(() => intro.evaluate((element) => getComputedStyle(element).fontFamily))
    .not.toBe(before);
  await expect(intro).toContainText('A short line about this series');

  await deck.selectOption({ label: '默认' });
  await expect.poll(() => intro.evaluate((element) => getComputedStyle(element).fontFamily)).toBe(before);
});

test('project template actions use the shared ghost button material', async ({ page }) => {
  await signIn(page, '/editor');
  const firstAction = page.locator('.template-pack-card__actions .button').first();
  await expect(firstAction).toBeVisible();
  await expect(firstAction).toHaveClass(/button--ghost/);
  await expect(firstAction).not.toHaveClass(/button--danger-ghost/);
  // Shared control radius, not a one-off shape.
  await expect(firstAction).toHaveCSS('border-radius', '4px');
});

test('the draft status line does not repeat itself', async ({ page }) => {
  await signIn(page, '/editor');
  const status = page.locator('.panel-note--status');
  await expect(status).toBeVisible();
  const text = await status.innerText();
  expect(text.match(/Draft only/g)?.length ?? 0).toBeLessThanOrEqual(1);
});
