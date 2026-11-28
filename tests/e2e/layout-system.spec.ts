import { expect, test } from '@playwright/test';
import { signIn, signInAs } from './helpers';

test('console pages share the 1440px shell and compact header', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await signInAs(page, 'e2e-admin@example.com', 'Password123!', '/admin');
  await expect(page.locator('.admin-console')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.admin-hero')).toBeVisible();

  const admin = await page.evaluate(() => {
    const consoleBox = document.querySelector('.admin-console')!.getBoundingClientRect();
    const headerBox = document.querySelector('.site-page-header')!.getBoundingClientRect();
    const title = document.querySelector('.admin-hero h2')!;
    return {
      consoleWidth: consoleBox.width,
      headerWidth: headerBox.width,
      titleSize: parseFloat(getComputedStyle(title).fontSize),
    };
  });
  expect(admin.consoleWidth).toBeGreaterThan(1400);
  expect(admin.consoleWidth).toBeLessThanOrEqual(1440.5);
  expect(Math.abs(admin.consoleWidth - admin.headerWidth)).toBeLessThan(1);
  expect(admin.titleSize).toBeLessThan(24);

  await page.goto('/account');
  await expect(page.locator('.account-console')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.admin-hero')).toBeVisible();
  const account = await page.evaluate(() => {
    const consoleBox = document.querySelector('.account-console')!.getBoundingClientRect();
    const headerBox = document.querySelector('.site-page-header')!.getBoundingClientRect();
    return { consoleWidth: consoleBox.width, headerWidth: headerBox.width };
  });
  expect(account.consoleWidth).toBeGreaterThan(1400);
  expect(account.consoleWidth).toBeLessThanOrEqual(1440.5);
  expect(Math.abs(account.consoleWidth - account.headerWidth)).toBeLessThan(1);
});

test('marketing keeps 1240px and the editor puts the canvas first when narrow', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/');
  const heroWidth = await page.locator('.hero').evaluate((element) => element.getBoundingClientRect().width);
  expect(heroWidth).toBeLessThanOrEqual(1240.5);
  expect(heroWidth).toBeGreaterThan(1200);

  await page.setViewportSize({ width: 1024, height: 900 });
  await signIn(page, '/editor');
  await expect(page.locator('.editor-layout')).toBeVisible({ timeout: 15_000 });
  const positions = await page.evaluate(() => {
    const stage = document.querySelector('.editor-stage')!.getBoundingClientRect();
    const sidebar = document.querySelector('.editor-sidebar')!.getBoundingClientRect();
    return { stageTop: stage.top, sidebarTop: sidebar.top };
  });
  expect(positions.stageTop).toBeLessThan(positions.sidebarTop);
});

test('every panel toggle sits in the panel top-right corner', async ({ page }) => {
  await signIn(page, '/account');
  await expect(page.locator('.editor-panel .editor-panel__toggle').first()).toBeVisible({ timeout: 15_000 });
  const toggles = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.editor-panel .editor-panel__toggle')).map((toggle) => {
      const panel = toggle.closest('.editor-panel')!.getBoundingClientRect();
      const box = toggle.getBoundingClientRect();
      return {
        position: getComputedStyle(toggle).position,
        rightGap: Math.round(panel.right - box.right),
        topGap: Math.round(box.top - panel.top),
      };
    }),
  );
  expect(toggles.length).toBeGreaterThan(3);
  for (const toggle of toggles) {
    expect(toggle.position).toBe('absolute');
    expect(Math.abs(toggle.rightGap - 14)).toBeLessThanOrEqual(1);
    expect(Math.abs(toggle.topGap - 14)).toBeLessThanOrEqual(1);
  }
});

test('accepted terms are informational, with no continue gate', async ({ page }) => {
  await signIn(page, '/terms');
  await expect(page.locator('.terms-accepted')).toContainText(/already accepted/i, { timeout: 10_000 });
  await expect(page.locator('.terms-gate')).toHaveCount(0);
  await expect(page.locator('.terms-gate button')).toHaveCount(0);
});

test('notices show the message without a page-level label', async ({ page }) => {
  await signInAs(page, 'e2e-admin@example.com', 'Password123!', '/admin');
  await expect(page.locator('.admin-console')).toBeVisible({ timeout: 15_000 });
  await page.route('**/api/admin/summary', (route) => route.abort());
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.locator('.admin-notice')).toContainText(/network connection failed/i, { timeout: 10_000 });
  await expect(page.locator('.admin-notice__label')).toHaveCount(0);
  await expect(page.locator('.admin-notice')).not.toContainText('Admin update');
});

test('mobile pages do not overflow horizontally', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  const homeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(homeOverflow).toBeLessThanOrEqual(1);

  await signIn(page, '/account');
  await expect(page.locator('.account-console')).toBeVisible({ timeout: 15_000 });
  const accountOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(accountOverflow).toBeLessThanOrEqual(1);
  await context.close();
});
