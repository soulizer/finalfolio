import type { AdminSummary, UserSession } from '../../editor/api';
import { getUserPrimaryIdentity, getUserSecondaryIdentity } from '../../editor/identity';
import { formatBytes } from './adminFormatting';
import type { AdminSectionKey } from './useAdminShellState';

const ADMIN_SECTIONS: Array<{ id: AdminSectionKey; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'Projects' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'governance', label: 'Governance' },
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
  return (
    <section className="editor-panel admin-hero">
      <div className="editor-panel__heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Operations console for product governance.</h2>
          <p className="panel-note admin-hero__lede">
            Switch between focused backend views instead of cramming overview, folio governance, asset governance, and product
            settings into one scrolling page.
          </p>
        </div>
        <div className="admin-hero__meta">
          <span className="panel-tag">
            {!sessionReady ? 'Checking session' : session ? `${getUserPrimaryIdentity(session)} · ${session.role}` : 'Session required'}
          </span>
          {sessionReady && session && getUserSecondaryIdentity(session) ? <span className="panel-tag">{getUserSecondaryIdentity(session)}</span> : null}
          {summary ? <span className="panel-tag">{`${formatBytes(summary.storage.totalBytes)} storage`}</span> : null}
          {summary ? <span className="panel-tag">{`${summary.failures.length} recent failures`}</span> : null}
        </div>
      </div>
      <div className="admin-section-nav" role="tablist" aria-label="Admin sections">
        {ADMIN_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`button button--small button--ghost admin-section-tab ${activeSection === section.id ? 'admin-section-tab--active' : ''}`}
            aria-pressed={activeSection === section.id}
            onClick={() => selectSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </section>
  );
}
