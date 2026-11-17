import { useEffect, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import {
  fetchAdminAiUsage,
  updateAdminAiUsage,
  type AdminAiUsageUser,
} from '../../editor/api';
import { confirmAction } from '../../ui/confirm';

type Draft = { total: string; daily: string };

function toDraft(user: AdminAiUsageUser): Draft {
  return {
    total: String(user.usage.total),
    daily: String(user.usage.daily),
  };
}

export function AdminAiUsagePanel() {
  const t = useT();
  const [users, setUsers] = useState<AdminAiUsageUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminAiUsage()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setUsers(payload.users);
        setDrafts(Object.fromEntries(payload.users.map((user) => [user.userId, toDraft(user)])));
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('Unable to load AI usage.'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) =>
      [user.email, user.username ?? '', user.userId].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, users]);

  async function saveUsage(user: AdminAiUsageUser, draft: Draft) {
    const total = Math.min(100000, Math.max(0, Math.floor(Number(draft.total) || 0)));
    const daily = Math.min(10000, Math.max(0, Math.floor(Number(draft.daily) || 0)));
    setBusyId(user.userId);
    setError(null);
    setNotice(null);
    try {
      const payload = await updateAdminAiUsage(user.userId, { total, daily });
      const usage = payload.usage ?? { ...user.usage, total, daily };
      setUsers((current) =>
        current.map((entry) => (entry.userId === user.userId ? { ...entry, usage } : entry)),
      );
      setDrafts((current) => ({
        ...current,
        [user.userId]: { total: String(usage.total), daily: String(usage.daily) },
      }));
      setNotice(t('AI usage updated for %s.').replace('%s', user.email));
    } catch (saveError) {
      setError(saveError instanceof Error ? t(saveError.message) : t('Unable to update AI usage.'));
    } finally {
      setBusyId(null);
    }
  }

  async function resetUsage(user: AdminAiUsageUser) {
    const confirmed = await confirmAction({
      title: 'Reset AI usage?',
      body: 'This clears the used count for this account. It does not change the configured limits.',
      confirmLabel: 'Reset usage',
    });
    if (!confirmed) {
      return;
    }
    await saveUsage(user, { total: '0', daily: '0' });
  }

  return (
    <div className="admin-ai-usage">
      <div className="admin-section-heading">
        <div>
          <p className="eyebrow">{t('AI usage')}</p>
          <h3>{t('Adjust used credits per account')}</h3>
        </div>
        <span className="panel-tag">{t('%s accounts').replace('%s', String(users.length))}</span>
      </div>
      <p className="panel-note">
        {t('Use this when an account needs a corrected or manually granted number of AI layouts. Limits still apply.')}
      </p>
      <label className="admin-ai-usage__search">
        <span>{t('Search accounts')}</span>
        <input
          value={search}
          placeholder={t('Email, username, or user ID')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {loading ? <p className="panel-note">{t('Loading AI usage…')}</p> : null}
      {error ? (
        <p className="ai-dialog__error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="admin-inline-note" role="status">
          {notice}
        </p>
      ) : null}

      {!loading && !filtered.length ? (
        <p className="panel-note">{t('No accounts match this search.')}</p>
      ) : null}

      <div className="admin-ai-usage__list">
        {filtered.map((user) => {
          const draft = drafts[user.userId] ?? toDraft(user);
          const dirty =
            Number(draft.total) !== user.usage.total || Number(draft.daily) !== user.usage.daily;
          return (
            <article className="admin-ai-usage__row" key={user.userId}>
              <div className="admin-ai-usage__identity">
                <strong>{user.email}</strong>
                <span>
                  {user.username ? `@${user.username}` : user.userId} · {t(user.role)} · {t(user.status)}
                </span>
                <small>
                  {t('Used %s total · %s today')
                    .replace('%s', String(user.usage.total))
                    .replace('%s', String(user.usage.daily))}
                </small>
              </div>
              <div className="admin-ai-usage__fields">
                <label>
                  <span>{t('Total used')}</span>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={draft.total}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [user.userId]: { ...draft, total: event.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>{t('Used today')}</span>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={draft.daily}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [user.userId]: { ...draft, daily: event.target.value },
                      }))
                    }
                  />
                </label>
              </div>
              <div className="admin-ai-usage__actions">
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={!dirty || busyId === user.userId}
                  onClick={() => void saveUsage(user, draft)}
                >
                  {busyId === user.userId ? t('Saving…') : t('Save usage')}
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  disabled={busyId === user.userId || (user.usage.total === 0 && user.usage.daily === 0)}
                  onClick={() => void resetUsage(user)}
                >
                  {t('Reset')}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
