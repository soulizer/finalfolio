import { useT } from '../../i18n';
import type { AdminSummary, ProductConfigPayload } from '../../editor/api';
import { getUserPrimaryIdentity, getUserSecondaryIdentity } from '../../editor/identity';
import { countLabel } from '../../i18n';
import { formatBytes, formatTimestamp, formatTrendLabel } from './adminFormatting';
import type { AdminSectionKey } from './useAdminShellState';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';

type AdminOverviewPanelProps = {
  activeHourlyTrend: AdminSummary['trends']['last24Hours'];
  enabledPackCount: number;
  enabledTemplateCount: number;
  productConfig: ProductConfigPayload | null;
  selectSection: (section: AdminSectionKey) => void;
  summary: AdminSummary;
};

export function AdminOverviewPanel({
  activeHourlyTrend,
  enabledPackCount,
  enabledTemplateCount,
  productConfig,
  selectSection,
  summary,
}: AdminOverviewPanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--overview admin-dashboard">
      <div className="admin-page__main admin-dashboard__primary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Overview')}</p>
              <h2>{t('Operational snapshot')}</h2>
            </div>
            <span className="panel-tag">{t('%s exports logged').replace('%s', String(summary.counts.exports))}</span>
                    <PanelCollapseToggle />
          </div>
          <div className="admin-metric-grid">
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('users')}>
              <span>{t('Users')}</span>
              <strong>{summary.counts.users}</strong>
              <small>{t('Accounts')}</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('projects')}>
              <span>{t('Projects')}</span>
              <strong>{summary.counts.projects}</strong>
              <small>{t('Saved folios')}</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('uploads')}>
              <span>{t('Uploads')}</span>
              <strong>{summary.counts.uploads}</strong>
              <small>{t('Stored files')}</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('governance')}>
              <span>{t('Templates')}</span>
              <strong>{enabledTemplateCount}</strong>
              <small>{t('Enabled page types')}</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('governance')}>
              <span>{t('Packs')}</span>
              <strong>{enabledPackCount}</strong>
              <small>{t('Enabled starters')}</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('storage')}>
              <span>{t('Storage')}</span>
              <strong>{formatBytes(summary.storage.totalBytes)}</strong>
              <small>{t('Upload footprint')}</small>
            </button>
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Homepage')}</p>
              <h2>{t('Featured folio on landing page')}</h2>
            </div>
            <span className="panel-tag">{productConfig?.homepagePreview?.source === 'project' ? t('live folio') : t('demo fallback')}</span>
                    <PanelCollapseToggle />
          </div>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{productConfig?.homepagePreview?.title ?? t('Built-in demo preview')}</strong>
              {productConfig?.homepagePreview?.source === 'project' ? (
                <span>{productConfig.homepagePreview.issue}</span>
              ) : null}
            </div>
            <p>
              {productConfig?.homepagePreview
                ? `${productConfig.homepagePreview.source === 'project' ? t('Pinned from a saved folio') : t('Using the built-in demo sequence')} so the homepage keeps showing a real multi-page output proof.`
                : t('No live folio is currently pinned on the homepage. The product will fall back to the built-in demo sequence.')}
            </p>
          </article>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Templates')}</p>
              <h2>{t('Template governance coverage')}</h2>
            </div>
            <span className="panel-tag">{enabledTemplateCount} {t('live templates')}</span>
                    <PanelCollapseToggle />
          </div>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{t('Page types and starter packs')}</strong>
              <span>{enabledPackCount} {t('live packs')}</span>
            </div>
            <p>
              {t('Template order, enablement, starter packs, and homepage content are now governed from admin rather than buried in               editor-only TSX.')}</p>
          </article>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Trend')}</p>
              <h2>{t('Last 7 days')}</h2>
            </div>
            <span className="panel-tag">{t('Events vs failures')}</span>
                    <PanelCollapseToggle />
          </div>
          <div className="admin-breakdown-list">
            {summary.trends.last7Days.map((bucket) => (
              <article key={bucket.label} className="admin-breakdown-row">
                <strong>{formatTrendLabel(bucket, 'day')}</strong>
                <div className="admin-breakdown-row__stats">
                  <span>{countLabel(bucket.total, '1 event', '%s events')}</span>
                  <span>{countLabel(bucket.failures, '1 failure', '%s failures')}</span>
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
              <p className="eyebrow">{t('Recent activity')}</p>
              <h2>{t('Who touched the product')}</h2>
            </div>
            <span className="panel-tag">{summary.recentActivity.length}</span>
                    <PanelCollapseToggle />
          </div>
          <div className="admin-mini-list">
            {summary.recentActivity.length ? (
              summary.recentActivity.map((user) => (
                <article key={user.id} className="admin-mini-list__item">
                  <span>{t(user.role)}</span>
                  <strong>{getUserPrimaryIdentity(user)}</strong>
                  <p className="panel-note">{`${getUserSecondaryIdentity(user) ? `${getUserSecondaryIdentity(user)} · ` : ''}${t('Last active')} ${formatTimestamp(user.lastActiveAt)}`}</p>
                </article>
              ))
            ) : (
              <p className="panel-note">{t('No recent signed-in activity yet.')}</p>
            )}
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Failures')}</p>
              <h2>{t('Error pressure')}</h2>
            </div>
            <span className="panel-tag">{summary.failures.length}</span>
                    <PanelCollapseToggle />
          </div>
          {activeHourlyTrend.length ? (
            <div className="admin-trend-grid">
              {activeHourlyTrend.map((bucket) => (
                <article key={bucket.label} className="admin-stat-card admin-stat-card--static">
                  <span>{formatTrendLabel(bucket, 'hour')}</span>
                  <strong>{bucket.total}</strong>
                  {bucket.failures > 0 ? (
                    <small>{bucket.failures === 1 ? t('1 failure') : t('%s failures').replace('%s', String(bucket.failures))}</small>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="panel-note">{t('No recent error or event spikes in the last 24 hours.')}</p>
          )}
          <div className="admin-mini-list">
            {summary.failures.length ? (
              summary.failures.slice(0, 5).map((failure) => (
                <article key={failure.id} className="admin-mini-list__item">
                  <span>{t(failure.type)}</span>
                  <strong>{t(failure.detail?.message ?? 'Unknown error')}</strong>
                  <p className="panel-note">{formatTimestamp(failure.createdAt)}</p>
                </article>
              ))
            ) : (
              <p className="panel-note">{t('No recent failures recorded.')}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
