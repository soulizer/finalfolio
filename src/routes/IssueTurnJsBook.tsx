import { CSSProperties, ForwardedRef, forwardRef } from 'react';
import type { Asset, ProjectFonts } from '../editor/types';
import type { RenderedViewerPage, TurnJsDisplayMode, ViewerPositionMode, VisibleTurnView } from './issueViewReaderState';
import { useIssueTurnJsRuntime, type TurnJsBookHandle as IssueTurnJsBookHandle } from './useIssueTurnJsRuntime';

export type TurnJsBookHandle = IssueTurnJsBookHandle;

type TurnJsBookProps = {
  issueLabel: string;
  renderedPages: RenderedViewerPage[];
  assetsById: Record<string, Asset>;
  frameRadius: number;
  fonts?: ProjectFonts;
  sheetWidth: number;
  sheetHeight: number;
  pageWidth: number;
  pageHeight: number;
  pageScale: number;
  displayMode: TurnJsDisplayMode;
  pageSideMode: ViewerPositionMode;
  turning: boolean;
  shadowLeft: boolean;
  shadowRight: boolean;
  initialPage: number;
  onViewChange: (view: VisibleTurnView, page: number) => void;
  onTurningChange: (turning: boolean) => void;
};

export const IssueTurnJsBook = forwardRef(function IssueTurnJsBook(
  {
    issueLabel,
    renderedPages,
    assetsById,
    frameRadius,
    fonts,
    sheetWidth,
    sheetHeight,
    pageWidth,
    pageHeight,
    pageScale,
    displayMode,
    pageSideMode,
    turning,
    shadowLeft,
    shadowRight,
    initialPage,
    onViewChange,
    onTurningChange,
  }: TurnJsBookProps,
  ref: ForwardedRef<IssueTurnJsBookHandle>,
) {
  const { bookRef, bookReady, spreadPageCount } = useIssueTurnJsRuntime({
    ref,
    issueLabel,
    renderedPages,
    assetsById,
    frameRadius,
    fonts,
    sheetWidth,
    sheetHeight,
    pageWidth,
    pageHeight,
    displayMode,
    initialPage,
    onViewChange,
    onTurningChange,
  });

  return (
    <div
      ref={bookRef}
      className={[
        'issue-viewer__turnjs',
        `issue-viewer__turnjs--book-${pageSideMode}`,
        bookReady ? 'issue-viewer__turnjs--ready' : '',
        turning ? 'issue-viewer__turnjs--turning' : '',
        shadowLeft ? 'issue-viewer__turnjs--shadow-left' : '',
        shadowRight ? 'issue-viewer__turnjs--shadow-right' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        '--issue-turnjs-scale': pageScale,
        width: `${Math.round(pageWidth * spreadPageCount)}px`,
        height: `${Math.round(pageHeight)}px`,
      } as CSSProperties}
    />
  );
});
