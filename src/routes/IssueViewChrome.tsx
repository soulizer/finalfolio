import { useT } from '../i18n';
import type { CSSProperties } from 'react';
import type { UserSession } from '../editor/api';
import type { PublicIssuePayload } from '../editor/types';
import { Link } from 'react-router-dom';

type IssueCurrentView = {
  label: string;
  rangeLabel: string;
  canGoPrev: boolean;
  canGoNext: boolean;
};

type IssueViewReaderChromeProps = {
  currentView: IssueCurrentView;
  fullscreenActive: boolean;
  isTurning: boolean;
  issue: PublicIssuePayload;
  mobilePanelOpen: boolean;
  mobileStatusLabel: string;
  pageCount: number;
  pageWidth: number;
  session: UserSession | null;
  sessionReady: boolean;
  showMobileChrome: boolean;
  onAdvanceToNextPage: () => void;
  onAdvanceToPreviousPage: () => void;
  onCloseMobilePanel: () => void;
  onToggleFullscreen: () => void | Promise<void>;
  onToggleMobilePanel: () => void;
};

type IssueViewSidebarProps = {
  currentView: IssueCurrentView;
  fullscreenActive: boolean;
  isTurning: boolean;
  issue: PublicIssuePayload;
  pageCount: number;
  session: UserSession | null;
  sessionReady: boolean;
  showDesktopSidebar: boolean;
  viewerHint: string;
  onAdvanceToNextPage: () => void;
  onAdvanceToPreviousPage: () => void;
  onToggleFullscreen: () => void | Promise<void>;
};

type IssueViewSharedFolioSectionProps = {
  className?: string;
  issue: PublicIssuePayload;
  pageCount: number;
  session: UserSession | null;
  sessionReady: boolean;
};

function IssueViewSharedFolioSection({
  className = 'issue-view-copy',
  issue,
  pageCount,
  session,
  sessionReady,
}: IssueViewSharedFolioSectionProps) {
  const t = useT();
  return (
    <section className={className}>
      <p className="eyebrow">{t('Shared folio')}</p>
      <h1>{issue.title}</h1>
      <div className="issue-view-copy__meta">
        <span className="panel-tag">{t('Read only')}</span>
        <span className="panel-tag">{issue.issue || t('Folio')}</span>
        <span className="panel-tag">{`${pageCount} pages`}</span>
      </div>
      {issue.subtitle ? <p>{issue.subtitle}</p> : null}
      {sessionReady && !session ? (
        <div className="issue-view-copy__actions">
          <Link to="/" className="button button--ghost button--small">
            {t('Back to FinalFolio')}</Link>
          <Link to="/editor" className="button button--primary button--small">
            {t('Make my folio')}</Link>
        </div>
      ) : null}
    </section>
  );
}

type IssueViewCurrentViewToolsProps = {
  className?: string;
  currentView: IssueCurrentView;
  fullscreenActive: boolean;
  isTurning: boolean;
  viewerHint: string;
  onAdvanceToNextPage: () => void;
  onAdvanceToPreviousPage: () => void;
  onToggleFullscreen: () => void | Promise<void>;
};

function IssueViewCurrentViewTools({
  className = 'issue-view-tools',
  currentView,
  fullscreenActive,
  isTurning,
  viewerHint,
  onAdvanceToNextPage,
  onAdvanceToPreviousPage,
  onToggleFullscreen,
}: IssueViewCurrentViewToolsProps) {
  const t = useT();
  return (
    <section className={className}>
      <div className="issue-view-tools__section">
        <div>
          <p className="eyebrow">{t('Current view')}</p>
          <h2>{currentView.label}</h2>
        </div>
        <p className="issue-view-tools__caption">{currentView.rangeLabel}</p>
      </div>

      <div className="issue-view-tools__section">
        <div className="issue-view-controls">
          <button
            type="button"
            className="button button--ghost issue-view-controls__button issue-view-controls__button--prev"
            disabled={!currentView.canGoPrev || isTurning}
            onClick={onAdvanceToPreviousPage}
          >
            <span aria-hidden="true" className="issue-view-controls__icon">
              ←
            </span>
            <span>{t('Previous')}</span>
          </button>
          <button
            type="button"
            className="button button--ghost issue-view-controls__button issue-view-controls__button--next"
            disabled={!currentView.canGoNext || isTurning}
            onClick={onAdvanceToNextPage}
          >
            <span>{t('Next')}</span>
            <span aria-hidden="true" className="issue-view-controls__icon">
              →
            </span>
          </button>
        </div>
      </div>

      <div className="issue-view-tools__section issue-view-tools__section--aux">
        <button type="button" className="button button--ghost button--small" onClick={() => void onToggleFullscreen()}>
          {fullscreenActive ? t('Exit fullscreen') : t('Fullscreen')}
        </button>
        <p className="issue-view-tools__hint">{viewerHint}</p>
      </div>
    </section>
  );
}

export function IssueViewReaderChrome({
  currentView,
  fullscreenActive,
  isTurning,
  issue,
  mobilePanelOpen,
  mobileStatusLabel,
  pageCount,
  pageWidth,
  session,
  sessionReady,
  showMobileChrome,
  onAdvanceToNextPage,
  onAdvanceToPreviousPage,
  onCloseMobilePanel,
  onToggleFullscreen,
  onToggleMobilePanel,
}: IssueViewReaderChromeProps) {
  const t = useT();
  return (
    <>
      {showMobileChrome ? (
        <>
          <div className="issue-view-mobile-topbar">
            <div className="issue-view-mobile-topbar__summary">
              <span className="eyebrow">{t('Shared folio')}</span>
              <strong>{issue.title}</strong>
              <small>{`${issue.issue} · ${currentView.rangeLabel}`}</small>
            </div>
            <button
              type="button"
              className="button button--ghost button--small issue-view-mobile-topbar__action"
              aria-expanded={mobilePanelOpen}
              aria-controls="issue-view-mobile-panel"
              onClick={onToggleMobilePanel}
            >
              {t('Details')}</button>
          </div>

          <div
            className="issue-view-mobile-controls"
            style={{ '--issue-mobile-control-width': `${Math.round(pageWidth)}px` } as CSSProperties}
          >
            <div className="issue-view-mobile-controls__status">
              <span>{mobileStatusLabel}</span>
              <strong>{currentView.label}</strong>
            </div>
            <div className="issue-view-mobile-controls__actions">
              <button
                type="button"
                className="button button--ghost issue-view-controls__button issue-view-mobile-controls__button"
                disabled={!currentView.canGoPrev || isTurning}
                onClick={onAdvanceToPreviousPage}
              >
                {t('Previous')}</button>
              <button
                type="button"
                className="button button--ghost issue-view-controls__button issue-view-mobile-controls__button"
                disabled={!currentView.canGoNext || isTurning}
                onClick={onAdvanceToNextPage}
              >
                {t('Next')}</button>
            </div>
          </div>

          {mobilePanelOpen ? (
            <button
              type="button"
              className="issue-view-mobile-overlay"
              aria-label={t('Close shared folio details')}
              onClick={onCloseMobilePanel}
            />
          ) : null}

          <div
            id="issue-view-mobile-panel"
            className={`issue-view-mobile-sheet ${mobilePanelOpen ? 'is-open' : ''}`.trim()}
            role="dialog"
            aria-modal="true"
            aria-label={t('Shared folio details')}
          >
            <div className="issue-view-mobile-sheet__card">
              <div className="issue-view-mobile-sheet__header">
                <button type="button" className="button button--ghost button--small" onClick={onCloseMobilePanel}>
                  {t('Close')}</button>
              </div>
              <div className="issue-view-mobile-sheet__content">
                <IssueViewSharedFolioSection issue={issue} pageCount={pageCount} session={session} sessionReady={sessionReady} />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {fullscreenActive ? (
        <div className="issue-view-fullscreen-controls">
          <button
            type="button"
            className="button button--ghost button--small issue-view-fullscreen-controls__button"
            disabled={!currentView.canGoPrev || isTurning}
            onClick={onAdvanceToPreviousPage}
          >
            {t('Previous')}</button>
          <button
            type="button"
            className="button button--ghost button--small issue-view-fullscreen-controls__button"
            disabled={!currentView.canGoNext || isTurning}
            onClick={onAdvanceToNextPage}
          >
            {t('Next')}</button>
          <button
            type="button"
            className="button button--ghost button--small issue-view-fullscreen-controls__button"
            onClick={() => void onToggleFullscreen()}
          >
            {t('Exit fullscreen')}</button>
        </div>
      ) : null}
    </>
  );
}

export function IssueViewSidebar({
  currentView,
  fullscreenActive,
  isTurning,
  issue,
  pageCount,
  session,
  sessionReady,
  showDesktopSidebar,
  viewerHint,
  onAdvanceToNextPage,
  onAdvanceToPreviousPage,
  onToggleFullscreen,
}: IssueViewSidebarProps) {
  if (!showDesktopSidebar) {
    return null;
  }

  return (
    <aside className="issue-view-sidebar">
      <div className="issue-view-sidebar__rail">
        <IssueViewSharedFolioSection issue={issue} pageCount={pageCount} session={session} sessionReady={sessionReady} />
        <IssueViewCurrentViewTools
          currentView={currentView}
          fullscreenActive={fullscreenActive}
          isTurning={isTurning}
          viewerHint={viewerHint}
          onAdvanceToNextPage={onAdvanceToNextPage}
          onAdvanceToPreviousPage={onAdvanceToPreviousPage}
          onToggleFullscreen={onToggleFullscreen}
        />
      </div>
    </aside>
  );
}
