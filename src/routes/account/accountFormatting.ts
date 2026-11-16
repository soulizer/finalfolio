import { formatCompactDateTime, formatDateTime } from '../../editor/dateFormat';

export function formatTimestamp(value: string | null | undefined) {
  return formatDateTime(value);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function formatDimensions(width: number | null, height: number | null) {
  if (!width || !height) {
    return 'unknown';
  }

  return `${width} × ${height}`;
}

export function buildAbsoluteUrl(path: string | null | undefined) {
  if (!path) {
    return '';
  }

  if (typeof window === 'undefined') {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

export function formatCompactTimestamp(value: string | null | undefined) {
  return formatCompactDateTime(value);
}
