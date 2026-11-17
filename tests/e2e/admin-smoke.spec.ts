import { expect, test } from '@playwright/test';
import { signInAs } from './helpers';

test('admin console loads its views without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await signInAs(page, 'e2e-admin@example.com', 'Password123!', '/admin');
  await expect(page.getByRole('heading', { name: 'Operational snapshot' })).toBeVisible();

  for (const tab of ['Projects', 'Uploads', 'Governance', 'AI', 'Storage', 'Users', 'Events']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.locator('.editor-panel').first()).toBeVisible();
  }

  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await expect(page.locator('.admin-page--ai')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Interface pool, usage limits and the default prompt' })).toBeVisible();

  expect(errors).toEqual([]);
});
