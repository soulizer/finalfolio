import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { countLabel, useT } from '../i18n';
import {
  fetchUnalbumPhotos,
  fetchUnalbumStatus,
  importUnalbumPhotos,
  type UnalbumPhoto,
  type UnalbumStatus,
} from '../editor/api';
import type { Asset } from '../editor/types';
import { MarqueeGrid } from './MarqueeGrid';

type UnAlbumPickerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onImported: (assets: Asset[]) => void | Promise<void>;
};

function rawMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function friendlyError(error: unknown, t: (key: string) => string, fallback: string) {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'unalbum_reconnect') {
    return t('The UnAlbum authorization expired. Reconnect the account on the account page.');
  }
  if (code === 'unalbum_rate_limited') {
    return t('UnAlbum is rate limiting requests right now. Try again in a minute.');
  }
  if (code === 'unalbum_not_bound') {
    return t('Connect UnAlbum first.');
  }
  return rawMessage(error, fallback);
}

/**
 * Imports photos from a linked UnAlbum account. Import happens on the server
 * (which holds the OAuth token and copies the bytes), so the browser only ever
 * sees preview URLs and the resulting FinalFolio assets.
 */
export function UnAlbumPicker({ open, title, onClose, onImported }: UnAlbumPickerProps) {
  const t = useT();
  const [status, setStatus] = useState<UnalbumStatus | null>(null);
  const [photos, setPhotos] = useState<UnalbumPhoto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setError(null);
    setPhotos([]);
    setNextCursor(null);
    setPickedIds(new Set());
    anchorRef.current = null;
    fetchUnalbumStatus()
      .then((next) => {
        if (!cancelled) {
          setStatus(next);
        }
      })
      .catch((statusError) => {
        if (!cancelled) {
          setStatus({ configured: false, bound: false, account: null });
          setError(friendlyError(statusError, t, t('Unable to reach UnAlbum.')));
        }
      });
    return () => {
      cancelled = true;
    };
    // The dialog re-runs this only when it opens; query changes load separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadPage = async (cursor: string, search: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchUnalbumPhotos({ cursor, query: search });
      setPhotos((current) => (cursor ? [...current, ...page.photos] : page.photos));
      setNextCursor(page.nextCursor);
    } catch (loadError) {
      setError(friendlyError(loadError, t, t('Unable to load your UnAlbum photos.')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !status?.bound) {
      return;
    }
    void loadPage('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status?.bound]);

  const pickedPhotos = useMemo(() => photos.filter((photo) => pickedIds.has(photo.id)), [photos, pickedIds]);
  const hasPendingAnalysis = useMemo(
    () => photos.some((photo) => photo.analysis?.status === 'pending' && !photo.analysis.description && !photo.analysis.tags?.length),
    [photos],
  );

  if (!open) {
    return null;
  }

  const togglePick = (photoId: string) => {
    setPickedIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
    anchorRef.current = photoId;
  };

  const extendPick = (photoId: string) => {
    const anchorId = anchorRef.current;
    const anchorIndex = anchorId ? photos.findIndex((photo) => photo.id === anchorId) : -1;
    const targetIndex = photos.findIndex((photo) => photo.id === photoId);
    if (anchorIndex < 0 || targetIndex < 0) {
      togglePick(photoId);
      return;
    }
    const [from, to] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
    const rangeIds = photos.slice(from, to + 1).map((photo) => photo.id);
    setPickedIds((current) => {
      const next = new Set(current);
      rangeIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handlePickClick = (photo: UnalbumPhoto, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => {
    if (event.shiftKey) {
      extendPick(photo.id);
      return;
    }
    togglePick(photo.id);
  };

  const handleMarquee = (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setPickedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleImport = async () => {
    if (!pickedIds.size || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const ids = Array.from(pickedIds);
    const importedAssets: Asset[] = [];
    // One photo per request: a single request that downloads thirty originals
    // would outlive proxy timeouts, and the server caps one request anyway.
    for (let index = 0; index < ids.length; index += 1) {
      setProgress({ done: index, total: ids.length });
      try {
        const { assets } = await importUnalbumPhotos([ids[index]]);
        importedAssets.push(...assets);
        setPickedIds((current) => {
          const next = new Set(current);
          next.delete(ids[index]);
          return next;
        });
      } catch (importError) {
        if (importedAssets.length) {
          await onImported(importedAssets);
        }
        setError(friendlyError(importError, t, t('Unable to import these photos from UnAlbum.')));
        setBusy(false);
        setProgress(null);
        return;
      }
    }
    setBusy(false);
    setProgress(null);
    await onImported(importedAssets);
    onClose();
  };

  const searchPhotos = async () => {
    setPickedIds(new Set());
    anchorRef.current = null;
    await loadPage('', query.trim());
  };

  return (
    <div className="ai-dialog-overlay" role="presentation" onClick={onClose}>
      <section
        className="ai-dialog unalbum-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ai-dialog__header">
          <div>
            <span className="panel-tag">UnAlbum</span>
            <h2>{title}</h2>
            {status?.account ? (
              <p className="panel-note">
                {t('Signed in as @%s').replace('%s', status.account.username || status.account.displayName || status.account.id)}
              </p>
            ) : null}
          </div>
          <button type="button" className="button button--ghost button--small" onClick={onClose}>
            {t('Close')}
          </button>
        </header>

        {!status ? (
          <div className="unalbum-dialog__state">
            <p className="panel-note">{t('Checking your UnAlbum connection…')}</p>
          </div>
        ) : !status.configured ? (
          <div className="unalbum-dialog__state">
            <strong>{t('UnAlbum is not available right now.')}</strong>
            <p className="panel-note">{t('This server has not been configured for UnAlbum yet.')}</p>
          </div>
        ) : !status.bound ? (
          <div className="unalbum-dialog__state">
            <strong>{t('Connect UnAlbum first.')}</strong>
            <p className="panel-note">
              {t('Link your UnAlbum account on the account page, then come back to pick photos.')}
            </p>
            <Link className="button button--primary button--small" to="/account" onClick={onClose}>
              {t('Go to account settings')}
            </Link>
          </div>
        ) : (
          <>
            <div className="unalbum-dialog__body">
              <form
                className="unalbum-dialog__search"
                onSubmit={(event) => {
                  event.preventDefault();
                  void searchPhotos();
                }}
              >
                <label className="field">
                  <span>{t('Search your UnAlbum photos')}</span>
                  <input
                    type="search"
                    value={query}
                    placeholder={t('Search by name')}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <button type="submit" className="button button--ghost button--small" disabled={loading}>
                  {t('Search')}
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={loading}
                  onClick={() => void searchPhotos()}
                >
                  {loading ? t('Refreshing…') : t('Refresh')}
                </button>
              </form>

              {error ? (
                <p className="ai-dialog__error" role="alert">
                  {error}
                </p>
              ) : null}

              {photos.length ? (
                <MarqueeGrid className="unalbum-grid" onMarquee={handleMarquee}>
                  {photos.map((photo) => {
                    const picked = pickedIds.has(photo.id);
                    const thumb = photo.variants.thumb?.url || photo.variants.preview?.url || '';
                    const description = photo.analysis?.description ?? '';
                    const analyzed = Boolean(photo.analysis && (photo.analysis.description || photo.analysis.tags?.length));
                    const pending = !analyzed && photo.analysis?.status === 'pending';
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        data-marquee-id={photo.id}
                        className={`unalbum-tile ${picked ? 'is-picked' : ''}`.trim()}
                        aria-pressed={picked}
                        title={description || photo.name || photo.filename}
                        onClick={(event) => handlePickClick(photo, event)}
                      >
                        {thumb ? <img src={thumb} alt={photo.name || photo.filename} loading="lazy" /> : null}
                        <span className="unalbum-tile__name">{photo.name || photo.filename}</span>
                        {analyzed ? (
                          <span className="unalbum-tile__tag">{t('Analyzed')}</span>
                        ) : pending ? (
                          <span className="unalbum-tile__tag unalbum-tile__tag--pending">{t('Analyzing')}</span>
                        ) : null}
                        {picked ? (
                          <span className="unalbum-tile__check" aria-hidden="true">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </MarqueeGrid>
              ) : loading ? (
                <p className="panel-note">{t('Loading photos…')}</p>
              ) : (
                <div className="unalbum-dialog__state unalbum-dialog__state--inline">
                  <strong>{t('No photos found')}</strong>
                  <p className="panel-note">{t('Add photos to UnAlbum first, or try another search.')}</p>
                </div>
              )}

              {nextCursor ? (
                <button
                  type="button"
                  className="button button--ghost button--small unalbum-dialog__more"
                  disabled={loading}
                  onClick={() => void loadPage(nextCursor, query.trim())}
                >
                  {t('Load more')}
                </button>
              ) : null}

              <p className="panel-note ai-selection-hint">
                {t('Click to select, Shift-click for a range, or drag a box across photos.')}
              </p>
              {hasPendingAnalysis ? (
                <p className="panel-note">
                  {t('Some photos are still being analysed by UnAlbum. Refresh later to reuse their tags.')}
                </p>
              ) : null}
            </div>

            <footer className="ai-dialog__footer">
              <span className="panel-tag">
                {t('%s selected').replace('%s', String(pickedIds.size))}
              </span>
              <div className="ai-dialog__footer-actions">
                <button type="button" className="button button--ghost button--small" onClick={onClose}>
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={!pickedIds.size || busy}
                  onClick={() => void handleImport()}
                >
                  {busy
                    ? progress
                      ? t('Importing %s of %s…')
                          .replace('%s', String(progress.done + 1))
                          .replace('%s', String(progress.total))
                      : t('Importing…')
                    : countLabel(pickedIds.size, 'Add 1 photo', 'Add %s photos')}
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export type { UnalbumPhoto };
