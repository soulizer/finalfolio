import type { RefObject } from 'react';
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

  const normalizedView = pageCount ? currentViewPages : ([0, 0] as VisibleTurnView);
  const normalizedMobileVisiblePage = clamp(mobileVisiblePage, 1, Math.max(pageCount, 1));
  const desktopNavigation = getDesktopNavigationAvailability(normalizedView, pageCount);
  const canGoPrev = mobileSinglePageActive ? normalizedMobileVisiblePage > 1 : desktopNavigation.canGoPrev;
  const canGoNext = mobileSinglePageActive ? normalizedMobileVisiblePage < pageCount : desktopNavigation.canGoNext;

  function resetNavigationState() {
    stableTurnPageRef.current = 1;
    setCurrentTurnPage(1);
    setCurrentViewPages([0, 0]);
    setMobileVisiblePage(1);
  }

  function initializeLoadedIssue(nextPageCount: number) {
    stableTurnPageRef.current = 1;
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

    book.page(clamp(targetPage, 1, pageCount));
  }

  function handleAdvanceToNextPage() {
    if (!canGoNext || isTurning) {
      return;
    }

    if (!mobileSinglePageActive) {
      bookRef.current?.next();
      return;
    }

    requestMobileTurn(normalizedMobileVisiblePage + 1);
  }

  function handleAdvanceToPreviousPage() {
    if (!canGoPrev || isTurning) {
      return;
    }

    if (!mobileSinglePageActive) {
      bookRef.current?.previous();
      return;
    }

    requestMobileTurn(normalizedMobileVisiblePage - 1);
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

    if (mobileSinglePageActive) {
      // In single-page mode the book's current page is the page on screen.
      setMobileVisiblePage(clamp(page, 1, Math.max(pageCount, 1)));
    }
  }

  useEffect(() => {
    if (!mobileSinglePageActive) {
      return;
    }

    setMobileVisiblePage(getLeadingVisiblePage(currentViewPages, pageCount));
  }, [mobileSinglePageActive]);

  useEffect(() => {
    if (loadState !== 'ready') {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

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
    initializeLoadedIssue,
    mobileVisiblePage,
    resetNavigationState,
    stableTurnPageRef,
  };
}
