import { translate, useT } from '../i18n';
import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  useLayoutEffect,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { templateUsesBody, templateUsesDeck, templateUsesKicker } from '../editor/demoData';
import {
  calculateImageRenderGeometry,
  clamp,
  pixelOffsetToCropValue,
  resolveAssetIntrinsicSize,
  cropValueToPixelOffset,
} from '../editor/imageGeometry';
import { getAssetSource } from '../editor/assetResources';
import { Asset, AssetVariantKind, CropSettings, LayoutArea, PageData } from '../editor/types';

interface MagazinePreviewProps {
  issue: string;
  page: PageData;
  assets: Record<string, Asset>;
  assetVariant?: AssetVariantKind;
  imageDecoding?: 'sync' | 'async' | 'auto';
  frameRadius?: number;
  pageNumber?: number;
  selectedSlot?: string | null;
  interactive?: boolean;
  onSelectSlot?: (slot: string) => void;
  onAssignDroppedAsset?: (slot: string, assetId: string) => void;
  onUpdateCrop?: (slot: string, updater: (crop: CropSettings) => CropSettings) => void;
  onCropMetricsChange?: (slot: string, metrics: { maxOffsetX: number; maxOffsetY: number } | null) => void;
  onTextEditCommit?: (field: 'kicker' | 'title' | 'deck' | 'body' | 'caption', value: string) => void;
  localizeContent?: boolean;
}

type PageTextField = 'kicker' | 'title' | 'deck' | 'body' | 'caption';

const eastAsianTextPattern = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function hasEastAsianText(...values: Array<string | null | undefined>) {
  return values.some((value) => Boolean(value && eastAsianTextPattern.test(value)));
}

function fallbackFrameStyle(crop?: CropSettings): CSSProperties {
  return {
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: crop?.fit ?? 'cover',
    objectPosition: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`,
    transform: `scale(${crop?.scale ?? 1})`,
  };
}

function createInteractiveFrameStyle(
  geometry: ReturnType<typeof calculateImageRenderGeometry>,
  crop: CropSettings | undefined,
): CSSProperties {
  if (!crop || !geometry) {
    return fallbackFrameStyle(crop);
  }

  return {
    left: '50%',
    top: '50%',
    width: `${geometry.baseWidth}px`,
    height: `${geometry.baseHeight}px`,
    transform: `translate(-50%, -50%) translate(${geometry.offsetX}px, ${geometry.offsetY}px) scale(${crop.scale})`,
  };
}

function getFallbackCrop(crop?: CropSettings): CropSettings {
  return {
    x: crop?.x ?? 50,
    y: crop?.y ?? 50,
    scale: crop?.scale ?? 1,
    fit: crop?.fit ?? 'cover',
  };
}

function readStableFrameSize(frame: HTMLButtonElement | HTMLDivElement) {
  const computed = window.getComputedStyle(frame);
  const computedWidth = Number.parseFloat(computed.width);
  const computedHeight = Number.parseFloat(computed.height);

  if (Number.isFinite(computedWidth) && computedWidth > 0 && Number.isFinite(computedHeight) && computedHeight > 0) {
    return {
      width: computedWidth,
      height: computedHeight,
    };
  }

  const clientWidth = frame.clientWidth;
  const clientHeight = frame.clientHeight;
  if (clientWidth > 0 && clientHeight > 0) {
    return {
      width: clientWidth,
      height: clientHeight,
    };
  }

  const rect = frame.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
  };
}

const cropNudgeStep = 4;
const cropScaleStep = 0.06;

function areaStyle(area: LayoutArea): CSSProperties {
  return {
    left: `${area.x}%`,
    top: `${area.y}%`,
    width: `${area.width}%`,
    height: `${area.height}%`,
  };
}

function AssetFrame({
  slot,
  page,
  assets,
  selectedSlot,
  interactive,
  onSelectSlot,
  onAssignDroppedAsset,
  onUpdateCrop,
  onCropMetricsChange,
  assetVariant = 'original',
  imageDecoding,
  className,
  hintLabel,
}: {
  slot: string;
  page: PageData;
  assets: Record<string, Asset>;
  assetVariant?: AssetVariantKind;
  imageDecoding?: 'sync' | 'async' | 'auto';
  selectedSlot?: string | null;
  interactive?: boolean;
  onSelectSlot?: (slot: string) => void;
  onAssignDroppedAsset?: (slot: string, assetId: string) => void;
  onUpdateCrop?: (slot: string, updater: (crop: CropSettings) => CropSettings) => void;
  onCropMetricsChange?: (slot: string, metrics: { maxOffsetX: number; maxOffsetY: number } | null) => void;
  className?: string;
  hintLabel?: string;
}) {
  const t = useT();
  const assetId = page.slots[slot];
  const asset = assetId ? assets[assetId] : null;
  const assetSource = getAssetSource(asset, assetVariant);
  const isSelected = selectedSlot === slot;
  const canAdjustCrop = Boolean(interactive && asset && isSelected && onUpdateCrop);
  const [isDragging, setIsDragging] = useState(false);
  const frameClassName = `asset-frame ${className ?? ''} ${isSelected ? 'is-selected' : ''} ${canAdjustCrop ? 'is-draggable' : ''} ${isDragging ? 'is-dragging' : ''}`.trim();
  const slotHint = hintLabel ?? slot;
  const frameRef = useRef<HTMLButtonElement | HTMLDivElement | null>(null);
  const setFrameElement = (node: HTMLButtonElement | HTMLDivElement | null) => {
    frameRef.current = node;
  };
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  // getFallbackCrop allocates a fresh object. Memoising it keeps imageGeometry and
  // dragMetrics referentially stable, which the crop-metrics effect below depends on.
  const crop = useMemo(() => getFallbackCrop(page.crops[slot]), [page.crops, slot]);
  const intrinsicSize = useMemo(
    () => resolveAssetIntrinsicSize(asset, naturalSize),
    [asset, naturalSize],
  );
  const imageGeometry = useMemo(
    () => calculateImageRenderGeometry(frameSize, intrinsicSize, crop),
    [crop, frameSize, intrinsicSize],
  );
  const interactiveImageStyle = useMemo(() => createInteractiveFrameStyle(imageGeometry, crop), [crop, imageGeometry]);
  const hasAsset = Boolean(asset);
  const frameReady = frameSize.width > 0 && frameSize.height > 0;
  const geometryReady = !hasAsset || Boolean(imageGeometry);
  const dragMetrics = useMemo(() => {
    if (!imageGeometry) {
      return {
        maxOffsetX: 0,
        maxOffsetY: 0,
      };
    }

    return {
      maxOffsetX: imageGeometry.maxOffsetX,
      maxOffsetY: imageGeometry.maxOffsetY,
    };
  }, [imageGeometry]);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    maxOffsetX: number;
    maxOffsetY: number;
    startCrop: CropSettings;
    target: HTMLButtonElement;
  } | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateFrameSize = (nextWidth: number, nextHeight: number) => {
      setFrameSize((current) =>
        Math.abs(current.width - nextWidth) < 0.1 && Math.abs(current.height - nextHeight) < 0.1
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    const initialSize = readStableFrameSize(frame);
    updateFrameSize(initialSize.width, initialSize.height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        const fallbackSize = readStableFrameSize(frame);
        updateFrameSize(fallbackSize.width, fallbackSize.height);
        return;
      }

      // Prefer the content box reported by ResizeObserver so preview image geometry
      // follows the same untransformed frame dimensions across editor, homepage, and admin surfaces.
      const nextWidth = entry.contentRect.width || frame.clientWidth || frame.getBoundingClientRect().width;
      const nextHeight = entry.contentRect.height || frame.clientHeight || frame.getBoundingClientRect().height;
      updateFrameSize(nextWidth, nextHeight);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setNaturalSize({ width: 0, height: 0 });
  }, [asset?.id, assetSource]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image?.complete || !image.naturalWidth || !image.naturalHeight) {
      return;
    }

    setNaturalSize((current) =>
      current.width === image.naturalWidth && current.height === image.naturalHeight
        ? current
        : { width: image.naturalWidth, height: image.naturalHeight },
    );
  }, [asset?.id, assetSource]);

  const onCropMetricsChangeRef = useRef(onCropMetricsChange);
  onCropMetricsChangeRef.current = onCropMetricsChange;

  useEffect(() => {
    const notify = onCropMetricsChangeRef.current;
    if (!interactive || !notify) {
      return;
    }

    notify(slot, asset ? dragMetrics : null);
    return () => onCropMetricsChangeRef.current?.(slot, null);
  }, [asset, dragMetrics, interactive, slot]);

  function nudgeCropByPixels(axis: 'x' | 'y', deltaPixels: number) {
    if (!onUpdateCrop) {
      return;
    }

    const maxOffset = axis === 'x' ? dragMetrics.maxOffsetX : dragMetrics.maxOffsetY;
    if (maxOffset <= 0) {
      return;
    }

    onUpdateCrop(slot, (crop) => {
      const safeCrop = getFallbackCrop(crop);
      const currentOffset = cropValueToPixelOffset(safeCrop[axis], maxOffset);
      const nextOffset = clamp(currentOffset + deltaPixels, -maxOffset, maxOffset);
      return {
        ...safeCrop,
        [axis]: pixelOffsetToCropValue(nextOffset, maxOffset),
      };
    });
  }

  function stopCropInteraction() {
    const dragState = dragStateRef.current;
    if (dragState?.target.hasPointerCapture(dragState.pointerId)) {
      dragState.target.releasePointerCapture(dragState.pointerId);
    }
    setIsDragging(false);
    dragStateRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopCropInteraction);
    window.removeEventListener('pointercancel', stopCropInteraction);
  }

  function handlePointerMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState || !onUpdateCrop || event.pointerId !== dragState.pointerId) {
      return;
    }

    event.preventDefault();
    const nextOffsetX = clamp(dragState.startOffsetX + (event.clientX - dragState.startX), -dragState.maxOffsetX, dragState.maxOffsetX);
    const nextOffsetY = clamp(dragState.startOffsetY + (event.clientY - dragState.startY), -dragState.maxOffsetY, dragState.maxOffsetY);
    onUpdateCrop(slot, (crop) => ({
      ...getFallbackCrop(crop),
      x: pixelOffsetToCropValue(nextOffsetX, dragState.maxOffsetX),
      y: pixelOffsetToCropValue(nextOffsetY, dragState.maxOffsetY),
    }));
  }

  function startCropInteraction(event: ReactPointerEvent<HTMLButtonElement>) {
    onSelectSlot?.(slot);
    if (!canAdjustCrop || event.button !== 0) {
      return;
    }

    event.preventDefault();
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    const startCrop = getFallbackCrop(page.crops[slot]);
    const startOffsetX = cropValueToPixelOffset(startCrop.x, dragMetrics.maxOffsetX);
    const startOffsetY = cropValueToPixelOffset(startCrop.y, dragMetrics.maxOffsetY);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX,
      startOffsetY,
      maxOffsetX: dragMetrics.maxOffsetX,
      maxOffsetY: dragMetrics.maxOffsetY,
      startCrop,
      target: event.currentTarget,
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopCropInteraction);
    window.addEventListener('pointercancel', stopCropInteraction);
  }

  function handleWheel(event: ReactWheelEvent<HTMLButtonElement>) {
    if (!canAdjustCrop || !onUpdateCrop) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaY < 0 ? cropScaleStep : -cropScaleStep;
    onUpdateCrop(slot, (crop) => ({
      ...crop,
      scale: clamp(crop.scale + delta, 1, 2.2),
    }));
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!canAdjustCrop || !onUpdateCrop) {
      return;
    }

    switch (event.key) {
      case t('ArrowLeft'):
        event.preventDefault();
        nudgeCropByPixels('x', -cropNudgeStep);
        return;
      case t('ArrowRight'):
        event.preventDefault();
        nudgeCropByPixels('x', cropNudgeStep);
        return;
      case t('ArrowUp'):
        event.preventDefault();
        nudgeCropByPixels('y', -cropNudgeStep);
        return;
      case t('ArrowDown'):
        event.preventDefault();
        nudgeCropByPixels('y', cropNudgeStep);
        return;
      case '+':
      case '=':
        event.preventDefault();
        onUpdateCrop(slot, (crop) => ({
          ...crop,
          scale: clamp(crop.scale + cropScaleStep, 1, 2.2),
        }));
        return;
      case '-':
      case '_':
        event.preventDefault();
        onUpdateCrop(slot, (crop) => ({
          ...crop,
          scale: clamp(crop.scale - cropScaleStep, 1, 2.2),
        }));
        return;
      default:
        return;
    }
  }

  useEffect(() => () => stopCropInteraction(), []);

  const content = (
    <>
      <div className="asset-frame__media">
        {asset ? (
          <img
            key={`${page.id}:${slot}:${asset.id}:${
              assetSource.startsWith('data:') ? `${assetSource.length}:${assetSource.slice(-32)}` : assetSource
            }`}
            ref={imageRef}
            alt={asset.name}
            src={assetSource}
            className="asset-frame__image"
            style={interactiveImageStyle}
            draggable={false}
            decoding={imageDecoding ?? (assetVariant === 'original' ? 'sync' : 'async')}
            onDragStart={(event) => event.preventDefault()}
            onLoad={(event) =>
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
        ) : interactive ? (
          <span className="asset-frame__placeholder">{t('Drop a photo here')}</span>
        ) : null}
      </div>
      {interactive ? <span className="asset-frame__hint">{slotHint}</span> : null}
    </>
  );

  if (!interactive) {
    return (
      <div
        ref={setFrameElement}
        className={frameClassName}
        data-has-asset={hasAsset ? 'true' : 'false'}
        data-frame-ready={frameReady ? 'true' : 'false'}
        data-geometry-ready={geometryReady ? 'true' : 'false'}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      ref={setFrameElement}
      type="button"
      className={frameClassName}
      data-has-asset={hasAsset ? 'true' : 'false'}
      data-frame-ready={frameReady ? 'true' : 'false'}
      data-geometry-ready={geometryReady ? 'true' : 'false'}
      aria-label={`Select the ${slot} frame`}
      title={canAdjustCrop ? t('Drag to move the photo naturally. Arrow keys nudge. Use the wheel or +/- to zoom.') : undefined}
      onClick={() => onSelectSlot?.(slot)}
      onPointerDown={startCropInteraction}
      onDragStart={(event) => event.preventDefault()}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      onDoubleClick={() =>
        canAdjustCrop
          ? onUpdateCrop?.(slot, (crop) => ({
              ...crop,
              x: 50,
              y: 50,
            }))
          : undefined
      }
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const droppedAssetId = event.dataTransfer.getData(t('text/finalfolio-asset'));
        if (droppedAssetId) {
          onAssignDroppedAsset?.(slot, droppedAssetId);
        }
      }}
    >
      {content}
    </button>
  );
}

export function MagazinePreview({
  issue,
  page,
  assets,
  assetVariant = 'original',
  imageDecoding,
  frameRadius,
  pageNumber,
  selectedSlot,
  interactive,
  onSelectSlot,
  onAssignDroppedAsset,
  onUpdateCrop,
  onCropMetricsChange,
  onTextEditCommit,
  localizeContent,
}: MagazinePreviewProps) {
  const t = useT();
  const customTemplate = page.customTemplate;

  // Inline stage editing: in the editor the text itself becomes editable, so the
  // copy is typed directly on the page. Blur or Escape commits the new value.
  const renderText = (field: PageTextField) => {
    if (!onTextEditCommit) {
      return localizeContent ? t(page[field]) : page[field];
    }
    return (
      <span
        className="magazine-editable"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          const value = event.currentTarget.innerText.replace(/\u00a0/g, ' ');
          if (value !== page[field]) {
            onTextEditCommit(field, value);
          }
        }}
      >
        {page[field]}
      </span>
    );
  };
  const pageHasEastAsianCopy = hasEastAsianText(
    issue,
    page.title,
    page.kicker,
    page.deck,
    page.body,
    page.caption,
    customTemplate?.name,
  );
  const pageClassName = `magazine-page magazine-page--${page.template} magazine-page--theme-${page.theme} ${
    pageHasEastAsianCopy ? 'magazine-page--cjk' : ''
  }`.trim();
  const pageStyle = {
    '--page-frame-radius': `${frameRadius ?? 18}px`,
  } as CSSProperties;
  const hasKicker = templateUsesKicker(page.template) && Boolean(page.kicker.trim());
  const hasDeck = templateUsesDeck(page.template) && Boolean(page.deck.trim());
  const hasBody = templateUsesBody(page.template, page.customTemplate) && Boolean(page.body.trim());
  const hasCaption = Boolean(page.caption.trim());
  const hasTriptychAside = hasDeck || hasBody || hasCaption;
  const renderSlot = (slot: string, options: { className?: string; hintLabel?: string } = {}) => (
    <AssetFrame
      key={`${page.id}:${slot}`}
      slot={slot}
      page={page}
      assets={assets}
      assetVariant={assetVariant}
      imageDecoding={imageDecoding}
      selectedSlot={selectedSlot}
      interactive={interactive}
      onSelectSlot={onSelectSlot}
      onAssignDroppedAsset={onAssignDroppedAsset}
      onUpdateCrop={onUpdateCrop}
      onCropMetricsChange={onCropMetricsChange}
      className={options.className}
      hintLabel={options.hintLabel}
    />
  );

  return (
    <article className={pageClassName} style={pageStyle}>
      <header className="magazine-page__meta">
        <span>{issue}</span>
        {pageNumber ? <span>{t('Page %s').replace('%s', String(pageNumber).padStart(2, '0'))}</span> : null}
      </header>

      {page.template === 'cover' ? (
        <div className="magazine-cover">
          <div className="magazine-cover__image">{renderSlot('hero', { hintLabel: t('Hero') })}</div>
          <div className="magazine-cover__copy magazine-heading-block">
            {hasDeck ? <p className="magazine-kicker">{renderText('deck')}</p> : null}
            <h2>{renderText('title')}</h2>
            {hasCaption ? <p>{renderText('caption')}</p> : null}
          </div>
        </div>
      ) : null}

      {page.template === 'essay' ? (
        <div className="magazine-essay">
          <div className="magazine-essay__visual">{renderSlot('hero', { hintLabel: t('Hero') })}</div>
          <div className="magazine-essay__copy">
            <div className="magazine-essay__headline magazine-heading-block">
              {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
              <h2>{renderText('title')}</h2>
              {hasDeck ? <p className="magazine-essay__deck">{renderText('deck')}</p> : null}
            </div>
            {hasBody ? <p className="magazine-essay__body">{renderText('body')}</p> : null}
            {hasCaption ? <footer>{renderText('caption')}</footer> : null}
          </div>
        </div>
      ) : null}

      {page.template === 'folio' ? (
        <div className="magazine-folio">
          <div className="magazine-folio__header">
            <div className="magazine-heading-block">
              {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
              <h2>{renderText('title')}</h2>
            </div>
            {hasDeck ? <p>{renderText('deck')}</p> : null}
          </div>
          <div className="magazine-folio__visual">{renderSlot('hero', { hintLabel: t('Hero') })}</div>
          {hasCaption ? <footer>{renderText('caption')}</footer> : null}
        </div>
      ) : null}

      {page.template === 'grid' ? (
        <div className="magazine-grid">
          <div className="magazine-grid__copy magazine-heading-block">
            {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
            <h2>{renderText('title')}</h2>
          </div>
          <div className="magazine-grid__frames">
            {renderSlot('a', { hintLabel: t('Frame A') })}
            {renderSlot('b', { hintLabel: t('Frame B') })}
            {renderSlot('c', { hintLabel: t('Frame C') })}
            {renderSlot('d', { hintLabel: t('Frame D') })}
          </div>
          {hasBody || hasCaption ? (
            <div className="magazine-grid__footer">
              {hasBody ? <p className="magazine-grid__body">{renderText('body')}</p> : null}
              {hasCaption ? <footer>{renderText('caption')}</footer> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {page.template === 'diptych' ? (
        <div className="magazine-diptych">
          <div className="magazine-diptych__header">
            <div className="magazine-heading-block">
              {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
              <h2>{renderText('title')}</h2>
            </div>
            {hasDeck ? <p>{renderText('deck')}</p> : null}
          </div>
          <div className="magazine-diptych__frames">
            {renderSlot('left', { hintLabel: t('Left frame') })}
            {renderSlot('right', { hintLabel: t('Right frame') })}
          </div>
          {hasBody || hasCaption ? (
            <div className="magazine-diptych__footer">
              {hasBody ? <p className="magazine-diptych__body">{renderText('body')}</p> : null}
              {hasCaption ? <footer>{renderText('caption')}</footer> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {page.template === 'panorama' ? (
        <div className="magazine-panorama">
          <div className="magazine-panorama__header">
            <div className="magazine-heading-block">
              {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
              <h2>{renderText('title')}</h2>
            </div>
            {hasDeck ? <p>{renderText('deck')}</p> : null}
          </div>
          <div className="magazine-panorama__frames">
            {renderSlot('top', { hintLabel: t('Top frame') })}
            {renderSlot('bottom', { hintLabel: t('Bottom frame') })}
          </div>
          {hasCaption ? <footer>{renderText('caption')}</footer> : null}
        </div>
      ) : null}

      {page.template === 'mosaic' ? (
        <div className="magazine-mosaic">
          <div className="magazine-mosaic__frames">
            <div className="magazine-mosaic__lead">{renderSlot('lead', { hintLabel: t('Lead frame') })}</div>
            <div className="magazine-mosaic__support">
              {renderSlot('top', { hintLabel: t('Support frame A') })}
              {renderSlot('bottom', { hintLabel: t('Support frame B') })}
            </div>
          </div>
          <div className={`magazine-mosaic__band ${hasBody || hasCaption ? '' : t('magazine-mosaic__band--compact')}`.trim()}>
            <div className="magazine-mosaic__headline magazine-heading-block">
              {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
              <h2>{renderText('title')}</h2>
              {hasDeck ? <p className="magazine-mosaic__deck">{renderText('deck')}</p> : null}
            </div>
            {hasBody || hasCaption ? (
              <div className="magazine-mosaic__notes">
                {hasBody ? <p className="magazine-mosaic__body">{renderText('body')}</p> : null}
                {hasCaption ? <footer>{renderText('caption')}</footer> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {page.template === 'triptych' ? (
        <div className="magazine-triptych">
          <div className="magazine-triptych__frames">
            {renderSlot('a', { hintLabel: t('Frame A') })}
            {renderSlot('b', { hintLabel: t('Frame B') })}
            {renderSlot('c', { hintLabel: t('Frame C') })}
          </div>
          <div className={`magazine-triptych__footer ${hasTriptychAside ? '' : t('magazine-triptych__footer--compact')}`.trim()}>
            <div className="magazine-triptych__copy magazine-heading-block">
              {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
              <h2>{renderText('title')}</h2>
            </div>
            {hasTriptychAside ? (
              <div className="magazine-triptych__aside">
                {hasDeck ? <p className="magazine-triptych__deck">{renderText('deck')}</p> : null}
                {hasBody ? <p className="magazine-triptych__body">{renderText('body')}</p> : null}
                {hasCaption ? <footer>{renderText('caption')}</footer> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {page.template === 'custom' && customTemplate ? (
        <div className="magazine-custom">
          <div className="magazine-custom__canvas">
            {customTemplate.frames.map((frame) => (
              <div key={frame.slot} className="magazine-custom__frame" style={areaStyle(frame)}>
                {renderSlot(frame.slot, { className: t('magazine-custom__asset-frame'), hintLabel: frame.label })}
              </div>
            ))}
            <section className="magazine-custom__text" style={areaStyle(customTemplate.text)}>
              <span className="magazine-custom__label">{customTemplate.name}</span>
              <div className="magazine-heading-block">
                {hasKicker ? <p className="magazine-kicker">{renderText('kicker')}</p> : null}
                <h2>{renderText('title')}</h2>
                {hasDeck ? <p className="magazine-custom__deck">{renderText('deck')}</p> : null}
              </div>
              {hasBody ? <p className="magazine-custom__body">{renderText('body')}</p> : null}
              {hasCaption ? <footer>{renderText('caption')}</footer> : null}
            </section>
          </div>
        </div>
      ) : null}
    </article>
  );
}
