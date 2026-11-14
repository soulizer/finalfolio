import { useEffect, useRef, useState } from 'react';
import { fetchPublicIssue } from '../editor/api';
import type { PublicIssuePayload } from '../editor/types';
import { useDelayedVisibility } from '../useDelayedVisibility';

type LoadState = 'loading' | 'ready' | 'error';

type UseIssueViewShareStateOptions = {
  onBeforeLoad: () => void;
  onLoaded: (pageCount: number) => void;
  shareId: string;
};

export function useIssueViewShareState({
  onBeforeLoad,
  onLoaded,
  shareId,
}: UseIssueViewShareStateOptions) {
  const [issue, setIssue] = useState<PublicIssuePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const loadingShellVisible = useDelayedVisibility(loadState === 'loading');
  const beforeLoadRef = useRef(onBeforeLoad);
  const loadedRef = useRef(onLoaded);

  beforeLoadRef.current = onBeforeLoad;
  loadedRef.current = onLoaded;

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setLoadError(null);
    setIssue(null);
    beforeLoadRef.current();

    void fetchPublicIssue(shareId)
      .then((payload) => {
        if (!active) {
          return;
        }

        setIssue(payload);
        setLoadState('ready');
        loadedRef.current(payload.pages.length);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : 'Unable to open this shared folio.');
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [shareId]);

  useEffect(() => {
    if (!issue) {
      return;
    }

    document.title = `${issue.title} | FinalFolio`;
    return () => {
      document.title = 'FinalFolio';
    };
  }, [issue]);

  return {
    issue,
    loadError,
    loadingShellVisible,
    loadState,
  };
}
