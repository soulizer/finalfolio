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

/** Converts the server's 12-hour bucket labels to the 24-hour form used in Chinese UI. */
export function formatHourLabel(label: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label.trim());
  if (!match) {
    return label;
  }

  let hour = Number(match[1]) % 12;
  if (/pm/i.test(match[3])) {
    hour += 12;
  }

  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}
