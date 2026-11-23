import { ForwardedRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
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
  // The page the parent has committed as current. The desk shadow waits for
  // this to catch up with the page turn.js is on, so it is never painted from
  // a stale view.
  committedTurnPage: number;
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

// Which half of the book the moving sheet belongs to. Even page numbers are
// left pages, odd are right (page 1 is the cover on the right).
function getLiftSide(book: HTMLElement, turnInstance: TurnJsInstance) {
  const turnData = turnInstance?.data?.('t') as
    | { pageMv?: number[]; page?: number; tpage?: number }
    | undefined;
  const target = Number(turnData?.tpage ?? turnData?.page ?? 0) || 0;
  const liftedPages = Array.from(book.querySelectorAll('.page-wrapper.is-leaf-lifting .page'))
    .map((page) => Number(page.className.match(/\bp(\d+)\b/)?.[1] ?? 0))
    .filter((page) => page > 0);
  const movingPage =
    turnData?.pageMv?.find((page) => page > 0) ??
    liftedPages.find((page) => page !== target) ??
    liftedPages[0];
  if (!movingPage) {
    return null;
  }

  return movingPage % 2 === 0 ? 'left' : 'right';
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
  committedTurnPage,
}: UseIssueTurnJsRuntimeOptions) {
  const bookRef = useRef<HTMLDivElement | null>(null);
  const turnInstanceRef = useRef<TurnJsInstance | null>(null);
  const [bookReady, setBookReady] = useState(false);
  const onViewChangeRef = useRef(onViewChange);
  const onTurningChangeRef = useRef(onTurningChange);
  const committedTurnPageRef = useRef(committedTurnPage);
  const lastLiftSideRef = useRef<'left' | 'right' | null>(null);
  const pointerDraggingRef = useRef(false);
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

  // The page the parent has rendered. The desk shadow is kept off until this
  // matches the page turn.js is on, so the landed shadow is never painted from
  // the previous view.
  useLayoutEffect(() => {
    committedTurnPageRef.current = committedTurnPage;
  });

  // A bare press can make turn.js fold the page (`tapping`) before any drag.
  // The desk must not react to that; it reacts to a real drag or a turn.
  useEffect(() => {
    const book = bookRef.current;
    if (!book) {
      return;
    }

    let active = false;
    let startX = 0;
    let startY = 0;
    const onPointerDown = (event: PointerEvent) => {
      active = true;
      pointerDraggingRef.current = false;
      startX = event.clientX;
      startY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!active) {
        return;
      }
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) {
        pointerDraggingRef.current = true;
      }
    };
    const onPointerEnd = () => {
      active = false;
      pointerDraggingRef.current = false;
    };

    book.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      book.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let uncommittedFrames = 0;

    const tick = () => {
      const book = bookRef.current;
      const turnInstance = turnInstanceRef.current;
      if (book && turnInstance) {
        const turnPage = Number(turnInstance.data?.('t')?.page) || 0;
        const uncommitted = turnPage > 0 && turnPage !== committedTurnPageRef.current;
        uncommittedFrames = uncommitted ? uncommittedFrames + 1 : 0;

        // The background follows the paper, not turn.js's press state. A
        // mouse-down can set `status`/`pageMv` before any sheet has rotated,
        // which used to blank the desk and flicker on every press.
        if (isTurnJsLifted(turnInstance)) {
          syncLiftedLeafShadows(book);
        } else {
          clearLiftedLeafShadows(book);
        }
        const paperLifted = book.querySelector('.page-wrapper.is-leaf-lifting') !== null;
        const waitingForCommit = uncommitted && uncommittedFrames <= UNCOMMITTED_PAGE_TIMEOUT_FRAMES;
        const turnData = turnInstance?.data?.('t') as { status?: string } | undefined;
        const realMovement =
          pointerDraggingRef.current || turnData?.status === 'turning' || turnData?.status === 'moving';
        const liftSide =
          paperLifted && realMovement
            ? getLiftSide(book, turnInstance)
            : waitingForCommit
              ? lastLiftSideRef.current
              : null;
        if (liftSide) {
          lastLiftSideRef.current = liftSide;
        } else if (!waitingForCommit) {
          lastLiftSideRef.current = null;
        }
        if (liftSide) {
          if (book.getAttribute('data-lift-side') !== liftSide) {
            book.setAttribute('data-lift-side', liftSide);
          }
        } else if (book.hasAttribute('data-lift-side')) {
          book.removeAttribute('data-lift-side');
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
