import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('typing during an in-flight save is not lost', async ({ page }) => {
  await signIn(page, '/editor');
  await page.getByRole('button', { name: 'Save folio' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9_-]+$/);
  const projectId = page.url().split('/editor/')[1];

  const title = page.locator('label:has(span:text-is("Title")) textarea').first();
  await expect(title).toBeVisible();

  let releaseResponse: (() => void) | null = null;
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let requestStarted: (() => void) | null = null;
  const requestSeen = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });

  await page.route(`**/api/projects/${projectId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      requestStarted?.();
      await responseGate;
    }
    await route.continue();
  });

  await title.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' ALPHA', { delay: 20 });

  await requestSeen;
  await title.press('End');
  await page.keyboard.type(' BRAVO', { delay: 20 });

  releaseResponse?.();

  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/projects/${projectId}`);
      if (!response.ok()) {
        return '';
      }
      const payload = await response.json();
      return payload.project.pages[0].title as string;
    }, { timeout: 20_000 })
    .toContain('BRAVO');

  await expect(title).toHaveValue(/ALPHA BRAVO/);
  await page.unroute(`**/api/projects/${projectId}`);
});
