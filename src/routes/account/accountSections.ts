export type AccountSectionKey = 'overview' | 'projects' | 'uploads' | 'settings' | 'templates' | 'preferences';

export const ACCOUNT_SECTIONS: Array<{ id: AccountSectionKey; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'projects', label: 'My projects' },
  { id: 'uploads', label: 'My uploads' },
  { id: 'settings', label: 'Account settings' },
  { id: 'templates', label: 'My templates' },
  { id: 'preferences', label: 'Preferences' },
];

export function normalizeAccountSection(value: string | null): AccountSectionKey {
  return ACCOUNT_SECTIONS.some((section) => section.id === value) ? (value as AccountSectionKey) : 'overview';
}
