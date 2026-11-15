import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { SiteLegalFooter } from '../components/SiteLegalFooter';
import { SitePageHeader } from '../components/SitePageHeader';

export function NotFoundPage() {
  const t = useT();
  return (
    <div className="site-shell">
      <SitePageHeader current="not-found" sessionReady={false} reveal />
      <main id="main-content" className="site-main">
        <section className="hero hero--compact" data-reveal>
          <div className="hero__copy">
            <p className="eyebrow">{t('Page not found')}</p>
            <h1>{t('This page is not part of the folio.')}</h1>
            <p className="hero__lede">
              {t('The link may be out of date, or the folio may have been unpublished. Saved projects stay available from your account.')}</p>
            <div className="hero__actions">
              <Link to="/" className="button button--primary">
                {t('Back home')}</Link>
              <Link to="/editor" className="button button--ghost">
                {t('Open editor')}</Link>
              <Link to="/account" className="button button--ghost">
                {t('My account')}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteLegalFooter />
    </div>
  );
}
