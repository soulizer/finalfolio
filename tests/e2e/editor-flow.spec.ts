import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signIn } from './helpers';

type PrintRuntime = Window & typeof globalThis & {
  __printCalls?: number;
  __holdPrintOpen?: boolean;
};

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uploadFixture = path.resolve(testDir, '../../public/icon-192.png');
const uploadFixtureBuffer = fs.readFileSync(uploadFixture);

test('upload, save, reopen, share, and export the editor flow', async ({ page }) => {
  const title = 'E2E Smoke ' + Date.now();

  await page.addInitScript(() => {
    const runtime = window as PrintRuntime;
    runtime.__printCalls = 0;
    runtime.__holdPrintOpen = false;
    window.print = () => {
      runtime.__printCalls = (runtime.__printCalls ?? 0) + 1;
      if (!runtime.__holdPrintOpen) {
        window.dispatchEvent(new Event('afterprint'));
      }
    };
  });

  await signIn(page, '/editor');
  const projectTitleInput = page.getByRole('textbox', { name: 'Title', exact: true });
  await expect(projectTitleInput).toBeVisible();
  await projectTitleInput.fill(title);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'icon-192.png',
    mimeType: 'image/png',
    buffer: uploadFixtureBuffer,
  });
  await expect(page.locator('.editor-panel--photos .panel-tag')).toHaveText(/1 photo/);
  await page.getByRole('button', { name: /Select the hero frame/ }).click();
  await page.locator('.asset-tile__main').first().click();
  await expect(page.locator('main .asset-frame[data-has-asset="true"] img')).toBeVisible();

  await page.getByRole('button', { name: 'Save folio' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9_-]+$/);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

  const editorUrl = await page.getByLabel('Project URL').inputValue();
  expect(editorUrl).toContain('/editor/');

  await page.reload();
  await expect(projectTitleInput).toHaveValue(title);

  await page.getByRole('button', { name: 'Share project' }).click();
  await expect(page.getByRole('button', { name: 'Open shared' })).toBeVisible();
  const publicShareUrl = await page.getByLabel('Share link').inputValue();
  expect(publicShareUrl).toContain('/project/');

  const viewerErrors: string[] = [];
  page.on('pageerror', (error) => viewerErrors.push(error.message));
  await page.goto(publicShareUrl);
  await expect(page.getByText(title).first()).toBeVisible();
  // The public reader renders its pages inside a detached React root; this
  // guards against provider/context regressions that used to blank the book.
  await expect(page.locator('.magazine-page').first()).toBeVisible();
  expect(viewerErrors).toEqual([]);

  await page.goto(editorUrl);
  await page.getByRole('button', { name: 'Export Center' }).click();
  await page.getByRole('button', { name: /A3/ }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export PDF$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const pdfBytes = fs.readFileSync(pdfPath as string);
  expect(pdfBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(pdfBytes.length).toBeGreaterThan(10_000);

  // The print path stays available as a secondary action and must still use the
  // same page renderer as the editor preview.
  await page.getByRole('button', { name: 'Export Center' }).click();
  await page.evaluate(() => {
    const runtime = window as PrintRuntime;
    runtime.__holdPrintOpen = true;
  });
  await page.getByRole('button', { name: 'Print instead' }).click();
  await expect.poll(async () => page.evaluate(() => (window as PrintRuntime).__printCalls ?? 0)).toBe(1);

  const exportGeometry = await page.evaluate(() => {
    const previewFrame = document.querySelector('main .asset-frame[data-has-asset="true"]');
    const printFrame = document.querySelector('.editor-print-stack.is-export-capture-active .asset-frame[data-has-asset="true"]');
    const previewImage = previewFrame?.querySelector('img');
    const printImage = printFrame?.querySelector('img');

    if (
      !(previewFrame instanceof HTMLElement) ||
      !(printFrame instanceof HTMLElement) ||
      !(previewImage instanceof HTMLImageElement) ||
      !(printImage instanceof HTMLImageElement)
    ) {
      return null;
    }

    const previewFrameStyle = getComputedStyle(previewFrame);
    const printFrameStyle = getComputedStyle(printFrame);
    const previewImageStyle = getComputedStyle(previewImage);
    const printImageStyle = getComputedStyle(printImage);

    return {
      preview: {
        ratioW: Number.parseFloat(previewImageStyle.width) / Number.parseFloat(previewFrameStyle.width),
        ratioH: Number.parseFloat(previewImageStyle.height) / Number.parseFloat(previewFrameStyle.height),
      },
      print: {
        ratioW: Number.parseFloat(printImageStyle.width) / Number.parseFloat(printFrameStyle.width),
        ratioH: Number.parseFloat(printImageStyle.height) / Number.parseFloat(printFrameStyle.height),
      },
    };
  });

  expect(exportGeometry).not.toBeNull();
  expect(Math.abs(exportGeometry!.preview.ratioW - exportGeometry!.print.ratioW)).toBeLessThan(0.002);
  expect(Math.abs(exportGeometry!.preview.ratioH - exportGeometry!.print.ratioH)).toBeLessThan(0.002);

  await page.evaluate(() => {
    const runtime = window as PrintRuntime;
    runtime.__holdPrintOpen = false;
    window.dispatchEvent(new Event('afterprint'));
  });

  await page.goto('/account');
  await expect(page.getByText('Exported a project').first()).toBeVisible();
});
