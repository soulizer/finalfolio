import type { ReactNode } from 'react';

type AccountInlineFieldProps = {
  label: string;
  children: ReactNode;
  multiline?: boolean;
  stacked?: boolean;
};

export function AccountInlineField({
  label,
  children,
  multiline = false,
  stacked = false,
}: AccountInlineFieldProps) {
  return (
    <label
      className={`admin-inline-field ${multiline ? 'admin-inline-field--textarea' : ''} ${stacked ? 'admin-inline-field--stacked' : ''}`.trim()}
    >
      <span className="admin-inline-field__label">{label}</span>
      <div className="admin-inline-field__control">{children}</div>
    </label>
  );
}
