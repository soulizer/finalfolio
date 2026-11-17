import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  logoutUser,
  type AdminSummary,
  type BootstrapStatus,
  type UserSession,
} from '../../editor/api';
import { getUserPrimaryIdentity } from '../../editor/identity';
import { buildTermsPath } from '../../legal/terms';
import { useDelayedVisibility } from '../../useDelayedVisibility';

export type AdminSectionKey = 'overview' | 'projects' | 'uploads' | 'governance' | 'ai' | 'storage' | 'users' | 'events';

function normalizeAdminSection(value: string | null): AdminSectionKey {
  const validSections: AdminSectionKey[] = ['overview', 'projects', 'uploads', 'governance', 'ai', 'storage', 'users', 'events'];
  return validSections.includes(value as AdminSectionKey) ? (value as AdminSectionKey) : 'overview';
}

type UseAdminShellStateOptions = {
  bootstrapStatus: BootstrapStatus | null;
  busy: boolean;
  clearAdminData: () => void;
  loadAdminData: (currentSession?: UserSession | null) => Promise<void>;
  message: string | null;
  refreshSession: () => Promise<UserSession | null>;
  session: UserSession | null;
  sessionReady: boolean;
  setMessage: (message: string | null) => void;
  setSessionUser: (user: UserSession | null) => void;
  summary: AdminSummary | null;
};

export function useAdminShellState({
  bootstrapStatus,
  busy,
  clearAdminData,
  loadAdminData,
  message,
  refreshSession,
  session,
  sessionReady,
  setMessage,
  setSessionUser,
  summary,
}: UseAdminShellStateOptions) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = normalizeAdminSection(searchParams.get('section'));

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (session?.needsTermsAcceptance) {
      navigate(buildTermsPath('/admin'), { replace: true });
      return;
    }

    void loadAdminData(session);
  }, [loadAdminData, navigate, session, sessionReady]);

  async function refreshAll() {
    setMessage(null);

    const currentUser = await refreshSession();
    if (currentUser?.needsTermsAcceptance) {
      navigate(buildTermsPath('/admin'), { replace: true });
      return;
    }

    await loadAdminData(currentUser);
  }

  async function handleLogout() {
    await logoutUser();
    setSessionUser(null);
    clearAdminData();
    setMessage('Signed out.');
  }

  function openRoute(path: string) {
    navigate(path);
  }

  function selectSection(section: AdminSectionKey) {
    const nextParams = new URLSearchParams(searchParams);
    if (section === 'overview') {
      nextParams.delete('section');
    } else {
      nextParams.set('section', section);
    }
    setSearchParams(nextParams, { replace: true });
  }

  const canAccessAdmin = session?.role === 'admin';
  const blocked = session !== null && !canAccessAdmin;
  const loadFailed = canAccessAdmin && !summary && Boolean(message);
  const requiresBootstrap = bootstrapStatus?.requiresBootstrap === true;
  const sessionIdentity = session ? getUserPrimaryIdentity(session) : 'unknown account';
  const fallbackTitle = requiresBootstrap
    ? 'Create the first admin account.'
    : !session
      ? 'Sign in with an admin account.'
      : blocked
        ? 'Admin account required.'
        : loadFailed
          ? 'Admin backend failed to load.'
          : 'Loading admin backend.';
  const fallbackBody = requiresBootstrap
    ? 'No user exists yet. The first registered account becomes the initial administrator after email verification.'
    : !session
      ? 'This backend is restricted to administrators. Sign in with an existing admin account to govern projects, uploads, templates, and site content.'
      : blocked
        ? 'The current account (%s) is signed in but does not have the admin role. Use an administrator account instead.'
        : message ?? 'This account is an administrator, but the backend did not finish loading its live data.';
  const adminLoading = !sessionReady || (canAccessAdmin && !summary && !loadFailed && !requiresBootstrap);
  const showLoadingShell = useDelayedVisibility(adminLoading);
  const primaryFallbackDisabled = busy && !requiresBootstrap && !blocked && Boolean(session);
  const primaryFallbackLabel = requiresBootstrap ? 'Create first admin' : !session ? 'Open sign in' : blocked ? 'Switch account' : 'Retry';

  function handlePrimaryFallbackAction() {
    if (requiresBootstrap || !session || blocked) {
      openRoute('/auth');
      return;
    }

    void refreshAll();
  }

  return {
    accountPath: session ? '/account' : '/auth',
    activeSection,
    adminLoading,
    blocked,
    canAccessAdmin,
    fallbackBody,
    fallbackTitle,
    handleLogout,
    handlePrimaryFallbackAction,
    openRoute,
    primaryFallbackDisabled,
    primaryFallbackLabel,
    refreshAll,
    selectSection,
    showLoadingShell,
  };
}
