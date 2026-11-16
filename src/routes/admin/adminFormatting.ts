export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

import { formatCompactDateTime, formatDateTime } from '../../editor/dateFormat';
import { getActiveLocale } from '../../i18n';

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

export function formatCompactTimestamp(value: string | null | undefined) {
  return formatCompactDateTime(value);
}

export function formatTrendLabel(
  bucket: { label: string; start?: string },
  mode: 'day' | 'hour',
) {
  if (bucket.start) {
    const date = new Date(bucket.start);
    if (!Number.isNaN(date.getTime())) {
      const locale = getActiveLocale() === 'zh' ? 'zh-CN' : 'en-CA';
      return new Intl.DateTimeFormat(
        locale,
        mode === 'hour'
          ? { hour: '2-digit', minute: '2-digit', hour12: false }
          : { month: '2-digit', day: '2-digit' },
      ).format(date);
    }
  }

  return mode === 'hour' ? formatHourLabel(bucket.label) : bucket.label;
}
