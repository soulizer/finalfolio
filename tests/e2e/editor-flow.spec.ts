import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
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
  const projectTitleInput = page
    .locator('.editor-panel--project-actions')
    .getByRole('textbox', { name: 'Title', exact: true });
  await expect(projectTitleInput).toBeVisible();
  await projectTitleInput.fill(title);
  await page.locator('.editor-panel--photos input[type="file"]').setInputFiles({
    name: 'icon-192.png',
    mimeType: 'image/png',
    buffer: uploadFixtureBuffer,
  });
  await expect(page.locator('.editor-panel--photos .panel-tag')).toContainText(/photo/);
  const uploadedTile = page.locator('.asset-tile').filter({ hasText: 'icon-192' }).first();
  await expect(uploadedTile).toBeVisible();
  await page.getByRole('button', { name: /Select the hero frame/ }).click();
  await uploadedTile.locator('.asset-tile__main').click();
  await expect(page.locator('main .asset-frame[data-has-asset="true"] img')).toBeVisible();

  await page.getByRole('button', { name: 'Save folio' }).click();
  await expect(page).toHaveURL(/\/editor\/[a-z0-9_-]+$/);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

  const editorUrl = page.url();
  expect(editorUrl).toContain('/editor/');

  await page.reload();
  await expect(projectTitleInput).toHaveValue(title);
  await expect(page.getByRole('button', { name: 'Open shared' })).toBeVisible();
  const publicShareUrl = await page.getByLabel('Share link').inputValue();
  expect(publicShareUrl).toContain('/project/');

  const editorPageClasses = await page.locator('.magazine-sheet--editor .magazine-page').first().getAttribute('class');
  // Editor-only hints (the frame label chips) are chrome, not page copy.
  const editorPageCopy = await page
    .locator('.magazine-sheet--editor .magazine-page')
    .first()
    .evaluate((element) => {
      const clone = element.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('.asset-frame__hint').forEach((node) => node.remove());
      return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
    });

  const viewerErrors: string[] = [];
  page.on('pageerror', (error) => viewerErrors.push(error.message));
  await page.goto(publicShareUrl);
  await expect(page.getByText(title).first()).toBeVisible();
  // The public reader must render the same page model: identical template,
  // theme and visible copy, not an approximation.
  await expect(page.locator('.magazine-page').first()).toHaveAttribute('class', editorPageClasses ?? '');
  const readerPageCopy = await page
    .locator('.magazine-page')
    .first()
    .evaluate((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim());
  expect(readerPageCopy).toBe(editorPageCopy);
  // The public reader renders its pages inside a detached React root; this
  // guards against provider/context regressions that used to blank the book.
  await expect(page.locator('.magazine-page').first()).toBeVisible();
  expect(viewerErrors).toEqual([]);

  await page.goto(editorUrl);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('button', { name: /A3/ }).click();
  // Pin Standard quality so the DPI assertion below has an exact target.
  await page.getByRole('button', { name: /180 dpi/ }).click();
  const folioPageCount = await page.locator('.page-chip').count();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Export PDF$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await download.path();
  expect(pdfPath).toBeTruthy();
  const pdfBytes = fs.readFileSync(pdfPath as string);
  expect(pdfBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(pdfBytes.length).toBeGreaterThan(10_000);

  // The exported PDF must contain one page per folio page and keep A4 geometry.
  const pdfDocument = await PDFDocument.load(pdfBytes);
  expect(pdfDocument.getPageCount()).toBe(folioPageCount);
  const pdfPageSize = pdfDocument.getPage(0).getSize();

  // Sheet geometry: A3 in PostScript points, keeping the A-series ratio.
  const a3WidthPt = (297 / 25.4) * 72;
  const a3HeightPt = (420 / 25.4) * 72;
  expect(Math.abs(pdfPageSize.width - a3WidthPt)).toBeLessThan(1);
  expect(Math.abs(pdfPageSize.height - a3HeightPt)).toBeLessThan(1);
  expect(pdfPageSize.width / pdfPageSize.height).toBeCloseTo(297 / 420, 3);

  // Density: the embedded raster must carry the configured 180 dpi on both
  // axes instead of whatever the capture canvas happened to produce.
  const pdfText = pdfBytes.toString('latin1');
  const rasterWidths = [...pdfText.matchAll(/\/Width\s+(\d+)/g)].map((entry) => Number(entry[1]));
  const rasterHeights = [...pdfText.matchAll(/\/Height\s+(\d+)/g)].map((entry) => Number(entry[1]));
  expect(rasterWidths.length).toBe(pdfDocument.getPageCount());
  expect(rasterHeights.length).toBe(pdfDocument.getPageCount());
  const horizontalDpi = rasterWidths[0] / (pdfPageSize.width / 72);
  const verticalDpi = rasterHeights[0] / (pdfPageSize.height / 72);
  expect(horizontalDpi).toBeGreaterThan(176);
  expect(horizontalDpi).toBeLessThan(184);
  expect(Math.abs(horizontalDpi - verticalDpi)).toBeLessThan(2);
  console.log(
    `[evidence] pdf pages=${pdfDocument.getPageCount()} sheet=${pdfPageSize.width.toFixed(2)}x${pdfPageSize.height.toFixed(2)}pt raster=${rasterWidths[0]}x${rasterHeights[0]}px dpi=${horizontalDpi.toFixed(1)}/${verticalDpi.toFixed(1)}`,
  );

  // The print path stays available as a secondary action and must still use the
  // same page renderer as the editor preview.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.evaluate(() => {
    const runtime = window as PrintRuntime;
    runtime.__holdPrintOpen = true;
  });
  await page.getByRole('button', { name: 'Print instead' }).click();
  await expect.poll(async () => page.evaluate(() => (window as PrintRuntime).__printCalls ?? 0)).toBe(1);
  // Geometry is measured from image boxes, so wait until the print capture has
  // decoded every image and web fonts have settled; otherwise a partially
  // decoded image reports a slightly different cover size.
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>('main .asset-frame img, .editor-print-stack .asset-frame img'),
    );
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    // Font swaps and image decodes reflow the page on the next frame.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  const readExportGeometry = () =>
    page.evaluate(() => {
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

  // Font swaps and image decodes can reflow the page a frame or two after the
  // print capture starts (sub-pixel cover sizing). Poll until the two layouts
  // settle and agree; a genuinely different renderer never converges.
  await expect
    .poll(
      async () => {
        const geometry = await readExportGeometry();
        if (!geometry) {
          return 1;
        }
        return Math.max(
          Math.abs(geometry.preview.ratioW - geometry.print.ratioW),
          Math.abs(geometry.preview.ratioH - geometry.print.ratioH),
        );
      },
      { timeout: 5000, intervals: [100, 200, 400, 800] },
    )
    .toBeLessThan(0.002);

  await page.evaluate(() => {
    const runtime = window as PrintRuntime;
    runtime.__holdPrintOpen = false;
    window.dispatchEvent(new Event('afterprint'));
  });

  await page.goto('/account');
  await expect(page.getByText('Exported a project').first()).toBeVisible();
});
