import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { AccountPreferences, PageThemeId } from '../../editor/types';
import { AccountInlineField } from './AccountFormFields';

type AccountPreferencesPanelProps = {
  handleSavePreferences: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  preferences: AccountPreferences;
  preferencesBusy: boolean;
  setPreferences: Dispatch<SetStateAction<AccountPreferences>>;
};

export function AccountPreferencesPanel({
  handleSavePreferences,
  preferences,
  preferencesBusy,
  setPreferences,
}: AccountPreferencesPanelProps) {
  return (
    <div className="admin-page admin-page--users">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">Preferences</p>
            <h2>Editor defaults</h2>
          </div>
          <span className="panel-tag">Saved to account</span>
        </div>
        <form className="admin-settings-stack" onSubmit={handleSavePreferences}>
          <div className="admin-form-grid admin-form-grid--compact">
            <AccountInlineField label="Default export format">
              <select
                value={preferences.defaultExportFormat}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultExportFormat: event.target.value as AccountPreferences['defaultExportFormat'],
                  }))
                }
              >
                <option value="pdf">PDF</option>
                <option value="jpg">JPG</option>
                <option value="project">FinalFolio Project</option>
              </select>
            </AccountInlineField>
            <AccountInlineField label="Default export quality">
              <select
                value={preferences.defaultExportQuality}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultExportQuality: event.target.value as AccountPreferences['defaultExportQuality'],
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="standard">Standard</option>
                <option value="print">Print</option>
              </select>
            </AccountInlineField>
            <AccountInlineField label="Default page size">
              <select
                value={preferences.defaultPageSize}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultPageSize: event.target.value as AccountPreferences['defaultPageSize'],
                  }))
                }
              >
                <option value="a4">A4</option>
                <option value="a5">A5</option>
                <option value="a3">A3</option>
              </select>
            </AccountInlineField>
            <AccountInlineField label="Default page tone">
              <select
                value={preferences.defaultPageTheme ?? ''}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultPageTheme: (event.target.value || null) as PageThemeId | null,
                  }))
                }
              >
                <option value="">Use project default</option>
                <option value="warm-beige">Warm beige</option>
                <option value="butter-cream">Butter cream</option>
                <option value="pale-blue">Pale blue</option>
                <option value="sea-glass">Sea glass</option>
                <option value="pure-white">Pure white</option>
                <option value="light-gray">Light gray</option>
                <option value="sandstone">Sand stone</option>
                <option value="sage-mist">Sage mist</option>
                <option value="dusty-rose">Dusty rose</option>
                <option value="pearl-blush">Pearl blush</option>
              </select>
            </AccountInlineField>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={preferences.preserveCopyWhenSavingTemplate}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  preserveCopyWhenSavingTemplate: event.target.checked,
                }))
              }
            />
            <span>Preserve copy by default when saving a template from the editor.</span>
          </label>
          <div className="editor-panel__actions admin-panel__actions--end">
            <button type="submit" className="button button--primary button--small" disabled={preferencesBusy}>
              {preferencesBusy ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
