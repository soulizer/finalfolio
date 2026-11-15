import { useT } from '../../i18n';
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
  const t = useT();
  return (
    <div className="admin-page admin-page--users">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Preferences')}</p>
            <h2>{t('Editor defaults')}</h2>
          </div>
          <span className="panel-tag">{t('Saved to account')}</span>
        </div>
        <form className="admin-settings-stack" onSubmit={handleSavePreferences}>
          <div className="admin-form-grid admin-form-grid--compact">
            <AccountInlineField label={t('Default export format')}>
              <select
                value={preferences.defaultExportFormat}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultExportFormat: event.target.value as AccountPreferences['defaultExportFormat'],
                  }))
                }
              >
                <option value="pdf">{t('PDF')}</option>
                <option value="jpg">{t('JPG')}</option>
                <option value="project">{t('FinalFolio Project')}</option>
              </select>
            </AccountInlineField>
            <AccountInlineField label={t('Default export quality')}>
              <select
                value={preferences.defaultExportQuality}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultExportQuality: event.target.value as AccountPreferences['defaultExportQuality'],
                  }))
                }
              >
                <option value="draft">{t('Draft')}</option>
                <option value="standard">{t('Standard')}</option>
                <option value="print">{t('Print')}</option>
              </select>
            </AccountInlineField>
            <AccountInlineField label={t('Default page size')}>
              <select
                value={preferences.defaultPageSize}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultPageSize: event.target.value as AccountPreferences['defaultPageSize'],
                  }))
                }
              >
                <option value="a4">{t('A4')}</option>
                <option value="a5">{t('A5')}</option>
                <option value="a3">{t('A3')}</option>
              </select>
            </AccountInlineField>
            <AccountInlineField label={t('Default page tone')}>
              <select
                value={preferences.defaultPageTheme ?? ''}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    defaultPageTheme: (event.target.value || null) as PageThemeId | null,
                  }))
                }
              >
                <option value="">{t('Use project default')}</option>
                <option value="warm-beige">{t('Warm beige')}</option>
                <option value="butter-cream">{t('Butter cream')}</option>
                <option value="pale-blue">{t('Pale blue')}</option>
                <option value="sea-glass">{t('Sea glass')}</option>
                <option value="pure-white">{t('Pure white')}</option>
                <option value="light-gray">{t('Light gray')}</option>
                <option value="sandstone">{t('Sand stone')}</option>
                <option value="sage-mist">{t('Sage mist')}</option>
                <option value="dusty-rose">{t('Dusty rose')}</option>
                <option value="pearl-blush">{t('Pearl blush')}</option>
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
            <span>{t('Preserve copy by default when saving a template from the editor.')}</span>
          </label>
          <div className="editor-panel__actions admin-panel__actions--end">
            <button type="submit" className="button button--primary button--small" disabled={preferencesBusy}>
              {preferencesBusy ? t('Saving…') : t('Save preferences')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
