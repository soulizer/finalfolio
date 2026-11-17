import { expect, test } from '@playwright/test';
import { signIn, signInAs } from './helpers';

const status = {
  enabled: true,
  prompt: 'Mock prompt for AI arrangement.',
  maxImages: 50,
  userTotalLimit: 5,
  dailyLimit: 2,
  usage: { total: 0, daily: 0, day: '2026-11-17' },
  remaining: { total: 5, daily: 2 },
};

const planPages = [
  {
    template: 'cover',
    theme: 'warm-beige',
    kicker: '',
    title: 'AI cover',
    deck: 'Opening deck',
    body: '',
    caption: 'Cover caption',
    assetIndexes: [0],
  },
  {
    template: 'essay',
    theme: 'warm-beige',
    kicker: 'Note',
    title: 'AI essay',
    deck: 'Essay deck',
    body: 'Mock body copy.',
    caption: 'Essay caption',
    assetIndexes: [0],
  },
];

const bundle = {
  folioTitle: 'AI test folio',
  folioSubtitle: 'Mock subtitle',
  issue: 'AI 01',
  frameRadius: 14,
  prompt: status.prompt,
  providerName: 'Mock AI',
  plans: [
    {
      id: 'plan-1',
      name: 'Quiet editorial',
      style: 'Quiet and spacious',
      summary: 'A restrained two-page opening.',
      pageCount: 2,
      photoCount: 1,
      pages: planPages,
    },
    {
      id: 'plan-2',
      name: 'Visual impact',
      style: 'Bold and direct',
      summary: 'A stronger visual opening.',
      pageCount: 2,
      photoCount: 1,
      pages: planPages,
    },
    {
      id: 'plan-3',
      name: 'Soft journal',
      style: 'Warm and personal',
      summary: 'A softer paper-led sequence.',
      pageCount: 2,
      photoCount: 1,
      pages: planPages,
    },
  ],
};

test('AI arrangement previews three plans and applies the chosen one', async ({ page }) => {
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: status }));
  await page.route('**/api/ai/plans', (route) => route.fulfill({ json: bundle }));
  await signIn(page, '/editor');

  await page.getByRole('button', { name: 'Arrange with AI' }).click();
  const dialog = page.locator('.ai-dialog');
  await expect(dialog).toBeVisible();

  const prompt = page.locator('.ai-prompt-textarea');
  await expect(prompt).toHaveJSProperty('readOnly', true);
  await page.getByRole('button', { name: 'Edit prompt' }).click();
  await expect(prompt).toHaveJSProperty('readOnly', false);
  await page.getByRole('button', { name: 'Done editing' }).click();

  await dialog.locator('input[type="file"]').setInputFiles('public/icon-192.png');
  await expect(page.locator('.ai-photo-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Generate 3 plans' }).click();

  await expect(page.locator('.ai-plan-card')).toHaveCount(3);
  await page.locator('.ai-plan-card').first().click();
  await page.getByRole('button', { name: 'Apply this plan' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.page-chip')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator('.editor-panel--project-actions input').first()).toHaveValue('AI test folio');
  await expect(page.locator('.page-chip em').first()).toContainText('Cover');
});


test('AI arrangement accepts URL imports and reuses them from the library', async ({ page }) => {
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: status }));
  await page.route('**/api/ai/plans', (route) => route.fulfill({ json: bundle }));
  await page.route('**/api/uploads/from-url', (route) =>
    route.fulfill({
      json: {
        assets: [
          {
            id: 'asset-url-check',
            name: 'URL photo',
            src: '/icon-192.png',
            note: '',
            width: 192,
            height: 192,
          },
        ],
      },
    }),
  );
  await signIn(page, '/editor');

  await page.getByRole('button', { name: 'Arrange with AI' }).click();
  const dialog = page.locator('.ai-dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('tab', { name: 'URL import' }).click();
  await dialog.getByLabel('Image URL').fill('https://example.com/photo.jpg');
  await dialog.getByRole('button', { name: 'Import URL' }).click();
  await expect(page.locator('.ai-photo-card')).toHaveCount(1);

  await dialog.getByRole('tab', { name: 'Choose from library' }).click();
  await expect(dialog.locator('.ai-library-item.is-selected')).toHaveCount(1);
  await expect(dialog.locator('.ai-library-item.is-selected')).toContainText('URL photo');

  await page.getByRole('button', { name: 'Generate 3 plans' }).click();
  await expect(page.locator('.ai-plan-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Apply this plan' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.page-chip')).toHaveCount(2, { timeout: 20_000 });
});

test('AI arrangement asks guests to sign in first', async ({ page }) => {
  await page.goto('/editor');
  await expect(page.getByRole('button', { name: 'Arrange with AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Arrange with AI' }).click();
  await expect(page).toHaveURL(/\/auth\?next=/);
});


test('admin AI pool saves a provider and its ordering fields', async ({ page }) => {
  await signInAs(page, 'e2e-admin@example.com', 'Password123!', '/admin');
  await page.getByRole('button', { name: 'AI', exact: true }).click();
  await expect(page.locator('.admin-page--ai')).toBeVisible();

  const prompt = page.locator('.admin-ai-prompt__textarea');
  await expect(prompt).toHaveJSProperty('readOnly', true);
  await page.getByRole('button', { name: 'Edit prompt' }).click();
  await expect(prompt).toHaveJSProperty('readOnly', false);
  await page.getByRole('button', { name: 'Done editing' }).click();
  await expect(prompt).toHaveJSProperty('readOnly', true);

  await page.getByRole('button', { name: 'Add interface' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add interface' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name').fill('Mock provider');
  await dialog.getByLabel('Model').fill('mock-model');
  await dialog.getByLabel('Base URL').fill('http://127.0.0.1:4180/v1');
  await dialog.getByLabel('API key').fill('sk-mock-1234');
  await dialog.getByRole('button', { name: 'Save interface' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.admin-notice')).toContainText('AI settings saved.');
  await expect(page.locator('.admin-ai-provider-card').filter({ hasText: 'Mock provider' })).toBeVisible();
});
