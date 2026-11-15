import { useT } from '../../i18n';
import {
  getAssetDeliveryLabel,
  getAssetDeliveryTooltip,
  getAssetDeliveryTone,
} from '../../editor/assetDelivery';
import type { AdminUploadDetail, AdminUploadListItem } from '../../editor/api';
import { formatBytes, formatDimensions, formatTimestamp } from './adminFormatting';

type AdminUploadsPanelProps = {
  filteredUploads: AdminUploadListItem[];
  handleDeleteUpload: (filename: string) => void | Promise<void>;
  handleRetryUpload: (filename: string) => void | Promise<void>;
  selectedUploadDetail: AdminUploadDetail | null;
  selectedUploadFilename: string | null;
  setSelectedUploadFilename: (filename: string) => void;
  setUploadSearch: (value: string) => void;
  uploadSearch: string;
};

export function AdminUploadsPanel({
  filteredUploads,
  handleDeleteUpload,
  handleRetryUpload,
  selectedUploadDetail,
  selectedUploadFilename,
  setSelectedUploadFilename,
  setUploadSearch,
  uploadSearch,
}: AdminUploadsPanelProps) {
  const t = useT();
  return (
    <div className="admin-page admin-page--single">
      <section className="editor-panel admin-panel">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Uploads')}</p>
            <h2>{t('Asset governance')}</h2>
          </div>
          <span className="panel-tag">{filteredUploads.length}</span>
        </div>
        <label className="field admin-search-field">
          <span>{t('Search uploads')}</span>
          <input
            placeholder={t('Filename, owner, or project')}
            value={uploadSearch}
            onChange={(event) => setUploadSearch(event.target.value)}
          />
        </label>
        <div className="admin-split-panel admin-split-panel--inspector">
          <div className="admin-list">
            {filteredUploads.length ? (
              filteredUploads.map((upload) => (
                <article
                  key={upload.filename}
                  className={`admin-row admin-row--with-thumb ${selectedUploadFilename === upload.filename ? 'is-selected' : ''}`}
                  onClick={() => setSelectedUploadFilename(upload.filename)}
                >
                  <div className="admin-row__thumb admin-row__thumb--upload">
                    <img
                      src={upload.thumb?.src ?? upload.preview?.src ?? upload.src}
                      alt={upload.filename}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="admin-row__main">
                    <div className="admin-row__header">
                      <strong className="admin-row__title admin-row__title--truncate" title={upload.filename}>
                        {upload.filename}
                      </strong>
                      <span
                        className={`delivery-indicator delivery-indicator--${getAssetDeliveryTone(upload.delivery)}`}
                        title={getAssetDeliveryTooltip(upload.delivery)}
                        aria-label={getAssetDeliveryLabel(upload.delivery)}
                      />
                    </div>
                    <p className="admin-row__subline">{upload.src}</p>
                    {upload.ownerEmails.length ? (
                      <p className="admin-row__description">{`${upload.ownerDisplayNames.join(' / ')} · ${upload.referencedProjectCount} project refs`}</p>
                    ) : null}
                  </div>
                  <div className="admin-row__aside">
                    <div className="admin-row__meta">
                      <span className="admin-pill admin-pill--strong">{formatBytes(upload.bytes)}</span>
                      <span className={`admin-pill ${upload.referencedProjectCount ? 'admin-pill--warning' : 'admin-pill--success'}`}>
                        {upload.referencedProjectCount ? `${upload.referencedProjectCount} refs` : 'orphan'}
                      </span>
                      <span className="admin-pill">{formatDimensions(upload.width, upload.height)}</span>
                    </div>
                    <div className="admin-row__actions">
                      <a
                        className="button button--primary button--small"
                        href={upload.original?.src ?? upload.src}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {t('Open')}</a>
                      {upload.delivery.canRetry ? (
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRetryUpload(upload.filename);
                          }}
                        >
                          {t('Retry mirror')}</button>
                      ) : null}
                      <button
                        type="button"
                        className="button button--danger button--small"
                        disabled={upload.referencedProjectCount > 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDeleteUpload(upload.filename);
                        }}
                      >
                        {t('Delete')}</button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <article className="admin-list__empty">
                <strong>{t('No matching uploads')}</strong>
                <p>{t('Try a filename, owner username/email, or project title.')}</p>
              </article>
            )}
          </div>

          <aside className="admin-detail-card">
            {selectedUploadDetail ? (
              <>
                <div className="admin-detail-card__header">
                  <div>
                    <p className="eyebrow">{t('Inspect')}</p>
                    <div className="admin-detail-card__title">
                      <h2 className="admin-row__title--truncate" title={selectedUploadDetail.filename}>
                        {selectedUploadDetail.filename}
                      </h2>
                      <span
                        className={`delivery-indicator delivery-indicator--${getAssetDeliveryTone(selectedUploadDetail.delivery)}`}
                        title={getAssetDeliveryTooltip(selectedUploadDetail.delivery)}
                        aria-label={getAssetDeliveryLabel(selectedUploadDetail.delivery)}
                      />
                    </div>
                  </div>
                  <span className="panel-tag">{formatBytes(selectedUploadDetail.bytes)}</span>
                </div>
                <div className="admin-upload-preview">
                  <img
                    src={selectedUploadDetail.preview?.src ?? selectedUploadDetail.src}
                    alt={selectedUploadDetail.filename}
                    loading="eager"
                    decoding="async"
                  />
                </div>
                <div className="admin-detail-metrics">
                  <article>
                    <span>{t('Dimensions')}</span>
                    <strong>{formatDimensions(selectedUploadDetail.width, selectedUploadDetail.height)}</strong>
                  </article>
                  <article>
                    <span>{t('Uploaded')}</span>
                    <strong>{formatTimestamp(selectedUploadDetail.uploadedAt)}</strong>
                  </article>
                  <article>
                    <span>{t('Owners')}</span>
                    <strong>{selectedUploadDetail.ownerDisplayNames.length ? selectedUploadDetail.ownerDisplayNames.join(', ') : 'unowned'}</strong>
                  </article>
                  <article>
                    <span>{t('Projects')}</span>
                    <strong>{selectedUploadDetail.referencedProjectCount}</strong>
                  </article>
                  <article>
                    <span>{t('Placed pages')}</span>
                    <strong>{selectedUploadDetail.referencedPages.length}</strong>
                  </article>
                  <article>
                    <span>{t('Asset records')}</span>
                    <strong>{selectedUploadDetail.assetIds.length}</strong>
                  </article>
                  <article>
                    <span>{t('Preview')}</span>
                    <strong>{selectedUploadDetail.preview?.bytes ? formatBytes(selectedUploadDetail.preview.bytes) : 'fallback'}</strong>
                  </article>
                  <article>
                    <span>{t('Thumb')}</span>
                    <strong>{selectedUploadDetail.thumb?.bytes ? formatBytes(selectedUploadDetail.thumb.bytes) : 'fallback'}</strong>
                  </article>
                  <article>
                    <span>{t('Delivery')}</span>
                    <strong>{getAssetDeliveryLabel(selectedUploadDetail.delivery)}</strong>
                  </article>
                </div>
                <div className="editor-panel__actions admin-panel__actions--flush">
                  <a
                    className="button button--primary button--small"
                    href={selectedUploadDetail.original?.src ?? selectedUploadDetail.src}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('Open original')}</a>
                  {selectedUploadDetail.delivery.canRetry ? (
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => void handleRetryUpload(selectedUploadDetail.filename)}
                    >
                      {t('Retry mirror')}</button>
                  ) : null}
                </div>
                <div className="admin-detail-section">
                  <strong>{t('Referenced projects')}</strong>
                  <div className="admin-mini-list">
                    {selectedUploadDetail.referencedProjects.length ? (
                      selectedUploadDetail.referencedProjects.map((project) => (
                        <article key={project.id} className="admin-mini-list__item">
                          <span>{project.issue ?? t('folio mark')}</span>
                          <strong>{project.title ?? project.id}</strong>
                        </article>
                      ))
                    ) : (
                      <p className="panel-note">{t('No saved project currently references this file. It is safe to clean up.')}</p>
                    )}
                  </div>
                </div>
                {selectedUploadDetail.referencedPages.length ? (
                  <div className="admin-detail-section">
                    <strong>{t('Placed on pages')}</strong>
                    <div className="admin-mini-list">
                      {selectedUploadDetail.referencedPages.slice(0, 8).map((reference) => (
                        <article key={`${reference.projectId}:${reference.pageId}:${reference.slot}`} className="admin-mini-list__item">
                          <span>{`${reference.projectTitle} · ${reference.slot}`}</span>
                          <strong>{reference.pageTitle}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="admin-detail-card__empty">
                <strong>{t('Select an upload')}</strong>
                <p>{t('Pick a stored file to inspect its preview, ownership, references, and cleanup safety.')}</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
