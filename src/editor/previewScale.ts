import type { CSSProperties } from 'react';

/** Shared thumbnail scale for the account/admin project strips. */
export const PREVIEW_PAGE_SCALE = 0.32;

export function createPreviewPageStyle(scale: number = PREVIEW_PAGE_SCALE): CSSProperties {
  return { '--page-scale': scale } as CSSProperties;
}
