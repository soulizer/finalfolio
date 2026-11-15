import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getChineseText } from './zh';

export type Locale = 'en' | 'zh';

const LOCALE_STORAGE_KEY = 'finalfolio-locale';

/**
 * Module-level locale backing the standalone translate() helper. React
 * components use useT() so they re-render on locale changes; non-component
 * code (module maps, class components, helpers) calls translate() and reads
 * whatever locale the provider last activated.
 */
let activeLocale: Locale | null = null;

export function getActiveLocale(): Locale {
  return activeLocale ?? readInitialLocale();
}

export function translate(text: string) {
  const locale = activeLocale ?? readInitialLocale();
  return locale === 'zh' ? getChineseText(text) : text;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'en';
  }

  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') {
      return stored;
    }
  } catch {
    // Storage can be unavailable in private modes.
  }

  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * Gettext-style localisation: the English copy is the lookup key, so call sites
 * read naturally and a missing entry simply falls back to the English text.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    activeLocale = locale;
  }, [locale]);

  useEffect(() => {
    activeLocale = locale;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Private browsing may block storage; the in-memory choice still applies.
    }
  }, []);

  const t = useCallback((text: string) => (locale === 'zh' ? getChineseText(text) : text), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider.');
  }

  return context;
}

export function useT() {
  return useLocale().t;
}
