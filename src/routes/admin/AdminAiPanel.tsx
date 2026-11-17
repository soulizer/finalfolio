import { useT } from '../../i18n';
import type { AdminAiConfigDraft, AdminAiProviderDraft } from '../../editor/api';
import { AdminInlineField, AdminToggleField } from './AdminFormFields';

type AdminAiPanelProps = {
  addProvider: () => void;
  aiBusy: boolean;
  aiConfigDraft: AdminAiConfigDraft | null;
  aiTestBusyId: string | null;
  handleSaveAiConfig: () => void | Promise<void>;
  handleTestAiProvider: (index: number) => void | Promise<void>;
  moveProvider: (index: number, direction: -1 | 1) => void;
  removeProvider: (index: number) => void;
  updateField: <Key extends keyof Omit<AdminAiConfigDraft, 'providers'>>(
    field: Key,
    value: AdminAiConfigDraft[Key],
  ) => void;
  updateProvider: (index: number, field: keyof AdminAiProviderDraft, value: string | number | boolean) => void;
};

export function AdminAiPanel({
  addProvider,
  aiBusy,
  aiConfigDraft,
  aiTestBusyId,
  handleSaveAiConfig,
  handleTestAiProvider,
  moveProvider,
  removeProvider,
  updateField,
  updateProvider,
}: AdminAiPanelProps) {
  const t = useT();

  if (!aiConfigDraft) {
    return null;
  }

  return (
    <div className="admin-page admin-page--ai">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('AI arrangement')}</p>
            <h2>{t('Interface pool, usage limits and the default prompt')}</h2>
            <p className="panel-note">
              {t('The editor tries enabled interfaces in order. It only reports an error after every interface fails.')}
            </p>
          </div>
          <span className="panel-tag">{aiConfigDraft.providers.length}</span>
        </div>

        <div className="admin-form-grid admin-ai-limits">
          <div className="admin-inline-card">
            <AdminToggleField
              label={t('Enable AI arrangement')}
              checked={aiConfigDraft.enabled}
              onChange={(checked) => updateField('enabled', checked)}
            />
            <p className="panel-note">{t('Users must sign in to use AI arrangement.')}</p>
          </div>
          <AdminInlineField label={t('Total uses per user')}>
            <input
              type="number"
              min={0}
              max={100000}
              value={aiConfigDraft.userTotalLimit}
              onChange={(event) => updateField('userTotalLimit', Number(event.target.value) || 0)}
            />
          </AdminInlineField>
          <AdminInlineField label={t('Daily uses per user')}>
            <input
              type="number"
              min={0}
              max={10000}
              value={aiConfigDraft.dailyLimit}
              onChange={(event) => updateField('dailyLimit', Number(event.target.value) || 0)}
            />
          </AdminInlineField>
          <AdminInlineField label={t('Maximum photos per request')}>
            <input
              type="number"
              min={1}
              max={50}
              value={aiConfigDraft.maxImages}
              onChange={(event) => updateField('maxImages', Number(event.target.value) || 1)}
            />
          </AdminInlineField>
          <AdminInlineField label={t('Provider timeout (seconds)')}>
            <input
              type="number"
              min={15}
              max={300}
              value={Math.round(aiConfigDraft.requestTimeoutMs / 1000)}
              onChange={(event) => updateField('requestTimeoutMs', (Number(event.target.value) || 15) * 1000)}
            />
          </AdminInlineField>
        </div>
        <p className="panel-note">
          {t('0 means unlimited. The daily limit resets at UTC midnight.')}
        </p>

        <div className="admin-ai-prompt">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">{t('Default prompt')}</p>
              <h3>{t('Users can view it and temporarily edit it before generating.')}</h3>
            </div>
          </div>
          <textarea
            aria-label={t('Default prompt')}
            rows={12}
            value={aiConfigDraft.prompt}
            onChange={(event) => updateField('prompt', event.target.value)}
          />
        </div>

        <div className="admin-section-heading admin-ai-providers__heading">
          <div>
            <p className="eyebrow">{t('Interface pool')}</p>
            <h3>{t('OpenAI-compatible chat completions endpoints')}</h3>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={addProvider}>
            {t('Add interface')}
          </button>
        </div>
        <p className="panel-note">
          {t('Base URL example: https://api.openai.com/v1. The app calls /chat/completions under it.')}
        </p>

        <div className="admin-ai-provider-list">
          {aiConfigDraft.providers.length ? (
            aiConfigDraft.providers.map((provider, index) => {
              const busyId = provider.id ?? `draft-${index}`;
              return (
                <article className="admin-ai-provider-card" key={provider.id ?? `draft-${index}`}>
                  <div className="admin-ai-provider-card__header">
                    <div>
                      <span className="eyebrow">{t('Priority %s').replace('%s', String(index + 1))}</span>
                      <strong>{provider.name || t('Untitled interface')}</strong>
                    </div>
                    <div className="admin-ai-provider-card__controls">
                      <AdminToggleField
                        label={t('Enabled')}
                        checked={provider.enabled}
                        onChange={(checked) => updateProvider(index, 'enabled', checked)}
                      />
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={index === 0}
                        onClick={() => moveProvider(index, -1)}
                        aria-label={t('Move up')}
                        title={t('Move up')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={index === aiConfigDraft.providers.length - 1}
                        onClick={() => moveProvider(index, 1)}
                        aria-label={t('Move down')}
                        title={t('Move down')}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="button button--danger-ghost button--small"
                        onClick={() => removeProvider(index)}
                      >
                        {t('Remove')}
                      </button>
                    </div>
                  </div>

                  <div className="admin-ai-provider-grid">
                    <AdminInlineField label={t('Name')}>
                      <input value={provider.name} onChange={(event) => updateProvider(index, 'name', event.target.value)} />
                    </AdminInlineField>
                    <AdminInlineField label={t('Model')}>
                      <input value={provider.model} onChange={(event) => updateProvider(index, 'model', event.target.value)} />
                    </AdminInlineField>
                    <AdminInlineField label={t('Base URL')}>
                      <input value={provider.baseUrl} onChange={(event) => updateProvider(index, 'baseUrl', event.target.value)} />
                    </AdminInlineField>
                    <AdminInlineField label={t('API key')}>
                      <input
                        type="password"
                        autoComplete="off"
                        value={provider.apiKey ?? ''}
                        placeholder={provider.hasApiKey ? provider.apiKeyHint ?? t('Saved key') : 'sk-...'}
                        onChange={(event) => updateProvider(index, 'apiKey', event.target.value)}
                      />
                    </AdminInlineField>
                  </div>

                  <div className="admin-ai-provider-card__footer">
                    <p className="panel-note">
                      {provider.hasApiKey
                        ? t('A key is already saved. Leave the field blank to keep it.')
                        : t('This interface needs an API key before it can be used.')}
                    </p>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={aiTestBusyId === busyId || !provider.name || !provider.model || !provider.baseUrl}
                      onClick={() => void handleTestAiProvider(index)}
                    >
                      {aiTestBusyId === busyId ? t('Testing…') : t('Test connection')}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="panel-note">{t('No interfaces yet. Add the first one to enable AI arrangement.')}</p>
          )}
        </div>

        <div className="editor-panel__actions admin-panel__actions--end admin-save-bar">
          <button
            type="button"
            className="button button--primary button--small"
            disabled={aiBusy}
            onClick={() => void handleSaveAiConfig()}
          >
            {aiBusy ? t('Saving…') : t('Save AI settings')}
          </button>
        </div>
      </section>
    </div>
  );
}
