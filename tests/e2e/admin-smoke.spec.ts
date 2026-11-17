import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test('admin console loads its views without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await signInAs(page, 'e2e-admin@example.com', 'Password123!', '/admin');
  await expect(page.getByRole('heading', { name: 'Operational snapshot' })).toBeVisible();

  for (const tab of ['Projects', 'Uploads', 'Governance', 'Storage', 'Users', 'Events']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.locator('.editor-panel').first()).toBeVisible();
  }

  expect(errors).toEqual([]);
});
