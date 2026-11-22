import { ForwardedRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Asset, ProjectFonts } from '../editor/types';
import {
  clamp,
  normalizeVisibleTurnView,
  type RenderedViewerPage,
  type TurnJsDisplayMode,
  type VisibleTurnView,
} from './issueViewReaderState';

export type TurnJsBookHandle = {
  next: () => void;
  previous: () => void;
  page: (page: number) => void;
  refreshLayout: () => void;
};

type TurnJsPageChangeHandler = (view: VisibleTurnView, page: number) => void;

type UseIssueTurnJsRuntimeOptions = {
  ref: ForwardedRef<TurnJsBookHandle>;
  issueLabel: string;
  renderedPages: RenderedViewerPage[];
  assetsById: Record<string, Asset>;
  frameRadius: number;
  fonts?: ProjectFonts;
  sheetWidth: number;
  sheetHeight: number;
  pageWidth: number;
  pageHeight: number;
  displayMode: TurnJsDisplayMode;
  initialPage: number;
  onViewChange: TurnJsPageChangeHandler;
  onTurningChange: (turning: boolean) => void;
  onTurnTargetChange?: (view: VisibleTurnView | null) => void;
};

type TurnJsInstance = any;

type SyncTurnJsLayoutOptions = {
  currentPage: number;
  displayMode: TurnJsDisplayMode;
  onViewChange: TurnJsPageChangeHandler;
  pageHeight: number;
  pageWidth: number;
  spreadPageCount: number;
  totalPages: number;
};

type InitializeTurnJsOptions = {
  assetsById: Record<string, Asset>;
  currentPageRef: { current: number };
  displayMode: TurnJsDisplayMode;
  frameRadius: number;
  fonts?: ProjectFonts;
  isDisposed: () => boolean;
  issueLabel: string;
  onTurningChangeRef: { current: (turning: boolean) => void };
  onViewChangeRef: { current: TurnJsPageChangeHandler };
  onTurnTargetChangeRef: { current: (view: VisibleTurnView | null) => void };
  pageHeight: number;
  pageWidth: number;
  renderedPages: RenderedViewerPage[];
  sheetHeight: number;
  sheetWidth: number;
  spreadPageCount: number;
  targetPage: number;
  turnHost: HTMLDivElement;
};

function clearIdlePeelAffordance(turnInstance: TurnJsInstance) {
  if (!turnInstance?.turn) {
    return;
  }

  turnInstance.turn('peel', false, false);
}

function syncTurnJsViewState(
  turnInstance: TurnJsInstance,
  totalPages: number,
  onViewChange: TurnJsPageChangeHandler,
) {
  const currentPage = Number(turnInstance.turn('page')) || 1;
  clearIdlePeelAffordance(turnInstance);
  onViewChange(normalizeVisibleTurnView(turnInstance.turn('view'), totalPages, currentPage), currentPage);
}

function setTurnJsAnimatedCentering(turnInstance: TurnJsInstance, animated: boolean) {
  const bookElement = turnInstance?.[0] as HTMLElement | undefined;
  if (!bookElement) {
    return;
  }

  bookElement.classList.toggle('animated', animated);
}

function markTurnJsReady(turnInstance: TurnJsInstance) {
  const bookElement = turnInstance?.[0] as HTMLElement | undefined;
  if (!bookElement) {
    return;
  }

  // Hide the original source pages after Turn.js has built its page wrappers.
  // Without this, the raw page nodes can remain visible on first paint and overlap the active spread.
  bookElement.classList.add('issue-viewer__turnjs--ready');
}

function syncTurnJsToPage(
  turnInstance: TurnJsInstance,
  currentPageRef: { current: number },
  targetPage: number,
  totalPages: number,
) {
  const safePage = clamp(targetPage, 1, Math.max(totalPages, 1));
  currentPageRef.current = safePage;
  turnInstance.turn('page', safePage);
  return safePage;
}

function syncTurnJsLayout(turnInstance: TurnJsInstance, currentPageRef: { current: number }, options: SyncTurnJsLayoutOptions) {
  markTurnJsReady(turnInstance);
  turnInstance.turn('display', options.displayMode);
  turnInstance.turn('size', Math.round(options.pageWidth * options.spreadPageCount), Math.round(options.pageHeight));
  syncTurnJsToPage(turnInstance, currentPageRef, options.currentPage, options.totalPages);
  turnInstance.turn('center');
  syncTurnJsViewState(turnInstance, options.totalPages, options.onViewChange);
}

function destroyTurnJsBook(turnHost: HTMLDivElement, turnInstance: TurnJsInstance | null) {
  setTurnJsAnimatedCentering(turnInstance, false);

  try {
    turnInstance?.turn('destroy');
  } catch {
    try {
      turnInstance?.turn('disable', true);
    } catch {
      // noop
    }
  }

  turnHost.innerHTML = '';
}

async function initializeTurnJs({
  assetsById,
  currentPageRef,
  displayMode,
  frameRadius,
  fonts,
  isDisposed,
  issueLabel,
  onTurningChangeRef,
  onTurnTargetChangeRef,
  onViewChangeRef,
  pageHeight,
  pageWidth,
  renderedPages,
  sheetHeight,
  sheetWidth,
  spreadPageCount,
  targetPage,
  turnHost,
}: InitializeTurnJsOptions) {
  const [{ ensureTurnJsLoaded, turn$ }, { renderTurnJsPageMarkup }] = await Promise.all([
    import('../turnjs'),
    import('./issueViewTurnJsMarkup'),
  ]);
  await ensureTurnJsLoaded();

  if (isDisposed()) {
    return null;
  }

  const activeTurnHost = turnHost.isConnected ? turnHost : null;
  if (!activeTurnHost) {
    return null;
  }

  const $book = turn$(activeTurnHost);
  activeTurnHost.innerHTML = renderTurnJsPageMarkup({
    issue: issueLabel,
    renderedPages,
    assets: assetsById,
    frameRadius,
    fonts,
    sheetWidth,
    sheetHeight,
  });
  // A spine crease above the pages. Turn.js only paints gradients on the
  // turning leaf, so a page closing toward the spine had no matching center
  // shading. The overlay lives in the book plane (it follows auto-centering)
  // and is ignored by turn.js via `ignore=1`.
  if (!activeTurnHost.querySelector('.issue-turnjs__hinge')) {
    activeTurnHost.insertAdjacentHTML(
      'beforeend',
      '<div class="issue-turnjs__hinge" ignore="1" aria-hidden="true"></div>',
    );
  }

  $book.turn({
    width: Math.round(pageWidth * spreadPageCount),
    height: Math.round(pageHeight),
    display: displayMode,
    autoCenter: true,
    gradients: true,
    acceleration: true,
    duration: 500,
    elevation: '10%',
    cornerSize: 50,
    cornerPosition: '50px 20px',
    smartFlip: true,
    swipe: true,
    turnCorners: 'bl,br',
    page: clamp(targetPage, 1, renderedPages.length),
    pages: renderedPages.length,
    when: {
      turning: (_event: unknown, page: number, view: number[]) => {
        setTurnJsAnimatedCentering($book, true);
        // Turn.js passes the destination view here. The parent uses it only to
        // classify the turn (an opening, a closing, or a spread-to-spread
        // turn); the body shadow itself stays on the pages still lying flat.
        onTurnTargetChangeRef.current(
          normalizeVisibleTurnView(view, renderedPages.length, page ?? currentPageRef.current),
        );
        onTurningChangeRef.current(true);
      },
      turned: (_event: unknown, page: number, view: number[]) => {
        const normalizedView = normalizeVisibleTurnView(view, renderedPages.length, page);
        currentPageRef.current = page;
        setTurnJsAnimatedCentering($book, false);
        // Publish the landed view before clearing the turn target. If the target
        // is cleared first, React briefly renders the old view with no target,
        // which flashes the source-side body shadow back in exactly at landing.
        onViewChangeRef.current(normalizedView, page);
        onTurnTargetChangeRef.current(null);
        onTurningChangeRef.current(false);
        clearIdlePeelAffordance($book);
      },
      end: (_event: unknown, _page: number, completed: boolean) => {
        setTurnJsAnimatedCentering($book, false);
        // `turned` follows a completed flip and publishes the new view there.
        // A cancelled drag never reaches it, so clear the in-flight state here.
        if (!completed) {
          onTurnTargetChangeRef.current(null);
          onTurningChangeRef.current(false);
        }
      },
    },
  });

  return $book;
}

export function useIssueTurnJsRuntime({
  ref,
  issueLabel,
  renderedPages,
  assetsById,
  frameRadius,
  fonts,
  sheetWidth,
  sheetHeight,
  pageWidth,
  pageHeight,
  displayMode,
  initialPage,
  onViewChange,
  onTurningChange,
  onTurnTargetChange,
}: UseIssueTurnJsRuntimeOptions) {
  const bookRef = useRef<HTMLDivElement | null>(null);
  const turnInstanceRef = useRef<TurnJsInstance | null>(null);
  const [bookReady, setBookReady] = useState(false);
  const onViewChangeRef = useRef(onViewChange);
  const onTurningChangeRef = useRef(onTurningChange);
  const onTurnTargetChangeRef = useRef(onTurnTargetChange ?? (() => undefined));
  const pageWidthRef = useRef(pageWidth);
  const pageHeightRef = useRef(pageHeight);
  const currentPageRef = useRef(clamp(initialPage, 1, Math.max(renderedPages.length, 1)));

  useEffect(() => {
    pageWidthRef.current = pageWidth;
    pageHeightRef.current = pageHeight;
  }, [pageHeight, pageWidth]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    onTurningChangeRef.current = onTurningChange;
  }, [onTurningChange]);

  useEffect(() => {
    onTurnTargetChangeRef.current = onTurnTargetChange ?? (() => undefined);
  }, [onTurnTargetChange]);

  const spreadPageCount = displayMode === 'double' ? 2 : 1;
  const canInitializeTurnJs = renderedPages.length > 0 && pageWidth > 0 && pageHeight > 0;

  useImperativeHandle(
    ref,
    () => ({
      next() {
        turnInstanceRef.current?.turn('next');
      },
      previous() {
        turnInstanceRef.current?.turn('previous');
      },
      page(page: number) {
        const turnInstance = turnInstanceRef.current;
        if (!turnInstance) {
          return;
        }

        syncTurnJsToPage(turnInstance, currentPageRef, page, renderedPages.length);
      },
      refreshLayout() {
        const turnInstance = turnInstanceRef.current;
        if (!turnInstance) {
          return;
        }

        syncTurnJsLayout(turnInstance, currentPageRef, {
          currentPage: currentPageRef.current,
          displayMode,
          onViewChange: onViewChangeRef.current,
          pageHeight: pageHeightRef.current,
          pageWidth: pageWidthRef.current,
          spreadPageCount,
          totalPages: renderedPages.length,
        });
      },
    }),
    [displayMode, renderedPages.length, spreadPageCount],
  );

  useEffect(() => {
    const turnHost = bookRef.current;
    if (!turnHost || !canInitializeTurnJs) {
      return;
    }

    let disposed = false;
    setBookReady(false);

    void initializeTurnJs({
      assetsById,
      currentPageRef,
      displayMode,
      frameRadius,
      isDisposed: () => disposed,
      issueLabel,
      onTurningChangeRef,
      onTurnTargetChangeRef,
      onViewChangeRef,
      pageHeight: pageHeightRef.current,
      pageWidth: pageWidthRef.current,
      renderedPages,
      sheetHeight,
      sheetWidth,
      spreadPageCount,
      targetPage: currentPageRef.current,
      turnHost,
    }).then((turnInstance) => {
      if (!turnInstance) {
        return;
      }

      if (disposed) {
        destroyTurnJsBook(turnHost, turnInstance);
        return;
      }

      turnInstanceRef.current = turnInstance;
      setBookReady(true);
      syncTurnJsLayout(turnInstance, currentPageRef, {
        currentPage: currentPageRef.current,
        displayMode,
        onViewChange: onViewChangeRef.current,
        pageHeight: pageHeightRef.current,
        pageWidth: pageWidthRef.current,
        spreadPageCount,
        totalPages: renderedPages.length,
      });
      setTurnJsAnimatedCentering(turnInstance, false);
      onTurningChangeRef.current(false);
    });

    return () => {
      disposed = true;
      setBookReady(false);
      destroyTurnJsBook(turnHost, turnInstanceRef.current);
      turnInstanceRef.current = null;
    };
  }, [assetsById, canInitializeTurnJs, displayMode, fonts, frameRadius, issueLabel, renderedPages, sheetHeight, sheetWidth, spreadPageCount]);

  useEffect(() => {
    const turnInstance = turnInstanceRef.current;
    if (!turnInstance) {
      return;
    }

    syncTurnJsLayout(turnInstance, currentPageRef, {
      currentPage: currentPageRef.current,
      displayMode,
      onViewChange: onViewChangeRef.current,
      pageHeight,
      pageWidth,
      spreadPageCount,
      totalPages: renderedPages.length,
    });
  }, [displayMode, pageHeight, pageWidth, renderedPages.length, spreadPageCount]);

  useEffect(() => {
    const turnInstance = turnInstanceRef.current;
    if (!turnInstance) {
      currentPageRef.current = clamp(initialPage, 1, Math.max(renderedPages.length, 1));
      return;
    }

    syncTurnJsLayout(turnInstance, currentPageRef, {
      currentPage: initialPage,
      displayMode,
      onViewChange: onViewChangeRef.current,
      pageHeight,
      pageWidth,
      spreadPageCount,
      totalPages: renderedPages.length,
    });
  }, [displayMode, initialPage, pageHeight, pageWidth, renderedPages.length, spreadPageCount]);

  return {
    bookRef,
    bookReady,
    spreadPageCount,
  };
}
