import { useMemo } from 'react';
import type { PublicIssuePayload } from '../editor/types';
import { buildRenderedViewerPages } from './issueViewReaderState';

type UseIssueViewDocumentStateOptions = {
  issue: PublicIssuePayload | null;
};

export function useIssueViewDocumentState({ issue }: UseIssueViewDocumentStateOptions) {
  const assetsById = useMemo(
    () => Object.fromEntries((issue?.assets ?? []).map((asset) => [asset.id, asset])),
    [issue?.assets],
  );
  const pages = issue?.pages ?? [];
  const renderedPages = useMemo(() => buildRenderedViewerPages(pages), [pages]);

  return {
    assetsById,
    pageCount: renderedPages.length,
    pages,
    renderedPages,
  };
}
