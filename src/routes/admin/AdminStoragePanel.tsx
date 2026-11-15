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
  handleSaveObjectStorage: () => void | Promise<void>;
  handleSyncObjectStorage: () => void | Promise<void>;
  handleTestObjectStorage: () => void | Promise<void>;
  objectStorageBusy: boolean;
  objectStorageDraft: AdminObjectStorageDraft | null;
  productConfig: ProductConfigPayload | null;
  updateObjectStorageDraftField: UpdateObjectStorageDraftField;
};

export function AdminStoragePanel({
  handleRestoreObjectStorage,
  handleSaveObjectStorage,
  handleSyncObjectStorage,
  handleTestObjectStorage,
  objectStorageBusy,
  objectStorageDraft,
  productConfig,
  updateObjectStorageDraftField,
}: AdminStoragePanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Object storage')}</p>
            <h2>{t('Bitiful S3 delivery and upload mirroring')}</h2>
          </div>
          <span className="panel-tag">{productConfig?.objectStorage.enabled ? 'enabled' : t('local only')}</span>
        </div>
        {objectStorageDraft ? (
          <div className="admin-settings-stack">
            <div className="admin-overview-grid">
              <article className="admin-overview-card">
                <div className="admin-overview-card__header">
                  <strong>{t('Delivery mode')}</strong>
                  <span>{productConfig?.objectStorage.provider ?? t('Provider')}</span>
                </div>
                <p>
                  {productConfig?.objectStorage.enabled
                    ? `Remote delivery enabled with ${productConfig.objectStorage.syncStats.mirroredUploads} mirrored uploads, ${productConfig.objectStorage.syncStats.pendingUploads} pending mirrors, and ${productConfig.objectStorage.syncStats.failedUploads} failed mirrors.`
                    : t('Uploads still resolve locally until remote delivery is enabled.')}
                </p>
              </article>
              <article className="admin-overview-card">
                <div className="admin-overview-card__header">
                  <strong>{t('Mirror coverage')}</strong>
                  <span>{productConfig?.objectStorage.bucket ?? t('Bucket')}</span>
                </div>
                <p>{`${productConfig?.objectStorage.syncStats.mirroredUploads ?? 0} mirrored · ${productConfig?.objectStorage.syncStats.pendingUploads ?? 0} pending · ${productConfig?.objectStorage.syncStats.failedUploads ?? 0} failed · ${productConfig?.objectStorage.syncStats.localOnlyUploads ?? 0} local only`}</p>
              </article>
              <article className="admin-overview-card">
                <div className="admin-overview-card__header">
                  <strong>{t('Validation')}</strong>
                  <span>{productConfig?.objectStorage.lastValidatedAt ? formatTimestamp(productConfig.objectStorage.lastValidatedAt) : t('Not tested')}</span>
                </div>
                <p>
                  {productConfig?.objectStorage.lastValidationOk === true
                    ? t('Last connection test completed successfully.')
                    : productConfig?.objectStorage.lastValidationOk === false
                      ? t('Last connection test failed. Review config before enabling delivery.')
                      : t('No connection test has been recorded yet.')}
                </p>
              </article>
              <article className="admin-overview-card">
                <div className="admin-overview-card__header">
                  <strong>{t('Latest sync')}</strong>
                  <span>{productConfig?.objectStorage.updatedAt ? formatTimestamp(productConfig.objectStorage.updatedAt) : t('Never saved')}</span>
                </div>
                <p>{productConfig?.objectStorage.syncStats.latestSyncAt ? `Last mirrored upload ${formatTimestamp(productConfig.objectStorage.syncStats.latestSyncAt)}.` : t('No upload has been mirrored yet.')}</p>
              </article>
            </div>

            <p className="panel-note">
              {t('Canonical upload identity stays local under')}<code>{t('/uploads')}</code>{t('. Object storage mirrors original, preview, and thumb resources for delivery. Changing or disabling storage is blocked while mirrored uploads still exist, so restore them to local first before switching buckets or credentials.')}</p>

            <div className="admin-form-grid">
              <article className="admin-inline-card">
                <strong>{t('Connection')}</strong>
                <div className="admin-inline-field-stack">
                  <AdminToggleField
                    label={t('Enable remote delivery')}
                    checked={objectStorageDraft.enabled}
                    onChange={(checked) => updateObjectStorageDraftField('enabled', checked)}
                  />
                  <AdminInlineField label={t('Provider')}>
                    <input
                      value={objectStorageDraft.provider}
                      onChange={(event) => updateObjectStorageDraftField('provider', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Endpoint')}>
                    <input
                      value={objectStorageDraft.endpoint}
                      onChange={(event) => updateObjectStorageDraftField('endpoint', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Region')}>
                    <input
                      value={objectStorageDraft.region}
                      onChange={(event) => updateObjectStorageDraftField('region', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Bucket')}>
                    <input
                      value={objectStorageDraft.bucket}
                      onChange={(event) => updateObjectStorageDraftField('bucket', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Prefix')}>
                    <input
                      value={objectStorageDraft.prefix}
                      onChange={(event) => updateObjectStorageDraftField('prefix', event.target.value)}
                    />
                  </AdminInlineField>
                  <AdminInlineField label={t('Public base URL')} multiline stacked>
                    <input
                      value={objectStorageDraft.publicBaseUrl}
                      onChange={(event) => updateObjectStorageDraftField('publicBaseUrl', event.target.value)}
                    />
                  </AdminInlineField>
                </div>
              </article>

              <article className="admin-inline-card">
                <strong>{t('Credentials')}</strong>
                <div className="admin-inline-field-stack">
                  <AdminInlineField label={t('Access key ID')} stacked>
                    <div className="admin-secret-field">
                      <input
                        value={objectStorageDraft.accessKeyId ?? ''}
                        onChange={(event) => updateObjectStorageDraftField('accessKeyId', event.target.value)}
                        placeholder={t('Leave blank to keep the current key')}
                      />
                      <p className="field-note">
                        {productConfig?.objectStorage.hasAccessKey
                          ? `Current key: ${productConfig.objectStorage.accessKeyHint}`
                          : t('No access key is stored yet.')}
                      </p>
                    </div>
                  </AdminInlineField>
                  <AdminInlineField label={t('Secret access key')} stacked>
                    <div className="admin-secret-field">
                      <input
                        type="password"
                        value={objectStorageDraft.secretAccessKey ?? ''}
                        onChange={(event) => updateObjectStorageDraftField('secretAccessKey', event.target.value)}
                        placeholder={t('Leave blank to keep the current secret')}
                      />
                      <p className="field-note">
                        {productConfig?.objectStorage.hasSecretKey
                          ? `Current secret: ${productConfig.objectStorage.secretKeyHint}`
                          : t('No secret key is stored yet.')}
                      </p>
                    </div>
                  </AdminInlineField>
                  <article className="admin-overview-card">
                    <div className="admin-overview-card__header">
                      <strong>{t('Change safety')}</strong>
                      <span>{t('Guarded')}</span>
                    </div>
                    <p>
                      {t('Save requires explicit confirmation, and the server rejects bucket or credential changes until mirrored uploads are restored back to local delivery.')}</p>
                  </article>
                </div>
              </article>
            </div>

            <div className="editor-panel__actions admin-panel__actions--end">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => void handleTestObjectStorage()}
                disabled={objectStorageBusy}
              >
                {t('Test connection')}</button>
              <button
                type="button"
                className="button button--primary button--small"
                onClick={() => void handleSaveObjectStorage()}
                disabled={objectStorageBusy}
              >
                {t('Save object storage')}</button>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => void handleSyncObjectStorage()}
                disabled={objectStorageBusy || !productConfig?.objectStorage.enabled}
              >
                {t('Sync existing uploads')}</button>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => void handleRestoreObjectStorage()}
                disabled={objectStorageBusy || (productConfig?.objectStorage.syncStats.mirroredUploads ?? 0) === 0}
              >
                {t('Restore to local')}</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
