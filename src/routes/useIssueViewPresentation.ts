import { translate, useLocale } from '../i18n';
import { useMemo } from 'react';
import type { PageData } from '../editor/types';
import {
  clamp,
  describeSinglePageView,
  describeVisibleView,
  readSheetMetrics,
  type TurnJsDisplayMode,
  type VisibleTurnView,
} from './issueViewReaderState';

type ViewportSize = {
  width: number;
  height: number;
};

type UseIssueViewPresentationOptions = {
  currentViewPages: VisibleTurnView;
  effectiveViewerViewportSize: ViewportSize;
  fullscreenActive: boolean;
  mobileSinglePageActive: boolean;
  mobileVisiblePage: number;
  pageCount: number;
  pages: PageData[];
  shareId: string;
};

export function useIssueViewPresentation({
  currentViewPages,
  effectiveViewerViewportSize,
  fullscreenActive,
  mobileSinglePageActive,
  mobileVisiblePage,
  pageCount,
  pages,
  shareId,
}: UseIssueViewPresentationOptions) {
  const { locale } = useLocale();
  const sheetMetrics = useMemo(() => readSheetMetrics(), []);

  return useMemo(() => {
    const normalizedView = pageCount ? currentViewPages : ([0, 0] as VisibleTurnView);
    const normalizedMobileVisiblePage = clamp(mobileVisiblePage, 1, Math.max(pageCount, 1));
    const currentView = mobileSinglePageActive
      ? describeSinglePageView(normalizedMobileVisiblePage, pages)
      : describeVisibleView(normalizedView, pages);
    // Mobile reads one page at a time. Using turn.js's native single-page
    // display (instead of a translated double spread) keeps the drag following
    // the finger and removes the post-turn camera slide that briefly showed the
    // next odd page after turning to an even page.
    const viewerDisplayMode: TurnJsDisplayMode = mobileSinglePageActive ? 'single' : 'double';
    const layoutPageCount = mobileSinglePageActive ? 1 : 2;
    const viewerFramePad = 18;
    const viewerAvailableWidth =
      effectiveViewerViewportSize.width > 0
        ? effectiveViewerViewportSize.width
        : sheetMetrics.width * layoutPageCount + viewerFramePad * 2;
    const viewerAvailableHeight =
      effectiveViewerViewportSize.height > 0
        ? effectiveViewerViewportSize.height
        : sheetMetrics.height + viewerFramePad * 2;
    const usableViewerWidth = Math.max(1, viewerAvailableWidth - viewerFramePad * 2);
    const usableViewerHeight = Math.max(1, viewerAvailableHeight - viewerFramePad * 2);
    const pageWidth = Number(
      Math.min(
        sheetMetrics.width,
        usableViewerWidth / layoutPageCount,
        (usableViewerHeight * sheetMetrics.width) / sheetMetrics.height,
      ).toFixed(2),
    );
    const pageHeight = Number(((pageWidth * sheetMetrics.height) / sheetMetrics.width).toFixed(2));
    const pageScale = Number((pageWidth / sheetMetrics.width).toFixed(4));
    const viewerStageWidth = Math.round(pageWidth * layoutPageCount);
    const viewerClipWidth = Math.round(pageWidth * layoutPageCount + viewerFramePad * 2);
    const viewerClipHeight = Math.round(pageHeight + viewerFramePad * 2);
    const viewerReady = pageCount > 0 && pageWidth > 0 && pageHeight > 0;
    const showDesktopSidebar = !mobileSinglePageActive && !fullscreenActive;
    const showMobileChrome = mobileSinglePageActive && !fullscreenActive;
    const viewerHint = mobileSinglePageActive
      ? translate('Swipe across the page or use the controls below to move through the folio one page at a time.')
      : translate('Use left/right keys, drag the outer page, or click the page edge to turn the book.');
    const bookKey = `${shareId}:${pageCount}:${mobileSinglePageActive ? 'mobile' : 'desktop'}`;

    return {
      bookKey,
      currentView,
      pageHeight,
      pageScale,
      pageWidth,
      sheetMetrics,
      showDesktopSidebar,
      showMobileChrome,
      viewerClipHeight,
      viewerClipWidth,
      viewerDisplayMode,
      viewerHint,
      viewerPositionMode: currentView.mode,
      viewerReady,
      viewerStageWidth,
    };
  }, [
    locale,
    currentViewPages,
    effectiveViewerViewportSize.height,
    effectiveViewerViewportSize.width,
    fullscreenActive,
    mobileSinglePageActive,
    mobileVisiblePage,
    pageCount,
    pages,
    shareId,
    sheetMetrics,
  ]);
}
