import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoadingStack } from '../../components/LoadingStack';

function EditorStateTopbar({ actions }: { actions: ReactNode }) {
  return (
    <header className="editor-topbar">
      <div className="editor-topbar__brand">
        <Link to="/">FinalFolio</Link>
        <span>Server-backed editorial builder</span>
      </div>
      <div className="editor-topbar__actions">{actions}</div>
    </header>
  );
}

export function EditorLoadingState() {
  return (
    <div className="editor-shell">
      <div className="editor-layout editor-layout--loading" aria-busy="true">
        <aside className="editor-sidebar editor-sidebar--navigation">
          <section className="page-strip-panel">
            <div className="page-strip-panel__header page-strip-panel__header--compact">
              <div>
                <p className="eyebrow">Sequence</p>
              </div>
              <span className="panel-tag">Loading</span>
            </div>
            <LoadingStack lines={['title', 'line-medium', 'line-long', 'line-medium']} />
          </section>

          <section className="editor-panel">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">Page style</p>
                <h2>Preparing controls</h2>
              </div>
              <span className="panel-tag">Syncing</span>
            </div>
            <LoadingStack lines={['line-full', 'line-long', 'line-medium']} />
          </section>
        </aside>

        <main className="editor-stage" aria-label="Loading editor">
          <div className="editor-canvas editor-canvas--loading">
            <div className="editor-loading-canvas">
              <div className="editor-loading-canvas__meta">
                <span className="panel-tag">Project</span>
                <span className="panel-tag">Loading</span>
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
                <p className="eyebrow">Page content</p>
                <h2>Preparing fields</h2>
              </div>
              <span className="panel-tag">Loading</span>
            </div>
            <LoadingStack lines={['line-full', 'line-full', 'line-long', 'line-medium']} />
          </section>
        </aside>

        <aside className="editor-sidebar editor-sidebar--operations">
          <section className="editor-panel editor-panel--account">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">Account</p>
                <h2>Checking session</h2>
              </div>
              <span className="panel-tag">Loading</span>
            </div>
            <LoadingStack lines={['line-full', 'line-medium']} />
          </section>

          <section className="editor-panel editor-panel--project-actions">
            <div className="editor-panel__heading">
              <div>
                <p className="eyebrow">Project</p>
                <h2>Preparing controls</h2>
              </div>
              <span className="panel-tag">Loading</span>
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
  return (
    <div className="editor-shell">
      <EditorStateTopbar
        actions={
          <button type="button" className="button button--ghost" onClick={startNewDraft}>
            New draft
          </button>
        }
      />
      <section className="editor-empty-state">
        <p className="eyebrow">Unavailable</p>
        <h1>Project not available.</h1>
        <p>{loadError ?? 'The link is invalid or the project file could not be read.'}</p>
        <div className="editor-empty-state__actions">
          <button type="button" className="button button--primary" onClick={startNewDraft}>
            Start a new draft
          </button>
          <Link to="/" className="button button--ghost">
            Back home
          </Link>
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
  return (
    <div className="editor-shell">
      <EditorStateTopbar
        actions={
          <>
            <Link to="/" className="button button--ghost">
              Back home
            </Link>
            <button type="button" className="button button--primary" onClick={openAccountPage}>
              Sign in
            </button>
          </>
        }
      />
      <section className="editor-empty-state">
        <p className="eyebrow">Session ended</p>
        <h1>Sign in to reopen this folio.</h1>
        <p>This saved project belongs to an account. After sign-out, the editor hides its uploaded media until you sign in again.</p>
        <div className="editor-empty-state__actions">
          <button type="button" className="button button--primary" onClick={openAccountPage}>
            Sign in again
          </button>
          <button type="button" className="button button--ghost" onClick={startNewDraft}>
            Start a new draft
          </button>
        </div>
      </section>
    </div>
  );
}
