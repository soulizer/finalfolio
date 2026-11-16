import { useState } from 'react';
import { countLabel, useT } from '../../i18n';
import type { ChangeEvent } from 'react';
import {
  getAssetDeliveryLabel,
  getAssetDeliveryTooltip,
  getAssetDeliveryTone,
} from '../../editor/assetDelivery';
import { getAssetSource } from '../../editor/assetResources';
import { createDefaultCrop, DEFAULT_FILL_SCALE } from '../../editor/demoData';
import {
  PAGE_BODY_LIMIT,
  PAGE_CAPTION_LIMIT,
  PAGE_DECK_LIMIT,
  PAGE_KICKER_LIMIT,
  PAGE_TITLE_LIMIT,
} from '../../editor/limits';
import type { Asset, CropSettings, PageData } from '../../editor/types';
import type { UploadState } from './uploadState';

type AssetPlacement = {
  pageId: string;
  pageIndex: number;
  pageTitle: string;
  slot: string;
};

type EditorContentSidebarProps = {
  assetDeleteBusy: boolean;
  assetDeleteTargetId: string | null;
  assetMutationBusy: boolean;
  assetRetryTargetId: string | null;
  assetUsageCounts: Record<string, number>;
  assignAsset: (slot: string, assetId: string) => void;
  canUploadAssets: boolean;
  clearAssetPlacements: (assetId: string) => void;
  clearSelectedSlot: () => void;
  commitZoomInputValue: (rawValue: string) => void;
  currentCrop?: CropSettings;
  focusAssetPlacement: (placement: AssetPlacement) => void;
  handleDeleteAsset: (asset: Asset) => void | Promise<void>;
  handleRetryAssetMirror: (asset: Asset) => void | Promise<void>;
  handleUploadFiles: (files: File[]) => void | Promise<void>;
  importUrlBusy: boolean;
  onImportFromUrl: (url: string) => void | Promise<void>;
  handleZoomInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  libraryAssets: Asset[];
  nudgeSelectedCrop: (axis: 'x' | 'y', deltaPixels: number) => void;
  nudgeSelectedScale: (delta: number) => void;
  projectAssetIds: Set<string>;
  removeUnusedAssetsFromIssue: () => void | Promise<void>;
  resetZoomInputValue: () => void;
  selectedAsset: Asset | null;
  selectedAssetId: string | null;
  selectedAssetPlacements: AssetPlacement[];
  selectedFrameLabel: string | null;
  selectedPage: PageData;
  selectedPagePositionLabel: string;
  selectedPageUsesBody: boolean;
  selectedPageUsesDeck: boolean;
  selectedPageUsesKicker: boolean;
  selectedSlot: string | null;
  unusedAssetCount: number;
  updateSelectedCrop: (updater: (crop: CropSettings) => CropSettings) => void;
  updateSelectedPage: (updater: (page: PageData) => PageData) => void;
  uploadBusy: boolean;
  uploadProgressDetail: string | null;
  uploadProgressLabel: string;
  uploadProgressPercent: number;
  uploadState: UploadState;
  zoomInputValue: string;
};

export function EditorContentSidebar({
  assetDeleteBusy,
  assetDeleteTargetId,
  assetMutationBusy,
  assetRetryTargetId,
  assetUsageCounts,
  assignAsset,
  canUploadAssets,
  clearAssetPlacements,
  clearSelectedSlot,
  commitZoomInputValue,
  currentCrop,
  focusAssetPlacement,
  handleDeleteAsset,
  handleRetryAssetMirror,
  handleUploadFiles,
  importUrlBusy,
  onImportFromUrl,
  handleZoomInputChange,
  libraryAssets,
  nudgeSelectedCrop,
  nudgeSelectedScale,
  projectAssetIds,
  removeUnusedAssetsFromIssue,
  resetZoomInputValue,
  selectedAsset,
  selectedAssetId,
  selectedAssetPlacements,
  selectedFrameLabel,
  selectedPage,
  selectedPagePositionLabel,
  selectedPageUsesBody,
  selectedPageUsesDeck,
  selectedPageUsesKicker,
  selectedSlot,
  unusedAssetCount,
  updateSelectedCrop,
  updateSelectedPage,
  uploadBusy,
  uploadProgressDetail,
  uploadProgressLabel,
  uploadProgressPercent,
  uploadState,
  zoomInputValue,
}: EditorContentSidebarProps) {
  const t = useT();
  const [importUrlValue, setImportUrlValue] = useState('');
  const uploadTrackWidth = `${
    uploadBusy ? uploadProgressPercent : Math.round((uploadState.completedFiles / Math.max(uploadState.totalFiles, 1)) * 100)
  }%`;

  return (
    <aside className="editor-sidebar editor-sidebar--content">
      <section className="editor-panel editor-panel--photos">
        <div className="editor-panel__heading">
          <div>
            <p className="eyebrow">{t('Photos')}</p>
            <h2>{t('Media library')}</h2>
          </div>
          <span className="panel-tag">{libraryAssets.length === 0 ? t('Empty') : countLabel(libraryAssets.length, '1 photo', '%s photos')}</span>
        </div>
        <form
          className="import-url-form"
          onSubmit={(event) => {
            event.preventDefault();
            const value = importUrlValue.trim();
            if (!value || importUrlBusy) {
              return;
            }
            void Promise.resolve(onImportFromUrl(value)).finally(() => setImportUrlValue(''));
          }}
        >
          <input
            type="url"
            value={importUrlValue}
            placeholder={t('Paste an image URL (http/https)')}
            aria-label={t('Add from URL')}
            disabled={importUrlBusy || !canUploadAssets}
            onChange={(event) => setImportUrlValue(event.target.value)}
          />
          <button type="submit" className="button button--ghost button--small" disabled={importUrlBusy || !importUrlValue.trim() || !canUploadAssets}>
            {importUrlBusy ? t('Importing…') : t('Import')}
          </button>
        </form>
        <div className="editor-panel__actions editor-panel__actions--tight">
          <label className={`upload-button upload-button--dark ${uploadBusy ? 'is-busy' : ''}`.trim()}>
            {uploadProgressLabel}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              multiple
              disabled={uploadBusy || assetMutationBusy || !canUploadAssets}
              onChange={(event) => {
                const input = event.currentTarget;
                const files = Array.from(input.files ?? []);
                if (!files.length) {
                  input.value = "";
                  return;
                }

                void Promise.resolve(handleUploadFiles(files)).finally(() => {
                  input.value = "";
                });
              }}
            />
          </label>
          <button
            type="button"
            className="button button--ghost button--small"
            disabled={assetMutationBusy || uploadBusy || unusedAssetCount === 0}
            title={assetMutationBusy || uploadBusy ? t('Wait for the current library mutation to finish.') : undefined}
            onClick={() => void removeUnusedAssetsFromIssue()}
          >
            {unusedAssetCount === 0 ? t('No unused') : `Clear ${unusedAssetCount} unused`}
          </button>
        </div>
        {uploadBusy ? (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="upload-progress__meta">
              <strong>{uploadBusy ? uploadProgressLabel : t('Upload finished')}</strong>
              <span>{uploadBusy ? `${uploadProgressPercent}%` : `${uploadState.completedFiles}/${Math.max(uploadState.totalFiles, 1)} complete`}</span>
            </div>
            <div className="upload-progress__track">
              <span style={{ width: uploadTrackWidth }} />
            </div>
            {uploadProgressDetail ? <p>{uploadProgressDetail}</p> : null}
            {uploadState.queue.length ? (
              <div className="upload-progress__queue">
                {uploadState.queue.map((item) => (
                  <div key={item.id} className={`upload-progress__queue-item upload-progress__queue-item--${item.state}`}>
                    <strong>{item.name}</strong>
                    <span>
                      {item.state === 'preparing'
                        ? t('Optimizing')
                        : item.state === 'uploading'
                          ? t('Uploading')
                          : item.state === 'complete'
                            ? t('Added')
                            : item.state === 'failed'
                              ? item.error ?? t('Failed')
                              : t('Queued')}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="asset-rail asset-rail--gallery">
          {libraryAssets.length ? (
            libraryAssets.map((asset) => {
              const placements = assetUsageCounts[asset.id] ?? 0;
              const isSelected = selectedAssetId === asset.id;
              const isInCurrentProject = projectAssetIds.has(asset.id);
              const deliveryLabel = getAssetDeliveryLabel(asset.delivery);
              const deliveryTone = getAssetDeliveryTone(asset.delivery);
              const deliveryTooltip = getAssetDeliveryTooltip(asset.delivery);
              const deleteLabel = assetDeleteBusy && assetDeleteTargetId === asset.id ? t('Removing…') : t('Delete');
              const retryLabel = assetRetryTargetId === asset.id ? t('Retrying…') : t('Retry mirror');

              return (
                <article key={asset.id} className={`asset-tile ${isSelected ? 'is-selected' : ''}`.trim()}>
                  <button
                    type="button"
                    className="asset-tile__main"
                    title={asset.name}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData(t('text/finalfolio-asset'), asset.id)}
                    onClick={() => {
                      if (selectedSlot && !assetMutationBusy) {
                        assignAsset(selectedSlot, asset.id);
                      }
                    }}
                  >
                    <img alt={asset.name} src={getAssetSource(asset, 'thumb')} loading="lazy" decoding="async" />
                    <div className="asset-tile__copy">
                      <div className="asset-tile__title-row">
                        <strong>{asset.name}</strong>
                        <span
                          className={`delivery-indicator delivery-indicator--${deliveryTone}`}
                          title={deliveryTooltip}
                          aria-label={deliveryLabel}
                        />
                      </div>
                      <span>
                        {placements
                          ? countLabel(placements, '1 use', '%s uses')
                          : isInCurrentProject
                            ? t('Unused in this folio')
                            : t('Saved in account')}
                      </span>
                    </div>
                  </button>
                  <div className="asset-tile__actions">
                    {asset.delivery?.canRetry ? (
                      <button
                        type="button"
                        className="asset-tile__action"
                        disabled={assetMutationBusy}
                        onClick={() => void handleRetryAssetMirror(asset)}
                      >
                        {retryLabel}
                      </button>
                    ) : null}
                    {isInCurrentProject ? (
                      <button
                        type="button"
                        className="asset-tile__delete"
                        disabled={assetMutationBusy}
                        onClick={() => void handleDeleteAsset(asset)}
                      >
                        {deleteLabel}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="asset-rail__empty">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
                <circle cx="8.5" cy="9.5" r="1.8" />
                <path d="M4.5 17.5 10 12l3.2 3.4 2.6-2.6 3.7 4.7" />
              </svg>
              <strong>{t('No photos yet.')}</strong>
              <span>{t('Use the upload button above, or drag photos straight onto the page.')}</span>
            </div>
          )}
        </div>
      </section>
      <section className="editor-panel editor-panel--content-work">
        <div className="editor-panel__heading editor-panel__heading--compact">
          <div>
            <p className="eyebrow">{t('Page content')}</p>
          </div>
          <span className="panel-tag">{selectedPagePositionLabel}</span>
        </div>

        <section className="editor-panel__section">
          <div className="editor-section-heading">
            <div>
              <p className="eyebrow">{t('Text')}</p>
              <h3>{t('Fields')}</h3>
            </div>
          </div>
          {selectedPageUsesKicker ? (
            <label className="field">
              <span>{t('Kicker')}</span>
              <small className="field-note">{t('Small label above the main headline. Line breaks stay visible in the preview.')}</small>
              <textarea
                rows={2}
                maxLength={PAGE_KICKER_LIMIT}
                value={selectedPage.kicker}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, kicker: event.target.value }))}
              />
            </label>
          ) : null}
          <label className="field">
            <span>{t('Title')}</span>
            <small className="field-note">{t('Main headline shown on the page. Line breaks stay visible in the preview.')}</small>
            <textarea
              rows={2}
              maxLength={PAGE_TITLE_LIMIT}
              value={selectedPage.title}
              onChange={(event) => updateSelectedPage((page) => ({ ...page, title: event.target.value }))}
            />
          </label>
          {selectedPageUsesDeck ? (
            <label className="field">
              <span>{t('Deck')}</span>
              <small className="field-note">
                {selectedPage.template === 'cover'
                  ? t('Short line above the cover title. Line breaks stay visible in the preview.')
                  : t('Secondary introduction beneath or beside the headline. Line breaks stay visible in the preview.')}
              </small>
              <textarea
                rows={2}
                maxLength={PAGE_DECK_LIMIT}
                value={selectedPage.deck}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, deck: event.target.value }))}
              />
            </label>
          ) : null}
          {selectedPageUsesBody ? (
            <label className="field">
              <span>{t('Body')}</span>
              <small className="field-note">{t('Optional supporting text block used when the layout needs more editorial weight. Line breaks stay visible in the preview.')}</small>
              <textarea
                rows={4}
                maxLength={PAGE_BODY_LIMIT}
                value={selectedPage.body}
                onChange={(event) => updateSelectedPage((page) => ({ ...page, body: event.target.value }))}
              />
            </label>
          ) : null}
          {selectedPage.template === 'custom' && !selectedPageUsesBody ? (
            <p className="panel-note">{t('Compact custom text blocks automatically hide BODY so copy does not get clipped inside the page preview.')}</p>
          ) : null}
          <label className="field">
            <span>{t('Caption')}</span>
            <small className="field-note">{t('Small note at the bottom of the page. Line breaks stay visible in the preview.')}</small>
            <textarea
              rows={2}
              maxLength={PAGE_CAPTION_LIMIT}
              value={selectedPage.caption}
              onChange={(event) => updateSelectedPage((page) => ({ ...page, caption: event.target.value }))}
            />
          </label>
        </section>

        <section className="editor-panel__section">
          <div className="editor-section-heading">
            <div>
              <p className="eyebrow">{t('Selected frame')}</p>
              <h3>{selectedFrameLabel ?? t('No frame selected')}</h3>
            </div>
            {selectedAsset ? <span className="panel-tag">{currentCrop?.fit === 'contain' ? t('Fit') : t('Fill')}</span> : null}
          </div>
          <p className="selected-frame-status">
            {selectedAsset ? `Assigned image: ${selectedAsset.name}` : t('No image assigned to this frame yet.')}
          </p>
          {selectedAssetPlacements.length ? (
            <div className="placement-list" aria-label={t('Asset placements')}>
              {selectedAssetPlacements.map((placement) => {
                const isCurrentPlacement = placement.pageId === selectedPage.id && placement.slot === selectedSlot;
                const slotLabel = placement.slot.toUpperCase();
                return (
                  <button
                    key={`${placement.pageId}-${placement.slot}`}
                    type="button"
                    className={`placement-chip ${isCurrentPlacement ? 'is-active' : ''}`}
                    title={`${placement.pageTitle} · ${slotLabel}`}
                    onClick={() => focusAssetPlacement(placement)}
                  >
                    {`Page ${placement.pageIndex + 1} · ${slotLabel}`}
                  </button>
                );
              })}
            </div>
          ) : null}
          {selectedSlot && currentCrop && selectedAsset ? (
            <>
              <p className="panel-note">{t('Drag on the live page to move the photo in any direction. Arrow keys nudge. Use the wheel, +/- or the controls here to zoom.')}</p>
              <div className="segmented-control" role="group" aria-label={t('Frame fit')}>
                <button
                  type="button"
                  className={currentCrop.fit === 'cover' ? 'is-active' : ''}
                  onClick={() =>
                    updateSelectedCrop((crop) => ({
                      ...crop,
                      fit: 'cover',
                      scale: Math.max(crop.scale, DEFAULT_FILL_SCALE),
                    }))
                  }
                >
                  {t('Fill')}</button>
                <button
                  type="button"
                  className={currentCrop.fit === 'contain' ? 'is-active' : ''}
                  onClick={() =>
                    updateSelectedCrop((crop) => ({
                      ...crop,
                      fit: 'contain',
                    }))
                  }
                >
                  {t('Fit')}</button>
              </div>
              <div className="editor-crop-workbench">
                <div className="editor-crop-cluster">
                  <span className="editor-crop-cluster__label">{t('Move image')}</span>
                  <div className="editor-crop-pad" role="group" aria-label={t('Nudge image position')}>
                    <button type="button" className="editor-crop-tool" onClick={() => nudgeSelectedCrop('y', -4)}>
                      ↑
                    </button>
                    <button type="button" className="editor-crop-tool" onClick={() => nudgeSelectedCrop('x', -4)}>
                      ←
                    </button>
                    <button
                      type="button"
                      className="editor-crop-tool editor-crop-tool--center"
                      onClick={() =>
                        updateSelectedCrop((crop) => ({
                          ...crop,
                          x: 50,
                          y: 50,
                        }))
                      }
                    >
                      ◎
                    </button>
                    <button type="button" className="editor-crop-tool" onClick={() => nudgeSelectedCrop('x', 4)}>
                      →
                    </button>
                    <button type="button" className="editor-crop-tool" onClick={() => nudgeSelectedCrop('y', 4)}>
                      ↓
                    </button>
                  </div>
                </div>
                <div className="editor-crop-cluster editor-crop-cluster--zoom">
                  <span className="editor-crop-cluster__label">{t('Zoom')}</span>
                  <div className="editor-zoom-controls" role="group" aria-label={t('Zoom image')}>
                    <button type="button" className="editor-crop-tool editor-crop-tool--zoom" onClick={() => nudgeSelectedScale(-0.06)}>
                      −
                    </button>
                    <input
                      type="number"
                      className="editor-zoom-input"
                      min="1"
                      max="2.2"
                      step="0.01"
                      inputMode="decimal"
                      value={zoomInputValue}
                      onChange={handleZoomInputChange}
                      onBlur={() => commitZoomInputValue(zoomInputValue)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          commitZoomInputValue(zoomInputValue);
                          event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                          resetZoomInputValue();
                          event.currentTarget.blur();
                        }
                      }}
                      aria-label={t('Zoom scale')}
                    />
                    <button type="button" className="editor-crop-tool editor-crop-tool--zoom" onClick={() => nudgeSelectedScale(0.06)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="editor-crop-actions editor-crop-actions--below">
                <button type="button" className="button button--ghost button--small" onClick={clearSelectedSlot}>
                  {t('Clear')}</button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => clearAssetPlacements(selectedAsset.id)}
                >
                  {t('Clear all')}</button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() =>
                    updateSelectedCrop((crop) =>
                      createDefaultCrop({
                        fit: crop.fit,
                      }),
                    )
                  }
                >
                  {t('Reset')}</button>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </aside>
  );
}
