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


type DeskFrame = {
  t: number;
  lifted: boolean;
  turnState: string;
  pageMoving: number;
  peel: boolean;
  left: number;
  right: number;
  classes: string;
  gradients: number;
  leafShadows: number;
  leafFilters: string[];
};

type ShadowSnapshot = {
  className: string;
  left: number;
  right: number;
  leftClass: boolean;
  rightClass: boolean;
};

const nextButton = (page: Page) => page.locator('.issue-view-sidebar button').filter({ hasText: /Next|下一页/ }).first();
const prevButton = (page: Page) => page.locator('.issue-view-sidebar button').filter({ hasText: /Previous|上一页/ }).first();

async function snapshotDesk(page: Page): Promise<ShadowSnapshot | null> {
  return page.evaluate(() => {
    const book = document.querySelector('.issue-viewer__turnjs');
    if (!book) return null;
    return {
      className: book.className,
      left: Number.parseFloat(getComputedStyle(book, '::before').opacity),
      right: Number.parseFloat(getComputedStyle(book, '::after').opacity),
      leftClass: book.classList.contains('issue-viewer__turnjs--shadow-left'),
      rightClass: book.classList.contains('issue-viewer__turnjs--shadow-right'),
    };
  });
}

// Records every animation frame of the book: turn.js's own lift state, the
// lifted attribute, both desk opacities, and any painted turn.js gradient.
async function startDeskRecording(page: Page) {
  await page.evaluate(() => {
    const scope = window as unknown as { __deskFrames?: unknown[]; __deskRecording?: boolean };
    scope.__deskFrames = [];
    scope.__deskRecording = true;
    const book = document.querySelector<HTMLElement>('.issue-viewer__turnjs');
    if (!book) return;
    const started = performance.now();
    const tick = () => {
      if (!scope.__deskRecording) return;
      const turn = (window as unknown as { jQuery: (el: Element) => { data: (key: string) => any } }).jQuery(book).data('t');
      const gradients = Array.from(
        book.querySelectorAll<HTMLElement>('.inner-gradient, .outer-gradient'),
      ).filter((gradient) => {
        const style = getComputedStyle(gradient);
        return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0 && gradient.getBoundingClientRect().width > 1;
      }).length;
      const leaves = Array.from(book.querySelectorAll<HTMLElement>('.page-wrapper.is-leaf-lifting'));
      (scope.__deskFrames as unknown[]).push({
        t: Math.round(performance.now() - started),
        lifted: book.hasAttribute('data-lifted'),
        turnState: turn?.status ?? '',
        pageMoving: turn?.pageMv?.length ?? 0,
        peel: Boolean(turn?.peel),
        left: Number.parseFloat(getComputedStyle(book, '::before').opacity),
        right: Number.parseFloat(getComputedStyle(book, '::after').opacity),
        classes: (book.className.match(/shadow-(left|right)/g) ?? []).join('+') || 'none',
        gradients,
        leafShadows: leaves.length,
        leafFilters: leaves.map((leaf) => getComputedStyle(leaf).filter),
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopDeskRecording(page: Page): Promise<DeskFrame[]> {
  return page.evaluate(() => {
    const scope = window as unknown as { __deskFrames?: DeskFrame[]; __deskRecording?: boolean };
    scope.__deskRecording = false;
    return scope.__deskFrames ?? [];
  });
}

function isLiftedFrame(frame: DeskFrame) {
  return frame.lifted || frame.turnState !== '' || frame.pageMoving > 0 || frame.peel;
}

// The shared rule: while any leaf is lifted the desk has no shadow at all, and
// no turn.js fold gradient is painted in either direction.
function expectDeskRuleHolds(frames: DeskFrame[]) {
  const lifted = frames.filter(isLiftedFrame);
  expect(lifted.length).toBeGreaterThan(0);
  for (const frame of lifted) {
    expect(frame.left, `frame ${frame.t}ms: desk left while lifted`).toBeLessThan(0.001);
    expect(frame.right, `frame ${frame.t}ms: desk right while lifted`).toBeLessThan(0.001);
  }
  for (const frame of frames) {
    expect(frame.gradients, `frame ${frame.t}ms: painted spine gradient`).toBe(0);
  }

  // The correct shadows must survive: the lifted sheet keeps its own drop
  // shadow, and no resting page carries one.
  const leafFrames = lifted.filter((frame) => frame.leafShadows > 0);
  expect(leafFrames.length, 'a lifted sheet keeps a shadow').toBeGreaterThan(0);
  for (const frame of leafFrames) {
    expect(frame.leafFilters.length, `frame ${frame.t}ms: leaf filter`).toBeGreaterThan(0);
    for (const filter of frame.leafFilters) {
      expect(filter, `frame ${frame.t}ms: leaf drop-shadow`).toContain('drop-shadow');
    }
  }
  for (const frame of frames.filter((candidate) => !isLiftedFrame(candidate))) {
    expect(frame.leafShadows, `frame ${frame.t}ms: leaf shadow at rest`).toBe(0);
  }
}

// After the last lifted frame the first resting frame already shows the landed
// state, so the desk never flashes the previous view's shadow at landing.
function expectLandedWithoutStaleShadow(frames: DeskFrame[]) {
  const lastLifted = frames.map(isLiftedFrame).lastIndexOf(true);
  expect(lastLifted).toBeGreaterThanOrEqual(0);
  const landed = frames[lastLifted + 1];
  expect(landed, 'a resting frame follows the last lifted frame').toBeTruthy();
  expect(landed.classes).toBe(frames[frames.length - 1].classes);
}

test('the book shadow follows the visible paper in every rest state', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });

  // Cover: paper only on the right half.
  await expect.poll(async () => (await snapshotDesk(page))?.right ?? 0).toBeCloseTo(1, 2);
  const cover = await snapshotDesk(page);
  expect(cover?.rightClass).toBe(true);
  expect(cover?.leftClass).toBe(false);
  expect(cover!.left).toBeCloseTo(0, 2);

  // Spread: both halves.
  await page.waitForTimeout(800);
  await nextButton(page).click();
  await expect.poll(async () => (await snapshotDesk(page))?.left ?? 0).toBeCloseTo(1, 2);
  const spread = await snapshotDesk(page);
  expect(spread?.leftClass).toBe(true);
  expect(spread?.rightClass).toBe(true);
  expect(spread!.right).toBeCloseTo(1, 2);

  // Last page: paper only on the left half.
  for (let step = 0; step < 3; step += 1) {
    const control = nextButton(page);
    if (!(await control.isEnabled().catch(() => false))) break;
    await control.click();
    await page.waitForTimeout(800);
  }
  const last = await snapshotDesk(page);
  expect(last?.leftClass).toBe(true);
  expect(last?.rightClass).toBe(false);
  expect(last!.right).toBeCloseTo(0, 2);
});

test('the desk shadow is off for every turn and returns only after landing', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);

  const book = page.locator('.issue-viewer__turnjs');
  const next = nextButton(page);
  const prev = prevButton(page);

  // Each step: cover -> spread, spread -> spread, spread -> cover, spread ->
  // spread, spread -> last page, last page -> spread.
  const steps: Array<{ name: string; control: typeof next; expectedClass: RegExp }> = [
    { name: 'open the cover', control: next, expectedClass: /shadow-left.*shadow-right/ },
    { name: 'turn forward to the next spread', control: next, expectedClass: /shadow-left.*shadow-right/ },
    { name: 'close the spread to the cover', control: prev, expectedClass: /shadow-right(?!.*shadow-left)/ },
    { name: 'open the spread again', control: next, expectedClass: /shadow-left.*shadow-right/ },
    { name: 'turn to the last page', control: next, expectedClass: /shadow-left(?!.*shadow-right)/ },
    { name: 'return from the last page', control: prev, expectedClass: /shadow-left.*shadow-right/ },
  ];

  for (const step of steps) {
    await startDeskRecording(page);
    await step.control.click();
    await page.waitForTimeout(1_000);
    const frames = await stopDeskRecording(page);
    expect(frames.some(isLiftedFrame), step.name).toBe(true);
    expectDeskRuleHolds(frames);
    expectLandedWithoutStaleShadow(frames);
    await expect(book).toHaveClass(step.expectedClass);
  }
});

test('a dragged page lifts the desk shadow and a cancelled drag restores it', async ({ page }) => {
  await signIn(page, '/editor');
  const sharePath = await createShare(page);
  await page.goto(sharePath);
  await expect(page.locator('.issue-viewer__turnjs--ready')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(800);
  await nextButton(page).click();
  await page.waitForTimeout(900);

  const book = page.locator('.issue-viewer__turnjs');
  const box = await book.boundingBox();
  expect(box).not.toBeNull();

  // Pull the bottom-right corner, then let go in the same place: a cancelled drag.
  await startDeskRecording(page);
  await page.mouse.move(box!.x + box!.width - 12, box!.y + box!.height - 8);
  await page.mouse.down();
  for (let step = 1; step <= 4; step += 1) {
    await page.mouse.move(box!.x + box!.width - 12 - step * 6, box!.y + box!.height - 8 - step);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(1_200);
  const cancelled = await stopDeskRecording(page);
  expect(cancelled.some(isLiftedFrame)).toBe(true);
  expectDeskRuleHolds(cancelled);
  await expect(book).toHaveClass(/shadow-left.*shadow-right/);
  await expect.poll(async () => (await snapshotDesk(page))?.left ?? 0).toBeCloseTo(1, 2);
  await expect.poll(async () => (await snapshotDesk(page))?.right ?? 0).toBeCloseTo(1, 2);
});

test('mobile turns lift the desk, and the auto-slide keeps it under the visible page', async ({ browser }) => {
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

  const next = page.locator('.issue-view-mobile-controls__actions button').filter({ hasText: /Next|下一页/ }).first();
  const prev = page.locator('.issue-view-mobile-controls__actions button').filter({ hasText: /Previous|上一页/ }).first();

  // Cover -> page 2 is a turn: the desk is off for the whole flight.
  await startDeskRecording(page);
  await next.click();
  await page.waitForTimeout(1_000);
  const opening = await stopDeskRecording(page);
  expect(opening.some(isLiftedFrame)).toBe(true);
  expectDeskRuleHolds(opening);
  expectLandedWithoutStaleShadow(opening);
  await expect(book).toHaveClass(/--shadow-left/);

  // Page 2 -> page 3 is the horizontal auto-slide: no page is lifted, so the
  // desk stays under the page that is now centred.
  await startDeskRecording(page);
  await next.click();
  await page.waitForTimeout(700);
  const slide = await stopDeskRecording(page);
  expect(slide.some(isLiftedFrame)).toBe(false);
  await expect(book).toHaveClass(/--shadow-right/);
  const page3Offset = await page.evaluate(() => {
    const page3 = document.querySelector('.issue-viewer__turnjs .page.p3')?.getBoundingClientRect();
    const clip = document.querySelector('.issue-viewer__clip--turnjs')?.getBoundingClientRect();
    if (!page3 || !clip) return Number.POSITIVE_INFINITY;
    return Math.abs(page3.x + page3.width / 2 - (clip.x + clip.width / 2));
  });
  expect(page3Offset).toBeLessThan(2);

  // Page 3 -> page 4 is a turn again, and page 2 -> cover closes it.
  await startDeskRecording(page);
  await next.click();
  await page.waitForTimeout(1_000);
  expectDeskRuleHolds(await stopDeskRecording(page));

  await startDeskRecording(page);
  await prev.click();
  await page.waitForTimeout(1_000);
  const closing = await stopDeskRecording(page);
  expectDeskRuleHolds(closing);
  expectLandedWithoutStaleShadow(closing);

  await context.close();
});
