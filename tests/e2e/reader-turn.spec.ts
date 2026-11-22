import { devices, expect, test } from '@playwright/test';
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


async function shadowSnapshot(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const book = document.querySelector('.issue-viewer__turnjs');
    if (!book) return null;
    const rect = book.getBoundingClientRect();
    const left = window.getComputedStyle(book, '::before');
    const right = window.getComputedStyle(book, '::after');
    const hinge = document.querySelector('.issue-turnjs__hinge');
    const hingeRect = hinge?.getBoundingClientRect();
    return {
      className: book.className,
      bookWidth: rect.width,
      bookCenter: rect.x + rect.width / 2,
      hingeCenter: hingeRect ? hingeRect.x + hingeRect.width / 2 : null,
      hingeOpacity: hinge ? Number.parseFloat(window.getComputedStyle(hinge).opacity) : 0,
      left: {
        opacity: Number.parseFloat(left.opacity),
        left: Number.parseFloat(left.left),
        width: Number.parseFloat(left.width),
      },
      right: {
        opacity: Number.parseFloat(right.opacity),
        left: Number.parseFloat(right.left),
        width: Number.parseFloat(right.width),
      },
    };
  });
}

const turnClass = /issue-viewer__turnjs--turning/;

type BookClassSample = { t: number; className: string };

async function startClassRecording(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const book = document.querySelector('.issue-viewer__turnjs');
    const scope = window as unknown as { __bookClassSamples?: { t: number; className: string }[] };
    if (!book) {
      scope.__bookClassSamples = [];
      return;
    }
    const started = performance.now();
    const samples = scope.__bookClassSamples = [] as { t: number; className: string }[];
    const record = () => samples.push({ t: Math.round(performance.now() - started), className: book.className });
    record();
    const observer = new MutationObserver(record);
    observer.observe(book, { attributes: true, attributeFilter: ['class'] });
    window.setTimeout(() => observer.disconnect(), 3_000);
  });
}

async function readClassRecording(page: import('@playwright/test').Page): Promise<BookClassSample[]> {
  return page.evaluate(() => {
    const scope = window as unknown as { __bookClassSamples?: { t: number; className: string }[] };
    return scope.__bookClassSamples ?? [];
  });
}

test('the book shadow follows the visible paper in every rest state', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });

  // Cover: paper only on the right half, and no crease in the middle of a cover.
  await expect.poll(async () => (await shadowSnapshot(page))?.right.opacity ?? 0).toBe(1);
  const cover = await shadowSnapshot(page);
  expect(cover?.className).toContain('issue-viewer__turnjs--shadow-right');
  expect(cover?.className).not.toContain('issue-viewer__turnjs--shadow-left');
  expect(cover!.right.width).toBeCloseTo(cover!.bookWidth / 2, 0);
  expect(cover!.right.left).toBeCloseTo(cover!.bookWidth / 2, 0);
  expect(cover!.left.opacity).toBeCloseTo(0, 2);
  expect(cover!.hingeOpacity).toBeCloseTo(0, 2);

  // Spread: both halves and a crease on the real spine.
  await page.waitForTimeout(1000);
  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  await next.click();
  await page.waitForTimeout(1000);
  const spread = await shadowSnapshot(page);
  expect(spread?.className).toContain('issue-viewer__turnjs--shadow-left');
  expect(spread?.className).toContain('issue-viewer__turnjs--shadow-right');
  expect(spread!.left.opacity).toBeCloseTo(1, 2);
  expect(spread!.right.opacity).toBeCloseTo(1, 2);
  expect(spread!.hingeOpacity).toBeCloseTo(1, 2);
  expect(spread!.hingeCenter).toBeCloseTo(spread!.bookCenter, 0);

  // Last page: paper only on the left half and no crease over an empty right half.
  for (let step = 0; step < 3; step += 1) {
    const control = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
    if (!(await control.isEnabled().catch(() => false))) break;
    await control.click();
    await page.waitForTimeout(800);
  }
  const last = await shadowSnapshot(page);
  expect(last?.className).toContain('issue-viewer__turnjs--shadow-left');
  expect(last?.className).not.toContain('issue-viewer__turnjs--shadow-right');
  expect(last!.left.width).toBeCloseTo(last!.bookWidth / 2, 0);
  expect(last!.left.left).toBeCloseTo(0, 0);
  expect(last!.right.opacity).toBeCloseTo(0, 2);
  expect(last!.hingeOpacity).toBeCloseTo(0, 2);
});

test('opening the cover adds the left shadow only after the page lands', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const book = page.locator('.issue-viewer__turnjs');
  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  await next.click();
  await expect(book).toHaveClass(turnClass, { timeout: 2_000 });
  await page.waitForTimeout(200);

  // The left half is still empty while the cover is in the air. Neither the body
  // shadow nor the spine crease may appear there before the page lands.
  const inFlight = await shadowSnapshot(page);
  expect(inFlight?.className).not.toContain('issue-viewer__turnjs--shadow-left');
  expect(inFlight!.left.opacity).toBeLessThan(0.02);
  expect(inFlight!.hingeOpacity).toBeLessThan(0.02);

  await expect(book).not.toHaveClass(turnClass, { timeout: 3_000 });
  await expect.poll(async () => (await shadowSnapshot(page))?.left.opacity ?? 0).toBeGreaterThan(0.9);
  expect((await shadowSnapshot(page))?.className).toContain('issue-viewer__turnjs--shadow-left');
});

test('closing a spread removes the left shadow as soon as the page lifts', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);

  const book = page.locator('.issue-viewer__turnjs');
  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  const prev = page.locator('.issue-view-sidebar button').filter({ hasText: /Previous|上一页/ }).first();
  await next.click();
  await page.waitForTimeout(900);

  await prev.click();
  await expect(book).toHaveClass(turnClass, { timeout: 2_000 });
  await page.waitForTimeout(100);

  // The left page is already off the table; its body shadow must go with it.
  const inFlight = await shadowSnapshot(page);
  expect(inFlight?.className).not.toContain('issue-viewer__turnjs--shadow-left');
  expect(inFlight!.left.opacity).toBeLessThan(0.3);
  expect(inFlight!.className).toContain('issue-viewer__turnjs--shadow-right');
  // The gutter stays, because the leaf is still hinged at the spine.
  expect(inFlight!.hingeOpacity).toBeGreaterThan(0.9);

  await expect(book).not.toHaveClass(turnClass, { timeout: 3_000 });
  await page.waitForTimeout(200);
  const cover = await shadowSnapshot(page);
  expect(cover?.className).toContain('issue-viewer__turnjs--shadow-right');
  expect(cover?.className).not.toContain('issue-viewer__turnjs--shadow-left');
  expect(cover!.left.opacity).toBeCloseTo(0, 2);
  expect(cover!.hingeOpacity).toBeCloseTo(0, 2);
});

test('a spread keeps both body shadows and the crease while turning either way', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);

  const book = page.locator('.issue-viewer__turnjs');
  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  const prev = page.locator('.issue-view-sidebar button').filter({ hasText: /Previous|上一页/ }).first();
  await next.click();
  await page.waitForTimeout(900);

  await next.click();
  await expect(book).toHaveClass(turnClass, { timeout: 2_000 });
  await page.waitForTimeout(180);
  const forward = await shadowSnapshot(page);
  expect(forward?.className).toContain('issue-viewer__turnjs--shadow-left');
  expect(forward?.className).toContain('issue-viewer__turnjs--shadow-right');
  expect(forward!.hingeOpacity).toBeGreaterThan(0.9);

  await expect(book).not.toHaveClass(turnClass, { timeout: 3_000 });
  await page.waitForTimeout(150);

  await prev.click();
  await expect(book).toHaveClass(turnClass, { timeout: 2_000 });
  await page.waitForTimeout(180);
  const backward = await shadowSnapshot(page);
  expect(backward?.className).toContain('issue-viewer__turnjs--shadow-left');
  expect(backward?.className).toContain('issue-viewer__turnjs--shadow-right');
  expect(backward!.hingeOpacity).toBeGreaterThan(0.9);
});

test('the last page keeps the body under the flat pages until it lands', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1000);

  const book = page.locator('.issue-viewer__turnjs');
  const next = page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
  // Cover -> spread 2-3 -> spread 4-5.
  await next.click();
  await page.waitForTimeout(800);
  await next.click();
  await page.waitForTimeout(900);

  await next.click();
  await expect(book).toHaveClass(turnClass, { timeout: 2_000 });
  await page.waitForTimeout(180);

  // Pages 4 and 5 are still flat under the flying last sheet, so their body
  // shadows stay until the sheet lands. The gutter is still hinged.
  const inFlight = await shadowSnapshot(page);
  expect(inFlight?.className).toContain('issue-viewer__turnjs--shadow-left');
  expect(inFlight?.className).toContain('issue-viewer__turnjs--shadow-right');
  expect(inFlight!.left.opacity).toBeCloseTo(1, 2);
  expect(inFlight!.right.opacity).toBeCloseTo(1, 2);
  expect(inFlight!.hingeOpacity).toBeGreaterThan(0.9);

  await expect(book).not.toHaveClass(turnClass, { timeout: 3_000 });
  await expect.poll(async () => (await shadowSnapshot(page))?.right.opacity ?? 1).toBeLessThan(0.02);
  const rested = await shadowSnapshot(page);
  expect(rested?.className).toContain('issue-viewer__turnjs--shadow-left');
  expect(rested?.className).not.toContain('issue-viewer__turnjs--shadow-right');
  expect(rested!.hingeOpacity).toBeCloseTo(0, 2);
});

test('mobile slides the centered page and its shadow together', async ({ browser }) => {
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
  await expect(book).toHaveClass(/--shadow-right/);
  await expect(book).not.toHaveClass(/--shadow-left/);

  const next = page.locator('.issue-view-mobile-controls__actions button').filter({ hasText: /Next|下一页/ }).first();
  const prev = page.locator('.issue-view-mobile-controls__actions button').filter({ hasText: /Previous|上一页/ }).first();

  // Cover -> page 2. Record every class mutation so the very short mobile turn
  // cannot slip between two Playwright polls.
  await startClassRecording(page);
  await next.click();
  await page.waitForTimeout(900);
  const opening = await readClassRecording(page);
  expect(opening.some((sample) => turnClass.test(sample.className))).toBe(true);
  expect(
    opening.some((sample) => turnClass.test(sample.className) && /--shadow-left/.test(sample.className)),
  ).toBe(false);
  await expect(book).toHaveClass(/--shadow-left/, { timeout: 2_000 });
  await page.waitForTimeout(450);
  const page2Offset = await page.evaluate(() => {
    const page2 = document.querySelector('.issue-viewer__turnjs .page.p2')?.getBoundingClientRect();
    const clip = document.querySelector('.issue-viewer__clip--turnjs')?.getBoundingClientRect();
    if (!page2 || !clip) return Number.POSITIVE_INFINITY;
    return Math.abs(page2.x + page2.width / 2 - (clip.x + clip.width / 2));
  });
  expect(page2Offset).toBeLessThan(2);

  // Page 2 -> cover. The lifted left page loses its shadow at the first frame
  // of the turn, while the stationary cover keeps its right shadow.
  await startClassRecording(page);
  await prev.click();
  await page.waitForTimeout(900);
  const closing = await readClassRecording(page);
  expect(closing.some((sample) => turnClass.test(sample.className))).toBe(true);
  expect(
    closing.some((sample) => turnClass.test(sample.className) && /--shadow-left/.test(sample.className)),
  ).toBe(false);
  expect(
    closing.some((sample) => turnClass.test(sample.className) && /--shadow-right/.test(sample.className)),
  ).toBe(true);
  await expect(book).toHaveClass(/--shadow-right/);

  // Cover -> page 2 again, then page 3 uses the horizontal auto-slide only.
  await next.click();
  await page.waitForTimeout(900);
  await startClassRecording(page);
  await next.click();
  await page.waitForTimeout(900);
  const slide = await readClassRecording(page);
  expect(slide.some((sample) => turnClass.test(sample.className))).toBe(false);
  await expect(book).toHaveClass(/--shadow-right/, { timeout: 2_000 });
  await page.waitForTimeout(450);
  const page3Offset = await page.evaluate(() => {
    const page3 = document.querySelector('.issue-viewer__turnjs .page.p3')?.getBoundingClientRect();
    const clip = document.querySelector('.issue-viewer__clip--turnjs')?.getBoundingClientRect();
    if (!page3 || !clip) return Number.POSITIVE_INFINITY;
    return Math.abs(page3.x + page3.width / 2 - (clip.x + clip.width / 2));
  });
  expect(page3Offset).toBeLessThan(2);

  await context.close();
});
