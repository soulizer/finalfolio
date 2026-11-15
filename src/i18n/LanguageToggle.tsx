import { useLocale } from './index';

/**
 * Compact language switcher shared by the site header and the editor topbar.
 * Shows the language you would switch *to*, which keeps the control one tap.
 */
export function LanguageToggle({ className = 'button button--ghost button--small' }: { className?: string }) {
  const { locale, setLocale } = useLocale();

  return (
    <button
      type="button"
      className={className}
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
      aria-label={locale === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      {locale === 'zh' ? 'EN' : '中文'}
    </button>
  );
}
