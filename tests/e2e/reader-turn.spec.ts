import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

function pageData(index: number) {
  return {
    id: `turn-page-${index}`,
    template: 'cover',
    theme: 'warm-beige',
    kicker: '',
    title: `第 ${index} 页`,
    deck: '',
    body: '',
    caption: '',
    customTemplate: null,
    slots: { hero: null },
    crops: { hero: { x: 50, y: 50, scale: 1, fit: 'cover' } },
  };
}

async function readPages(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.issue-viewer__turnjs .page'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 ? `${element.className}|${Math.round(rect.x)}|${Math.round(rect.y)}` : null;
      })
      .filter(Boolean)
      .join('~'),
  );
}

async function createShare(page: import('@playwright/test').Page) {
  const created = await page.request.post('/api/projects', {
    data: {
      project: {
        title: 'Reader drag test',
        subtitle: '',
        issue: 'TURN',
        frameRadius: 12,
        fonts: { title: 'default', deck: 'default', caption: 'default', body: 'default' },
        assets: [],
        pages: Array.from({ length: 6 }, (_, index) => pageData(index + 1)),
      },
    },
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  const shared = await page.request.post(`/api/projects/${project.id}/share`, { data: {} });
  expect(shared.ok()).toBe(true);
  return (await shared.json()).share.path as string;
}

async function waitForStablePages(page: import('@playwright/test').Page) {
  let previous = '';
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await readPages(page);
    if (current === previous) {
      return current;
    }
    previous = current;
    await page.waitForTimeout(150);
  }
  return previous;
}

test('dragging a shared page releases with the mouse', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  await signIn(page, '/editor');

  const sharePath = await createShare(page);

  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.issue-viewer__placeholder-book')).toHaveCount(0);

  const visible = await page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('.issue-viewer__turnjs .page'));
    const target = pages
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 50 && rect.x + rect.width > 0 && rect.x < window.innerWidth)
      .pop();
    return target ? { x: target.x, y: target.y, width: target.width, height: target.height } : null;
  });
  expect(visible).not.toBeNull();

  // Turn.js only starts a drag from the bottom corners; stay below the flip
  // threshold so this test measures release, not the flip animation.
  const startX = visible!.x + visible!.width - 25;
  const startY = visible!.y + visible!.height - 15;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) {
    await page.mouse.move(startX - step, startY - step / 2);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  const released = await waitForStablePages(page);
  await page.mouse.move(220, 220);
  await page.waitForTimeout(300);
  expect(await readPages(page)).toBe(released);
  await page.mouse.click(20, 500);
  await page.waitForTimeout(400);
  expect(await readPages(page)).toBe(released);
  expect(pageErrors).toEqual([]);
});

test('the loading state is a neutral indicator, not a fake spread', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);

  // Keep the page endpoint pending long enough to observe the loading shell.
  await page.route('**/api/issues/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__placeholder-note')).toBeVisible();
  await expect(page.locator('.issue-viewer__placeholder-note')).toHaveText('Loading the folio…');
  await expect(page.locator('.issue-viewer__placeholder-book')).toHaveCount(0);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
});
