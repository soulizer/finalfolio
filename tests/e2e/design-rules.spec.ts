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

  // Row actions share one height, and the icon-only delete is square.
  const row = page.locator('.admin-row').first();
  const actionButtons = row.locator('.admin-row__actions > button, .admin-row__actions > a.button');
  const heights = await actionButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(new Set(heights).size, 'row action heights').toBe(1);
  const iconBox = await deleteButton.boundingBox();
  expect(iconBox?.width, 'delete icon width').toBe(iconBox?.height);

  // Same skeuomorphic surface as the other buttons: gradient + control shadow.
  const deleteSurface = await deleteButton.evaluate((button) => {
    const style = getComputedStyle(button);
    return { background: style.backgroundImage, shadow: style.boxShadow };
  });
  expect(deleteSurface.background, 'delete icon gradient').toContain('linear-gradient');
  expect(deleteSurface.shadow, 'delete icon shadow').not.toBe('none');

  await deleteButton.click();
  const dialog = page.locator('.confirm-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
});

test('mobile row actions keep one height and a square delete icon', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('finalfolio-locale', 'zh'));
  await page.goto('/auth?next=%2Faccount?section=uploads');
  await page.locator('.auth-form input[autocomplete="username"]').fill('e2e-user@example.com');
  await page.locator('.auth-form input[autocomplete="current-password"]').fill('Password123!');
  await page.locator('.auth-form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.startsWith('/account'));

  const image = readFileSync('public/icon-192.png');
  const uploaded = await page.request.post('/api/uploads', {
    multipart: { files: { name: '移动端规则.png', mimeType: 'image/png', buffer: image } },
  });
  expect(uploaded.ok()).toBe(true);
  await page.reload();
  await expect(page.locator('.admin-row').first()).toBeVisible({ timeout: 15_000 });

  const row = page.locator('.admin-row').first();
  const actionButtons = row.locator('.admin-row__actions > button, .admin-row__actions > a.button');
  const boxes = await actionButtons.evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  for (const box of boxes) {
    expect(box.height, 'mobile row action height').toBe(44);
  }
  const deleteButton = page.getByRole('button', { name: '删除', exact: true }).first();
  const iconBox = await deleteButton.boundingBox();
  expect(iconBox?.width, 'mobile delete icon width').toBe(44);
  expect(iconBox?.height, 'mobile delete icon height').toBe(44);

  await context.close();
});

test('primary buttons keep their dark shadow on hover and press down', async ({ page }) => {
  await page.goto('/auth');
  await expect(page.locator('.auth-form button[type="submit"]')).toBeVisible();

  const submit = page.locator('.auth-form button[type="submit"]');
  await submit.hover();
  await page.waitForTimeout(220);
  const hover = await submit.evaluate((button) => getComputedStyle(button).boxShadow);
  expect(hover, 'primary hover keeps the dark shadow').toContain('rgba(17, 17, 17, 0.24)');
  expect(hover, 'primary hover has no light top edge').not.toContain('rgba(255, 255, 255, 0.98)');

  await page.mouse.down();
  await page.waitForTimeout(180);
  const active = await submit.evaluate((button) => {
    const style = getComputedStyle(button);
    return { transform: style.transform, shadow: style.boxShadow };
  });
  expect(active.transform, 'pressed button moves down').not.toBe('none');
  expect(active.shadow, 'pressed primary keeps the dark shadow').toContain('rgba(17, 17, 17, 0.2)');
  await page.mouse.up();
});
