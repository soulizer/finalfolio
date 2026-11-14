import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type IssueViewLoadState = 'loading' | 'ready' | 'error';
type ViewportSize = { width: number; height: number };

type UseIssueViewViewportLayoutOptions = {
  loadState: IssueViewLoadState;
  mobileSinglePageActive: boolean;
  onRefreshLayout: () => void;
};

type UseIssueViewViewportLayoutResult = {
  effectiveViewerViewportSize: ViewportSize;
  fullscreenActive: boolean;
  shellClassName: string;
  shellRef: RefObject<HTMLDivElement | null>;
  toggleFullscreen: () => Promise<void>;
  viewerViewportRef: RefObject<HTMLDivElement | null>;
  viewerViewportSize: ViewportSize;
};

type UseIssueViewSidebarOffsetOptions = {
  pageHeight: number;
  shellRef: RefObject<HTMLDivElement | null>;
  showDesktopSidebar: boolean;
  viewerViewportHeight: number;
  viewerViewportRef: RefObject<HTMLDivElement | null>;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  webkitExitFullscreen?: (() => Promise<void> | void) | undefined;
  mozCancelFullScreen?: (() => Promise<void> | void) | undefined;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (() => Promise<void> | void) | undefined;
  mozRequestFullScreen?: (() => Promise<void> | void) | undefined;
};

function getFullscreenElement() {
  if (typeof document === 'undefined') {
    return null;
  }

  const fullscreenDocument = document as FullscreenDocument;
  return fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? fullscreenDocument.mozFullScreenElement ?? null;
}

async function requestElementFullscreen(element: HTMLElement) {
  const fullscreenElement = element as FullscreenElement;

  if (fullscreenElement.requestFullscreen) {
    await fullscreenElement.requestFullscreen();
    return;
  }

  if (fullscreenElement.webkitRequestFullscreen) {
    await fullscreenElement.webkitRequestFullscreen();
    return;
  }

  if (fullscreenElement.mozRequestFullScreen) {
    await fullscreenElement.mozRequestFullScreen();
  }
}

async function exitDocumentFullscreen() {
  if (typeof document === 'undefined') {
    return;
  }

  const fullscreenDocument = document as FullscreenDocument;

  if (fullscreenDocument.exitFullscreen) {
    await fullscreenDocument.exitFullscreen();
    return;
  }

  if (fullscreenDocument.webkitExitFullscreen) {
    await fullscreenDocument.webkitExitFullscreen();
    return;
  }

  if (fullscreenDocument.mozCancelFullScreen) {
    await fullscreenDocument.mozCancelFullScreen();
  }
}

export function useIssueViewViewportLayout({
  loadState,
  mobileSinglePageActive,
  onRefreshLayout,
}: UseIssueViewViewportLayoutOptions): UseIssueViewViewportLayoutResult {
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [viewerViewportSize, setViewerViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [lastNonFullscreenViewportSize, setLastNonFullscreenViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewerViewportRef = useRef<HTMLDivElement | null>(null);
  const syncViewportSizeRef = useRef<() => void>(() => undefined);
  const refreshLayoutRef = useRef(onRefreshLayout);
  const layoutRefreshFrameIdsRef = useRef<number[]>([]);
  const layoutRefreshTimerIdsRef = useRef<number[]>([]);

  useEffect(() => {
    refreshLayoutRef.current = onRefreshLayout;
  }, [onRefreshLayout]);

  function clearQueuedLayoutRefresh() {
    if (typeof window === 'undefined') {
      return;
    }

    layoutRefreshFrameIdsRef.current.forEach((frameId) => window.cancelAnimationFrame(frameId));
    layoutRefreshFrameIdsRef.current = [];
    layoutRefreshTimerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    layoutRefreshTimerIdsRef.current = [];
  }

  function runLayoutRefreshPass() {
    syncViewportSizeRef.current();
    refreshLayoutRef.current();
  }

  function queueLayoutRefresh() {
    if (typeof window === 'undefined' || loadState !== 'ready') {
      return;
    }

    clearQueuedLayoutRefresh();

    [0, 120, 280, 560, 900].forEach((delay) => {
      const timerId = window.setTimeout(() => {
        runLayoutRefreshPass();
      }, delay);
      layoutRefreshTimerIdsRef.current.push(timerId);
    });
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreenActive(Boolean(getFullscreenElement()));
    }

    function handleResize() {
      queueLayoutRefresh();
    }

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [loadState]);

  useLayoutEffect(() => {
    const viewport = viewerViewportRef.current;
    if (!viewport) {
      return;
    }

    function syncViewportSize() {
      const currentViewport = viewerViewportRef.current;
      if (!currentViewport) {
        return;
      }

      const rect = currentViewport.getBoundingClientRect();
      const nextWidth = Number(rect.width.toFixed(2));
      const nextHeight = Number(rect.height.toFixed(2));

      if (nextWidth <= 0.5 || nextHeight <= 0.5) {
        return;
      }

      setViewerViewportSize((current) =>
        Math.abs(current.width - nextWidth) < 0.5 && Math.abs(current.height - nextHeight) < 0.5
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    }

    syncViewportSizeRef.current = syncViewportSize;

    syncViewportSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncViewportSize);
      return () => {
        window.removeEventListener('resize', syncViewportSize);
        syncViewportSizeRef.current = () => undefined;
      };
    }

    const observer = new ResizeObserver(() => syncViewportSize());
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      syncViewportSizeRef.current = () => undefined;
    };
  }, [loadState]);

  useEffect(() => {
    if (fullscreenActive || viewerViewportSize.width <= 0 || viewerViewportSize.height <= 0) {
      return;
    }

    setLastNonFullscreenViewportSize((current) =>
      Math.abs(current.width - viewerViewportSize.width) < 0.5 && Math.abs(current.height - viewerViewportSize.height) < 0.5
        ? current
        : viewerViewportSize,
    );
  }, [fullscreenActive, viewerViewportSize]);

  useEffect(() => {
    if (loadState !== 'ready') {
      clearQueuedLayoutRefresh();
      return;
    }

    queueLayoutRefresh();
    return () => {
      clearQueuedLayoutRefresh();
    };
  }, [fullscreenActive, loadState]);

  useEffect(() => () => {
    clearQueuedLayoutRefresh();
  }, []);

  const shellClassName = [
    'issue-view-shell',
    mobileSinglePageActive ? 'issue-view-shell--mobile-portrait' : '',
    fullscreenActive ? 'is-fullscreen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const effectiveViewerViewportSize =
    viewerViewportSize.width > 0 && viewerViewportSize.height > 0 ? viewerViewportSize : lastNonFullscreenViewportSize;

  async function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    if (getFullscreenElement()) {
      await exitDocumentFullscreen().catch(() => null);
      return;
    }

    await requestElementFullscreen(shell).catch(() => null);
  }

  return {
    effectiveViewerViewportSize,
    fullscreenActive,
    shellClassName,
    shellRef,
    toggleFullscreen,
    viewerViewportRef,
    viewerViewportSize,
  };
}

export function useIssueViewSidebarOffset({
  pageHeight,
  shellRef,
  showDesktopSidebar,
  viewerViewportHeight,
  viewerViewportRef,
}: UseIssueViewSidebarOffsetOptions) {
  const [sidebarTopOffset, setSidebarTopOffset] = useState(0);

  useLayoutEffect(() => {
    if (!showDesktopSidebar) {
      setSidebarTopOffset(0);
      return;
    }

    const shell = shellRef.current;
    const viewport = viewerViewportRef.current;
    if (!shell || !viewport || viewerViewportHeight <= 0) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const bookTop = viewportRect.top + Math.max(0, (viewerViewportHeight - pageHeight) / 2);
    const nextOffset = Number(Math.max(0, bookTop - shellRect.top).toFixed(2));

    setSidebarTopOffset((current) => (Math.abs(current - nextOffset) < 0.5 ? current : nextOffset));
  }, [pageHeight, shellRef, showDesktopSidebar, viewerViewportHeight, viewerViewportRef]);

  return sidebarTopOffset;
}
