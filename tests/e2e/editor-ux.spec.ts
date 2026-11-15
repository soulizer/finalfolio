import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('editor exposes the new first-step guidance and compact controls', async ({ page }) => {
  await signIn(page, '/editor');

  // Photos panel now leads the content sidebar.
  const sidebarSections = page.locator('.editor-sidebar--content > .editor-panel');
  await expect(sidebarSections.first()).toHaveClass(/editor-panel--photos/);

  // URL import control exists and validates empty submissions client-side.
  const importForm = page.locator('.import-url-form');
  await expect(importForm).toBeVisible();
  await expect(importForm.getByRole('button', { name: /Import/ })).toBeDisabled();

  // Empty drafts show the four-step hint.
  await expect(page.locator('.editor-first-steps')).toBeVisible();

  // Page templates render layout thumbnails instead of text-only cards.
  await expect(page.locator('.template-card__thumb').first()).toBeVisible();

  // Per-page paper colour popover opens from the sequence chip dot.
  const firstDot = page.locator('.page-chip__dot').first();
  await expect(firstDot).toBeVisible();
  await firstDot.click();
  const popover = page.locator('.page-color-popover');
  await expect(popover).toBeVisible();
  await popover.locator('.page-color-popover__swatch').nth(2).click();
  await expect(popover).toHaveCount(0);
});

test('clicking stage text opens the inline editor and commits copy', async ({ page }) => {
  await signIn(page, '/editor');

  const heading = page.locator('.magazine-sheet--editor h2 .magazine-editable').first();
  await heading.click();

  const popover = page.locator('.text-edit-popover');
  await expect(popover).toBeVisible();
  const textarea = popover.locator('textarea');
  const marker = `Inline edit ${Date.now()}`;
  await textarea.fill(marker);
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(page.locator('.magazine-sheet--editor h2')).toContainText(marker);
});

test('language toggle switches the editor and homepage to Chinese', async ({ page }) => {
  await signIn(page, '/');
  await page.getByRole('button', { name: '切换到中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('link', { name: '打开编辑器' }).first()).toBeVisible();

  await page.goto('/editor');
  await expect(page.getByText('页面顺序').first()).toBeVisible();
  await expect(page.getByText('照片').first()).toBeVisible();

  // Persisted choice survives a reload.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});
