export const CURRENT_TOS_VERSION = '2026-03-28';

export function normalizeTermsLanguage(value) {
  if (typeof value !== 'string') {
    return 'en';
  }

  const nextValue = value.trim().toLowerCase();
  if (nextValue === 'zh' || nextValue === 'zh-cn' || nextValue === 'zh-hans') {
    return 'zh-CN';
  }

  return 'en';
}

export function hasAcceptedCurrentTerms(user) {
  return Boolean(user?.termsAcceptedAt) && user?.termsAcceptedVersion === CURRENT_TOS_VERSION;
}
