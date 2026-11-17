import type { LayoutArea } from './types';

/**
 * The custom layout canvas is the printable content area of an A4 page:
 * 178mm wide by roughly 248mm tall after the page margins and meta row.
 * Keeping the gap expressed in millimetres means a horizontal gap and a
 * vertical gap look identical on paper, even though the canvas is not square.
 */
export const CUSTOM_LAYOUT_CANVAS_WIDTH_MM = 178;
export const CUSTOM_LAYOUT_CANVAS_HEIGHT_MM = 248;
export const CUSTOM_LAYOUT_GAP_MM = 4;
export const CUSTOM_LAYOUT_GAP_X_PERCENT = (CUSTOM_LAYOUT_GAP_MM / CUSTOM_LAYOUT_CANVAS_WIDTH_MM) * 100;
export const CUSTOM_LAYOUT_GAP_Y_PERCENT = (CUSTOM_LAYOUT_GAP_MM / CUSTOM_LAYOUT_CANVAS_HEIGHT_MM) * 100;

export function clampLayoutArea(area: LayoutArea): LayoutArea {
  const x = Math.min(100, Math.max(0, area.x));
  const y = Math.min(100, Math.max(0, area.y));
  const width = Math.min(100 - x, Math.max(12, area.width));
  const height = Math.min(100 - y, Math.max(12, area.height));

  return {
    x,
    y,
    width,
    height,
  };
}

export function layoutAreaStyle(area: LayoutArea) {
  return {
    left: `${area.x}%`,
    top: `${area.y}%`,
    width: `${area.width}%`,
    height: `${area.height}%`,
  };
}
