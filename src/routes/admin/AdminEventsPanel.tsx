import { translate as tModule } from '../../i18n';
import { countLabel, useT } from '../../i18n';
import type { AdminProjectListItem, AdminSummary, UserSession } from '../../editor/api';
import { getUserPrimaryIdentity } from '../../editor/identity';
import { formatTimestamp, formatTrendLabel } from './adminFormatting';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';

type AdminEventRecord = AdminSummary['events'][number];

type AdminEventsPanelProps = {
  activeDailyTrend: AdminSummary['trends']['last7Days'];
  activeHourlyTrend: AdminSummary['trends']['last24Hours'];
  projectsById: Record<string, AdminProjectListItem>;
  rankedEventBreakdown: Array<
    [
      string,
      {
        failures: number;
        total: number;
      },
    ]
  >;
  summary: AdminSummary;
  usersById: Record<string, UserSession>;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  admin: tModule('Admin'),
  auth: tModule('Authentication'),
  export: tModule('Exports'),
  project: tModule('Projects'),
  share: tModule('Sharing'),
  upload: tModule('Uploads'),
  request: tModule('Request'),
};

function getEventTypeLabel(type: string) {
  return EVENT_TYPE_LABELS[type] ?? type.replace(/[-_]/g, ' ');
}

function formatDetailSummary(detail: Record<string, unknown> | null | undefined, fallback: string) {
  const message = typeof detail?.message === 'string' ? detail.message.trim() : '';
  if (message) {
    return message;
  }

  const reason = typeof detail?.reason === 'string' ? detail.reason.trim() : '';
  if (reason) {
    return reason;
  }

  const action = typeof detail?.action === 'string' ? detail.action.trim() : '';
  if (action) {
    return action.replace(/[-_]/g, ' ');
  }

  const path = typeof detail?.path === 'string' ? detail.path.trim() : '';
  if (path) {
    return path;
  }

  return fallback;
}

function buildEventContext(
  record: Pick<AdminEventRecord, 'createdAt' | 'projectId' | 'userId'>,
  usersById: Record<string, UserSession>,
  projectsById: Record<string, AdminProjectListItem>,
) {
  const parts = [];
  if (record.projectId && projectsById[record.projectId]) {
    parts.push(projectsById[record.projectId].title);
  }

  if (record.userId && usersById[record.userId]) {
    parts.push(getUserPrimaryIdentity(usersById[record.userId]));
  }

  parts.push(formatTimestamp(record.createdAt));
  return parts.join(' · ');
}

function getEventStatusLabel(record: Pick<AdminEventRecord, 'status' | 'type'>) {
  if (record.status === 'requested' && record.type === 'export') {
    return tModule('Requested');
  }
  if (record.status === 'error') {
    return tModule('Error');
  }
  return tModule('Completed');
}

function getEventStatusClass(record: Pick<AdminEventRecord, 'status'>) {
  if (record.status === 'error') {
    return 'admin-pill--warning';
  }
  if (record.status === 'requested') {
    return 'admin-pill--muted';
  }
  return 'admin-pill--success';
}

export function AdminEventsPanel({
  activeDailyTrend,
  activeHourlyTrend,
  projectsById,
  rankedEventBreakdown,
  summary,
  usersById,
}: AdminEventsPanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--events">
      <div className="admin-page__main admin-dashboard__primary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Events')}</p>
              <h2>{t('Recent errors and activity')}</h2>
            </div>
            <span className="panel-tag">{summary.failures.length ? countLabel(summary.failures.length, '1 failure', '%s failures') : t('No current failures')}</span>
                    <PanelCollapseToggle />
          </div>
          <div className="admin-breakdown-list">
            {rankedEventBreakdown.map(([type, counts]) => (
              <article key={type} className="admin-breakdown-row">
                <strong>{getEventTypeLabel(type)}</strong>
                <div className="admin-breakdown-row__stats">
                  <span>{countLabel(counts.total, '1 event', '%s events')}</span>
                  <span>{countLabel(counts.failures, '1 failure', '%s failures')}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Failures')}</p>
              <h2>{t('Recent failures')}</h2>
            </div>
            <span className="panel-tag">{summary.failures.length}</span>
                    <PanelCollapseToggle />
          </div>
          <div className="admin-mini-list">
            {summary.failures.length ? (
              summary.failures.map((failure) => (
                <article key={failure.id} className="admin-mini-list__item">
                  <span>{getEventTypeLabel(failure.type)}</span>
                  <strong>{t(formatDetailSummary(failure.detail, t('Unknown error')))}</strong>
                  <p className="panel-note">{buildEventContext(failure, usersById, projectsById)}</p>
                </article>
              ))
            ) : (
              <p className="panel-note">{t('No recent failures recorded.')}</p>
            )}
          </div>
        </section>
      </div>

      <div className="admin-page__side admin-side-stack admin-dashboard__secondary">
        <section className="editor-panel admin-panel">
          <div className="editor-panel__heading">
            <div>
              <p className="eyebrow">{t('Operations')}</p>
              <h2>{t('Recent operations')}</h2>
            </div>
            <span className="panel-tag">{summary.events.length}</span>
                    <PanelCollapseToggle />
          </div>
          <div className="admin-mini-list">
            {summary.events.length ? (
              summary.events.slice(0, 8).map((event) => {
                const action = typeof event.detail?.action === 'string' ? event.detail.action.trim() : '';
                const actionLabel = action ? t(action) : '';
                const typeLabel = getEventTypeLabel(event.type);
                return (
                  <article key={event.id} className="admin-mini-list__item">
                    <div className="admin-inline-meta">
                      <span>{typeLabel}</span>
                      <span className={`admin-pill ${getEventStatusClass(event)}`}>{getEventStatusLabel(event)}</span>
                    </div>
                    {actionLabel && actionLabel !== typeLabel ? <strong>{actionLabel}</strong> : null}
                    <p className="panel-note">{buildEventContext(event, usersById, projectsById)}</p>
                  </article>
                );
              })
            ) : (
              <p className="panel-note">{t('No recent operations recorded.')}</p>
            )}
          </div>
        </section>

        <section className="editor-panel admin-panel">
          <details className="admin-collapsible">
            <summary>
              <span>{t('Trend details')}</span>
              <small>{t('Secondary diagnostic view')}</small>
            </summary>
            <div className="admin-collapsible__body">
              <div className="admin-detail-section">
                <strong>{t('Last 7 days')}</strong>
                <div className="admin-breakdown-list">
                  {(activeDailyTrend.length ? activeDailyTrend : summary.trends.last7Days).map((bucket) => (
                    <article key={bucket.label} className="admin-breakdown-row">
                      <strong>{formatTrendLabel(bucket, 'day')}</strong>
                      <div className="admin-breakdown-row__stats">
                        <span>{countLabel(bucket.total, '1 event', '%s events')}</span>
                        <span>{countLabel(bucket.failures, '1 failure', '%s failures')}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
              <div className="admin-detail-section">
                <strong>{t('Last 24 hours')}</strong>
                <div className="admin-breakdown-list">
                  {(activeHourlyTrend.length ? activeHourlyTrend : summary.trends.last24Hours).map((bucket) => (
                    <article key={bucket.label} className="admin-breakdown-row">
                      <strong>{formatTrendLabel(bucket, 'hour')}</strong>
                      <div className="admin-breakdown-row__stats">
                        <span>{countLabel(bucket.total, '1 event', '%s events')}</span>
                        <span>{countLabel(bucket.failures, '1 failure', '%s failures')}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
