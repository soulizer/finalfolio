import JSZip from 'jszip';
import { toJpeg } from 'html-to-image';
import {
  ExportFormat,
  ExportPageSize,
  ExportQuality,
  ExportSettings,
  JpgExportMode,
  ProjectState,
} from './types';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_SIZE_SCALE: Record<ExportPageSize, number> = {
  a5: Math.SQRT1_2,
  a4: 1,
  a3: Math.SQRT2,
};

export const exportFormatMeta: Record<
  ExportFormat,
  { label: string; description: string }
> = {
  pdf: {
    label: 'PDF',
    description: 'Render every page into a downloadable PDF at the selected page size and quality.',
  },
  project: {
    label: 'FinalFolio Project',
    description: 'Download the project structure and reusable references instead of a flattened print file.',
  },
  jpg: {
    label: 'JPG',
    description: 'Render the current folio into images, either as a page set or a single stitched strip.',
  },
};

export const exportPageSizeMeta: Record<
  ExportPageSize,
  { label: string; widthMm: number; heightMm: number; description: string; emphasis: string; scale: number }
> = {
  a5: {
    label: 'A5',
    widthMm: Math.round(A4_WIDTH_MM * PAGE_SIZE_SCALE.a5 * 10) / 10,
    heightMm: Math.round(A4_HEIGHT_MM * PAGE_SIZE_SCALE.a5 * 10) / 10,
    description: 'Same ratio, smaller physical output.',
    emphasis: 'Smaller',
    scale: PAGE_SIZE_SCALE.a5,
  },
  a4: {
    label: 'A4',
    widthMm: A4_WIDTH_MM,
    heightMm: A4_HEIGHT_MM,
    description: 'Same ratio, original folio size.',
    emphasis: 'Original · Recommend',
    scale: PAGE_SIZE_SCALE.a4,
  },
  a3: {
    label: 'A3',
    widthMm: Math.round(A4_WIDTH_MM * PAGE_SIZE_SCALE.a3 * 10) / 10,
    heightMm: Math.round(A4_HEIGHT_MM * PAGE_SIZE_SCALE.a3 * 10) / 10,
    description: 'Same ratio, bigger physical output.',
    emphasis: 'Bigger',
    scale: PAGE_SIZE_SCALE.a3,
  },
};

export const exportQualityMeta: Record<
  ExportQuality,
  {
    label: string;
    description: string;
    baseDpi: number;
    jpegQuality: number;
    estimatedFileSizeLabel: string;
  }
> = {
  draft: {
    label: 'Draft',
    description: 'Fast proofing with lighter files.',
    baseDpi: 120,
    jpegQuality: 0.76,
    estimatedFileSizeLabel: 'Smallest files',
  },
  standard: {
    label: 'Standard',
    description: 'Balanced detail and shareability.',
    baseDpi: 180,
    jpegQuality: 0.86,
    estimatedFileSizeLabel: 'Medium files',
  },
  print: {
    label: 'Print',
    description: 'Higher detail with visibly larger files.',
    baseDpi: 300,
    jpegQuality: 0.92,
    estimatedFileSizeLabel: 'Largest files',
  },
};

export const jpgExportModeMeta: Record<
  JpgExportMode,
  { label: string; description: string }
> = {
  separate: {
    label: 'Multiple JPG files',
    description: 'Each page becomes its own JPG. Downloaded together as a ZIP package.',
  },
  combined: {
    label: 'Single stitched JPG',
    description: 'Stack all pages into one long vertical image.',
  },
};

function sanitizeFileBase(value: string) {
  const normalized = value.normalize('NFKC');
  const safe = normalized
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'Project';
}

export function buildExportFilenameBase(project: Pick<ProjectState, 'title' | 'issue'>) {
  return `${sanitizeFileBase(project.title.trim() || project.issue.trim() || 'Project')}_FinalFolio`;
}

export function getEffectiveExportDpi(settings: ExportSettings) {
  return exportQualityMeta[settings.quality].baseDpi;
}

export function getExportCapturePixelRatio(settings: ExportSettings) {
  return Math.max(1, getEffectiveExportDpi(settings) / 96);
}

export function getExportOptimizationOptions(settings: ExportSettings) {
  const quality = exportQualityMeta[settings.quality];
  const pageSize = exportPageSizeMeta[settings.pageSize];

  return {
    maxLongEdge: Math.round(pageSize.heightMm * (quality.baseDpi / 25.4)),
    jpegQuality: quality.jpegQuality,
    pixelRatio: getExportCapturePixelRatio(settings),
  };
}

export function buildExportAdvisories(settings: ExportSettings) {
  const advice: string[] = [];

  if (settings.format === 'pdf' && settings.quality === 'draft') {
    advice.push('Draft PDF is suitable for review, not for high-quality final print handoff.');
  }

  if (settings.pageSize === 'a3' && settings.quality !== 'print') {
    advice.push('A3 output usually benefits from Print quality because each page is physically larger.');
  }

  if (settings.pageSize === 'a5' && settings.quality === 'print') {
    advice.push('A5 at Print quality will stay sharp, but the file can become heavier than necessary for screen sharing.');
  }

  if (settings.format === 'project') {
    advice.push('Project export preserves structure and references instead of producing a flattened final deliverable.');
  }

  if (settings.format === 'jpg' && settings.jpgMode === 'combined') {
    advice.push('Single stitched JPG creates one long vertical image, which is easier to preview but heavier to open.');
  }

  return advice;
}

export function createProjectExportPayload(project: ProjectState, settings: ExportSettings) {
  return {
    type: 'finalfolio-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    project,
  };
}

export function createProjectExportBlob(project: ProjectState, settings: ExportSettings) {
  const payload = createProjectExportPayload(project, settings);
  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
}

export function downloadBlob(filename: string, blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Unable to convert blob to data URL.'));
    reader.readAsDataURL(blob);
  });
}

function extractBase64Payload(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,([\s\S]+)$/);
  if (!match || !match[2] || !match[3]) {
    throw new Error('Unable to decode exported image data.');
  }

  return match[3];
}

function dataUrlToImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to decode stitched export image.'));
    image.src = dataUrl;
  });
}

export function waitForFontsReady() {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return Promise.resolve();
  }

  return (document as Document & { fonts: FontFaceSet }).fonts.ready.catch(() => undefined);
}

export function applyPrintLayout(pageSize: ExportPageSize) {
  const preset = exportPageSizeMeta[pageSize];
  const root = document.documentElement;
  const previousWidth = root.style.getPropertyValue('--export-sheet-width');
  const previousHeight = root.style.getPropertyValue('--export-sheet-height');
  const previousScaleFactor = root.style.getPropertyValue('--export-sheet-scale-factor');
  const styleId = 'finalfolio-export-page-style';
  const existingStyle = document.getElementById(styleId);

  root.style.setProperty('--export-sheet-width', `${preset.widthMm}mm`);
  root.style.setProperty('--export-sheet-height', `${preset.heightMm}mm`);
  root.style.setProperty('--export-sheet-scale-factor', String(preset.scale));

  if (existingStyle) {
    existingStyle.remove();
  }

  const pageStyle = document.createElement('style');
  pageStyle.id = styleId;
  pageStyle.media = 'print';
  pageStyle.textContent = `@page { size: ${preset.widthMm}mm ${preset.heightMm}mm; margin: 0; }`;
  document.head.appendChild(pageStyle);

  return () => {
    if (previousWidth) {
      root.style.setProperty('--export-sheet-width', previousWidth);
    } else {
      root.style.removeProperty('--export-sheet-width');
    }

    if (previousHeight) {
      root.style.setProperty('--export-sheet-height', previousHeight);
    } else {
      root.style.removeProperty('--export-sheet-height');
    }

    if (previousScaleFactor) {
      root.style.setProperty('--export-sheet-scale-factor', previousScaleFactor);
    } else {
      root.style.removeProperty('--export-sheet-scale-factor');
    }

    pageStyle.remove();
  };
}

export async function capturePageNodeAsJpeg(node: HTMLElement, settings: ExportSettings) {
  await waitForFontsReady();
  const pixelRatio = getExportCapturePixelRatio(settings);
  const bounds = node.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width || node.scrollWidth || node.clientWidth));
  const height = Math.max(1, Math.round(bounds.height || node.scrollHeight || node.clientHeight));
  return await toJpeg(node, {
    quality: exportQualityMeta[settings.quality].jpegQuality,
    pixelRatio,
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    cacheBust: true,
    backgroundColor: '#f7f2ea',
    skipAutoScale: true,
  });
}

export async function createCombinedJpeg(dataUrls: string[], settings: ExportSettings) {
  const images = await Promise.all(dataUrls.map((dataUrl) => dataUrlToImage(dataUrl)));
  const width = Math.max(...images.map((image) => image.naturalWidth));
  const height = images.reduce((sum, image) => sum + image.naturalHeight, 0);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to build the stitched JPG export.');
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = '#f7f2ea';
  context.fillRect(0, 0, width, height);

  let currentTop = 0;
  images.forEach((image) => {
    context.drawImage(image, 0, currentTop, image.naturalWidth, image.naturalHeight);
    currentTop += image.naturalHeight;
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error('Unable to encode the stitched JPG export.'));
          return;
        }
        resolve(nextBlob);
      },
      'image/jpeg',
      exportQualityMeta[settings.quality].jpegQuality,
    );
  });

  return blob;
}

/**
 * Builds a real PDF file from rendered page JPEGs. pdf-lib is imported lazily so the
 * editor bundle only pays for it when someone actually exports a PDF.
 */
export async function createPdfFromJpegPages(
  pageCount: number,
  settings: ExportSettings,
  getPageJpeg: (index: number) => Promise<string>,
) {
  const { PDFDocument } = await import('pdf-lib');
  const preset = exportPageSizeMeta[settings.pageSize];
  const pageWidth = (preset.widthMm * 72) / 25.4;
  const pageHeight = (preset.heightMm * 72) / 25.4;
  const document = await PDFDocument.create();

  for (let index = 0; index < pageCount; index += 1) {
    const dataUrl = await getPageJpeg(index);
    const binary = atob(extractBase64Payload(dataUrl));
    const bytes = new Uint8Array(binary.length);
    for (let offset = 0; offset < binary.length; offset += 1) {
      bytes[offset] = binary.charCodeAt(offset);
    }

    const image = await document.embedJpg(bytes);
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const pdfBytes = await document.save();
  const buffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(buffer).set(pdfBytes);
  return new Blob([buffer], { type: 'application/pdf' });
}

export async function createJpegZip(
  pages: Array<{ name: string; dataUrl: string }>,
  project: Pick<ProjectState, 'title' | 'issue'>,
) {
  const zip = new JSZip();
  const baseName = buildExportFilenameBase(project);

  pages.forEach((page) => {
    zip.file(page.name, extractBase64Payload(page.dataUrl), {
      base64: true,
    });
  });

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    comment: `${baseName} JPG export`,
  });
}
