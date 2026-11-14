import type { CSSProperties, RefObject } from 'react';
import { Link } from 'react-router-dom';

type IssueViewLoadingStateProps = {
  mobileSinglePageActive: boolean;
  shellClassName: string;
  shellRef: RefObject<HTMLDivElement | null>;
  sidebarTopOffset: number;
};

export function IssueViewLoadingState({
  mobileSinglePageActive,
  shellClassName,
  shellRef,
  sidebarTopOffset,
}: IssueViewLoadingStateProps) {
  return (
    <div ref={shellRef} className={shellClassName}>
      <main
        className="issue-view-layout issue-view-layout--loading"
        aria-busy="true"
        style={
          {
            '--issue-view-sidebar-top-offset': `${sidebarTopOffset || 0}px`,
          } as CSSProperties
        }
      >
        <section className="issue-view-reader">
          <div className="issue-viewer__viewport issue-viewer__viewport--placeholder" aria-hidden="true">
            <div className="issue-viewer__placeholder">
              <div className="issue-viewer__placeholder-book">
                <div className="issue-viewer__placeholder-page" />
                {!mobileSinglePageActive ? <div className="issue-viewer__placeholder-page" /> : null}
              </div>
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
  return (
    <div className={`editor-shell ${shellClassName}`}>
      <section className="editor-empty-state">
        <p className="eyebrow">Unavailable</p>
        <h1>Shared folio not available.</h1>
        <p>{loadError ?? 'This share link is unavailable or has been turned off.'}</p>
        <div className="editor-empty-state__actions">
          <Link to="/" className="button button--primary">
            Back home
          </Link>
        </div>
      </section>
    </div>
  );
}
