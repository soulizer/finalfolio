import { useState } from 'react';
import { useT } from '../../i18n';
import type { AdminObjectStorageDraft, ProductConfigPayload } from '../../editor/api';
import { formatTimestamp } from './adminFormatting';
import { AdminInlineField, AdminToggleField } from './AdminFormFields';

type UpdateObjectStorageDraftField = <Key extends keyof AdminObjectStorageDraft>(
  field: Key,
  value: AdminObjectStorageDraft[Key],
) => void;

type AdminStoragePanelProps = {
  handleRestoreObjectStorage: () => void | Promise<void>;
  handleSaveObjectStorage: () => void | Promise<boolean>;
  handleSyncObjectStorage: () => void | Promise<void>;
  handleTestObjectStorage: () => void | Promise<void>;
  objectStorageBusy: boolean;
  objectStorageDraft: AdminObjectStorageDraft | null;
  onResetObjectStorageDraft: () => void;
  productConfig: ProductConfigPayload | null;
  updateObjectStorageDraftField: UpdateObjectStorageDraftField;
};

function displayValue(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export function AdminStoragePanel({
  handleRestoreObjectStorage,
  handleSaveObjectStorage,
  handleSyncObjectStorage,
  handleTestObjectStorage,
  objectStorageBusy,
  objectStorageDraft,
  onResetObjectStorageDraft,
  productConfig,
  updateObjectStorageDraftField,
}: AdminStoragePanelProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const storage = productConfig?.objectStorage;

  if (!objectStorageDraft) {
    return null;
  }

  async function handleSaveAndClose() {
    const saved = await handleSaveObjectStorage();
    if (saved) {
      setEditing(false);
    }
  }

  function handleCancelEditing() {
    onResetObjectStorageDraft();
    setEditing(false);
  }

  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Object storage')}</p>
            <h2>{t('Bitiful S3 delivery and upload mirroring')}</h2>
          </div>
          <span className="panel-tag">{storage?.enabled ? t('Enabled') : t('local only')}</span>
        </div>

        <div className="admin-overview-grid">
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{t('Delivery mode')}</strong>
              <span>{storage?.provider ?? t('Provider')}</span>
            </div>
            <p>
              {storage?.enabled
                ? t('Remote delivery enabled with %s mirrored uploads, %s pending mirrors, and %s failed mirrors.')
                    .replace('%s', String(storage.syncStats.mirroredUploads))
                    .replace('%s', String(storage.syncStats.pendingUploads))
                    .replace('%s', String(storage.syncStats.failedUploads))
                : t('Uploads still resolve locally until remote delivery is enabled.')}
            </p>
          </article>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{t('Mirror coverage')}</strong>
              <span>{storage?.bucket ?? t('Bucket')}</span>
            </div>
            <p>
              {t('%s mirrored · %s pending · %s failed · %s local only')
                .replace('%s', String(storage?.syncStats.mirroredUploads ?? 0))
                .replace('%s', String(storage?.syncStats.pendingUploads ?? 0))
                .replace('%s', String(storage?.syncStats.failedUploads ?? 0))
                .replace('%s', String(storage?.syncStats.localOnlyUploads ?? 0))}
            </p>
          </article>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{t('Validation')}</strong>
              <span>{storage?.lastValidatedAt ? formatTimestamp(storage.lastValidatedAt) : t('Not tested')}</span>
            </div>
            <p>
              {storage?.lastValidationOk === true
                ? t('Last connection test completed successfully.')
                : storage?.lastValidationOk === false
                  ? t('Last connection test failed. Review config before enabling delivery.')
                  : t('No connection test has been recorded yet.')}
            </p>
          </article>
          <article className="admin-overview-card">
            <div className="admin-overview-card__header">
              <strong>{t('Latest sync')}</strong>
              <span>{storage?.updatedAt ? formatTimestamp(storage.updatedAt) : t('Never saved')}</span>
            </div>
            <p>
              {storage?.syncStats.latestSyncAt
                ? t('Last mirrored upload %s.').replace('%s', formatTimestamp(storage.syncStats.latestSyncAt))
                : t('No upload has been mirrored yet.')}
            </p>
          </article>
        </div>

        <p className="panel-note">
          {t('Canonical upload identity stays local under')}<code>{t('/uploads')}</code>
          {t('. Object storage mirrors original, preview, and thumb resources for delivery. Changing or disabling storage is blocked while mirrored uploads still exist, so restore them to local first before switching buckets or credentials.')}
        </p>

        {!editing ? (
          <div className="admin-storage-readonly">
            <div className="admin-storage-readonly__header">
              <div>
                <p className="eyebrow">{t('Storage summary')}</p>
                <h3>{t('Status and credentials are read-only until you choose Edit configuration.')}</h3>
              </div>
              <button type="button" className="button button--primary button--small" onClick={() => setEditing(true)}>
                {t('Edit configuration')}
              </button>
            </div>
            <div className="admin-storage-summary">
              <div className="admin-storage-summary__item">
                <span>{t('Delivery')}</span>
                <strong>{storage?.enabled ? t('Remote delivery') : t('Local delivery')}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Provider')}</span>
                <strong>{displayValue(storage?.provider, t('Not set'))}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Endpoint')}</span>
                <strong>{displayValue(storage?.endpoint, t('Not set'))}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Region')}</span>
                <strong>{displayValue(storage?.region, t('Not set'))}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Bucket')}</span>
                <strong>{displayValue(storage?.bucket, t('Not set'))}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Prefix')}</span>
                <strong>{displayValue(storage?.prefix, t('Not set'))}</strong>
              </div>
              <div className="admin-storage-summary__item admin-storage-summary__item--wide">
                <span>{t('Public base URL')}</span>
                <strong>{displayValue(storage?.publicBaseUrl, t('Not set'))}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Access key ID')}</span>
                <strong>{storage?.hasAccessKey ? storage.accessKeyHint : t('Not set')}</strong>
              </div>
              <div className="admin-storage-summary__item">
                <span>{t('Secret access key')}</span>
                <strong>{storage?.hasSecretKey ? storage.secretKeyHint : t('Not set')}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-storage-editor">
            <div className="admin-storage-editor__header">
              <div>
                <p className="eyebrow">{t('Edit configuration')}</p>
                <h3>{t('Review every value before saving. Storage changes are guarded.')}</h3>
              </div>
              <span className="panel-tag">{t('Editing')}</span>
            </div>
            <div className="admin-storage-form">
              <article className="admin-inline-card">
                <strong>{t('Connection')}</strong>
                <div className="admin-storage-form__grid">
                  <div className="admin-storage-form__toggle">
                    <AdminToggleField
                      label={t('Enable remote delivery')}
                      checked={objectStorageDraft.enabled}
                      onChange={(checked) => updateObjectStorageDraftField('enabled', checked)}
                    />
                  </div>
                  <AdminInlineField label={t('Provider')} stacked>
                    <input
                      aria-label={t('Provider')}
                      value={objectStorageDraft.provider}
                      onChange={(event) => updateObjectStorageDraftField('provider', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Endpoint')} stacked>
                    <input
                      aria-label={t('Endpoint')}
                      value={objectStorageDraft.endpoint}
                      onChange={(event) => updateObjectStorageDraftField('endpoint', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Region')} stacked>
                    <input
                      aria-label={t('Region')}
                      value={objectStorageDraft.region}
                      onChange={(event) => updateObjectStorageDraftField('region', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Bucket')} stacked>
                    <input
                      aria-label={t('Bucket')}
                      value={objectStorageDraft.bucket}
                      onChange={(event) => updateObjectStorageDraftField('bucket', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Prefix')} stacked>
                    <input
                      aria-label={t('Prefix')}
                      value={objectStorageDraft.prefix}
                      onChange={(event) => updateObjectStorageDraftField('prefix', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Public base URL')} stacked>
                    <input
                      aria-label={t('Public base URL')}
                      value={objectStorageDraft.publicBaseUrl}
                      onChange={(event) => updateObjectStorageDraftField('publicBaseUrl', event.target.value)}
                    />
                  </AdminInlineField>
                </div>
              </article>

              <article className="admin-inline-card">
                <strong>{t('Credentials')}</strong>
                <div className="admin-storage-form__grid">
                  <AdminInlineField label={t('Access key ID')} stacked>
                    <div className="admin-secret-field">
                      <input
                        aria-label={t('Access key ID')}
                        value={objectStorageDraft.accessKeyId ?? ''}
                        onChange={(event) => updateObjectStorageDraftField('accessKeyId', event.target.value)}
                        placeholder={t('Leave blank to keep the current key')}
                      />
                      <p className="field-note">
                        {storage?.hasAccessKey
                          ? t('Current key: %s').replace('%s', storage.accessKeyHint ?? t('Saved'))
                          : t('No access key is stored yet.')}
                      </p>
                    </div>
                  </AdminInlineField>
                  <AdminInlineField label={t('Secret access key')} stacked>
                    <div className="admin-secret-field">
                      <input
                        type="password"
                        aria-label={t('Secret access key')}
                        value={objectStorageDraft.secretAccessKey ?? ''}
                        onChange={(event) => updateObjectStorageDraftField('secretAccessKey', event.target.value)}
                        placeholder={t('Leave blank to keep the current secret')}
                      />
                      <p className="field-note">
                        {storage?.hasSecretKey
                          ? t('Current secret: %s').replace('%s', storage.secretKeyHint ?? t('Saved'))
                          : t('No secret key is stored yet.')}
                      </p>
                    </div>
                  </AdminInlineField>
                </div>
                <article className="admin-overview-card">
                  <div className="admin-overview-card__header">
                    <strong>{t('Change safety')}</strong>
                    <span>{t('Guarded')}</span>
                  </div>
                  <p>
                    {t('Save requires explicit confirmation, and the server rejects bucket or credential changes until mirrored uploads are restored back to local delivery.')}
                  </p>
                </article>
              </article>
            </div>
            <div className="editor-panel__actions admin-panel__actions--end">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => void handleTestObjectStorage()}
                disabled={objectStorageBusy}
              >
                {t('Test connection')}
              </button>
              <button type="button" className="button button--ghost button--small" onClick={handleCancelEditing} disabled={objectStorageBusy}>
                {t('Cancel editing')}
              </button>
              <button
                type="button"
                className="button button--primary button--small"
                onClick={() => void handleSaveAndClose()}
                disabled={objectStorageBusy}
              >
                {t('Save object storage')}
              </button>
            </div>
          </div>
        )}

        <details className="admin-danger-zone">
          <summary>
            <span>{t('Advanced operations')}</span>
            <small>{t('Requires confirmation')}</small>
          </summary>
          <p className="panel-note">
            {t('These actions change delivery for existing uploads. Expand only when you are ready.')}
          </p>
          <div className="editor-panel__actions">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => void handleSyncObjectStorage()}
              disabled={objectStorageBusy || !storage?.enabled}
            >
              {t('Sync existing uploads')}
            </button>
            <button
              type="button"
              className="button button--danger-ghost button--small"
              onClick={() => void handleRestoreObjectStorage()}
              disabled={objectStorageBusy || (storage?.syncStats.mirroredUploads ?? 0) === 0}
            >
              {t('Restore to local')}
            </button>
          </div>
        </details>
      </section>
    </div>
  );
}
