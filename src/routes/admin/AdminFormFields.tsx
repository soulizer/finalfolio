import type { ReactNode } from 'react';

import { InlineField } from '../../ui/InlineField';

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
    <InlineField label={label} multiline={multiline} stacked={stacked}>
      {children}
    </InlineField>
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
