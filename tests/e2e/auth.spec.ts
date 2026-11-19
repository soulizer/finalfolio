import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('sign-in and sign-out stay functional in the browser shell', async ({ page }) => {
  await signIn(page, '/account');
  await expect(page.getByRole('heading', { name: 'Your library at a glance' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.goto('/auth');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
