import type { PageData } from '../editor/types';

export type ViewerPositionMode = 'single-right' | 'spread' | 'single-left';
export type TurnJsDisplayMode = 'single' | 'double';
export type VisibleTurnView = [number, number];

export type IssueCurrentView = {
  label: string;
  rangeLabel: string;
  mode: ViewerPositionMode;
  canGoPrev: boolean;
  canGoNext: boolean;
};

export type RenderedViewerPage = {
  id: string;
  page: PageData | null;
  pageNumber: number | null;
  blankLabel: string;
  decorativeBlank: boolean;
};

export const MOBILE_SINGLE_PAGE_MEDIA_QUERY = '(max-width: 760px) and (orientation: portrait) and (hover: none) and (pointer: coarse)';

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function measureCssLengthInPixels(value: string) {
  if (!value || typeof document === 'undefined') {
    return 0;
  }

  const probe = document.createElement('div');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.pointerEvents = 'none';
  probe.style.inlineSize = value;
  probe.style.blockSize = value;
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return rect.width;
}

export function readSheetMetrics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { width: 794, height: 1123 };
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const width = measureCssLengthInPixels(rootStyles.getPropertyValue('--sheet-width').trim() || '210mm');
  const height = measureCssLengthInPixels(rootStyles.getPropertyValue('--sheet-height').trim() || '297mm');

  return {
    width: width || 794,
    height: height || 1123,
  };
}

function pickViewLabel(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function buildRangeLabel(start: number | null, end: number | null, total: number) {
  if (typeof start !== 'number') {
    return `Pages unavailable of ${total}`;
  }

  if (typeof end === 'number' && end !== start) {
    return `Pages ${start}-${end} of ${total}`;
  }

  return `Page ${start} of ${total}`;
}

export function buildRenderedViewerPages(pages: PageData[]) {
  return pages.map((page, index) => ({
    id: page.id,
    page,
    pageNumber: index + 1,
    blankLabel: 'Blank page',
    decorativeBlank: false,
  }));
}

function getRenderedPageSide(pageNumber: number | null, totalPages: number): 'single' | 'left' | 'right' {
  if (pageNumber === 1) {
    return 'single';
  }

  if (pageNumber === totalPages && totalPages % 2 === 0) {
    return 'left';
  }

  return pageNumber !== null && pageNumber % 2 === 0 ? 'left' : 'right';
}

function getVisibleViewForPage(page: number, totalPages: number): VisibleTurnView {
  if (!totalPages) {
    return [0, 0];
  }

  if (page <= 1) {
    return [0, 1];
  }

  if (page >= totalPages && totalPages % 2 === 0) {
    return [totalPages, 0];
  }

  if (page % 2 === 0) {
    return [page, Math.min(page + 1, totalPages)];
  }

  return [Math.max(0, page - 1), page];
}

export function normalizeVisibleTurnView(view: unknown, totalPages: number, fallbackPage: number): VisibleTurnView {
  if (Array.isArray(view) && view.length >= 2) {
    const left = typeof view[0] === 'number' ? clamp(Math.round(view[0]), 0, totalPages) : 0;
    const right = typeof view[1] === 'number' ? clamp(Math.round(view[1]), 0, totalPages) : 0;
    return [left, right];
  }

  return getVisibleViewForPage(fallbackPage, totalPages);
}

export function describeVisibleView(view: VisibleTurnView, pages: PageData[]): IssueCurrentView {
  const totalPages = pages.length;
  const leftPageNumber = view[0] > 0 ? view[0] : null;
  const rightPageNumber = view[1] > 0 ? view[1] : null;
  const leftPage = leftPageNumber ? pages[leftPageNumber - 1] ?? null : null;
  const rightPage = rightPageNumber ? pages[rightPageNumber - 1] ?? null : null;

  if (!leftPage && rightPage) {
    return {
      label: pickViewLabel(rightPage.title, 'Cover'),
      rangeLabel: buildRangeLabel(rightPageNumber, null, totalPages),
      mode: 'single-right',
      canGoPrev: false,
      canGoNext: rightPageNumber !== null && rightPageNumber < totalPages,
    };
  }

  if (leftPage && !rightPage) {
    return {
      label: pickViewLabel(leftPage.title, `Page ${leftPageNumber}`),
      rangeLabel: buildRangeLabel(leftPageNumber, null, totalPages),
      mode: 'single-left',
      canGoPrev: leftPageNumber !== null && leftPageNumber > 1,
      canGoNext: false,
    };
  }

  const fallbackLabel =
    typeof leftPageNumber === 'number' && typeof rightPageNumber === 'number'
      ? `Pages ${leftPageNumber}-${rightPageNumber}`
      : typeof leftPageNumber === 'number'
        ? `Page ${leftPageNumber}`
        : 'Spread';

  return {
    label: pickViewLabel(leftPage?.title, rightPage?.title, fallbackLabel),
    rangeLabel: buildRangeLabel(leftPageNumber, rightPageNumber, totalPages),
    mode: 'spread',
    canGoPrev: typeof leftPageNumber === 'number' && leftPageNumber > 1,
    canGoNext: Math.max(view[0], view[1]) < totalPages,
  };
}

export function describeSinglePageView(pageNumber: number, pages: PageData[]): IssueCurrentView {
  const totalPages = pages.length;
  const normalizedPageNumber = clamp(pageNumber, 1, Math.max(totalPages, 1));
  const page = pages[normalizedPageNumber - 1] ?? null;
  const side = getRenderedPageSide(normalizedPageNumber, totalPages);

  return {
    label: pickViewLabel(page?.title, normalizedPageNumber === 1 ? 'Cover' : `Page ${normalizedPageNumber}`),
    rangeLabel: buildRangeLabel(normalizedPageNumber, null, totalPages),
    mode: side === 'left' ? 'single-left' : 'single-right',
    canGoPrev: normalizedPageNumber > 1,
    canGoNext: normalizedPageNumber < totalPages,
  };
}

export function getLeadingVisiblePage(view: VisibleTurnView, totalPages: number) {
  if (view[0] > 0) {
    return clamp(view[0], 1, Math.max(totalPages, 1));
  }

  if (view[1] > 0) {
    return clamp(view[1], 1, Math.max(totalPages, 1));
  }

  return 1;
}

export function getMobileStageSide(pageNumber: number, totalPages: number): 'left' | 'right' {
  return getRenderedPageSide(pageNumber, totalPages) === 'left' ? 'left' : 'right';
}
