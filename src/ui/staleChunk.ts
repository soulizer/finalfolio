const RELOAD_KEY = 'finalfolio-stale-asset-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * A deploy replaces hashed chunks. A tab that loaded the previous index can
 * request a chunk that no longer exists; Vite surfaces this as
 * `vite:preloadError` or a dynamic-import rejection. Reload once so the tab
 * picks up the new index instead of landing on the generic error boundary.
 */
export function reloadForFreshAssets() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(lastReload) && Date.now() - lastReload < RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Private mode or blocked storage: still attempt one reload.
  }

  window.location.reload();
  return true;
}

export function installStaleChunkReload() {
  if (typeof window === 'undefined' || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener('vite:preloadError' as never, ((event: Event) => {
    event.preventDefault();
    reloadForFreshAssets();
  }) as EventListener);
}

export function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(
    message,
  );
}
