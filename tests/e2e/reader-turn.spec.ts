import { devices, expect, test, type Page } from '@playwright/test';
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

test('dragging a shared page releases with the mouse', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });
  await signIn(page, '/editor');
  const sharePath = await createShare(page);

  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const visible = await page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('.issue-viewer__turnjs .page'));
    const target = pages
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 50 && rect.x + rect.width > 0 && rect.x < window.innerWidth)
      .pop();
    return target ? { x: target.x, y: target.y, width: target.width, height: target.height } : null;
  });
  expect(visible).not.toBeNull();

  // Turn.js starts drags from the bottom corners. Drag past the threshold,
  // release, then keep moving and click: the old runtime threw on mouseup and
  // left the leaf following the pointer.
  const startX = visible!.x + visible!.width - 25;
  const startY = visible!.y + visible!.height - 15;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(startX - step * 14, startY - step * 2);
    await page.waitForTimeout(15);
  }
  await page.mouse.up();
  await page.waitForTimeout(1_400);
  await page.mouse.move(220, 220);
  await page.waitForTimeout(300);
  await page.mouse.click(20, 500);
  await page.waitForTimeout(400);

  expect(pageErrors).toEqual([]);
  await expect(page.locator('.issue-viewer__turnjs--turning')).toHaveCount(0);
  await expect(page.locator('.issue-viewer__turnjs.animated')).toHaveCount(0);
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


type PageShadowState = {
  className: string;
  globalBeforeContent: string;
  globalAfterContent: string;
  globalBeforeShadow: string;
  globalAfterShadow: string;
  pageFilters: string[];
  visiblePageFilters: string[];
};

async function pageShadowState(page: Page): Promise<PageShadowState | null> {
  return page.evaluate(() => {
    const book = document.querySelector('.issue-viewer__turnjs');
    if (!book) return null;
    const wrappers = Array.from(book.querySelectorAll('.page-wrapper'));
    const visible = wrappers.filter((wrapper) => wrapper.getBoundingClientRect().width > 10);
    return {
      className: book.className,
      globalBeforeContent: getComputedStyle(book, '::before').content,
      globalAfterContent: getComputedStyle(book, '::after').content,
      globalBeforeShadow: getComputedStyle(book, '::before').boxShadow,
      globalAfterShadow: getComputedStyle(book, '::after').boxShadow,
      pageFilters: wrappers.map((wrapper) => getComputedStyle(wrapper).filter),
      visiblePageFilters: visible.map((wrapper) => getComputedStyle(wrapper).filter),
    };
  });
}

function expectPageShadows(state: PageShadowState | null) {
  expect(state).not.toBeNull();
  expect(state!.visiblePageFilters.length).toBeGreaterThan(0);
  for (const filter of state!.visiblePageFilters) {
    expect(filter).toContain('drop-shadow');
  }
  expect(state!.globalBeforeContent).toBe('none');
  expect(state!.globalAfterContent).toBe('none');
  expect(state!.globalBeforeShadow).toBe('none');
  expect(state!.globalAfterShadow).toBe('none');
}

test('every page keeps its own shadow and there is no global background shadow', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });

  // Cover.
  await page.waitForTimeout(800);
  expectPageShadows(await pageShadowState(page));

  // Spread.
  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  await next.click();
  await page.waitForTimeout(900);
  expectPageShadows(await pageShadowState(page));

  // Last page.
  for (let step = 0; step < 3; step += 1) {
    const control = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
    if (!(await control.isEnabled().catch(() => false))) break;
    await control.click();
    await page.waitForTimeout(800);
  }
  expectPageShadows(await pageShadowState(page));
});

test('a turn keeps the page shadow and never introduces a global background shadow', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  await next.click();
  await page.waitForTimeout(200);
  expectPageShadows(await pageShadowState(page));
  await page.waitForTimeout(900);
  expectPageShadows(await pageShadowState(page));

  // A bare press changes neither the page shadows nor a global layer.
  const book = page.locator('.issue-viewer__turnjs');
  const box = await book.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  expectPageShadows(await pageShadowState(page));
  await page.mouse.up();
  await page.waitForTimeout(300);
  expectPageShadows(await pageShadowState(page));
});

test('mobile keeps per-page shadows and no global background shadow', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('finalfolio-locale', 'zh'));
  await page.goto('/auth?next=%2Feditor');
  await page.locator('.auth-form input[autocomplete="username"]').fill('e2e-user@example.com');
  await page.locator('.auth-form input[autocomplete="current-password"]').fill('Password123!');
  await page.locator('.auth-form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.startsWith('/editor'));
  const sharePath = await createShare(page);
  await page.goto(sharePath);

  const book = page.locator('.issue-viewer__turnjs');
  await expect(book).toHaveClass(/--ready/, { timeout: 20_000 });
  await page.waitForTimeout(500);
  expectPageShadows(await pageShadowState(page));

  const next = page.locator('.issue-view-mobile-controls__actions button').filter({ hasText: /Next|下一页/ }).first();
  await next.click();
  await page.waitForTimeout(250);
  expectPageShadows(await pageShadowState(page));
  await page.waitForTimeout(800);
  expectPageShadows(await pageShadowState(page));

  // Auto-slide to the next page: still per-page shadow only.
  await next.click();
  await page.waitForTimeout(700);
  expectPageShadows(await pageShadowState(page));

  await context.close();
});
