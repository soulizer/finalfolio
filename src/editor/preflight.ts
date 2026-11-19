import { calculateImageRenderGeometry } from './imageGeometry';
import { BINDING_SAFE_MARGIN_MM, exportPageSizeMeta, getEffectiveExportDpi } from './export';
import { Asset, ExportPreflightIssue, ExportSettings, PageData, ProjectState } from './types';

const builtInSlotAreaRatio: Record<string, Record<string, number>> = {
  cover: { hero: 0.44 },
  essay: { hero: 0.38 },
  folio: { hero: 0.52 },
  grid: { a: 0.12, b: 0.12, c: 0.12, d: 0.12 },
  diptych: { left: 0.22, right: 0.22 },
  panorama: { top: 0.17, bottom: 0.17 },
  mosaic: { lead: 0.27, top: 0.11, bottom: 0.11 },
  triptych: { a: 0.15, b: 0.15, c: 0.15 },
};

function getPageTitle(page: PageData, pageIndex: number) {
  return page.title.trim() || `Page ${pageIndex + 1}`;
}

function getSlotAreaRatio(page: PageData, slot: string) {
  if (page.template === 'custom' && page.customTemplate) {
    const frame = page.customTemplate.frames.find((entry) => entry.slot === slot);
    if (frame) {
      return (frame.width / 100) * (frame.height / 100);
    }
  }

  return builtInSlotAreaRatio[page.template]?.[slot] ?? 0.12;
}

function getApproximateFrameSizePx(slotAreaRatio: number, pagePixelWidth: number, pagePixelHeight: number) {
  const pageArea = pagePixelWidth * pagePixelHeight;
  const slotAreaPx = pageArea * Math.max(0.02, slotAreaRatio);
  const pageAspectRatio = pagePixelWidth / Math.max(pagePixelHeight, 1);
  const slotWidth = Math.sqrt(slotAreaPx * pageAspectRatio);
  const slotHeight = slotAreaPx / Math.max(slotWidth, 1);

  return {
    width: Math.max(120, Math.round(slotWidth)),
    height: Math.max(120, Math.round(slotHeight)),
  };
}

function pageHasMainContent(page: PageData) {
  return [page.kicker, page.title, page.deck, page.body, page.caption].some((value) => value.trim().length > 0);
}

function createIssue(
  page: PageData,
  pageIndex: number,
  message: string,
  code: ExportPreflightIssue['code'],
  slot?: string,
): ExportPreflightIssue {
  return {
    code,
    severity: 'warning',
    pageId: page.id,
    pageIndex,
    pageTitle: getPageTitle(page, pageIndex),
    slot,
    message,
  };
}

function getPlacedAsset(page: PageData, assetsById: Record<string, Asset>, slot: string) {
  const assetId = page.slots[slot];
  return assetId ? assetsById[assetId] ?? null : null;
}

export type ExportBindingMetrics = {
  /** Inner (spine-side) margin of the rendered page, in millimetres. */
  innerMarginMm: number | null;
};

export function runExportPreflight(
  project: ProjectState,
  settings: ExportSettings,
  binding?: ExportBindingMetrics,
) {
  const issues: ExportPreflightIssue[] = [];
  const pageSize = exportPageSizeMeta[settings.pageSize];
  const dpi = getEffectiveExportDpi(settings);
  const pagePixelWidth = Math.round((pageSize.widthMm / 25.4) * dpi);
  const pagePixelHeight = Math.round((pageSize.heightMm / 25.4) * dpi);
  const assetsById = Object.fromEntries(project.assets.map((asset) => [asset.id, asset]));

  project.pages.forEach((page, pageIndex) => {
    const slotEntries = Object.entries(page.slots);
    const placedAssets = slotEntries.filter(([, assetId]) => typeof assetId === 'string');

    if (placedAssets.length === 0 && !pageHasMainContent(page)) {
      issues.push(createIssue(page, pageIndex, 'This page has no placed image and no text content.', 'empty-page'));
    }

    slotEntries.forEach(([slot, assetId]) => {
      if (!assetId) {
        issues.push(createIssue(page, pageIndex, `Frame ${slot} is empty.`, 'missing-image', slot));
        return;
      }

      const asset = assetsById[assetId];
      if (!asset || !asset.width || !asset.height) {
        return;
      }

      const slotAreaRatio = getSlotAreaRatio(page, slot);
      const frameSize = getApproximateFrameSizePx(slotAreaRatio, pagePixelWidth, pagePixelHeight);
      const crop = page.crops[slot];
      const geometry = calculateImageRenderGeometry(frameSize, { width: asset.width, height: asset.height }, crop);
      if (crop?.fit === 'contain' || (geometry && (geometry.scaledWidth < frameSize.width || geometry.scaledHeight < frameSize.height))) {
        issues.push(
          createIssue(
            page,
            pageIndex,
            `Frame ${slot} will expose page background because the image is not covering the full frame.`,
            'uncovered-frame',
            slot,
          ),
        );
      }

      const requiredPixelArea = pagePixelWidth * pagePixelHeight * slotAreaRatio;
      const effectiveSourceArea = (asset.width * asset.height) / Math.max((crop?.scale ?? 1) ** 2, 1);
      if (effectiveSourceArea < requiredPixelArea * 0.58) {
        issues.push(
          createIssue(
            page,
            pageIndex,
            `Frame ${slot} is drawing from a source image that is too small for this export size and quality.`,
            'low-resolution',
            slot,
          ),
        );
      }
    });
  });

  // Binding geometry: a bound copy needs an even page count (otherwise the
  // inside back cover stays blank) and enough spine-side margin for the glue
  // or stitching to swallow no content.
  const isPrintOutput = settings.format === 'pdf' || settings.format === 'jpg';
  if (isPrintOutput && project.pages.length % 2 === 1) {
    issues.push({
      code: 'odd-page-count',
      severity: 'warning',
      pageId: '',
      pageIndex: -1,
      pageTitle: 'Whole folio',
      message: `This folio has ${project.pages.length} pages. Bound output needs an even count, or the inside back page stays blank.`,
    });
  }

  const innerMarginMm = binding?.innerMarginMm ?? null;
  if (isPrintOutput && innerMarginMm !== null && innerMarginMm < BINDING_SAFE_MARGIN_MM) {
    issues.push({
      code: 'tight-gutter',
      severity: 'warning',
      pageId: '',
      pageIndex: -1,
      pageTitle: 'Whole folio',
      message: `The inner page margin is ${innerMarginMm.toFixed(1)} mm. Binding needs at least ${BINDING_SAFE_MARGIN_MM} mm so no content is lost in the gutter.`,
    });
  }

  // Folio-level geometry decides whether the whole output binds correctly, so
  // it must not be pushed past the per-frame warnings the list truncates at.
  const folioLevel = issues.filter((issue) => !issue.pageId);
  const perPage = issues.filter((issue) => Boolean(issue.pageId));
  return [...folioLevel, ...perPage];
}
