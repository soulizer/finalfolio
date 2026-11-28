import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('font choice survives save and reload and updates immediately', async ({ page }) => {
  await signIn(page, '/editor');
  const titleFont = page.getByLabel('Title font');
  await expect(titleFont).toBeVisible();

  const sheet = page.locator('.magazine-sheet--editor').first();
  const fontVar = () =>
    sheet.evaluate((element) => getComputedStyle(element).getPropertyValue('--page-font-title').trim());

  await titleFont.selectOption('serif-cn');
  await expect.poll(fontVar, { timeout: 5_000 }).toContain('FF Serif SC');

  // The 1.2s autosave must not replace the project with a default-font copy.
  await page.waitForTimeout(2_600);
  await expect(titleFont).toHaveValue('serif-cn');
  await expect.poll(fontVar, { timeout: 5_000 }).toContain('FF Serif SC');

  await page.getByRole('button', { name: 'Save folio' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9_-]+$/);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

  await expect.poll(fontVar, { timeout: 5_000 }).toContain('FF Serif SC');

  await page.reload();
  await expect(titleFont).toHaveValue('serif-cn');
  await expect.poll(fontVar, { timeout: 5_000 }).toContain('FF Serif SC');
});
