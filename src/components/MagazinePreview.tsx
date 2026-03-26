import { CSSProperties } from 'react';
import { Asset, CropSettings, LayoutArea, PageData } from '../editor/types';

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
    objectFit: crop?.fit ?? 'cover',
    objectPosition: `${crop?.x ?? 50}% ${crop?.y ?? 50}%`,
    transform: `scale(${crop?.scale ?? 1})`,
  };
}

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
  className,
  hintLabel,
}: {
  slot: string;
  page: PageData;
  assets: Record<string, Asset>;
  selectedSlot?: string | null;
  interactive?: boolean;
  onSelectSlot?: (slot: string) => void;
  onAssignDroppedAsset?: (slot: string, assetId: string) => void;
  className?: string;
  hintLabel?: string;
}) {
  const assetId = page.slots[slot];
  const asset = assetId ? assets[assetId] : null;
  const isSelected = selectedSlot === slot;
  const frameClassName = `asset-frame ${className ?? ''} ${isSelected ? 'is-selected' : ''}`.trim();
  const slotHint = hintLabel ?? slot;

  const content = (
    <>
      <div className="asset-frame__media">
        {asset ? (
          <img alt={asset.name} src={asset.src} className="asset-frame__image" style={frameStyle(page.crops[slot])} />
        ) : interactive ? (
          <span className="asset-frame__placeholder">Drop a photo here</span>
        ) : null}
      </div>
      {interactive ? <span className="asset-frame__hint">{slotHint}</span> : null}
    </>
  );

  if (!interactive) {
    return <div className={frameClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={frameClassName}
      aria-label={`Select the ${slotHint} frame`}
      onClick={() => onSelectSlot?.(slot)}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const droppedAssetId = event.dataTransfer.getData('text/crazyalbum-asset');
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
  pageNumber,
  selectedSlot,
  interactive,
  onSelectSlot,
  onAssignDroppedAsset,
}: MagazinePreviewProps) {
  const customTemplate = page.customTemplate;
  const pageClassName = `magazine-page magazine-page--${page.template} magazine-page--theme-${page.theme}`;
  const renderSlot = (slot: string, options: { className?: string; hintLabel?: string } = {}) => (
    <AssetFrame
      slot={slot}
      page={page}
      assets={assets}
      selectedSlot={selectedSlot}
      interactive={interactive}
      onSelectSlot={onSelectSlot}
      onAssignDroppedAsset={onAssignDroppedAsset}
      className={options.className}
      hintLabel={options.hintLabel}
    />
  );

  return (
    <article className={pageClassName}>
      <header className="magazine-page__meta">
        <span>{page.kicker}</span>
        <span>{issue}</span>
        {pageNumber ? <span>{`Page ${String(pageNumber).padStart(2, '0')}`}</span> : null}
      </header>

      {page.template === 'cover' ? (
        <div className="magazine-cover">
          <div className="magazine-cover__image">{renderSlot('hero')}</div>
          <div className="magazine-cover__copy">
            <p className="magazine-kicker">{page.deck}</p>
            <h2>{page.title}</h2>
            <p>{page.caption}</p>
          </div>
        </div>
      ) : null}

      {page.template === 'essay' ? (
        <div className="magazine-essay">
          <div className="magazine-essay__visual">{renderSlot('hero')}</div>
          <div className="magazine-essay__copy">
            <p className="magazine-kicker">{page.kicker}</p>
            <h2>{page.title}</h2>
            <p className="magazine-essay__deck">{page.deck}</p>
            <p className="magazine-essay__body">{page.body}</p>
            <footer>{page.caption}</footer>
          </div>
        </div>
      ) : null}

      {page.template === 'folio' ? (
        <div className="magazine-folio">
          <div className="magazine-folio__header">
            <div>
              <p className="magazine-kicker">{page.kicker}</p>
              <h2>{page.title}</h2>
            </div>
            <p>{page.deck}</p>
          </div>
          <div className="magazine-folio__visual">{renderSlot('hero')}</div>
          <footer>{page.caption}</footer>
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
            {renderSlot('a', { hintLabel: 'Frame A' })}
            {renderSlot('b', { hintLabel: 'Frame B' })}
            {renderSlot('c', { hintLabel: 'Frame C' })}
            {renderSlot('d', { hintLabel: 'Frame D' })}
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
            {renderSlot('left', { hintLabel: 'Left frame' })}
            {renderSlot('right', { hintLabel: 'Right frame' })}
          </div>
          <footer>{page.caption}</footer>
        </div>
      ) : null}

      {page.template === 'panorama' ? (
        <div className="magazine-panorama">
          <div className="magazine-panorama__header">
            <div>
              <p className="magazine-kicker">{page.kicker}</p>
              <h2>{page.title}</h2>
            </div>
            <p>{page.deck}</p>
          </div>
          <div className="magazine-panorama__frames">
            {renderSlot('top', { hintLabel: 'Top frame' })}
            {renderSlot('bottom', { hintLabel: 'Bottom frame' })}
          </div>
          <footer>{page.caption}</footer>
        </div>
      ) : null}

      {page.template === 'mosaic' ? (
        <div className="magazine-mosaic">
          <div className="magazine-mosaic__frames">
            <div className="magazine-mosaic__lead">{renderSlot('lead', { hintLabel: 'Lead frame' })}</div>
            <div className="magazine-mosaic__support">
              {renderSlot('top', { hintLabel: 'Support frame A' })}
              {renderSlot('bottom', { hintLabel: 'Support frame B' })}
            </div>
          </div>
          <div className="magazine-mosaic__band">
            <div className="magazine-mosaic__headline">
              <p className="magazine-kicker">{page.kicker}</p>
              <h2>{page.title}</h2>
            </div>
            <div className="magazine-mosaic__notes">
              <p>{page.deck}</p>
              <footer>{page.caption}</footer>
            </div>
          </div>
        </div>
      ) : null}

      {page.template === 'triptych' ? (
        <div className="magazine-triptych">
          <div className="magazine-triptych__rail">
            <div>
              <p className="magazine-kicker">{page.kicker}</p>
              <h2>{page.title}</h2>
              <p className="magazine-triptych__deck">{page.deck}</p>
            </div>
            <footer>{page.caption}</footer>
          </div>
          <div className="magazine-triptych__frames">
            {renderSlot('a', { hintLabel: 'Frame A' })}
            {renderSlot('b', { hintLabel: 'Frame B' })}
            {renderSlot('c', { hintLabel: 'Frame C' })}
          </div>
        </div>
      ) : null}

      {page.template === 'custom' && customTemplate ? (
        <div className="magazine-custom">
          <div className="magazine-custom__canvas">
            {customTemplate.frames.map((frame) => (
              <div key={frame.slot} className="magazine-custom__frame" style={areaStyle(frame)}>
                {renderSlot(frame.slot, { className: 'magazine-custom__asset-frame', hintLabel: frame.label })}
              </div>
            ))}
            <section className="magazine-custom__text" style={areaStyle(customTemplate.text)}>
              <span className="magazine-custom__label">{customTemplate.name}</span>
              <p className="magazine-kicker">{page.kicker}</p>
              <h2>{page.title}</h2>
              {page.deck ? <p className="magazine-custom__deck">{page.deck}</p> : null}
              {page.body ? <p className="magazine-custom__body">{page.body}</p> : null}
              {page.caption ? <footer>{page.caption}</footer> : null}
            </section>
          </div>
        </div>
      ) : null}
    </article>
  );
}
