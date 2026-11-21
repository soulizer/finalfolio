import { expect, test } from '@playwright/test';

test.describe('legal pages follow the browser locale', () => {
  test.use({ locale: 'zh-CN' });

  test('terms open in Chinese without a stored locale', async ({ page }) => {
    // A Chinese browser that never used the language toggle keeps the UI in
    // Chinese because the provider auto-detects it; the legal pages must use
    // the same signal instead of treating "no stored locale" as English.
    await page.goto('/terms');
    await expect(page.locator('h1')).toHaveText('服务条款');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  });

  test('privacy opens in Chinese without a stored locale', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('h1')).toHaveText('隐私政策');
  });
});
