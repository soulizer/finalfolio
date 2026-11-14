import { Asset, AssetVariant, AssetVariantKind } from './types';

function createOriginalVariant(asset: Asset): AssetVariant {
  return {
    src: asset.src,
    ...(typeof asset.width === 'number' ? { width: asset.width } : {}),
    ...(typeof asset.height === 'number' ? { height: asset.height } : {}),
    ...(typeof asset.bytes === 'number' ? { bytes: asset.bytes } : {}),
    ...(typeof asset.mimeType === 'string' ? { mimeType: asset.mimeType } : {}),
  };
}

export function getAssetVariant(asset: Asset | null | undefined, kind: AssetVariantKind = 'original'): AssetVariant | null {
  if (!asset) {
    return null;
  }

  if (kind === 'original') {
    return asset.variants?.original ?? createOriginalVariant(asset);
  }

  return asset.variants?.[kind] ?? getAssetVariant(asset, 'original');
}

export function getAssetSource(asset: Asset | null | undefined, kind: AssetVariantKind = 'original') {
  return getAssetVariant(asset, kind)?.src ?? asset?.src ?? '';
}
