import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoadingStack } from '../../components/LoadingStack';

function EditorStateTopbar({ actions }: { actions: ReactNode }) {
  const t = useT();
  return (
    <header className="editor-topbar">
      <div className="editor-topbar__brand">
        <Link to="/">{t('FinalFolio')}</Link>
        <span>{t('Server-backed editorial builder')}</span>
      </div>
      <div className="editor-topbar__actions">{actions}</div>
    </header>
  );
}

export function EditorLoadingState() {
  const t = useT();
  return (
    <div className="editor-shell">
      <div className="editor-layout editor-layout--loading" aria-busy="true">
        <aside className="editor-sidebar editor-sidebar--navigation">
          <section className="page-strip-panel">
            <div className="page-strip-panel__header page-strip-panel__header--compact">
              <div>
                <p className="eyebrow">{t('Sequence')}</p>
              </div>
              <span className="panel-tag">{t('Loading')}</span>
            </div>
            <LoadingStack lines={['title', 'line-medium', 'line-long', 'line-medium']} />
          </section>

          <section className="editor-panel">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">{t('Page style')}</p>
                <h2>{t('Preparing controls')}</h2>
              </div>
              <span className="panel-tag">{t('Syncing')}</span>
            </div>
            <LoadingStack lines={['line-full', 'line-long', 'line-medium']} />
          </section>
        </aside>

        <main id="main-content" className="editor-stage" aria-label={t('Loading editor')}>
          <div className="editor-canvas editor-canvas--loading">
            <div className="editor-loading-canvas">
              <div className="editor-loading-canvas__meta">
                <span className="panel-tag">{t('Project')}</span>
                <span className="panel-tag">{t('Loading')}</span>
              </div>
              <div className="editor-loading-canvas__body">
                <LoadingStack lines={['eyebrow', 'title', 'line-long', 'line-medium']} />
              </div>
            </div>
          </div>
        </main>

        <aside className="editor-sidebar editor-sidebar--content">
          <section className="editor-panel">
            <div className="editor-panel__heading editor-panel__heading--compact">
              <div>
                <p className="eyebrow">{t('Page content')}</p>
                <h2>{t('Preparing fields')}</h2>
              </div>
              <span className="panel-tag">{t('Loading')}</span>
            </div>
            <LoadingStack lines={['line-full', 'line-full', 'line-long', 'line-medium']} />
          </section>
        </aside>

        <aside className="editor-sidebar editor-sidebar--operations">
          <section className="editor-panel editor-panel--account">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">{t('Account')}</p>
                <h2>{t('Checking session')}</h2>
              </div>
              <span className="panel-tag">{t('Loading')}</span>
            </div>
            <LoadingStack lines={['line-full', 'line-medium']} />
          </section>

          <section className="editor-panel editor-panel--project-actions">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">{t('Project')}</p>
                <h2>{t('Preparing controls')}</h2>
              </div>
              <span className="panel-tag">{t('Loading')}</span>
            </div>
            <LoadingStack lines={['line-full', 'line-medium', 'line-medium']} />
          </section>
        </aside>
      </div>
    </div>
  );
}

export function EditorUnavailableState({
  loadError,
  startNewDraft,
}: {
  loadError: string | null;
  startNewDraft: () => void;
}) {
  const t = useT();
  return (
    <div className="editor-shell">
      <EditorStateTopbar
        actions={
          <button type="button" className="button button--ghost" onClick={startNewDraft}>
            {t('New draft')}</button>
        }
      />
      <section className="editor-empty-state">
        <p className="eyebrow">{t('Unavailable')}</p>
        <h1>{t('Project not available.')}</h1>
        <p>{loadError ?? t('The link is invalid or the project file could not be read.')}</p>
        <div className="editor-empty-state__actions">
          <button type="button" className="button button--primary" onClick={startNewDraft}>
            {t('Start a new draft')}</button>
          <Link to="/" className="button button--ghost">
            {t('Back home')}</Link>
        </div>
      </section>
    </div>
  );
}

export function EditorLockedState({
  openAccountPage,
  startNewDraft,
}: {
  openAccountPage: () => void;
  startNewDraft: () => void;
}) {
  const t = useT();
  return (
    <div className="editor-shell">
      <EditorStateTopbar
        actions={
          <>
            <Link to="/" className="button button--ghost">
              {t('Back home')}</Link>
            <button type="button" className="button button--primary" onClick={openAccountPage}>
              {t('Sign in')}</button>
          </>
        }
      />
      <section className="editor-empty-state">
        <p className="eyebrow">{t('Session ended')}</p>
        <h1>{t('Sign in to reopen this folio.')}</h1>
        <p>{t('This saved project belongs to an account. After sign-out, the editor hides its uploaded media until you sign in again.')}</p>
        <div className="editor-empty-state__actions">
          <button type="button" className="button button--primary" onClick={openAccountPage}>
            {t('Sign in again')}</button>
          <button type="button" className="button button--ghost" onClick={startNewDraft}>
            {t('Start a new draft')}</button>
        </div>
      </section>
    </div>
  );
}
