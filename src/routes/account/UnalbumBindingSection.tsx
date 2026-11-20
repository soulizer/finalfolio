import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n';
import {
  fetchUnalbumStatus,
  startUnalbumAuthorize,
  unbindUnalbum,
  type UnalbumStatus,
} from '../../editor/api';
import { confirmAction } from '../../ui/confirm';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';

/**
 * Account-page section for the optional UnAlbum link. Hidden entirely unless
 * the deployment configured UnAlbum, so self-hosted installs never show a
 * broken third-party control.
 */
export function UnalbumBindingSection() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<UnalbumStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    const outcome = searchParams.get('unalbum');
    if (!outcome) {
      return;
    }
    if (outcome === 'connected') {
      setMessage(t('UnAlbum is connected. Its photos and AI tags can now be imported.'));
      // Re-read the binding so the card flips to the connected state.
      void fetchUnalbumStatus()
        .then(setStatus)
        .catch(() => null);
    } else if (outcome === 'error') {
      setMessage(t('Connecting UnAlbum did not finish. Please try again.'));
    }
    const next = new URLSearchParams(searchParams);
    next.delete('unalbum');
    next.delete('reason');
    setSearchParams(next, { replace: true });
    // Only react to the callback landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('unalbum')]);

  if (status && !status.configured) {
    return null;
  }

  const handleConnect = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { authorizeUrl } = await startUnalbumAuthorize();
      window.location.assign(authorizeUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to start the UnAlbum connection.'));
      setBusy(false);
    }
  };

  const handleUnbind = async () => {
    if (busy || !status?.account) {
      return;
    }
    const confirmed = await confirmAction({
      title: t('Disconnect UnAlbum?'),
      body: t('Photos already imported stay in FinalFolio. You can reconnect at any time.'),
      confirmLabel: t('Disconnect'),
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await unbindUnalbum();
      setStatus({ configured: true, bound: false, account: null });
      setMessage(t('UnAlbum is disconnected.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Unable to disconnect UnAlbum.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="editor-panel admin-panel">
      <div className="editor-panel__heading">
        <div>
          <p className="eyebrow">UnAlbum</p>
          <h2>{t('UnAlbum account')}</h2>
        </div>
        <span className="panel-tag">{status?.bound ? t('Connected') : t('Not connected')}</span>
        <PanelCollapseToggle />
      </div>
      <div className="admin-settings-stack">
        <p className="panel-note account-settings-note">
          {t('Link your UnAlbum account to import your photos, together with the AI tags and descriptions UnAlbum already generated. FinalFolio reuses those tags instead of analysing the photos again.')}
        </p>
        {status?.bound && status.account ? (
          <div className="unalbum-binding">
            <div className="unalbum-binding__account">
              {status.account.avatarUrl ? (
                <img src={status.account.avatarUrl} alt="" className="unalbum-binding__avatar" loading="lazy" />
              ) : null}
              <div>
                <strong>@{status.account.username || status.account.id}</strong>
                {status.account.displayName ? <span>{status.account.displayName}</span> : null}
              </div>
            </div>
            <button type="button" className="button button--danger-ghost button--small" disabled={busy} onClick={() => void handleUnbind()}>
              {busy ? t('Disconnecting…') : t('Disconnect')}
            </button>
          </div>
        ) : (
          <div className="editor-panel__actions admin-panel__actions--end">
            <button type="button" className="button button--primary button--small" disabled={busy} onClick={() => void handleConnect()}>
              {busy ? t('Opening UnAlbum…') : t('Connect UnAlbum')}
            </button>
          </div>
        )}
        {message ? (
          <p className="panel-note" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
