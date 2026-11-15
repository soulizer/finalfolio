import { TemplateId } from '../editor/types';

/**
 * Schematic page previews used in the layout picker. The outer box keeps the A4
 * ratio (210 × 297) and the inner box reproduces the real page padding
 * (16mm sides, 16mm top, 18mm bottom), so the proportions of the image and text
 * areas match what the editor actually renders.
 */
function TextLines({ count = 2, short }: { count?: number; short?: boolean }) {
  return (
    <span className={`layout-thumb__text ${short ? 'is-short' : ''}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="layout-thumb__line" />
      ))}
    </span>
  );
}

function ImageBlock({ className = '' }: { className?: string }) {
  return (
    <span className={`layout-thumb__image ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <circle cx="8" cy="8" r="2.2" />
        <path d="M3.4 19.2 9.6 12l3.7 4.2 2.6-2.9 4.7 5.9Z" />
      </svg>
    </span>
  );
}

export function LayoutThumbnail({ templateId, className = '' }: { templateId: TemplateId; className?: string }) {
  return (
    <div className={`layout-thumb layout-thumb--${templateId} ${className}`.trim()} aria-hidden="true">
      <div className="layout-thumb__page">
        <div className="layout-thumb__inner">
          {templateId === 'cover' ? (
            <>
              <ImageBlock />
              <div className="layout-thumb__stack layout-thumb__stack--tight">
                <TextLines count={1} short />
                <span className="layout-thumb__line layout-thumb__line--title" />
                <TextLines count={1} short />
              </div>
            </>
          ) : null}

          {templateId === 'essay' ? (
            <>
              <ImageBlock />
              <div className="layout-thumb__stack">
                <TextLines count={1} short />
                <span className="layout-thumb__line layout-thumb__line--title" />
                <span className="layout-thumb__line layout-thumb__line--title is-short" />
                <TextLines count={2} />
                <TextLines count={3} />
              </div>
            </>
          ) : null}

          {templateId === 'folio' ? (
            <>
              <div className="layout-thumb__row">
                <div className="layout-thumb__stack layout-thumb__stack--tight">
                  <TextLines count={1} short />
                  <span className="layout-thumb__line layout-thumb__line--title" />
                </div>
                <TextLines count={1} short />
              </div>
              <ImageBlock />
              <TextLines count={1} short />
            </>
          ) : null}

          {templateId === 'grid' ? (
            <>
              <div className="layout-thumb__stack layout-thumb__stack--tight">
                <TextLines count={1} short />
                <span className="layout-thumb__line layout-thumb__line--title" />
              </div>
              <div className="layout-thumb__frames layout-thumb__frames--2x2">
                <ImageBlock />
                <ImageBlock />
                <ImageBlock />
                <ImageBlock />
              </div>
              <div className="layout-thumb__row">
                <TextLines count={2} />
                <TextLines count={1} short />
              </div>
            </>
          ) : null}

          {templateId === 'diptych' ? (
            <>
              <div className="layout-thumb__row">
                <div className="layout-thumb__stack layout-thumb__stack--tight">
                  <TextLines count={1} short />
                  <span className="layout-thumb__line layout-thumb__line--title" />
                </div>
                <TextLines count={1} short />
              </div>
              <div className="layout-thumb__frames layout-thumb__frames--2">
                <ImageBlock />
                <ImageBlock />
              </div>
              <div className="layout-thumb__row">
                <TextLines count={2} />
                <TextLines count={1} short />
              </div>
            </>
          ) : null}

          {templateId === 'panorama' ? (
            <>
              <div className="layout-thumb__row">
                <div className="layout-thumb__stack layout-thumb__stack--tight">
                  <TextLines count={1} short />
                  <span className="layout-thumb__line layout-thumb__line--title" />
                </div>
                <TextLines count={1} short />
              </div>
              <div className="layout-thumb__frames layout-thumb__frames--rows">
                <ImageBlock />
                <ImageBlock />
              </div>
              <TextLines count={1} short />
            </>
          ) : null}

          {templateId === 'mosaic' ? (
            <>
              <div className="layout-thumb__frames layout-thumb__frames--mosaic">
                <ImageBlock />
                <div className="layout-thumb__frames layout-thumb__frames--rows">
                  <ImageBlock />
                  <ImageBlock />
                </div>
              </div>
              <div className="layout-thumb__row">
                <div className="layout-thumb__stack layout-thumb__stack--tight">
                  <TextLines count={1} short />
                  <span className="layout-thumb__line layout-thumb__line--title" />
                  <TextLines count={2} />
                </div>
                <TextLines count={2} />
              </div>
            </>
          ) : null}

          {templateId === 'triptych' ? (
            <>
              <div className="layout-thumb__frames layout-thumb__frames--3">
                <ImageBlock />
                <ImageBlock />
                <ImageBlock />
              </div>
              <div className="layout-thumb__row">
                <div className="layout-thumb__stack layout-thumb__stack--tight">
                  <TextLines count={1} short />
                  <span className="layout-thumb__line layout-thumb__line--title" />
                </div>
                <TextLines count={2} />
                <TextLines count={1} short />
              </div>
            </>
          ) : null}

          {templateId === 'custom' ? (
            <>
              <div className="layout-thumb__frames layout-thumb__frames--custom">
                <ImageBlock />
                <ImageBlock />
                <ImageBlock />
              </div>
              <div className="layout-thumb__stack layout-thumb__stack--tight">
                <span className="layout-thumb__line layout-thumb__line--title" />
                <TextLines count={2} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
