import type { RefObject, TouchEvent as ReactTouchEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { TurnJsBookHandle } from './IssueTurnJsBook';
import { clamp, getLeadingVisiblePage, type VisibleTurnView } from './issueViewReaderState';

type IssueViewLoadState = 'loading' | 'ready' | 'error';

type UseIssueViewNavigationOptions = {
  bookRef: RefObject<TurnJsBookHandle | null>;
  isTurning: boolean;
  loadState: IssueViewLoadState;
  mobileSinglePageActive: boolean;
  pageCount: number;
};

function getDesktopNavigationAvailability(view: VisibleTurnView, totalPages: number) {
  const leadingPage = view[0] > 0 ? view[0] : view[1] > 0 ? view[1] : 1;
  const trailingPage = Math.max(view[0], view[1]);

  return {
    canGoPrev: leadingPage > 1,
    canGoNext: trailingPage > 0 && trailingPage < totalPages,
  };
}

export function useIssueViewNavigation({
  bookRef,
  isTurning,
  loadState,
  mobileSinglePageActive,
  pageCount,
}: UseIssueViewNavigationOptions) {
  const [currentTurnPage, setCurrentTurnPage] = useState(1);
  const [currentViewPages, setCurrentViewPages] = useState<VisibleTurnView>([0, 0]);
  const [mobileVisiblePage, setMobileVisiblePage] = useState(1);
  const stableTurnPageRef = useRef(1);
  const mobileTurnTargetRef = useRef<number | null>(null);
  const mobileTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const normalizedView = pageCount ? currentViewPages : ([0, 0] as VisibleTurnView);
  const normalizedMobileVisiblePage = clamp(mobileVisiblePage, 1, Math.max(pageCount, 1));
  const desktopNavigation = getDesktopNavigationAvailability(normalizedView, pageCount);
  const canGoPrev = mobileSinglePageActive ? normalizedMobileVisiblePage > 1 : desktopNavigation.canGoPrev;
  const canGoNext = mobileSinglePageActive ? normalizedMobileVisiblePage < pageCount : desktopNavigation.canGoNext;

  function resetNavigationState() {
    stableTurnPageRef.current = 1;
    mobileTurnTargetRef.current = null;
    mobileTouchStartRef.current = null;
    setCurrentTurnPage(1);
    setCurrentViewPages([0, 0]);
    setMobileVisiblePage(1);
  }

  function initializeLoadedIssue(nextPageCount: number) {
    stableTurnPageRef.current = 1;
    mobileTurnTargetRef.current = null;
    mobileTouchStartRef.current = null;
    setCurrentTurnPage(1);
    setCurrentViewPages(nextPageCount ? [0, 1] : [0, 0]);
    setMobileVisiblePage(1);
  }

  function requestMobileTurn(targetPage: number) {
    if (!pageCount || isTurning) {
      return;
    }

    const book = bookRef.current;
    if (!book) {
      return;
    }

    const normalizedTargetPage = clamp(targetPage, 1, pageCount);
    mobileTurnTargetRef.current = normalizedTargetPage;
    book.page(normalizedTargetPage);
  }

  function handleAdvanceToNextPage() {
    if (!canGoNext || isTurning) {
      return;
    }

    if (!mobileSinglePageActive) {
      bookRef.current?.next();
      return;
    }

    if (normalizedMobileVisiblePage === 1 || normalizedMobileVisiblePage % 2 === 1) {
      requestMobileTurn(Math.min(pageCount, normalizedMobileVisiblePage + 1));
      return;
    }

    setMobileVisiblePage((current) => clamp(current + 1, 1, pageCount));
  }

  function handleAdvanceToPreviousPage() {
    if (!canGoPrev || isTurning) {
      return;
    }

    if (!mobileSinglePageActive) {
      bookRef.current?.previous();
      return;
    }

    if (normalizedMobileVisiblePage % 2 === 0) {
      requestMobileTurn(Math.max(1, normalizedMobileVisiblePage - 1));
      return;
    }

    setMobileVisiblePage((current) => clamp(current - 1, 1, pageCount));
  }

  function handleJumpToFirstPage() {
    if (isTurning) {
      return;
    }

    if (mobileSinglePageActive) {
      requestMobileTurn(1);
      return;
    }

    bookRef.current?.page(1);
  }

  function handleJumpToLastPage() {
    if (isTurning || !pageCount) {
      return;
    }

    if (mobileSinglePageActive) {
      requestMobileTurn(pageCount);
      return;
    }

    bookRef.current?.page(pageCount);
  }

  function handleBookViewChange(view: VisibleTurnView, page: number) {
    stableTurnPageRef.current = page;
    setCurrentTurnPage(page);
    setCurrentViewPages(view);

    if (!mobileSinglePageActive) {
      mobileTurnTargetRef.current = null;
      return;
    }

    if (mobileTurnTargetRef.current !== null) {
      setMobileVisiblePage(clamp(mobileTurnTargetRef.current, 1, Math.max(pageCount, 1)));
      mobileTurnTargetRef.current = null;
    }
  }

  function handleMobileTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (!mobileSinglePageActive || isTurning) {
      mobileTouchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    if (!touch) {
      mobileTouchStartRef.current = null;
      return;
    }

    mobileTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleMobileTouchCancel() {
    mobileTouchStartRef.current = null;
  }

  function handleMobileTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const start = mobileTouchStartRef.current;
    mobileTouchStartRef.current = null;

    if (!mobileSinglePageActive || !start || isTurning) {
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX < 42 || absDeltaX <= absDeltaY * 1.15) {
      return;
    }

    if (deltaX < 0) {
      handleAdvanceToNextPage();
      return;
    }

    handleAdvanceToPreviousPage();
  }

  useEffect(() => {
    if (!mobileSinglePageActive) {
      mobileTurnTargetRef.current = null;
      return;
    }

    setMobileVisiblePage(getLeadingVisiblePage(currentViewPages, pageCount));
  }, [mobileSinglePageActive]);

  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleAdvanceToNextPage();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleAdvanceToPreviousPage();
      } else if (event.key === 'Home') {
        event.preventDefault();
        handleJumpToFirstPage();
      } else if (event.key === 'End') {
        event.preventDefault();
        handleJumpToLastPage();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoPrev, isTurning, loadState, mobileSinglePageActive, normalizedMobileVisiblePage, pageCount]);

  return {
    currentTurnPage,
    currentViewPages,
    handleAdvanceToNextPage,
    handleAdvanceToPreviousPage,
    handleBookViewChange,
    handleJumpToFirstPage,
    handleJumpToLastPage,
    handleMobileTouchCancel,
    handleMobileTouchEnd,
    handleMobileTouchStart,
    initializeLoadedIssue,
    mobileVisiblePage,
    resetNavigationState,
    stableTurnPageRef,
  };
}
