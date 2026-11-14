import type { UserSession } from '../../editor/api';
import { getUserPrimaryIdentity, getUserSecondaryIdentity } from '../../editor/identity';
import { formatTimestamp } from './adminFormatting';
import { AdminInlineField } from './AdminFormFields';

type AdminUsersPanelProps = {
  createUserEmail: string;
  createUserPassword: string;
  createUserRole: UserSession['role'];
  createUsername: string;
  currentUserId: string | null;
  filteredUsers: UserSession[];
  handleCreateUser: () => void | Promise<void>;
  handleDeleteUser: (user: UserSession) => void | Promise<void>;
  handleToggleUser: (user: UserSession) => void | Promise<void>;
  setCreateUserEmail: (value: string) => void;
  setCreateUserPassword: (value: string) => void;
  setCreateUserRole: (role: UserSession['role']) => void;
  setCreateUsername: (value: string) => void;
  setUserSearch: (value: string) => void;
  userActionBusy: boolean;
  userActionKind: string | null;
  userActionTargetId: string | null;
  userSearch: string;
};

export function AdminUsersPanel({
  createUserEmail,
  createUserPassword,
  createUserRole,
  createUsername,
  currentUserId,
  filteredUsers,
  handleCreateUser,
  handleDeleteUser,
  handleToggleUser,
  setCreateUserEmail,
  setCreateUserPassword,
  setCreateUserRole,
  setCreateUsername,
  setUserSearch,
  userActionBusy,
  userActionKind,
  userActionTargetId,
  userSearch,
}: AdminUsersPanelProps) {
  return (
    <div className="admin-page admin-page--users">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Create user</p>
            <h2>Provision an active account</h2>
          </div>
          <span className="panel-tag">Admin action</span>
        </div>
        <p className="panel-note">Admin-created accounts are activated immediately and bypass email verification.</p>
        <div className="admin-form-grid admin-form-grid--compact">
          <AdminInlineField label="Username">
            <input
              placeholder="3-40 letters, numbers, hyphen, underscore"
              value={createUsername}
              onChange={(event) => setCreateUsername(event.target.value)}
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9](?:[A-Za-z0-9_-]{1,38}[A-Za-z0-9])?"
            />
          </AdminInlineField>
          <AdminInlineField label="Email">
            <input
              type="email"
              placeholder="name@example.com"
              value={createUserEmail}
              onChange={(event) => setCreateUserEmail(event.target.value)}
            />
          </AdminInlineField>
          <AdminInlineField label="Password">
            <input
              type="password"
              placeholder="At least 8 characters"
              value={createUserPassword}
              onChange={(event) => setCreateUserPassword(event.target.value)}
            />
          </AdminInlineField>
          <AdminInlineField label="Role">
            <select value={createUserRole} onChange={(event) => setCreateUserRole(event.target.value as UserSession['role'])}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </AdminInlineField>
        </div>
        <div className="editor-panel__actions admin-panel__actions--end">
          <button
            type="button"
            className="button button--primary button--small"
            onClick={() => void handleCreateUser()}
            disabled={userActionBusy}
          >
            {userActionBusy && userActionKind === 'create' ? 'Creating…' : 'Create active user'}
          </button>
        </div>
      </section>

      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Users</p>
            <h2>Accounts</h2>
          </div>
          <span className="panel-tag">{filteredUsers.length}</span>
        </div>
        <label className="field admin-search-field">
          <span>Search users</span>
          <input placeholder="Username, email, or user ID" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
        </label>
        <div className="admin-list">
          {filteredUsers.length ? (
            filteredUsers.map((user) => (
              <article key={user.id} className="admin-row">
                <div className="admin-row__main">
                  <div className="admin-row__header">
                    <strong className="admin-row__title">{getUserPrimaryIdentity(user)}</strong>
                  </div>
                  <p className="admin-row__subline">
                    {getUserSecondaryIdentity(user) ? `${getUserSecondaryIdentity(user)} · ${user.id}` : user.id}
                  </p>
                  <p className="admin-row__description">{`Created ${formatTimestamp(user.createdAt)} · Last active ${formatTimestamp(user.lastActiveAt)}`}</p>
                </div>
                <div className="admin-row__aside">
                  <div className="admin-row__meta">
                    <span className={`admin-pill ${user.role === 'admin' ? 'admin-pill--strong' : ''}`}>{user.role}</span>
                    <span className={`admin-pill ${user.status === 'active' ? 'admin-pill--success' : 'admin-pill--danger'}`}>
                      {user.status}
                    </span>
                    <span className={`admin-pill ${user.emailVerifiedAt ? 'admin-pill--success' : 'admin-pill--warning'}`}>
                      {user.emailVerifiedAt ? 'verified' : 'verification pending'}
                    </span>
                  </div>
                  <div className="admin-row__actions">
                    <button
                      type="button"
                      className={`button button--small ${user.status === 'active' ? 'button--danger' : 'button--primary'}`}
                      disabled={userActionBusy || (user.id === currentUserId && user.status === 'active')}
                      onClick={() => void handleToggleUser(user)}
                    >
                      {userActionBusy && userActionTargetId === user.id && userActionKind === 'toggle'
                        ? 'Saving…'
                        : user.id === currentUserId && user.status === 'active'
                          ? 'Current admin'
                          : user.status === 'active'
                            ? 'Disable'
                            : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="button button--danger button--small"
                      disabled={userActionBusy || user.id === currentUserId}
                      onClick={() => void handleDeleteUser(user)}
                    >
                      {userActionBusy && userActionTargetId === user.id && userActionKind === 'delete' ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <article className="admin-list__empty">
              <strong>No matching users</strong>
              <p>Try a different username, email, or user ID.</p>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
