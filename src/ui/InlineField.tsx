import type { ReactNode } from 'react';

type InlineFieldProps = {
  label: string;
  children: ReactNode;
  multiline?: boolean;
  stacked?: boolean;
};

/**
 * Shared labelled control wrapper used by account and admin forms.
 *
 * Kept here so both consoles render the exact same field geometry instead of
 * carrying two near-identical copies that can drift apart.
 */
export function InlineField({
  label,
  children,
  multiline = false,
  stacked = false,
}: InlineFieldProps) {
  return (
    <label
      className={`admin-inline-field ${multiline ? 'admin-inline-field--textarea' : ''} ${stacked ? 'admin-inline-field--stacked' : ''}`.trim()}
    >
      <span className="admin-inline-field__label">{label}</span>
      <div className="admin-inline-field__control">{children}</div>
    </label>
  );
}
