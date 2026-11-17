import { useState } from 'react';
import { translate, useT } from '../../i18n';
import {
  testAdminAiProvider,
  type AdminAiConfigDraft,
  type AdminAiProviderDraft,
} from '../../editor/api';
import { confirmAction } from '../../ui/confirm';
import { AdminInlineField, AdminToggleField } from './AdminFormFields';
import { AdminAiUsagePanel } from './AdminAiUsagePanel';

type ProviderEditorState = {
  index: number | null;
  draft: AdminAiProviderDraft;
};

type AdminAiPanelProps = {
  aiBusy: boolean;
  aiConfigDraft: AdminAiConfigDraft | null;
  aiTestBusyId: string | null;
  handleSaveAiConfig: () => void | Promise<void>;
  handleTestAiProvider: (index: number) => void | Promise<void>;
  saveAiConfig: (draft: AdminAiConfigDraft) => Promise<void>;
  updateField: <Key extends keyof Omit<AdminAiConfigDraft, 'providers'>>(
    field: Key,
    value: AdminAiConfigDraft[Key],
  ) => void;
};

function nextOrder(providers: AdminAiProviderDraft[]) {
  return providers.reduce((max, provider) => Math.max(max, provider.order), 0) + 10;
}

function ProviderEditorDialog({
  busy,
  draft,
  index,
  onCancel,
  onSave,
}: {
  busy: boolean;
  draft: AdminAiProviderDraft;
  index: number | null;
  onCancel: () => void;
  onSave: (draft: AdminAiProviderDraft) => Promise<void>;
}) {
  const t = useT();
  const [provider, setProvider] = useState(draft);
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<Key extends keyof AdminAiProviderDraft>(field: Key, value: AdminAiProviderDraft[Key]) {
    setProvider((current) => ({ ...current, [field]: value }));
  }

  async function handleTest() {
    setTestBusy(true);
    setTestError(null);
    setTestMessage(null);

    try {
      const result = await testAdminAiProvider({
        providerId: provider.id,
        provider,
      });
      setTestMessage(
        translate('AI connection passed in %s ms (%s).')
          .replace('%s', String(result.latencyMs))
          .replace('%s', result.model),
      );
    } catch (error) {
      setTestError(
        error instanceof Error && /^AI connection failed/i.test(error.message)
          ? t('AI connection failed. Check the interface settings.')
          : t('Unable to test this AI provider.'),
      );
    } finally {
      setTestBusy(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(provider);
    } catch {
      setSaveError(t('Unable to save AI settings.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="layout-editor-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onCancel();
        }
      }}
    >
      <div className="admin-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-provider-dialog-title">
        <header className="admin-ai-dialog__header">
          <div>
            <p className="eyebrow">{t('Interface pool')}</p>
            <h2 id="ai-provider-dialog-title">
              {index === null ? t('Add interface') : t('Edit interface')}
            </h2>
            <p className="panel-note">
              {t('OpenAI-compatible chat completions endpoint. Base URL example: https://api.openai.com/v1')}
            </p>
          </div>
          <button
            type="button"
            className="layout-editor-close"
            aria-label={t('Close')}
            title={t('Close')}
            disabled={saving}
            onClick={onCancel}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="admin-ai-dialog__body">
          <div className="admin-ai-provider-grid">
            <AdminInlineField label={t('Name')} stacked>
              <input
                autoFocus
                aria-label={t('Name')}
                value={provider.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </AdminInlineField>
            <AdminInlineField label={t('Model')} stacked>
              <input
                aria-label={t('Model')}
                value={provider.model}
                onChange={(event) => update('model', event.target.value)}
              />
            </AdminInlineField>
            <AdminInlineField label={t('Base URL')} stacked>
              <input
                aria-label={t('Base URL')}
                value={provider.baseUrl}
                onChange={(event) => update('baseUrl', event.target.value)}
              />
            </AdminInlineField>
            <AdminInlineField label={t('API key')} stacked>
              <input
                type="password"
                autoComplete="off"
                aria-label={t('API key')}
                value={provider.apiKey ?? ''}
                placeholder={provider.hasApiKey ? provider.apiKeyHint ?? t('Saved key') : 'sk-...'}
                onChange={(event) => update('apiKey', event.target.value)}
              />
            </AdminInlineField>
          </div>
          <div className="admin-ai-dialog__toggle">
            <AdminToggleField
              label={t('Enabled')}
              checked={provider.enabled}
              onChange={(checked) => update('enabled', checked)}
            />
          </div>
          <p className="panel-note">
            {provider.hasApiKey
              ? t('A key is already saved. Leave the field blank to keep it.')
              : t('This interface needs an API key before it can be used.')}
          </p>
          {testMessage ? <p className="panel-note admin-ai-test-ok">{testMessage}</p> : null}
          {testError ? <p className="ai-dialog__error" role="alert">{testError}</p> : null}
          {saveError ? <p className="ai-dialog__error" role="alert">{saveError}</p> : null}
        </div>

        <footer className="admin-ai-dialog__footer">
          <button
            type="button"
            className="button button--ghost button--small"
            disabled={testBusy || saving || !provider.name || !provider.model || !provider.baseUrl}
            onClick={() => void handleTest()}
          >
            {testBusy ? t('Testing…') : t('Test connection')}
          </button>
          <div className="admin-ai-dialog__footer-actions">
            <button type="button" className="button button--ghost button--small" disabled={saving} onClick={onCancel}>
              {t('Cancel')}
            </button>
            <button
              type="button"
              className="button button--primary button--small"
              disabled={saving || busy}
              onClick={() => void handleSave()}
            >
              {saving || busy ? t('Saving…') : t('Save interface')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function AdminAiPanel({
  aiBusy,
  aiConfigDraft,
  aiTestBusyId,
  handleSaveAiConfig,
  handleTestAiProvider,
  saveAiConfig,
  updateField,
}: AdminAiPanelProps) {
  const t = useT();
  const [promptEditing, setPromptEditing] = useState(false);
  const [providerEditor, setProviderEditor] = useState<ProviderEditorState | null>(null);

  if (!aiConfigDraft) {
    return null;
  }
  const config: AdminAiConfigDraft = aiConfigDraft;

  function openAddProvider() {
    setProviderEditor({
      index: null,
      draft: {
        name: '',
        model: '',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        order: nextOrder(config.providers),
        enabled: true,
      },
    });
  }

  function openEditProvider(index: number) {
    const provider = config.providers[index];
    if (!provider) {
      return;
    }

    setProviderEditor({
      index,
      draft: {
        id: provider.id,
        name: provider.name,
        model: provider.model,
        baseUrl: provider.baseUrl,
        apiKey: '',
        order: provider.order,
        enabled: provider.enabled,
        hasApiKey: provider.hasApiKey,
        apiKeyHint: provider.apiKeyHint,
      },
    });
  }

  async function handleSaveProvider(draft: AdminAiProviderDraft) {
    if (!providerEditor) {
      return;
    }

    const providers =
      providerEditor.index === null
        ? [...config.providers, draft]
        : config.providers.map((provider, index) => (index === providerEditor.index ? draft : provider));
    await saveAiConfig({ ...config, providers });
    setProviderEditor(null);
  }

  async function handleRemoveProvider(index: number) {
    const provider = config.providers[index];
    if (!provider) {
      return;
    }

    const confirmed = await confirmAction({
      title: 'Remove this AI interface?',
      body: 'Requests will skip this interface. You can add it again later.',
      confirmLabel: 'Remove interface',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    await saveAiConfig({
      ...config,
      providers: config.providers.filter((_, providerIndex) => providerIndex !== index),
    });
  }

  async function handleMoveProvider(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= config.providers.length) {
      return;
    }

    const providers = [...config.providers];
    const [provider] = providers.splice(index, 1);
    providers.splice(targetIndex, 0, provider);
    await saveAiConfig({
      ...config,
      providers: providers.map((entry, providerIndex) => ({
        ...entry,
        order: (providerIndex + 1) * 10,
      })),
    });
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
          <span className="panel-tag">{config.providers.length}</span>
        </div>

        <div className="admin-ai-settings-grid">
          <div className="admin-ai-enable-card">
            <AdminToggleField
              label={t('Enable AI arrangement')}
              checked={config.enabled}
              onChange={(checked) => updateField('enabled', checked)}
            />
            <p className="panel-note">{t('Users must sign in to use AI arrangement.')}</p>
          </div>
          <div className="admin-ai-limits">
            <AdminInlineField label={t('Total uses per user')} stacked>
              <input
                type="number"
                min={0}
                max={100000}
                value={config.userTotalLimit}
                onChange={(event) => updateField('userTotalLimit', Number(event.target.value) || 0)}
              />
            </AdminInlineField>
            <AdminInlineField label={t('Daily uses per user')} stacked>
              <input
                type="number"
                min={0}
                max={10000}
                value={config.dailyLimit}
                onChange={(event) => updateField('dailyLimit', Number(event.target.value) || 0)}
              />
            </AdminInlineField>
            <AdminInlineField label={t('Maximum photos per request')} stacked>
              <input
                type="number"
                min={1}
                max={50}
                value={config.maxImages}
                onChange={(event) => updateField('maxImages', Number(event.target.value) || 1)}
              />
            </AdminInlineField>
            <AdminInlineField label={t('Provider timeout (seconds)')} stacked>
              <input
                type="number"
                min={15}
                max={300}
                value={Math.round(config.requestTimeoutMs / 1000)}
                onChange={(event) => updateField('requestTimeoutMs', (Number(event.target.value) || 15) * 1000)}
              />
            </AdminInlineField>
          </div>
        </div>
        <p className="panel-note">
          {t('0 means unlimited. The daily limit resets at UTC midnight.')}
        </p>

        <AdminAiUsagePanel />

        <div className="admin-ai-prompt">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">{t('Default prompt')}</p>
              <h3>{t('Users can view it and temporarily edit it before generating.')}</h3>
            </div>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => setPromptEditing((current) => !current)}
            >
              {promptEditing ? t('Done editing') : t('Edit prompt')}
            </button>
          </div>
          <p className="panel-note">
            {t('The default prompt is read-only. Click Edit prompt to change it, then save AI settings.')}
          </p>
          <textarea
            className={`admin-ai-prompt__textarea ${promptEditing ? 'is-editing' : ''}`}
            aria-label={t('Default prompt')}
            aria-readonly={!promptEditing}
            readOnly={!promptEditing}
            rows={12}
            value={config.prompt}
            onChange={(event) => updateField('prompt', event.target.value)}
          />
        </div>

        <div className="admin-section-heading admin-ai-providers__heading">
          <div>
            <p className="eyebrow">{t('Interface pool')}</p>
            <h3>{t('OpenAI-compatible chat completions endpoints')}</h3>
          </div>
          <button type="button" className="button button--ghost button--small" onClick={openAddProvider}>
            {t('Add interface')}
          </button>
        </div>
        <p className="panel-note">
          {t('Base URL example: https://api.openai.com/v1. The app calls /chat/completions under it.')}
        </p>

        <div className="admin-ai-provider-list">
          {config.providers.length ? (
            config.providers.map((provider, index) => {
              const busyId = provider.id ?? `draft-${index}`;
              return (
                <article className="admin-ai-provider-card" key={provider.id ?? `draft-${index}`}>
                  <div className="admin-ai-provider-card__header">
                    <div>
                      <span className="eyebrow">{t('Priority %s').replace('%s', String(index + 1))}</span>
                      <strong>{provider.name || t('Untitled interface')}</strong>
                      <p className="admin-ai-provider-card__meta">{provider.model}</p>
                    </div>
                    <div className="admin-ai-provider-card__controls">
                      <span className={`panel-tag ${provider.enabled ? '' : 'panel-tag--soft'}`}>
                        {provider.enabled ? t('Enabled') : t('Disabled')}
                      </span>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={index === 0 || aiBusy}
                        onClick={() => void handleMoveProvider(index, -1)}
                        aria-label={t('Move up')}
                        title={t('Move up')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={index === config.providers.length - 1 || aiBusy}
                        onClick={() => void handleMoveProvider(index, 1)}
                        aria-label={t('Move down')}
                        title={t('Move down')}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={aiBusy}
                        onClick={() => openEditProvider(index)}
                      >
                        {t('Edit interface')}
                      </button>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        disabled={aiTestBusyId === busyId || !provider.name || !provider.model || !provider.baseUrl}
                        onClick={() => void handleTestAiProvider(index)}
                      >
                        {aiTestBusyId === busyId ? t('Testing…') : t('Test connection')}
                      </button>
                      <button
                        type="button"
                        className="button button--danger-ghost button--small"
                        disabled={aiBusy}
                        onClick={() => void handleRemoveProvider(index)}
                      >
                        {t('Remove')}
                      </button>
                    </div>
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

      {providerEditor ? (
        <ProviderEditorDialog
          busy={aiBusy}
          draft={providerEditor.draft}
          index={providerEditor.index}
          onCancel={() => setProviderEditor(null)}
          onSave={handleSaveProvider}
        />
      ) : null}
    </div>
  );
}
