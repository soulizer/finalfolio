import { useT } from '../../i18n';
import type { AdminSummary, UserSession } from '../../editor/api';
import { getUserPrimaryIdentity, getUserSecondaryIdentity } from '../../editor/identity';
import { formatBytes } from './adminFormatting';
import type { AdminSectionKey } from './useAdminShellState';

const ADMIN_SECTIONS: Array<{ id: AdminSectionKey; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'governance', label: 'Governance' },
  { id: 'ai', label: 'AI' },
  { id: 'storage', label: 'Storage' },
  { id: 'users', label: 'Users' },
  { id: 'events', label: 'Events' },
];

type AdminConsoleHeaderProps = {
  activeSection: AdminSectionKey;
  selectSection: (section: AdminSectionKey) => void;
  session: UserSession | null;
  sessionReady: boolean;
  summary: AdminSummary | null;
};

export function AdminConsoleHeader({
  activeSection,
  selectSection,
  session,
  sessionReady,
  summary,
}: AdminConsoleHeaderProps) {
  const t = useT();
  return (
    <section className="editor-panel admin-hero">
      <div className="editor-panel__heading">
        <div>
          <p className="eyebrow">{t('Admin')}</p>
          <h2>{t('Operations console for product governance.')}</h2>
          <p className="panel-note admin-hero__lede">
            {t('Switch between focused backend views instead of cramming overview, folio governance, asset governance, and product             settings into one scrolling page.')}</p>
        </div>
        <div className="admin-hero__meta">
          <span className="panel-tag">
            {!sessionReady ? t('Checking session') : session ? `${getUserPrimaryIdentity(session)} · ${t(session.role)}` : t('Session required')}
          </span>
          {sessionReady && session && getUserSecondaryIdentity(session) ? <span className="panel-tag">{getUserSecondaryIdentity(session)}</span> : null}
          {summary ? <span className="panel-tag">{t('%s storage').replace('%s', formatBytes(summary.storage.totalBytes))}</span> : null}
          {summary ? <span className="panel-tag">{t('%s recent failures').replace('%s', String(summary.failures.length))}</span> : null}
        </div>
      </div>
      <div className="admin-section-nav" role="tablist" aria-label={t('Admin sections')}>
        {ADMIN_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`button button--small button--ghost admin-section-tab ${activeSection === section.id ? 'admin-section-tab--active' : ''}`}
            aria-pressed={activeSection === section.id}
            onClick={() => selectSection(section.id)}
          >
            {t(section.label)}
          </button>
        ))}
      </div>
    </section>
  );
}
