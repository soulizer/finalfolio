import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

const assets = [
  {
    id: 'builtin-architecture',
    name: 'Architecture',
    src: '/builtins/architecture.webp',
    note: '',
    builtIn: true,
    width: 1200,
    height: 1600,
  },
  {
    id: 'builtin-landscape',
    name: 'Landscape',
    src: '/builtins/landscape-lowangle-v2.webp',
    note: '',
    builtIn: true,
    width: 1600,
    height: 1200,
  },
];

const crop = { x: 50, y: 50, scale: 1, fit: 'cover' };

test('dragging one placed photo onto another swaps their frames', async ({ page }) => {
  await signIn(page, '/editor');
  const created = await page.request.post('/api/projects', {
    data: {
      project: {
        title: 'Swap frames',
        subtitle: '',
        issue: 'SWAP',
        frameRadius: 12,
        fonts: { title: 'default', deck: 'default', caption: 'default', body: 'default' },
        assets,
        pages: [
          {
            id: 'swap-page',
            template: 'diptych',
            theme: 'warm-beige',
            kicker: '',
            title: 'Swap frames',
            deck: '',
            body: '',
            caption: '',
            customTemplate: null,
            slots: { left: 'builtin-architecture', right: 'builtin-landscape' },
            crops: { left: crop, right: crop },
          },
        ],
      },
    },
  });
  expect(created.ok()).toBe(true);
  const project = await created.json();
  await page.goto(`/editor/${project.id}`);

  const frames = page.locator('.magazine-sheet--editor .asset-frame[data-has-asset="true"]');
  await expect(frames).toHaveCount(2, { timeout: 15_000 });
  await expect(frames.nth(0).locator('img')).toHaveAttribute('alt', 'Architecture');
  await expect(frames.nth(1).locator('img')).toHaveAttribute('alt', 'Landscape');

  await frames.nth(0).hover();
  await frames.nth(0).locator('.asset-frame__move-handle').dragTo(frames.nth(1));

  await expect(frames.nth(0).locator('img')).toHaveAttribute('alt', 'Landscape');
  await expect(frames.nth(1).locator('img')).toHaveAttribute('alt', 'Architecture');
});
