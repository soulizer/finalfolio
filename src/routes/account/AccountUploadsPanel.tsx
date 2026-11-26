import { countLabel, useT } from '../../i18n';
import { DeleteIconButton } from '../../ui/DeleteIconButton';
import {
  getAssetDeliveryLabel,
  getAssetDeliveryTooltip,
  getAssetDeliveryTone,
} from '../../editor/assetDelivery';
import type { AccountUploadListItem } from '../../editor/api';
import { formatBytes, formatCompactTimestamp, formatDimensions, formatTimestamp } from './accountFormatting';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';
import { handleRowClick, handleRowSelectKeyDown } from '../../ui/rowSelection';

type AccountUploadsPanelProps = {
  filteredUploads: AccountUploadListItem[];
  handleDeleteUpload: (upload: AccountUploadListItem) => void | Promise<void>;
  handleRetryUpload: (upload: AccountUploadListItem) => void | Promise<void>;
  selectedUpload: AccountUploadListItem | null;
  setSelectedUploadAssetId: (assetId: string) => void;
  setUploadSearch: (value: string) => void;
  uploadBusyId: string | null;
  uploadSearch: string;
};

export function AccountUploadsPanel({
  filteredUploads,
  handleDeleteUpload,
  handleRetryUpload,
  selectedUpload,
  setSelectedUploadAssetId,
  setUploadSearch,
  uploadBusyId,
  uploadSearch,
}: AccountUploadsPanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Uploads')}</p>
            <h2>{t('My uploads')}</h2>
          </div>
          <span className="panel-tag">{filteredUploads.length}</span>
                <PanelCollapseToggle />
        </div>
        <label className="field admin-search-field">
          <span>{t('Search uploads')}</span>
          <input
            placeholder={t('Filename, title, or referenced project')}
            value={uploadSearch}
            onChange={(event) => setUploadSearch(event.target.value)}
          />
        </label>
        <div className="admin-split-panel admin-split-panel--inspector">
          <div className="admin-list">
            {filteredUploads.length ? (
              filteredUploads.map((upload) => (
                <article
                  key={upload.assetId}
                  className={`admin-row admin-row--with-thumb admin-row--interactive ${selectedUpload?.assetId === upload.assetId ? 'is-selected' : ''}`}
                    onClick={(event) => handleRowClick(event, () => setSelectedUploadAssetId(upload.assetId))}
                >
                  <div className="admin-row__thumb admin-row__thumb--upload">
                    <img
                      src={upload.thumb?.src ?? upload.preview?.src ?? upload.original?.src ?? upload.src}
                      alt={upload.filename}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div
                    className="admin-row__main"
                    role="button"
                    tabIndex={0}
                    aria-label={t('Select an upload')}
                    onClick={() => setSelectedUploadAssetId(upload.assetId)}
                    onKeyDown={(event) => handleRowSelectKeyDown(event, () => setSelectedUploadAssetId(upload.assetId))}
                  >
                    <div className="admin-row__header">
                      <strong className="admin-row__title admin-row__title--truncate" title={upload.name}>
                        {upload.name}
                      </strong>
                      <span
                        className={`delivery-indicator delivery-indicator--${getAssetDeliveryTone(upload.delivery)}`}
                        title={getAssetDeliveryTooltip(upload.delivery)}
                        aria-label={getAssetDeliveryLabel(upload.delivery)}
                      />
                    </div>
                    <p className="admin-row__subline">{upload.filename}</p>
                    <p className="admin-row__description">
                      {t('%s · %s · %s')
                        .replace('%s', formatDimensions(upload.width, upload.height))
                        .replace('%s', formatBytes(upload.bytes))
                        .replace('%s', countLabel(upload.referencedProjectCount, '1 project reference', '%s project references'))}
                      {upload.lastUsedAt
                        ? ` · ${t('Last used %s').replace('%s', formatCompactTimestamp(upload.lastUsedAt))}`
                        : ''}
                    </p>
                  </div>
                  <div className="admin-row__aside">
                    <div className="admin-row__meta">
                      <span className="admin-pill admin-pill--strong">{formatBytes(upload.bytes)}</span>
                      <span className={`admin-pill ${upload.referencedProjectCount ? 'admin-pill--warning' : 'admin-pill--success'}`}>
                        {upload.referencedProjectCount
                          ? countLabel(upload.referencedProjectCount, '1 ref', '%s refs')
                          : t('unused')}
                      </span>
                    </div>
                    <div className="admin-row__actions">
                      <a
                        className="button button--primary button--small"
                        href={upload.original?.src ?? upload.src}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('Open')}</a>
                      {upload.delivery.canRetry ? (
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          disabled={uploadBusyId === upload.assetId}
                          onClick={() => void handleRetryUpload(upload)}
                        >
                          {uploadBusyId === upload.assetId ? t('Retrying…') : t('Retry mirror')}
                        </button>
                      ) : null}
                      <DeleteIconButton
                        label={uploadBusyId === upload.assetId ? t('Deleting…') : t('Delete')}
                        title={
                          upload.referencedProjectCount > 0
                            ? t('This image is used by a project. Remove it from the project first.')
                            : undefined
                        }
                        disabled={uploadBusyId === upload.assetId || upload.referencedProjectCount > 0}
                        onClick={() => void handleDeleteUpload(upload)}
                      />
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <article className="admin-list__empty">
                <strong>{t('No matching uploads')}</strong>
                <p>{t('Try a different filename, image title, or referenced project.')}</p>
              </article>
            )}
          </div>

          <aside className="admin-detail-card">
            {selectedUpload ? (
              <>
                <div className="admin-detail-card__header">
                  <div>
                    <p className="eyebrow">{t('Inspect')}</p>
                    <div className="admin-detail-card__title">
                      <h2 className="admin-row__title--truncate" title={selectedUpload.filename}>
                        {selectedUpload.name || selectedUpload.filename}
                      </h2>
                      <span
                        className={`delivery-indicator delivery-indicator--${getAssetDeliveryTone(selectedUpload.delivery)}`}
                        title={getAssetDeliveryTooltip(selectedUpload.delivery)}
                        aria-label={getAssetDeliveryLabel(selectedUpload.delivery)}
                      />
                    </div>
                  </div>
                  <span className="panel-tag">{formatBytes(selectedUpload.bytes)}</span>
                </div>
                <div className="admin-upload-preview">
                  <img
                    src={selectedUpload.preview?.src ?? selectedUpload.original?.src ?? selectedUpload.src}
                    alt={selectedUpload.filename}
                    loading="eager"
                    decoding="async"
                  />
                </div>
                <div className="admin-detail-metrics">
                  <article>
                    <span>{t('Dimensions')}</span>
                    <strong>{formatDimensions(selectedUpload.width, selectedUpload.height)}</strong>
                  </article>
                  <article>
                    <span>{t('Uploaded')}</span>
                    <strong>{formatTimestamp(selectedUpload.createdAt)}</strong>
                  </article>
                  <article>
                    <span>{t('Updated')}</span>
                    <strong>{formatTimestamp(selectedUpload.updatedAt)}</strong>
                  </article>
                  <article>
                    <span>{t('Last used')}</span>
                    <strong>{formatTimestamp(selectedUpload.lastUsedAt)}</strong>
                  </article>
                  <article>
                    <span>{t('Projects')}</span>
                    <strong>{selectedUpload.referencedProjectCount}</strong>
                  </article>
                  <article>
                    <span>{t('Placed pages')}</span>
                    <strong>{selectedUpload.referencedPageCount}</strong>
                  </article>
                  <article>
                    <span>{t('Delivery')}</span>
                    <strong>{getAssetDeliveryLabel(selectedUpload.delivery)}</strong>
                  </article>
                  <article>
                    <span>{t('Name')}</span>
                    <strong>{selectedUpload.filename}</strong>
                  </article>
                </div>
                <div className="editor-panel__actions admin-panel__actions--flush">
                  <a
                    className="button button--primary button--small"
                    href={selectedUpload.original?.src ?? selectedUpload.src}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Open original')}</a>
                  {selectedUpload.delivery.canRetry ? (
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      disabled={uploadBusyId === selectedUpload.assetId}
                      onClick={() => void handleRetryUpload(selectedUpload)}
                    >
                      {uploadBusyId === selectedUpload.assetId ? t('Retrying…') : t('Retry mirror')}
                    </button>
                  ) : null}
                </div>
                <div className="admin-detail-section">
                  <strong>{t('Referenced projects')}</strong>
                  <div className="admin-mini-list">
                    {selectedUpload.referencedProjectTitles.length ? (
                      selectedUpload.referencedProjectTitles.map((title) => (
                        <article key={title} className="admin-mini-list__item">
                          <span>{t('Project')}</span>
                          <strong>{title}</strong>
                        </article>
                      ))
                    ) : (
                      <p className="panel-note">{t('No saved project currently references this upload.')}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="admin-detail-card__empty">
                <strong>{t('Select an upload')}</strong>
                <p>{t('Choose an upload from the list to inspect its preview, metadata, and placement status.')}</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
