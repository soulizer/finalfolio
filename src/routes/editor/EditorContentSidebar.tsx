import { useEffect, useMemo, useRef, useState } from 'react';
import { countLabel, useT } from '../../i18n';
import type { ChangeEvent, KeyboardEvent } from 'react';
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
import type { UnalbumPhoto } from '../../editor/api';
import type { UploadState } from './uploadState';
import { DeleteIconButton } from '../../ui/DeleteIconButton';
import { PanelCollapseToggle } from '../../ui/PanelCollapseToggle';
import { PhotoThumb } from '../../ui/PhotoThumb';
import { EditorSubsection } from '../../ui/EditorSubsection';

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
  onDeleteAssets: (assets: Asset[]) => void | Promise<void>;
  handleRetryAssetMirror: (asset: Asset) => void | Promise<void>;
  handleUploadFiles: (files: File[]) => void | Promise<void>;
  importUrlBusy: boolean;
  onImportFromUrl: (url: string) => boolean | void | Promise<boolean | void>;
  unalbumPhotos: Array<{ photo: UnalbumPhoto; asset: Asset }>;
  unalbumLoading: boolean;
  unalbumHasMore: boolean;
  onLoadMoreUnalbum: () => void | Promise<void>;
  onUseUnalbumPhoto: (photo: UnalbumPhoto) => Promise<Asset | null>;
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
  onDeleteAssets,
  handleRetryAssetMirror,
  handleUploadFiles,
  importUrlBusy,
  onImportFromUrl,
  unalbumPhotos,
  unalbumLoading,
  unalbumHasMore,
  onLoadMoreUnalbum,
  onUseUnalbumPhoto,
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
  const [assetSearch, setAssetSearch] = useState('');
  // Photos picked for a bulk action (currently: delete). There is no mode to
  // enter: the checkbox on a tile, Shift for a range and Ctrl/Cmd for a single
  // tile are always available, so the normal click still assigns the photo.
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const assetRailRef = useRef<HTMLDivElement | null>(null);
  const [importingUnalbumIds, setImportingUnalbumIds] = useState<Set<string>>(new Set());
  const pickAnchorRef = useRef<string | null>(null);
  const [importUrlOpen, setImportUrlOpen] = useState(false);
  const remoteAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) {
      return unalbumPhotos;
    }
    return unalbumPhotos.filter(({ asset }) => asset.name.toLowerCase().includes(query));
  }, [assetSearch, unalbumPhotos]);

  const handleImportUnalbumPhoto = async (photo: UnalbumPhoto) => {
    if (importingUnalbumIds.has(photo.id) || assetMutationBusy) {
      return;
    }
    setImportingUnalbumIds((current) => new Set(current).add(photo.id));
    try {
      const asset = await onUseUnalbumPhoto(photo);
      if (asset && selectedSlot) {
        assignAsset(selectedSlot, asset.id);
      }
    } finally {
      setImportingUnalbumIds((current) => {
        const next = new Set(current);
        next.delete(photo.id);
        return next;
      });
    }
  };

  const visibleAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) {
      return libraryAssets;
    }
    return libraryAssets.filter((asset) => asset.name.toLowerCase().includes(query));
  }, [assetSearch, libraryAssets]);
  const libraryAssetIds = useMemo(() => new Set(libraryAssets.map((asset) => asset.id)), [libraryAssets]);
  const visibleAssetIds = new Set(visibleAssets.map((asset) => asset.id));
  const hiddenPickedCount = Array.from(pickedIds).filter((id) => !visibleAssetIds.has(id)).length;

  // Deleted or replaced assets must not stay picked, otherwise the count in the
  // action bar drifts from what a click would actually delete.
  useEffect(() => {
    setPickedIds((current) => {
      if (!current.size) {
        return current;
      }
      const next = new Set(Array.from(current).filter((id) => libraryAssetIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [libraryAssetIds]);

  function togglePick(assetId: string) {
    setPickedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
    pickAnchorRef.current = assetId;
  }

  function extendPickTo(assetId: string) {
    const anchorId = pickAnchorRef.current;
    const anchorIndex = anchorId ? visibleAssets.findIndex((asset) => asset.id === anchorId) : -1;
    const targetIndex = visibleAssets.findIndex((asset) => asset.id === assetId);
    if (anchorIndex < 0 || targetIndex < 0) {
      togglePick(assetId);
      return;
    }
    const [from, to] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
    const rangeIds = visibleAssets.slice(from, to + 1).map((asset) => asset.id);
    setPickedIds((current) => {
      const next = new Set(current);
      rangeIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const uploadTrackWidth = `${
    uploadBusy ? uploadProgressPercent : Math.round((uploadState.completedFiles / Math.max(uploadState.totalFiles, 1)) * 100)
  }%`;

  function handleLibraryKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      setPickedIds(new Set(visibleAssets.map((asset) => asset.id)));
      return;
    }

    if (event.key === 'Escape' && pickedIds.size) {
      event.preventDefault();
      setPickedIds(new Set());
      pickAnchorRef.current = null;
    }
  }

  return (
    <aside className="editor-sidebar editor-sidebar--content">
      <section className="editor-panel editor-panel--photos" onKeyDown={handleLibraryKeyDown}>
        <div className="editor-panel__toolbar">
          <span className="editor-panel__label">{t('Media library')}</span>
          <span className="panel-tag">
            {libraryAssets.length === 0 ? t('Empty') : countLabel(libraryAssets.length, '1 photo', '%s photos')}
          </span>
                <PanelCollapseToggle />
        </div>
        {libraryAssets.length && pickedIds.size ? (
          <div className="asset-batch-bar" role="group" aria-label={t('Selected photos')}>
            <span
              className="panel-tag"
              aria-hidden="true"
              title={
                hiddenPickedCount
                  ? t('%s selected, %s outside this search')
                      .replace('%s', String(pickedIds.size))
                      .replace('%s', String(hiddenPickedCount))
                  : t('%s selected').replace('%s', String(pickedIds.size))
              }
            >
              {pickedIds.size}/{libraryAssets.length}
              {hiddenPickedCount ? ` +${hiddenPickedCount}` : ''}
            </span>
            <span className="sr-only" aria-live="polite">
              {t('%s selected').replace('%s', String(pickedIds.size))}
            </span>
            <button
              type="button"
              className="button button--ghost button--small"
              aria-label={t(assetSearch.trim() ? 'Select all visible photos' : 'Select all photos')}
              title={t(assetSearch.trim() ? 'Select all visible photos' : 'Select all photos')}
              onClick={() => setPickedIds(new Set(visibleAssets.map((asset) => asset.id)))}
            >
              {t('All')}
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                setPickedIds(new Set());
                pickAnchorRef.current = null;
              }}
            >
              {t('Clear')}
            </button>
            <DeleteIconButton
              className="asset-batch-bar__delete"
              label={t('Delete selected photos')}
              disabled={assetMutationBusy}
              onClick={() => {
                const selectedAssets = libraryAssets.filter((asset) => pickedIds.has(asset.id));
                const previousScrollTop = assetRailRef.current?.scrollTop ?? 0;
                void Promise.resolve(onDeleteAssets(selectedAssets)).then(() => {
                  setPickedIds(new Set());
                  pickAnchorRef.current = null;
                  window.requestAnimationFrame(() => {
                    if (assetRailRef.current) {
                      assetRailRef.current.scrollTop = previousScrollTop;
                    }
                  });
                });
              }}
            />
          </div>
        ) : (
        <div className="editor-panel__actions editor-panel__actions--tight photo-actions editor-button-grid editor-button-grid--two">
          <label className={`button button--primary button--small upload-button upload-button--compact ${uploadBusy ? 'is-busy' : ''}`.trim()}>
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
            className={`button button--ghost button--small ${importUrlOpen ? 'is-active' : ''}`.trim()}
            aria-expanded={importUrlOpen}
            onClick={() => setImportUrlOpen((current) => !current)}
          >
            {t('Add from URL')}
          </button>

        </div>
        )}
        {importUrlOpen ? (
          <form
            className="import-url-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = importUrlValue.trim();
              if (!value || importUrlBusy) {
                return;
              }
              // A failed import keeps the field open with the URL intact so
              // the user can retry instead of re-pasting it.
              void Promise.resolve(onImportFromUrl(value))
                .catch(() => false)
                .then((added) => {
                  if (added === false) {
                    return;
                  }
                  setImportUrlValue('');
                  setImportUrlOpen(false);
                });
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
        ) : null}
        {uploadBusy ? (
          <div className="upload-progress" role="status" aria-live="polite">
            <div className="upload-progress__meta">
              <strong>{uploadBusy ? uploadProgressLabel : t('Upload finished')}</strong>
              <span>
                {uploadBusy
                  ? `${uploadProgressPercent}%`
                  : t('%s of %s complete')
                      .replace('%s', String(uploadState.completedFiles))
                      .replace('%s', String(Math.max(uploadState.totalFiles, 1)))}
              </span>
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
        {libraryAssets.length ? (
          <div className="asset-utility-row">
            <label className="field asset-search-field">
              <input
                type="search"
                aria-label={t('Search photos')}
                value={assetSearch}
                placeholder={t('Search by file name')}
                onChange={(event) => setAssetSearch(event.target.value)}
              />
            </label>
            {unusedAssetCount > 0 ? (
              <DeleteIconButton
                className="asset-utility-row__clear"
                label={countLabel(unusedAssetCount, 'Clear 1 unused', 'Clear %s unused')}
                title={countLabel(unusedAssetCount, 'Clear 1 unused', 'Clear %s unused')}
                disabled={assetMutationBusy || uploadBusy}
                onClick={() => void removeUnusedAssetsFromIssue()}
              />
            ) : null}
          </div>
        ) : null}
        <div ref={assetRailRef} className="asset-rail asset-rail--gallery">
          {libraryAssets.length || remoteAssets.length ? (
            visibleAssets.map((asset) => {
              const placements = assetUsageCounts[asset.id] ?? 0;
              const isSelected = selectedAssetId === asset.id;
              const isPicked = pickedIds.has(asset.id);
              const isInCurrentProject = projectAssetIds.has(asset.id);
              const deliveryLabel = getAssetDeliveryLabel(asset.delivery);
              const deliveryTone = getAssetDeliveryTone(asset.delivery);
              const deliveryTooltip = getAssetDeliveryTooltip(asset.delivery);
              const deleteLabel = assetDeleteBusy && assetDeleteTargetId === asset.id ? t('Removing…') : t('Delete');
              const retryLabel = assetRetryTargetId === asset.id ? t('Retrying…') : t('Retry mirror');
              const pickLabel = isPicked ? t('Remove from the selection') : t('Select for bulk actions');

              return (
                <article
                  key={asset.id}
                  className={`asset-tile ${isSelected ? 'is-selected' : ''} ${isPicked ? 'is-picked' : ''}`.trim()}
                >
                  <button
                    type="button"
                    className="asset-tile__main"
                    title={asset.name}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData(t('text/finalfolio-asset'), asset.id)}
                    onClick={(event) => {
                      // Shift selects the range from the last pick, Ctrl/Cmd
                      // toggles this tile; a plain click still assigns the
                      // photo to the selected frame.
                      if (event.shiftKey) {
                        extendPickTo(asset.id);
                        return;
                      }
                      if (event.ctrlKey || event.metaKey) {
                        togglePick(asset.id);
                        return;
                      }
                      if (selectedSlot && !assetMutationBusy) {
                        assignAsset(selectedSlot, asset.id);
                      }
                    }}
                  >
                    <PhotoThumb className="asset-tile__thumb" alt={asset.name} src={getAssetSource(asset, 'thumb')} />
                    <span className="asset-tile__copy">
                      <span className="asset-tile__title-row">
                        <strong>{asset.name}</strong>
                        <span
                          className={`delivery-indicator delivery-indicator--${deliveryTone}`}
                          title={deliveryTooltip}
                          aria-label={deliveryLabel}
                        />
                      </span>
                      <span>
                        {placements
                          ? countLabel(placements, '1 use', '%s uses')
                          : isInCurrentProject
                            ? t('Unused in this folio')
                            : t('Saved in account')}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`asset-tile__pick ${isPicked ? 'is-on' : ''}`.trim()}
                    aria-pressed={isPicked}
                    aria-label={pickLabel}
                    title={pickLabel}
                    onClick={() => togglePick(asset.id)}
                  >
                    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {isPicked ? <path d="m3.5 8.4 3 3 6-6.6" /> : null}
                    </svg>
                  </button>
                  {asset.delivery?.canRetry ? (
                    <button
                      type="button"
                      className="asset-tile__retry-icon"
                      disabled={assetMutationBusy}
                      aria-label={retryLabel}
                      title={retryLabel}
                      onClick={() => void handleRetryAssetMirror(asset)}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v2.6h-2.6" />
                      </svg>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="asset-tile__delete-icon"
                    disabled={assetMutationBusy}
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    onClick={() => void handleDeleteAsset(asset)}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.5 4.5h11M6 4.5V3.2h4v1.3M4 4.5l.6 8.2h6.8l.6-8.2M6.6 7v3.4M9.4 7v3.4" />
                    </svg>
                  </button>
                </article>
              );
            })
          ) : null}
          {remoteAssets.map(({ photo, asset }) => {
            const importing = importingUnalbumIds.has(photo.id);
            const status = importing ? t('Placing…') : t('From UnAlbum');
            return (
              <article key={asset.id} className="asset-tile asset-tile--remote">
                <button
                  type="button"
                  className="asset-tile__main"
                  title={photo.analysis?.description || asset.name}
                  disabled={importing}
                  onClick={() => void handleImportUnalbumPhoto(photo)}
                >
                  <PhotoThumb className="asset-tile__thumb" alt={asset.name} src={getAssetSource(asset, 'thumb')} />
                  <span className="asset-tile__copy">
                    <span className="asset-tile__title-row">
                      <strong>{asset.name}</strong>
                    </span>
                    <span>{status}</span>
                  </span>
                </button>
              </article>
            );
          })}
          {remoteAssets.length === 0 && !libraryAssets.length ? (
            <div className="asset-rail__empty">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
              </svg>
              <strong>{t('No photos yet.')}</strong>
              <span>{t('Use the upload button above, or drag photos straight onto the page.')}</span>
            </div>
          ) : null}
        </div>
        {unalbumHasMore && !pickedIds.size ? (
          <button
            type="button"
            className="button button--ghost button--small asset-rail__more"
            disabled={unalbumLoading}
            onClick={() => void onLoadMoreUnalbum()}
          >
            {unalbumLoading ? t('Loading…') : t('Load more UnAlbum photos')}
          </button>
        ) : null}
      </section>
      <section className="editor-panel editor-panel--content-work">
        <div className="editor-panel__toolbar">
          <span className="editor-panel__label">{t('Page content')}</span>
          <span className="panel-tag">{selectedPagePositionLabel}</span>
                <PanelCollapseToggle />
        </div>

        <section className="editor-panel__section editor-panel__section--text">
          <span className="editor-panel__section-label">{t('Text')}</span>
          {selectedPageUsesKicker ? (
            <label className="field">
              <span>{t('Kicker')}</span>
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
            <textarea
              rows={2}
              maxLength={PAGE_CAPTION_LIMIT}
              value={selectedPage.caption}
              onChange={(event) => updateSelectedPage((page) => ({ ...page, caption: event.target.value }))}
            />
          </label>
        </section>

        <EditorSubsection
          className="editor-frame-section"
          label={t('Image frame')}
          meta={selectedFrameLabel ?? t('No frame selected')}
          defaultOpen
        >
          <p className="selected-frame-status">
            {selectedAsset
              ? t('Assigned image: %s').replace('%s', selectedAsset.name)
              : t('No image assigned to this frame yet.')}
          </p>
          {selectedAsset ? <span className="panel-tag editor-frame-section__fit">{currentCrop?.fit === 'contain' ? t('Fit') : t('Fill')}</span> : null}
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
              <div className="editor-crop-actions editor-crop-actions--below editor-button-grid editor-button-grid--three">
                <button type="button" className="button button--ghost button--small" onClick={clearSelectedSlot}>
                  {t('Clear')}
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => clearAssetPlacements(selectedAsset.id)}
                >
                  {t('Clear all')}
                </button>
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
                  {t('Reset')}
                </button>
              </div>
            </>
          ) : null}
        </EditorSubsection>
      </section>
    </aside>
  );
}
