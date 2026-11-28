import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

function pageData(index: number) {
  return {
    id: `deleted-page-${index}`,
    template: 'cover',
    theme: 'warm-beige',
    kicker: '',
    title: `Deleted project page ${index}`,
    deck: '',
    body: '',
    caption: '',
    customTemplate: null,
    slots: { hero: null },
    crops: { hero: { x: 50, y: 50, scale: 1, fit: 'cover' } },
  };
}

async function createProject(page: Page, title: string) {
  const created = await page.request.post('/api/projects', {
    data: {
      project: {
        title,
        subtitle: '',
        issue: 'DEL',
        frameRadius: 12,
        fonts: { title: 'default', deck: 'default', caption: 'default', body: 'default' },
        assets: [],
        pages: [pageData(1), pageData(2)],
      },
    },
  });
  expect(created.ok()).toBe(true);
  return (await created.json()) as { id: string };
}

test('a deleted project opens the unavailable editor state after reload', async ({ page }) => {
  await signIn(page, '/editor');
  const project = await createProject(page, 'Deleted before reload');
  await page.goto(`/editor/${project.id}`);
  await expect(page.locator('.editor-layout')).toBeVisible({ timeout: 15_000 });

  const deleted = await page.request.delete(`/api/projects/${project.id}`);
  expect(deleted.status()).toBe(204);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Project not available.' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.editor-layout')).toHaveCount(0);
});

test('saving a project deleted in another tab leaves the editor unavailable', async ({ page }) => {
  await signIn(page, '/editor');
  const project = await createProject(page, 'Deleted while editing');
  await page.goto(`/editor/${project.id}`);
  const titleInput = page
    .locator('.editor-panel--project-actions')
    .getByRole('textbox', { name: 'Title', exact: true });
  await expect(titleInput).toBeVisible({ timeout: 15_000 });

  const deleted = await page.request.delete(`/api/projects/${project.id}`);
  expect(deleted.status()).toBe(204);

  await titleInput.fill('Changed after deletion');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Project not available.' })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.editor-layout')).toHaveCount(0);
});
