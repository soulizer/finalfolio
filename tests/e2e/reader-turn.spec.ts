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

async function createShare(
  page: import('@playwright/test').Page,
  fonts: { title: string; deck: string; caption: string; body: string } = {
    title: 'default',
    deck: 'default',
    caption: 'default',
    body: 'default',
  },
) {
  const created = await page.request.post('/api/projects', {
    data: {
      project: {
        title: 'Reader drag test',
        subtitle: '',
        issue: 'TURN',
        frameRadius: 12,
        fonts,
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
  const desktopDragging = await page.evaluate(() => {
    const jq = (window as any).jQuery;
    const bookEl = document.querySelector('.issue-viewer__turnjs');
    return Boolean(jq && bookEl && jq(bookEl).turn('animating') === true);
  });
  expect(desktopDragging, 'desktop drag follows the pointer').toBe(true);
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

test('the public reader keeps the project typography', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page, {
    title: 'serif-cn',
    deck: 'default',
    caption: 'default',
    body: 'default',
  });

  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const title = document.querySelector('.issue-viewer__turnjs .magazine-text--title');
        return title ? getComputedStyle(title).fontFamily : '';
      }),
    )
    .toContain('FF Serif SC');
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
  clipBackface: string[];
  innerBackface: string[];
  innerBackground: string[];
  pageBackface: string[];
  imageTransforms: string[];
};

async function pageShadowState(page: Page): Promise<PageShadowState | null> {
  return page.evaluate(() => {
    const book = document.querySelector('.issue-viewer__turnjs');
    if (!book) return null;
    const wrappers = Array.from(book.querySelectorAll('.page-wrapper'));
    const visible = wrappers.filter((wrapper) => wrapper.getBoundingClientRect().width > 10);
    const imageTransforms = Array.from(book.querySelectorAll('img')).map(
      (image) => getComputedStyle(image).transform,
    );
    return {
      className: book.className,
      globalBeforeContent: getComputedStyle(book, '::before').content,
      globalAfterContent: getComputedStyle(book, '::after').content,
      globalBeforeShadow: getComputedStyle(book, '::before').boxShadow,
      globalAfterShadow: getComputedStyle(book, '::after').boxShadow,
      pageFilters: wrappers.map((wrapper) => getComputedStyle(wrapper).filter),
      visiblePageFilters: visible.map((wrapper) => getComputedStyle(wrapper).filter),
      clipBackface: visible.map((wrapper) =>
        getComputedStyle(wrapper.querySelector('.clip') ?? wrapper).backfaceVisibility,
      ),
      innerBackface: visible.map((wrapper) =>
        getComputedStyle(wrapper.querySelector('.inner-page') ?? wrapper).backfaceVisibility,
      ),
      innerBackground: visible.map((wrapper) =>
        getComputedStyle(wrapper.querySelector('.inner-page') ?? wrapper).backgroundColor,
      ),
      pageBackface: visible.map((wrapper) =>
        getComputedStyle(wrapper.querySelector('.magazine-page') ?? wrapper).backfaceVisibility,
      ),
      imageTransforms,
    };
  });
}

function expectPageShadows(state: PageShadowState | null) {
  expect(state).not.toBeNull();
  expect(state!.visiblePageFilters.length).toBeGreaterThan(0);
  for (const filter of state!.visiblePageFilters) {
    expect(filter).toContain('drop-shadow');
  }
  // The drop-shadow source survives the back face at the visible page size:
  // `.clip` is visible, `.inner-page` carries the paper back, and the content
  // page stays front-only. No board larger than the page is painted.
  for (const backface of state!.clipBackface) {
    expect(backface, 'clip backface').toBe('visible');
  }
  for (const backface of state!.innerBackface) {
    expect(backface, 'inner page backface').toBe('visible');
  }
  for (const background of state!.innerBackground) {
    expect(background, 'inner page paper back').not.toBe('rgba(0, 0, 0, 0)');
  }
  for (const backface of state!.pageBackface) {
    expect(backface, 'page content backface').toBe('hidden');
  }
  for (const transform of state!.imageTransforms) {
    expect(transform, 'image compositor layer').not.toBe('none');
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

test('mobile chrome never covers the paper and turns directly to the next page', async ({ browser }) => {
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
  await expect(page.locator('.issue-view-mobile-topbar')).toBeVisible();
  await expect(page.locator('.issue-view-mobile-controls__status')).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const viewport = document.querySelector('.issue-viewer__viewport')!.getBoundingClientRect();
    const topbar = document.querySelector('.issue-view-mobile-topbar')!.getBoundingClientRect();
    const controls = document.querySelector('.issue-view-mobile-controls')!.getBoundingClientRect();
    const stage = document.querySelector('.issue-viewer__turnjs-stage') as HTMLElement;
    const turn = document.querySelector('.issue-viewer__turnjs') as HTMLElement;
    return {
      viewportBottom: viewport.bottom,
      viewportTop: viewport.top,
      topbarBottom: topbar.bottom,
      controlsTop: controls.top,
      stageTransform: getComputedStyle(stage).transform,
      pointerEvents: getComputedStyle(turn).pointerEvents,
      touchAction: getComputedStyle(turn).touchAction,
    };
  });

  // Chrome is in the layout flow, so it can never overlap the page area.
  expect(geometry.topbarBottom).toBeLessThanOrEqual(geometry.viewportTop + 1);
  expect(geometry.controlsTop).toBeGreaterThanOrEqual(geometry.viewportBottom - 1);
  // Single-page turns need no camera translation, and must accept touch drags.
  expect(geometry.stageTransform).toBe('none');
  expect(geometry.pointerEvents).not.toBe('none');
  expect(geometry.touchAction).toBe('none');

  const next = page.locator('.issue-view-mobile-controls__actions button').filter({ hasText: /Next|下一页/ }).first();
  const waitForTurn = async () => {
    await expect(page.locator('.issue-viewer__turnjs--turning')).toHaveCount(0, { timeout: 5_000 });
    await page.waitForTimeout(120);
  };

  await next.click();
  await waitForTurn();
  await next.click();
  await waitForTurn();
  await next.click();
  await waitForTurn();

  // 3 -> 4 must show page 4 directly; the old translated double spread briefly
  // exposed page 5 before sliding back.
  const visibleCopy = await page.evaluate(() => {
    const viewport = document.querySelector('.issue-viewer__viewport')!.getBoundingClientRect();
    const topmost = document.elementFromPoint(
      viewport.left + viewport.width / 2,
      viewport.top + viewport.height / 2,
    );
    return topmost?.textContent ?? '';
  });
  expect(visibleCopy).toContain('第 4 页');
  expect(visibleCopy).not.toContain('第 5 页');

  // The paper itself must accept the drag on mobile and follow the finger.
  const bookBox = await book.boundingBox();
  expect(bookBox).not.toBeNull();
  const startX = bookBox!.x + bookBox!.width - 24;
  const startY = bookBox!.y + bookBox!.height - 18;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX - step * 16, y: startY - step * 2 }],
    });
    await page.waitForTimeout(30);
  }

  const dragging = await page.evaluate(() => {
    const jq = (window as any).jQuery;
    const bookEl = document.querySelector('.issue-viewer__turnjs');
    if (!jq || !bookEl) {
      return false;
    }
    const animated = jq(bookEl).turn('animating') === true;
    const transformed = Array.from(document.querySelectorAll('.issue-viewer__turnjs .page-wrapper')).some(
      (element) => getComputedStyle(element).transform !== 'none',
    );
    return animated || transformed;
  });
  expect(dragging, 'dragged page follows the finger').toBe(true);

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitForTurn();

  // A normal horizontal swipe must also advance the single-page book.
  const beforeSwipe = await page.locator('.issue-view-mobile-topbar small').innerText();
  const swipeBox = await page.locator('.issue-viewer__viewport').boundingBox();
  expect(swipeBox).not.toBeNull();
  const swipeY = swipeBox!.y + swipeBox!.height / 2;
  const swipeStartX = swipeBox!.x + swipeBox!.width * 0.72;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: swipeStartX, y: swipeY }],
  });
  for (let step = 1; step <= 5; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: swipeStartX - step * 42, y: swipeY }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitForTurn();
  const afterSwipe = await page.locator('.issue-view-mobile-topbar small').innerText();
  expect(afterSwipe, 'horizontal swipe advances the page').not.toBe(beforeSwipe);

  // A short phone must still keep both chrome blocks outside the paper area.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(700);
  const shortScreen = await page.evaluate(() => {
    const viewport = document.querySelector('.issue-viewer__viewport')!.getBoundingClientRect();
    const topbar = document.querySelector('.issue-view-mobile-topbar')!.getBoundingClientRect();
    const controls = document.querySelector('.issue-view-mobile-controls')!.getBoundingClientRect();
    return {
      viewportHeight: viewport.height,
      viewportTop: viewport.top,
      viewportBottom: viewport.bottom,
      topbarBottom: topbar.bottom,
      controlsTop: controls.top,
    };
  });
  expect(shortScreen.viewportHeight).toBeGreaterThan(100);
  expect(shortScreen.topbarBottom).toBeLessThanOrEqual(shortScreen.viewportTop + 1);
  expect(shortScreen.controlsTop).toBeGreaterThanOrEqual(shortScreen.viewportBottom - 1);

  await context.close();
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
