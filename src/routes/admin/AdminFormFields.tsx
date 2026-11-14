import type { ReactNode } from 'react';

export function AdminInlineField({
  label,
  children,
  multiline = false,
  stacked = false,
}: {
  label: string;
  children: ReactNode;
  multiline?: boolean;
  stacked?: boolean;
}) {
  return (
    <label
      className={`admin-inline-field ${multiline ? 'admin-inline-field--textarea' : ''} ${stacked ? 'admin-inline-field--stacked' : ''}`.trim()}
    >
      <span className="admin-inline-field__label">{label}</span>
      <div className="admin-inline-field__control">{children}</div>
    </label>
  );
}

export function AdminToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="admin-toggle admin-toggle--row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
