import type { AdminSummary, ProductConfigPayload } from '../../editor/api';
import { getUserPrimaryIdentity, getUserSecondaryIdentity } from '../../editor/identity';
import { formatBytes, formatTimestamp } from './adminFormatting';
import type { AdminSectionKey } from './useAdminShellState';

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
  return (
    <div className="admin-page admin-page--overview admin-dashboard">
      <div className="admin-page__main admin-dashboard__primary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>Operational snapshot</h2>
            </div>
            <span className="panel-tag">{summary.counts.exports} exports logged</span>
          </div>
          <div className="admin-metric-grid">
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('users')}>
              <span>Users</span>
              <strong>{summary.counts.users}</strong>
              <small>Accounts</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('projects')}>
              <span>Projects</span>
              <strong>{summary.counts.projects}</strong>
              <small>Saved folios</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('uploads')}>
              <span>Uploads</span>
              <strong>{summary.counts.uploads}</strong>
              <small>Stored files</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('governance')}>
              <span>Templates</span>
              <strong>{enabledTemplateCount}</strong>
              <small>Enabled page types</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('governance')}>
              <span>Packs</span>
              <strong>{enabledPackCount}</strong>
              <small>Enabled starters</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('storage')}>
              <span>Storage</span>
              <strong>{formatBytes(summary.storage.totalBytes)}</strong>
              <small>Upload footprint</small>
            </button>
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Homepage</p>
              <h2>Featured folio on landing page</h2>
            </div>
            <span className="panel-tag">{productConfig?.homepagePreview?.source === 'project' ? 'live folio' : 'demo fallback'}</span>
          </div>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{productConfig?.homepagePreview?.title ?? 'Built-in demo preview'}</strong>
              <span>{productConfig?.homepagePreview?.issue ?? 'demo folio'}</span>
            </div>
            <p>
              {productConfig?.homepagePreview
                ? `${productConfig.homepagePreview.source === 'project' ? 'Pinned from a saved folio' : 'Using the built-in demo sequence'} so the homepage keeps showing a real multi-page output proof.`
                : 'No live folio is currently pinned on the homepage. The product will fall back to the built-in demo sequence.'}
            </p>
          </article>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Templates</p>
              <h2>Template governance coverage</h2>
            </div>
            <span className="panel-tag">{enabledTemplateCount} live templates</span>
          </div>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>Page types and starter packs</strong>
              <span>{enabledPackCount} live packs</span>
            </div>
            <p>
              Template order, enablement, starter packs, and homepage content are now governed from admin rather than buried in
              editor-only TSX.
            </p>
          </article>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Trend</p>
              <h2>Last 7 days</h2>
            </div>
            <span className="panel-tag">Events vs failures</span>
          </div>
          <div className="admin-breakdown-list">
            {summary.trends.last7Days.map((bucket) => (
              <article key={bucket.label} className="admin-breakdown-row">
                <strong>{bucket.label}</strong>
                <div className="admin-breakdown-row__stats">
                  <span>{`${bucket.total} events`}</span>
                  <span>{`${bucket.failures} failures`}</span>
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
              <p className="eyebrow">Recent activity</p>
              <h2>Who touched the product</h2>
            </div>
            <span className="panel-tag">{summary.recentActivity.length}</span>
          </div>
          <div className="admin-mini-list">
            {summary.recentActivity.length ? (
              summary.recentActivity.map((user) => (
                <article key={user.id} className="admin-mini-list__item">
                  <span>{user.role}</span>
                  <strong>{getUserPrimaryIdentity(user)}</strong>
                  <p className="panel-note">{`${getUserSecondaryIdentity(user) ? `${getUserSecondaryIdentity(user)} · ` : ''}Last active ${formatTimestamp(user.lastActiveAt)}`}</p>
                </article>
              ))
            ) : (
              <p className="panel-note">No recent signed-in activity yet.</p>
            )}
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Failures</p>
              <h2>Error pressure</h2>
            </div>
            <span className="panel-tag">{summary.failures.length}</span>
          </div>
          {activeHourlyTrend.length ? (
            <div className="admin-trend-grid">
              {activeHourlyTrend.map((bucket) => (
                <article key={bucket.label} className="admin-stat-card admin-stat-card--static">
                  <span>{bucket.label}</span>
                  <strong>{bucket.total}</strong>
                  {bucket.failures > 0 ? (
                    <small>{bucket.failures === 1 ? '1 failure' : `${bucket.failures} failures`}</small>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="panel-note">No recent error or event spikes in the last 24 hours.</p>
          )}
          <div className="admin-mini-list">
            {summary.failures.length ? (
              summary.failures.slice(0, 5).map((failure) => (
                <article key={failure.id} className="admin-mini-list__item">
                  <span>{failure.type}</span>
                  <strong>{failure.detail?.message ?? 'Unknown error'}</strong>
                  <p className="panel-note">{formatTimestamp(failure.createdAt)}</p>
                </article>
              ))
            ) : (
              <p className="panel-note">No recent failures recorded.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
