import { useT } from '../i18n';
import type { CSSProperties, RefObject } from 'react';
import { Link } from 'react-router-dom';

type IssueViewLoadingStateProps = {
  shellClassName: string;
  shellRef: RefObject<HTMLDivElement | null>;
  sidebarTopOffset: number;
};

export function IssueViewLoadingState({
  shellClassName,
  shellRef,
  sidebarTopOffset,
}: IssueViewLoadingStateProps) {
  const t = useT();
  return (
    <div ref={shellRef} className={shellClassName}>
      <main
        id="main-content"
        className="issue-view-layout issue-view-layout--loading"
        aria-busy="true"
        style={
          {
            '--issue-view-sidebar-top-offset': `${sidebarTopOffset || 0}px`,
          } as CSSProperties
        }
      >
        <section className="issue-view-reader">
          <div className="issue-viewer__viewport issue-viewer__viewport--placeholder">
            <div className="issue-viewer__placeholder" role="status" aria-live="polite">
              {/* A neutral indicator, not a fake spread: any fixed-size book
                  skeleton was smaller than the real page and flashed a wrong
                  layout before the folio loaded. */}
              <span className="issue-viewer__placeholder-spinner" aria-hidden="true" />
              <p className="issue-viewer__placeholder-note">{t('Loading the folio…')}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function IssueViewUnavailableState({
  loadError,
  shellClassName,
}: {
  loadError: string | null;
  shellClassName: string;
}) {
  const t = useT();
  return (
    <div className={`editor-shell ${shellClassName}`}>
      <section className="editor-empty-state">
        <p className="eyebrow">{t('Unavailable')}</p>
        <h1>{t('Shared folio not available.')}</h1>
        <p>{loadError ?? t('This share link is unavailable or has been turned off.')}</p>
        <div className="editor-empty-state__actions">
          <Link to="/" className="button button--primary">
            {t('Back home')}</Link>
        </div>
      </section>
    </div>
  );
}
