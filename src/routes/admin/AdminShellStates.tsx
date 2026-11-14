import { LoadingStack } from '../../components/LoadingStack';
import type { AdminSectionKey } from './useAdminShellState';

export function AdminLoadingState({ activeSection }: { activeSection: AdminSectionKey }) {
  const inspectorSection = activeSection === 'projects' || activeSection === 'uploads';

  if (inspectorSection) {
    return (
      <div className="admin-page admin-page--single">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{activeSection === 'projects' ? 'Projects' : 'Uploads'}</p>
              <h2>{activeSection === 'projects' ? 'Folio governance' : 'Asset governance'}</h2>
            </div>
            <span className="panel-tag">Loading</span>
          </div>
          <label className="field admin-search-field">
            <span>{activeSection === 'projects' ? 'Search projects' : 'Search uploads'}</span>
            <div className="loading-field" aria-hidden="true">
              <span className="loading-placeholder loading-placeholder--line-full" />
            </div>
          </label>
          <div className="admin-split-panel admin-split-panel--inspector">
            <div className="admin-list">
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={index} className="admin-row admin-row--loading">
                  <div className="admin-row__main">
                    <LoadingStack lines={['title', 'line-medium', 'line-long']} tight />
                  </div>
                  <div className="admin-row__aside">
                    <LoadingStack lines={['line-short', 'line-medium']} tight />
                  </div>
                </article>
              ))}
            </div>
            <aside className="admin-detail-card admin-detail-card--loading">
              <div className="admin-detail-card__header">
                <div>
                  <p className="eyebrow">Inspect</p>
                  <h2>{activeSection === 'projects' ? 'Project detail' : 'Upload detail'}</h2>
                </div>
                <span className="panel-tag">Loading</span>
              </div>
              <div className={activeSection === 'projects' ? 'admin-detail-preview' : 'admin-upload-preview'}>
                <div
                  className={`loading-placeholder loading-placeholder--line-full ${
                    activeSection === 'projects' ? 'admin-detail-preview__placeholder' : 'admin-upload-preview__placeholder'
                  }`.trim()}
                />
                <p className="panel-note">
                  {activeSection === 'projects'
                    ? 'Loading the selected folio into the inspector.'
                    : 'Loading the selected asset into the inspector.'}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page admin-page--overview">
      <div className="admin-page__main admin-dashboard__primary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>Operational snapshot</h2>
            </div>
            <span className="panel-tag">Loading</span>
          </div>
          <div className="admin-metric-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className="loading-card loading-card--metric admin-stat-card" aria-hidden="true">
                <LoadingStack lines={['eyebrow', 'title', 'line-short']} tight />
              </article>
            ))}
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Trends</p>
              <h2>Recent backend activity</h2>
            </div>
            <span className="panel-tag">Loading</span>
          </div>
          <div className="admin-breakdown-list">
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={index} className="admin-breakdown-row">
                <LoadingStack lines={['title']} tight />
                <div className="admin-breakdown-row__stats admin-breakdown-row__stats--loading">
                  <LoadingStack lines={['line-short']} tight />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-page__side admin-side-stack admin-dashboard__secondary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Backend status</h2>
            </div>
            <span className="panel-tag">Syncing</span>
          </div>
          <p className="panel-note">Live counts, failures, and governance controls will load in place.</p>
          <LoadingStack lines={['line-full', 'line-long', 'line-medium']} />
        </section>
      </div>
    </div>
  );
}

type AdminUnavailableStateProps = {
  fallbackBody: string;
  fallbackTitle: string;
  onBackToEditor: () => void;
  onPrimaryAction: () => void;
  primaryFallbackDisabled: boolean;
  primaryFallbackLabel: string;
};

export function AdminUnavailableState({
  fallbackBody,
  fallbackTitle,
  onBackToEditor,
  onPrimaryAction,
  primaryFallbackDisabled,
  primaryFallbackLabel,
}: AdminUnavailableStateProps) {
  return (
    <section className="editor-empty-state">
      <p className="eyebrow">Unavailable</p>
      <h1>{fallbackTitle}</h1>
      <p>{fallbackBody}</p>
      <div className="editor-empty-state__actions">
        <button type="button" className="button button--primary" disabled={primaryFallbackDisabled} onClick={onPrimaryAction}>
          {primaryFallbackLabel}
        </button>
        <button type="button" className="button button--primary" onClick={onBackToEditor}>
          Back to editor
        </button>
      </div>
    </section>
  );
}
