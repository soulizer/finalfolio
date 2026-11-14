import { expect, type Page } from '@playwright/test';

function escapePathForRegex(pathname: string) {
  return pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function signIn(page: Page, nextPath = '/account') {
  await page.goto(`/auth?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel('Email or username').fill('e2e-user@example.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${escapePathForRegex(nextPath)}(?:$|\\?)`));
}
