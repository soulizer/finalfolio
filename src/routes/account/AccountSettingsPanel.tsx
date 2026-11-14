import type { FormEvent } from 'react';
import type { UserSession } from '../../editor/api';
import { AccountInlineField } from './AccountFormFields';

type AccountSettingsPanelProps = {
  confirmPassword: string;
  currentPassword: string;
  handleChangePassword: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  handleSaveProfile: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  newPassword: string;
  session: UserSession;
  setConfirmPassword: (value: string) => void;
  setCurrentPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  setUsernameDraft: (value: string) => void;
  settingsBusy: boolean;
  usernameDraft: string;
};

export function AccountSettingsPanel({
  confirmPassword,
  currentPassword,
  handleChangePassword,
  handleSaveProfile,
  newPassword,
  session,
  setConfirmPassword,
  setCurrentPassword,
  setNewPassword,
  setUsernameDraft,
  settingsBusy,
  usernameDraft,
}: AccountSettingsPanelProps) {
  return (
    <div className="admin-page admin-page--users">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Identity settings</h2>
          </div>
          <span className="panel-tag">Self-service</span>
        </div>
        <form className="admin-settings-stack" onSubmit={handleSaveProfile}>
          <div className="admin-form-grid admin-form-grid--compact">
            <AccountInlineField label="Username">
              <input
                placeholder="letters, numbers, hyphen, underscore"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9](?:[A-Za-z0-9_-]{1,38}[A-Za-z0-9])?"
              />
            </AccountInlineField>
            <AccountInlineField label="Email">
              <input type="email" value={session.email} readOnly />
            </AccountInlineField>
            <AccountInlineField label="Verification">
              <input value={session.emailVerifiedAt ? 'Verified' : 'Pending'} readOnly />
            </AccountInlineField>
          </div>
          <p className="panel-note account-settings-note">
            New registrations require a unique username. This is now the primary account identity shown across FinalFolio, and older accounts can set or change it here.
          </p>
          <div className="editor-panel__actions admin-panel__actions--end">
            <button type="submit" className="button button--primary button--small" disabled={settingsBusy}>
              Save profile
            </button>
          </div>
        </form>
      </section>

      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Security</p>
            <h2>Change password</h2>
          </div>
          <span className="panel-tag">Protected</span>
        </div>
        <form className="admin-settings-stack" onSubmit={handleChangePassword}>
          <div className="admin-form-grid admin-form-grid--compact">
            <AccountInlineField label="Current password">
              <input
                type="password"
                minLength={8}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </AccountInlineField>
            <AccountInlineField label="New password">
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </AccountInlineField>
            <AccountInlineField label="Confirm password">
              <input
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </AccountInlineField>
          </div>
          <div className="editor-panel__actions admin-panel__actions--end">
            <button type="submit" className="button button--primary button--small" disabled={settingsBusy}>
              Update password
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
