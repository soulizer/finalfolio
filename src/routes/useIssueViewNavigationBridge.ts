import { useRef, type MutableRefObject } from 'react';
import { clamp } from './issueViewReaderState';

type UseIssueViewNavigationBridgeOptions = {
  onBeforeLoad?: () => void;
};

type NavigationBinding = {
  initializeLoadedIssue: (pageCount: number) => void;
  resetNavigationState: () => void;
};

export function useIssueViewNavigationBridge({ onBeforeLoad }: UseIssueViewNavigationBridgeOptions) {
  const initializeLoadedIssueRef = useRef<(pageCount: number) => void>(() => undefined);
  const resetNavigationStateRef = useRef<() => void>(() => undefined);

  return {
    connectNavigation({ initializeLoadedIssue, resetNavigationState }: NavigationBinding) {
      initializeLoadedIssueRef.current = initializeLoadedIssue;
      resetNavigationStateRef.current = resetNavigationState;
    },
    handleBeforeIssueLoad() {
      resetNavigationStateRef.current();
      onBeforeLoad?.();
    },
    handleIssueLoaded(pageCount: number) {
      initializeLoadedIssueRef.current(pageCount);
    },
    resolveInitialBookPage({
      currentTurnPage,
      pageCount,
      stableTurnPageRef,
    }: {
      currentTurnPage: number;
      pageCount: number;
      stableTurnPageRef: MutableRefObject<number>;
    }) {
      return clamp(stableTurnPageRef.current || currentTurnPage, 1, Math.max(pageCount, 1));
    },
  };
}
