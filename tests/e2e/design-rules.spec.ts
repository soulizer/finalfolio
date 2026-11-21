import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('destructive row actions are icon-only and confirmed', async ({ page }) => {
  await signIn(page, '/account?section=uploads');

  const image = readFileSync('public/icon-192.png');
  const uploaded = await page.request.post('/api/uploads', {
    multipart: { files: { name: '规则检查.png', mimeType: 'image/png', buffer: image } },
  });
  expect(uploaded.ok()).toBe(true);

  await page.reload();
  await expect(page.locator('.admin-row').first()).toBeVisible({ timeout: 15_000 });

  // House rule: delete is a trash icon with a tooltip, never a text button.
  const deleteButton = page.getByRole('button', { name: 'Delete', exact: true }).first();
  await expect(deleteButton).toBeVisible();
  await expect(deleteButton).toHaveAttribute('title', 'Delete');
  expect((await deleteButton.innerText()).trim()).toBe('');

  await deleteButton.click();
  const dialog = page.locator('.confirm-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
});
