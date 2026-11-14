import { useEffect, useState } from 'react';
import { MOBILE_SINGLE_PAGE_MEDIA_QUERY } from './issueViewReaderState';

export function useIssueViewReaderMode() {
  const [mobileSinglePageActive, setMobileSinglePageActive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_SINGLE_PAGE_MEDIA_QUERY);
    const syncMobileViewerMode = () => setMobileSinglePageActive(mediaQuery.matches);

    syncMobileViewerMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMobileViewerMode);
      return () => mediaQuery.removeEventListener('change', syncMobileViewerMode);
    }

    mediaQuery.addListener(syncMobileViewerMode);
    return () => mediaQuery.removeListener(syncMobileViewerMode);
  }, []);

  return mobileSinglePageActive;
}

export function useIssueViewMobilePanelState({
  fullscreenActive,
  mobileSinglePageActive,
}: {
  fullscreenActive: boolean;
  mobileSinglePageActive: boolean;
}) {
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    if (!mobileSinglePageActive) {
      setMobilePanelOpen(false);
    }
  }, [mobileSinglePageActive]);

  useEffect(() => {
    if (!mobilePanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobilePanelOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobilePanelOpen]);

  useEffect(() => {
    if (fullscreenActive) {
      setMobilePanelOpen(false);
    }
  }, [fullscreenActive]);

  return {
    closeMobilePanel() {
      setMobilePanelOpen(false);
    },
    mobilePanelOpen,
    toggleMobilePanel() {
      setMobilePanelOpen((current) => !current);
    },
  };
}
