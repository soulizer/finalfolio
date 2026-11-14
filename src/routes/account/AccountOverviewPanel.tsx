import type { AccountSummary, UserSession } from '../../editor/api';
import { getUserPrimaryIdentity } from '../../editor/identity';
import type { AccountActivityItem, AccountPreferences } from '../../editor/types';
import { formatTimestamp } from './accountFormatting';
import type { AccountSectionKey } from './accountSections';

type AccountOverviewPanelProps = {
  activity: AccountActivityItem[];
  openRoute: (path: string) => void;
  preferences: AccountPreferences;
  selectSection: (section: AccountSectionKey) => void;
  session: UserSession;
  summary: AccountSummary | null;
  templateCount: number;
};

export function AccountOverviewPanel({
  activity,
  openRoute,
  preferences,
  selectSection,
  session,
  summary,
  templateCount,
}: AccountOverviewPanelProps) {
  const getActivityToneClass = (status: AccountActivityItem['status']) => {
    if (status === 'error') {
      return 'admin-pill--warning';
    }
    if (status === 'requested') {
      return 'admin-pill--muted';
    }
    return 'admin-pill--success';
  };

  const getActivityStatusLabel = (item: AccountActivityItem) => {
    if (item.status === 'requested') {
      return 'Requested';
    }
    if (item.status === 'error') {
      return 'Issue';
    }
    return item.type;
  };

  return (
    <div className="admin-page admin-page--overview">
      <div className="admin-page__main admin-dashboard__primary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>Your working set</h2>
            </div>
            <span className="panel-tag">{summary ? formatTimestamp(summary.account.updatedAt) : 'Loading'}</span>
          </div>
          <div className="admin-metric-grid">
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('projects')}>
              <span>Projects</span>
              <strong>{summary?.counts.projects ?? 0}</strong>
              <small>Active folios</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('projects')}>
              <span>Archived</span>
              <strong>{summary?.counts.archivedProjects ?? 0}</strong>
              <small>Out of the active list</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('uploads')}>
              <span>Uploads</span>
              <strong>{summary?.counts.uploads ?? 0}</strong>
              <small>Stored files</small>
            </button>
            <button type="button" className="template-card admin-stat-card admin-stat-card--interactive" onClick={() => selectSection('templates')}>
              <span>Templates</span>
              <strong>{templateCount}</strong>
              <small>Reusable folio scaffolds</small>
            </button>
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Recent projects</p>
              <h2>Continue editing</h2>
            </div>
            <span className="panel-tag">{summary?.recentProjects.length ?? 0}</span>
          </div>
          <div className="admin-list">
            {summary?.recentProjects.length ? (
              summary.recentProjects.map((project) => (
                <article key={project.id} className="admin-row">
                  <div className="admin-row__main">
                    <div className="admin-row__header">
                      <strong className="admin-row__title">{project.title}</strong>
                    </div>
                    <p className="admin-row__subline">{project.id}</p>
                    <p className="admin-row__description">{`${project.issue} · Updated ${formatTimestamp(project.updatedAt)}`}</p>
                  </div>
                  <div className="admin-row__aside">
                    <div className="admin-row__meta">
                      <span className="admin-pill admin-pill--strong">{project.issue}</span>
                      {project.archivedAt ? <span className="admin-pill admin-pill--warning">Archived</span> : null}
                    </div>
                    <div className="admin-row__actions">
                      <button type="button" className="button button--primary button--small" onClick={() => openRoute(project.sharePath)}>
                        Open
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <article className="admin-list__empty">
                <strong>No saved projects yet</strong>
                <p>Create a project in the editor, then come back here to manage it.</p>
              </article>
            )}
          </div>
        </section>
      </div>

      <div className="admin-page__side admin-side-stack admin-dashboard__secondary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Account status</p>
              <h2>Identity and access</h2>
            </div>
            <span className="panel-tag">{session.role}</span>
          </div>
          <div className="admin-detail-metrics">
            <article>
              <span>Primary identity</span>
              <strong>{getUserPrimaryIdentity(session)}</strong>
            </article>
            <article>
              <span>Email</span>
              <strong>{session.email}</strong>
            </article>
            <article>
              <span>Created</span>
              <strong>{formatTimestamp(session.createdAt)}</strong>
            </article>
            <article>
              <span>Last active</span>
              <strong>{formatTimestamp(session.lastActiveAt)}</strong>
            </article>
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Preferences</p>
              <h2>Current defaults</h2>
            </div>
            <span className="panel-tag">Account level</span>
          </div>
          <div className="admin-detail-metrics">
            <article>
              <span>Export format</span>
              <strong>{preferences.defaultExportFormat}</strong>
            </article>
            <article>
              <span>Export quality</span>
              <strong>{preferences.defaultExportQuality}</strong>
            </article>
            <article>
              <span>Page size</span>
              <strong>{preferences.defaultPageSize}</strong>
            </article>
            <article>
              <span>Template copy</span>
              <strong>{preferences.preserveCopyWhenSavingTemplate ? 'Preserve by default' : 'Structure first'}</strong>
            </article>
          </div>
          <div className="editor-panel__actions admin-panel__actions--flush">
            <button type="button" className="button button--ghost button--small" onClick={() => selectSection('preferences')}>
              Edit preferences
            </button>
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>Latest account actions</h2>
            </div>
            <span className="panel-tag">{activity.length}</span>
          </div>
          <div className="admin-list">
            {activity.length ? (
              activity.slice(0, 8).map((item) => (
                <article key={item.id} className="admin-row">
                  <div className="admin-row__main">
                    <div className="admin-row__header">
                      <strong className="admin-row__title">{item.label}</strong>
                      <span className={`admin-pill ${getActivityToneClass(item.status)}`}>
                        {getActivityStatusLabel(item)}
                      </span>
                    </div>
                    <p className="admin-row__description">{formatTimestamp(item.createdAt)}</p>
                  </div>
                </article>
              ))
            ) : (
              <article className="admin-list__empty">
                <strong>No recent activity</strong>
                <p>Create, export, upload, or archive something and the account timeline will appear here.</p>
              </article>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
