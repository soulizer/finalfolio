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
  pageHeight: number;
  pageWidth: number;
  renderedPages: RenderedViewerPage[];
  sheetHeight: number;
  sheetWidth: number;
  spreadPageCount: number;
  targetPage: number;
  turnHost: HTMLDivElement;
};

// The book's desk shadow is only allowed while every leaf lies flat. Turn.js
// records the lift in its own state: pages in flight (`pageMv`), a turn status,
// or a corner peel. Reading that state every frame keeps the shadow in step
// with the paper, even when a turn starts or cancels between React renders.
function isTurnJsLifted(turnInstance: TurnJsInstance) {
  const data = turnInstance?.data?.('t') as
    | { pageMv?: number[]; status?: string; peel?: unknown }
    | undefined;
  if (!data) {
    return false;
  }

  return (data.pageMv?.length ?? 0) > 0 || Boolean(data.status) || Boolean(data.peel);
}

// Marks the sheets that are actually rotated away from the flat plane. Their
// drop shadow travels with the paper, so a turn keeps depth without leaving a
// shadow on the desk. Resting pages never get the filter.
function syncLiftedLeafShadows(book: HTMLElement) {
  book.querySelectorAll<HTMLElement>('.page-wrapper').forEach((wrapper) => {
    const innerPage = wrapper.querySelector<HTMLElement>('.inner-page');
    const transform = innerPage ? window.getComputedStyle(innerPage).transform : 'none';
    const moving = transform !== '' && transform !== 'none';
    wrapper.classList.toggle('is-leaf-lifting', moving);
  });
}

function clearLiftedLeafShadows(book: HTMLElement) {
  book.querySelectorAll('.page-wrapper.is-leaf-lifting').forEach((wrapper) => {
    wrapper.classList.remove('is-leaf-lifting');
  });
}

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
  $book.turn({
    width: Math.round(pageWidth * spreadPageCount),
    height: Math.round(pageHeight),
    display: displayMode,
    autoCenter: true,
    // Turn.js paints its fold gradients on whichever page is moving or being
    // revealed, so the spine shading differed between forward and backward
    // turns. Off means no spine shading in either direction.
    gradients: false,
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
      turning: () => {
        setTurnJsAnimatedCentering($book, true);
        onTurningChangeRef.current(true);
      },
      turned: (_event: unknown, page: number, view: number[]) => {
        const normalizedView = normalizeVisibleTurnView(view, renderedPages.length, page);
        currentPageRef.current = page;
        setTurnJsAnimatedCentering($book, false);
        onViewChangeRef.current(normalizedView, page);
        onTurningChangeRef.current(false);
        clearIdlePeelAffordance($book);
      },
      end: (_event: unknown, _page: number, completed: boolean) => {
        setTurnJsAnimatedCentering($book, false);
        // `turned` follows a completed flip. A cancelled drag never reaches it,
        // so the in-flight state is cleared here.
        if (!completed) {
          onTurningChangeRef.current(false);
        }
      },
    },
  });

  return $book;
}

// Frames to wait for React to commit a page change before releasing the desk
// shadow anyway. React normally commits within a frame; the limit only guards
// against a stuck state if a page change never triggers a render.
const UNCOMMITTED_PAGE_TIMEOUT_FRAMES = 60;

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
}: UseIssueTurnJsRuntimeOptions) {
  const bookRef = useRef<HTMLDivElement | null>(null);
  const turnInstanceRef = useRef<TurnJsInstance | null>(null);
  const [bookReady, setBookReady] = useState(false);
  const onViewChangeRef = useRef(onViewChange);
  const onTurningChangeRef = useRef(onTurningChange);
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
    let frame = 0;

    const tick = () => {
      const book = bookRef.current;
      const turnInstance = turnInstanceRef.current;
      if (book && turnInstance) {
        // The desk shadow is constant for the current resting shape. Only the
        // moving sheet's own shadow is tracked here.
        if (isTurnJsLifted(turnInstance)) {
          syncLiftedLeafShadows(book);
        } else {
          clearLiftedLeafShadows(book);
        }
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
