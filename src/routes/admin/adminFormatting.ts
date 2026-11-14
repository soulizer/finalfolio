export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

import { formatDateTime } from '../../editor/dateFormat';

export function formatTimestamp(value: string | null | undefined) {
  return formatDateTime(value);
}

export function formatDimensions(width: number | null, height: number | null) {
  if (!width || !height) {
    return 'unknown';
  }

  return `${width} × ${height}`;
}
