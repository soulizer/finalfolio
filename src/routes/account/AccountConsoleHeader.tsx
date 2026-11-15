import { useT } from '../../i18n';
import type { AccountSummary, UserSession } from '../../editor/api';
import { getUserPrimaryIdentity, getUserSecondaryIdentity } from '../../editor/identity';
import { ACCOUNT_SECTIONS, type AccountSectionKey } from './accountSections';

type AccountConsoleHeaderProps = {
  activeSection: AccountSectionKey;
  selectSection: (section: AccountSectionKey) => void;
  session: UserSession;
  summary: AccountSummary | null;
};

export function AccountConsoleHeader({
  activeSection,
  selectSection,
  session,
  summary,
}: AccountConsoleHeaderProps) {
  const t = useT();
  return (
    <section className="editor-panel admin-hero">
      <div className="editor-panel__heading">
        <div>
          <p className="eyebrow">{t('Account')}</p>
          <h2>{t('Manage your own projects, uploads, and identity.')}</h2>
          <p className="panel-note admin-hero__lede">
            {t('This workspace keeps the same information architecture and governance language as admin, but scoped to your own content.')}</p>
        </div>
        <div className="admin-hero__meta">
          <span className="panel-tag">{`${getUserPrimaryIdentity(session)} · ${t(session.role)}`}</span>
          {getUserSecondaryIdentity(session) ? <span className="panel-tag">{getUserSecondaryIdentity(session)}</span> : null}
          <span className="panel-tag">{session.emailVerifiedAt ? t('Verified') : t('verification pending')}</span>
          {summary ? <span className="panel-tag">{t('%s projects').replace('%s', String(summary.counts.projects))}</span> : null}
        </div>
      </div>
      <div className="admin-section-nav" role="tablist" aria-label={t('Account sections')}>
        {ACCOUNT_SECTIONS.map((section) => (
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
