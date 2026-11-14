import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function refreshSession() {
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
  }

  function setSessionUser(nextUser: UserSession | null) {
    userRef.current = nextUser;
    setUser(nextUser);
    setRefreshFailed(false);
    setReady(true);
  }

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
  }, []);

  return (
    <SessionContext.Provider
      value={{
        user,
        ready,
        refreshing,
        refreshFailed,
        refreshSession,
        setSessionUser,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider.');
  }

  return context;
}
