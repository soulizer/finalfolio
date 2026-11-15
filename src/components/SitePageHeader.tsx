import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { LanguageToggle } from '../i18n/LanguageToggle';

type SitePageKey = 'home' | 'auth' | 'account' | 'admin' | 'terms' | 'privacy' | 'not-found';

const PAGE_SUBTITLE_BY_KEY: Partial<Record<SitePageKey, string>> = {
  auth: 'Account and access',
  account: 'Self-service workspace',
  admin: 'Product backend',
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  'not-found': 'Page not found',
};

export function SitePageHeader({
  current,
  accountPath = '/account',
  signedIn = false,
  sessionReady = true,
  onSignOut,
  actions = null,
  reveal = false,
  subtitle,
  canAccessAdmin = false,
}: {
  current: SitePageKey;
  accountPath?: string;
  signedIn?: boolean;
  sessionReady?: boolean;
  onSignOut?: (() => void | Promise<void>) | null;
  actions?: ReactNode;
  reveal?: boolean;
  subtitle?: string;
  canAccessAdmin?: boolean;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [canAccessAdmin, current, signedIn]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      if (window.innerWidth > 760) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const nav = (
    <nav className="site-nav site-nav--page" aria-label={t('Site navigation')}>
      <Link to="/" aria-current={current === 'home' ? 'page' : undefined}>
        {t('Home')}
      </Link>
      <Link to={accountPath} aria-current={current === 'auth' || current === 'account' ? 'page' : undefined}>
        {t('Account')}
      </Link>
      {canAccessAdmin ? (
        <Link to="/admin" aria-current={current === 'admin' ? 'page' : undefined}>
          {t('Admin')}
        </Link>
      ) : null}
      <Link to="/terms" aria-current={current === 'terms' ? 'page' : undefined}>
        {t('Terms')}
      </Link>
      <Link to="/privacy" aria-current={current === 'privacy' ? 'page' : undefined}>
        {t('Privacy')}
      </Link>
    </nav>
  );

  const sessionAction = sessionReady
    ? signedIn && onSignOut
      ? (
        <button type="button" className="button button--ghost button--small" onClick={() => void onSignOut()}>
          {t('Sign out')}
        </button>
        )
      : current !== 'auth'
        ? (
          <Link className="button button--ghost button--small" to="/auth">
            {t('Sign in')}
          </Link>
          )
        : null
    : null;

  const editorAction = (
    <Link className="button button--primary button--small" to="/editor">
      {t('Open editor')}
    </Link>
  );

  const menuId = `site-page-header-${current}-menu`;
  const menuToggleClassName = `button button--ghost button--small site-page-header__mobile-toggle ${mobileMenuOpen ? 'is-active' : ''}`.trim();

  if (current === 'home') {
    return (
      <header
        className={`site-header site-page-header site-page-header--home ${mobileMenuOpen ? 'is-menu-open' : ''}`.trim()}
        data-reveal={reveal ? 'true' : undefined}
      >
        <Link to="/" className="site-brand">
          FinalFolio
        </Link>
        <button
          type="button"
          className={menuToggleClassName}
          aria-expanded={mobileMenuOpen}
          aria-controls={menuId}
          onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
        >
          {t('Menu')}
        </button>
        <div
          id={menuId}
          className={`site-page-header__right ${mobileMenuOpen ? 'is-open' : ''}`.trim()}
        >
          {nav}
          <div className="site-page-header__actions">
            {actions}
            <LanguageToggle />
            {sessionAction}
            {editorAction}
          </div>
        </div>
      </header>
    );
  }

  const resolvedSubtitle = subtitle ?? (PAGE_SUBTITLE_BY_KEY[current] ? t(PAGE_SUBTITLE_BY_KEY[current] as string) : '');

  return (
    <header className={`editor-topbar site-page-header site-page-header--editor ${mobileMenuOpen ? 'is-menu-open' : ''}`.trim()}>
      <div className="editor-topbar__brand">
        <Link to="/">FinalFolio</Link>
        {resolvedSubtitle ? <span>{resolvedSubtitle}</span> : null}
      </div>
      <button
        type="button"
        className={menuToggleClassName}
        aria-expanded={mobileMenuOpen}
        aria-controls={menuId}
        onClick={() => setMobileMenuOpen((currentValue) => !currentValue)}
      >
        Menu
      </button>
      <div id={menuId} className={`editor-topbar__actions site-page-header__editor-actions ${mobileMenuOpen ? 'is-open' : ''}`.trim()}>
        {nav}
        {actions}
        <LanguageToggle />
        {sessionAction}
        {editorAction}
      </div>
    </header>
  );
}
