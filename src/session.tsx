import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSession, UserSession } from './editor/api';

type SessionContextValue = {
  user: UserSession | null;
  ready: boolean;
  refreshing: boolean;
  refreshFailed: boolean;
  refreshSession: () => Promise<UserSession | null>;
  setSessionUser: (user: UserSession | null) => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const mountedRef = useRef(true);
  const userRef = useRef<UserSession | null>(null);
  const inFlightRefreshRef = useRef<Promise<UserSession | null> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    // Focus and visibility events can fire back-to-back; share one request so
    // the whole consumer tree does not re-render for each duplicate poll.
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    const request = (async () => {
      if (mountedRef.current) {
        setRefreshing(true);
      }

      try {
        const payload = await fetchSession();
        if (!mountedRef.current) {
          return payload.user ?? null;
        }

        userRef.current = payload.user;
        setUser(payload.user);
        setRefreshFailed(false);
        return payload.user ?? null;
      } catch {
        if (!mountedRef.current) {
          return userRef.current;
        }

        if (!userRef.current) {
          setUser(null);
        }
        setRefreshFailed(true);
        return userRef.current;
      } finally {
        if (mountedRef.current) {
          setRefreshing(false);
          setReady(true);
        }
      }
    })();

    inFlightRefreshRef.current = request;
    try {
      return await request;
    } finally {
      if (inFlightRefreshRef.current === request) {
        inFlightRefreshRef.current = null;
      }
    }
  }, []);

  const setSessionUser = useCallback((nextUser: UserSession | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
    setRefreshFailed(false);
    setReady(true);
  }, []);

  useEffect(() => {
    void refreshSession();

    const handleFocus = () => {
      void refreshSession();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshSession]);

  const contextValue = useMemo(
    () => ({
      user,
      ready,
      refreshing,
      refreshFailed,
      refreshSession,
      setSessionUser,
    }),
    [user, ready, refreshing, refreshFailed, refreshSession, setSessionUser],
  );

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider.');
  }

  return context;
}
