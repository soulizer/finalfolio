import type { CSSProperties, ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MagazinePreview } from '../components/MagazinePreview';
import { LocaleProvider, translate } from '../i18n';
import type { Asset, PageData } from '../editor/types';
import type { ProjectFonts } from '../editor/types';
import { buildProjectFontVars } from '../editor/fonts';

type RenderedViewerPage = {
  id: string;
  page: PageData | null;
  pageNumber: number | null;
  blankLabel: string;
  decorativeBlank: boolean;
};

type RenderTurnJsPageMarkupOptions = {
  issue: string;
  renderedPages: RenderedViewerPage[];
  assets: Record<string, Asset>;
  frameRadius: number;
  fonts?: ProjectFonts;
  sheetWidth: number;
  sheetHeight: number;
};

function formatPageNumber(pageNumber: number | null | undefined) {
  return typeof pageNumber === 'number'
    ? translate('Page %s').replace('%s', String(pageNumber).padStart(2, '0'))
    : translate('Endpaper');
}

function getRenderedPageSide(pageNumber: number | null, totalPages: number): 'single' | 'left' | 'right' {
  if (pageNumber === 1) {
    return 'single';
  }

  if (pageNumber === totalPages && totalPages % 2 === 0) {
    return 'left';
  }

  return pageNumber !== null && pageNumber % 2 === 0 ? 'left' : 'right';
}

function BlankIssuePage({
  issue,
  pageNumber,
  label,
  decorative,
}: {
  issue: string;
  pageNumber: number | null | undefined;
  label: string;
  decorative: boolean;
}) {
  if (decorative) {
    return <article className="magazine-page magazine-page--theme-pure-white issue-viewer__blank-page issue-viewer__blank-page--decorative" aria-hidden="true" />;
  }

  return (
    <article className="magazine-page magazine-page--theme-pure-white issue-viewer__blank-page">
      <header className="magazine-page__meta">
        <span>{issue}</span>
        <span>{formatPageNumber(pageNumber)}</span>
      </header>
      <div className="issue-viewer__blank-copy">
        <span>{label}</span>
      </div>
    </article>
  );
}

function TurnJsPageMarkup({
  issue,
  renderedPage,
  assets,
  frameRadius,
  fonts,
  totalPages,
  sheetWidth,
  sheetHeight,
}: {
  issue: string;
  renderedPage: RenderedViewerPage;
  assets: Record<string, Asset>;
  frameRadius: number;
  fonts?: ProjectFonts;
  totalPages: number;
  sheetWidth: number;
  sheetHeight: number;
}) {
  const side = getRenderedPageSide(renderedPage.pageNumber, totalPages);
  const isBoundaryPage = renderedPage.pageNumber === 1 || renderedPage.pageNumber === totalPages;
  const pageClassName = [
    'issue-turnjs__page',
    'page',
    `issue-turnjs__page--${side}`,
    isBoundaryPage ? 'issue-turnjs__page--boundary' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={pageClassName}>
      <div className={`issue-turnjs__sheet issue-turnjs__sheet--${side}`.trim()}>
        <div
          className="magazine-sheet magazine-sheet--editor issue-turnjs__sheet-scale"
          style={
            {
              '--sheet-width': `${sheetWidth}px`,
              '--sheet-height': `${sheetHeight}px`,
              ...buildProjectFontVars(fonts),
            } as CSSProperties
          }
        >
          {renderedPage.page ? (
            <MagazinePreview
              issue={issue}
              page={renderedPage.page}
              assets={assets}
              assetVariant="preview"
              imageDecoding="async"
              imageLoading="lazy"
              frameRadius={frameRadius}
              pageNumber={renderedPage.pageNumber ?? undefined}
            />
          ) : (
            <BlankIssuePage
              issue={issue}
              pageNumber={renderedPage.pageNumber}
              label={renderedPage.blankLabel}
              decorative={renderedPage.decorativeBlank}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function renderDetachedMarkup(element: ReactElement) {
  const container = document.createElement('div');
  const root = createRoot(container);

  flushSync(() => {
    root.render(<LocaleProvider>{element}</LocaleProvider>);
  });

  const markup = container.innerHTML;
  root.unmount();
  return markup;
}

export function renderTurnJsPageMarkup({
  issue,
  renderedPages,
  assets,
  frameRadius,
  fonts,
  sheetWidth,
  sheetHeight,
}: RenderTurnJsPageMarkupOptions) {
  // Render the whole book in one detached root. Creating and unmounting a root
  // per page cost 48 synchronous renders (plus their layout effects) before the
  // book could initialize; one tree keeps the markup identical and much cheaper.
  return renderDetachedMarkup(
    <>
      {renderedPages.map((renderedPage) => (
        <TurnJsPageMarkup
          key={renderedPage.id}
          issue={issue}
          renderedPage={renderedPage}
          assets={assets}
          frameRadius={frameRadius}
          fonts={fonts}
          totalPages={renderedPages.length}
          sheetWidth={sheetWidth}
          sheetHeight={sheetHeight}
        />
      ))}
    </>,
  );
}
