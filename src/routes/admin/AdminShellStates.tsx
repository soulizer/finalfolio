import { useT } from '../../i18n';
import { LoadingStack } from '../../components/LoadingStack';
import type { AdminSectionKey } from './useAdminShellState';

export function AdminLoadingState({ activeSection }: { activeSection: AdminSectionKey }) {
  const t = useT();
  const inspectorSection = activeSection === 'projects' || activeSection === 'uploads';

  if (inspectorSection) {
    return (
      <div className="admin-page admin-page--single">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{activeSection === 'projects' ? t('Projects') : t('Uploads')}</p>
              <h2>{activeSection === 'projects' ? t('Folio governance') : t('Asset governance')}</h2>
            </div>
            <span className="panel-tag">{t('Loading')}</span>
          </div>
          <label className="field admin-search-field">
            <span>{activeSection === 'projects' ? t('Search projects') : t('Search uploads')}</span>
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
                  <p className="eyebrow">{t('Inspect')}</p>
                  <h2>{activeSection === 'projects' ? t('Project detail') : t('Upload detail')}</h2>
                </div>
                <span className="panel-tag">{t('Loading')}</span>
              </div>
              <div className={activeSection === 'projects' ? 'admin-detail-preview' : 'admin-upload-preview'}>
                <div
                  className={`loading-placeholder loading-placeholder--line-full ${
                    activeSection === 'projects' ? t('admin-detail-preview__placeholder') : t('admin-upload-preview__placeholder')
                  }`.trim()}
                />
                <p className="panel-note">
                  {activeSection === 'projects'
                    ? t('Loading the selected folio into the inspector.')
                    : t('Loading the selected asset into the inspector.')}
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
              <p className="eyebrow">{t('Overview')}</p>
              <h2>{t('Operational snapshot')}</h2>
            </div>
            <span className="panel-tag">{t('Loading')}</span>
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
              <p className="eyebrow">{t('Trends')}</p>
              <h2>{t('Recent backend activity')}</h2>
            </div>
            <span className="panel-tag">{t('Loading')}</span>
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
              <p className="eyebrow">{t('Admin')}</p>
              <h2>{t('Backend status')}</h2>
            </div>
            <span className="panel-tag">{t('Syncing')}</span>
          </div>
          <p className="panel-note">{t('Live counts, failures, and governance controls will load in place.')}</p>
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
  const t = useT();
  return (
    <section className="editor-empty-state">
      <p className="eyebrow">{t('Unavailable')}</p>
      <h1>{t(fallbackTitle)}</h1>
      <p>{t(fallbackBody)}</p>
      <div className="editor-empty-state__actions">
        <button type="button" className="button button--primary" disabled={primaryFallbackDisabled} onClick={onPrimaryAction}>
          {t(primaryFallbackLabel)}
        </button>
        <button type="button" className="button button--primary" onClick={onBackToEditor}>
          {t('Back to editor')}</button>
      </div>
    </section>
  );
}
