import { expect, test } from '@playwright/test';
import { signIn, signInAs } from './helpers';

function project(title: string) {
  return {
    title,
    subtitle: '',
    issue: 'LIST',
    frameRadius: 12,
    fonts: { title: 'default', deck: 'default', caption: 'default', body: 'default' },
    assets: [],
    pages: [{
      id: 'list-page', template: 'cover', theme: 'warm-beige', kicker: '', title,
      deck: '', body: '', caption: '', customTemplate: null, slots: { hero: null },
      crops: { hero: { x: 50, y: 50, scale: 1, fit: 'cover' } },
    }],
  };
}

test('account delete removes the project from the list', async ({ page }) => {
  await signIn(page, '/account?section=projects');
  const title = `Delete list ${Date.now()}`;
  const created = await page.request.post('/api/projects', { data: { project: project(title) } });
  const record = await created.json();
  await page.reload();
  const row = page.locator('.admin-row').filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Delete folio' }).click();
  await expect(page.locator('.admin-row').filter({ hasText: title })).toHaveCount(0, { timeout: 15_000 });
  const list = await page.request.get('/api/projects');
  const payload = await list.json();
  expect(payload.projects.some((entry: { id: string }) => entry.id === record.id)).toBe(false);
});

test('admin delete removes the project from the list', async ({ page }) => {
  await signInAs(page, 'e2e-admin@example.com', 'Password123!', '/admin');
  const title = `Admin delete list ${Date.now()}`;
  const created = await page.request.post('/api/projects', { data: { project: project(title) } });
  const record = await created.json();
  await page.goto('/admin?section=projects');
  const row = page.locator('.admin-row').filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.locator('.confirm-dialog').getByRole('button', { name: 'Delete project' }).click();
  await expect(page.locator('.admin-row').filter({ hasText: title })).toHaveCount(0, { timeout: 15_000 });
  const list = await page.request.get('/api/projects');
  const payload = await list.json();
  expect(payload.projects.some((entry: { id: string }) => entry.id === record.id)).toBe(false);
});
