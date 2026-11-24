import type { ReactNode } from 'react';

import { InlineField } from '../../ui/InlineField';

export function AccountInlineField({
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
