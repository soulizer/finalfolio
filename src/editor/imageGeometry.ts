import { Asset, CropSettings } from './types';

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImageRenderGeometry {
  baseWidth: number;
  baseHeight: number;
  scaledWidth: number;
  scaledHeight: number;
  offsetX: number;
  offsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

const MIN_COVER_BLEED_PX = 2;
const COVER_BLEED_RATIO = 0.008;

function getCoverBleedScale(frame: ImageSize, base: ImageSize) {
  const longestEdge = Math.max(frame.width, frame.height, base.width, base.height, 1);
  const bleedRatio = Math.max(COVER_BLEED_RATIO, MIN_COVER_BLEED_PX / longestEdge);
  return 1 + bleedRatio;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isValidSizeValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizeImageSize(size?: Partial<ImageSize> | null): ImageSize | null {
  const width = size?.width;
  const height = size?.height;

  if (!isValidSizeValue(width) || !isValidSizeValue(height)) {
    return null;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

export function resolveAssetIntrinsicSize(asset?: Pick<Asset, 'width' | 'height'> | null, fallback?: Partial<ImageSize> | null) {
  return normalizeImageSize(fallback) ?? normalizeImageSize(asset);
}

export function cropValueToPixelOffset(position: number, maxOffset: number) {
  if (maxOffset <= 0) {
    return 0;
  }

  return ((50 - position) / 50) * maxOffset;
}

export function pixelOffsetToCropValue(offset: number, maxOffset: number) {
  if (maxOffset <= 0) {
    return 50;
  }

  return clamp(50 - (offset / maxOffset) * 50, 0, 100);
}

export function calculateFittedImageSize(frame: ImageSize, intrinsic: ImageSize, fit: CropSettings['fit']) {
  if (!frame.width || !frame.height || !intrinsic.width || !intrinsic.height) {
    return null;
  }

  const frameRatio = frame.width / frame.height;
  const imageRatio = intrinsic.width / intrinsic.height;

  if (fit === 'contain') {
    if (imageRatio > frameRatio) {
      return {
        width: frame.width,
        height: frame.width / imageRatio,
      };
    }

    return {
      width: frame.height * imageRatio,
      height: frame.height,
    };
  }

  if (imageRatio > frameRatio) {
    return {
      width: frame.height * imageRatio,
      height: frame.height,
    };
  }

  return {
    width: frame.width,
    height: frame.width / imageRatio,
  };
}

export function calculateImageRenderGeometry(
  frame: ImageSize,
  intrinsic: ImageSize | null,
  crop?: CropSettings,
): ImageRenderGeometry | null {
  if (!intrinsic || !crop || !frame.width || !frame.height) {
    return null;
  }

  const base = calculateFittedImageSize(frame, intrinsic, crop.fit);
  if (!base) {
    return null;
  }

  // Apply cover bleed as a proportional overscan so preview and export stay
  // compositionally aligned even when the export page size differs from the editor sheet.
  const coverBleedScale = crop.fit === "cover" ? getCoverBleedScale(frame, base) : 1;
  const baseWidth = base.width * coverBleedScale;
  const baseHeight = base.height * coverBleedScale;
  const scaledWidth = baseWidth * crop.scale;
  const scaledHeight = baseHeight * crop.scale;
  const maxOffsetX = Math.max((scaledWidth - frame.width) / 2, 0);
  const maxOffsetY = Math.max((scaledHeight - frame.height) / 2, 0);

  return {
    baseWidth,
    baseHeight,
    scaledWidth,
    scaledHeight,
    maxOffsetX,
    maxOffsetY,
    offsetX: cropValueToPixelOffset(crop.x, maxOffsetX),
    offsetY: cropValueToPixelOffset(crop.y, maxOffsetY),
  };
}
