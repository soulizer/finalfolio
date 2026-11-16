import { getActiveLocale } from '../i18n';

const formatters = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter() {
  const locale = getActiveLocale() === 'zh' ? 'zh-CN' : undefined;
  const key = locale ?? 'default';
  const cached = formatters.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  formatters.set(key, formatter);
  return formatter;
}

/**
 * Formats a timestamp consistently across the editor, account and admin surfaces,
 * including the local time zone so "Saved at" is unambiguous.
 */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = 'never') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : fallback;
  }

  return getDateTimeFormatter().format(date);
}

const compactFormatters = new Map<string, Intl.DateTimeFormat>();

/** Compact timestamp for dense list rows: 2026-11-14 22:47. */
export function formatCompactDateTime(value: string | number | Date | null | undefined, fallback = '—') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : fallback;
  }

  const locale = getActiveLocale() === 'zh' ? 'zh-CN' : 'en-CA';
  const key = locale;
  let formatter = compactFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    compactFormatters.set(key, formatter);
  }

  return formatter.format(date);
}
