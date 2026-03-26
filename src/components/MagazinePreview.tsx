import { CSSProperties } from 'react';
import { Asset, CropSettings, PageData } from '../editor/types';

interface MagazinePreviewProps {
  issue: string;
  page: PageData;
  assets: Record<string, Asset>;
  pageNumber?: number;
  selectedSlot?: string | null;
  interactive?: boolean;
  onSelectSlot?: (slot: string) => void;
  onAssignDroppedAsset?: (slot: string, assetId: string) => void;
}

function frameStyle(crop?: CropSettings): CSSProperties {
  return {
    objectPosition: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`,
    transform: `scale(${crop?.scale ?? 1})`,
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
  className,
}: {
  slot: string;
  page: PageData;
  assets: Record<string, Asset>;
  selectedSlot?: string | null;
  interactive?: boolean;
  onSelectSlot?: (slot: string) => void;
  onAssignDroppedAsset?: (slot: string, assetId: string) => void;
  className?: string;
}) {
  const assetId = page.slots[slot];
  const asset = assetId ? assets[assetId] : null;
  const isSelected = selectedSlot === slot;
  const frameClassName = `asset-frame ${className ?? ''} ${isSelected ? 'is-selected' : ''}`.trim();

  const content = (
    <>
      {asset ? (
        <img alt={asset.name} src={asset.src} className="asset-frame__image" style={frameStyle(page.crops[slot])} />
      ) : interactive ? (
        <span className="asset-frame__placeholder">Drop a photo here</span>
      ) : null}
      {interactive ? <span className="asset-frame__hint">{slot}</span> : null}
    </>
  );

  if (!interactive) {
    return <div className={frameClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={frameClassName}
      aria-label={`Select the ${slot} frame`}
      onClick={() => onSelectSlot?.(slot)}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const assetId = event.dataTransfer.getData('text/crazyalbum-asset');
        if (assetId) onAssignDroppedAsset?.(slot, assetId);
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
  pageNumber,
  selectedSlot,
  interactive,
  onSelectSlot,
  onAssignDroppedAsset,
}: MagazinePreviewProps) {
  const slots = {
    hero: (
      <AssetFrame
        slot="hero"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
    left: (
      <AssetFrame
        slot="left"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
    right: (
      <AssetFrame
        slot="right"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
    a: (
      <AssetFrame
        slot="a"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
    b: (
      <AssetFrame
        slot="b"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
    c: (
      <AssetFrame
        slot="c"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
    d: (
      <AssetFrame
        slot="d"
        page={page}
        assets={assets}
        selectedSlot={selectedSlot}
        interactive={interactive}
        onSelectSlot={onSelectSlot}
        onAssignDroppedAsset={onAssignDroppedAsset}
      />
    ),
  };

  return (
    <article className={`magazine-page magazine-page--${page.template}`}>
      <header className="magazine-page__meta">
        <span>{page.kicker}</span>
        <span>{issue}</span>
        {pageNumber ? <span>{`Page ${String(pageNumber).padStart(2, '0')}`}</span> : null}
      </header>

      {page.template === 'cover' ? (
        <div className="magazine-cover">
          <div className="magazine-cover__image">{slots.hero}</div>
          <div className="magazine-cover__copy">
            <p className="magazine-kicker">{page.deck}</p>
            <h2>{page.title}</h2>
            <p>{page.caption}</p>
          </div>
        </div>
      ) : null}

      {page.template === 'essay' ? (
        <div className="magazine-essay">
          <div className="magazine-essay__visual">{slots.hero}</div>
          <div className="magazine-essay__copy">
            <p className="magazine-kicker">{page.kicker}</p>
            <h2>{page.title}</h2>
            <p className="magazine-essay__deck">{page.deck}</p>
            <p className="magazine-essay__body">{page.body}</p>
            <footer>{page.caption}</footer>
          </div>
        </div>
      ) : null}

      {page.template === 'grid' ? (
        <div className="magazine-grid">
          <div className="magazine-grid__copy">
            <p className="magazine-kicker">{page.kicker}</p>
            <h2>{page.title}</h2>
            <p>{page.deck}</p>
          </div>
          <div className="magazine-grid__frames">
            {slots.a}
            {slots.b}
            {slots.c}
            {slots.d}
          </div>
          <footer>{page.caption}</footer>
        </div>
      ) : null}

      {page.template === 'diptych' ? (
        <div className="magazine-diptych">
          <div className="magazine-diptych__header">
            <div>
              <p className="magazine-kicker">{page.kicker}</p>
              <h2>{page.title}</h2>
            </div>
            <p>{page.deck}</p>
          </div>
          <div className="magazine-diptych__frames">
            {slots.left}
            {slots.right}
          </div>
          <footer>{page.caption}</footer>
        </div>
      ) : null}
    </article>
  );
}
