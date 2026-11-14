const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

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

  return dateTimeFormatter.format(date);
}
