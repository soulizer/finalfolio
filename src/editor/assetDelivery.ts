import { AssetDelivery } from './types';

const fallbackDelivery: AssetDelivery = {
  state: 'local',
  canRetry: false,
  queuedAt: null,
  lastAttemptAt: null,
  syncedAt: null,
  error: null,
  attempts: 0,
};

export function normalizeAssetDelivery(delivery?: AssetDelivery | null): AssetDelivery {
  return {
    ...fallbackDelivery,
    ...(delivery ?? {}),
  };
}

export function getAssetDeliveryLabel(delivery?: AssetDelivery | null) {
  switch (normalizeAssetDelivery(delivery).state) {
    case 'pending':
      return 'Local';
    case 'remote':
      return 'Mirrored';
    case 'failed':
      return 'Failed';
    default:
      return 'Local';
  }
}

export function getAssetDeliveryTone(delivery?: AssetDelivery | null) {
  switch (normalizeAssetDelivery(delivery).state) {
    case 'pending':
      return 'warning';
    case 'remote':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'warning';
  }
}

export function getAssetDeliveryTooltip(delivery?: AssetDelivery | null) {
  const normalized = normalizeAssetDelivery(delivery);

  switch (normalized.state) {
    case 'pending':
      return 'Local. Remote mirror pending.';
    case 'remote':
      return 'Mirrored';
    case 'failed':
      return normalized.error
        ? `Local. Mirror failed: ${normalized.error}`
        : 'Local. Mirror failed.';
    default:
      return 'Local';
  }
}
