import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate as t } from '../i18n';

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(t('FinalFolio render failure'), error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="editor-shell editor-shell--site-page">
        <header className="editor-topbar site-page-header site-page-header--editor">
          <div className="editor-topbar__brand">
            <a href="/">FinalFolio</a>
            <span>Recovery</span>
          </div>
          <div className="editor-topbar__actions site-page-header__editor-actions">
            <a className="button button--ghost button--small" href="/">
              Back home
            </a>
          </div>
        </header>
        <section className="editor-empty-state" role="alert">
          <p className="eyebrow">Unexpected error</p>
          <h1>Something interrupted this page.</h1>
          <p>
            Your saved folios are safe on the server. Reload the page to continue, or return home and reopen the folio from your
            account.
          </p>
          <div className="editor-empty-state__actions">
            <button type="button" className="button button--primary" onClick={this.handleReload}>
              Reload page
            </button>
            <a className="button button--ghost" href="/">
              Back home
            </a>
          </div>
        </section>
      </div>
    );
  }
}
