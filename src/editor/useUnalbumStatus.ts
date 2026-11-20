import { useEffect, useState } from 'react';
import { fetchUnalbumStatus, type UnalbumStatus } from './api';

/**
 * UnAlbum is optional infrastructure. One status fetch per session tells the
 * UI whether the feature is configured at all, so buttons can stay hidden
 * instead of opening a dialog that cannot work.
 */
export function useUnalbumStatus(sessionId?: string | null) {
  const [status, setStatus] = useState<UnalbumStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUnalbumStatus()
      .then((next) => {
        if (!cancelled) {
          setStatus(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ configured: false, bound: false, account: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return status;
}
