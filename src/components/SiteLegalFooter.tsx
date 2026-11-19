import { Link } from 'react-router-dom';
import { SITE_CONTACT_EMAIL } from '../legal/contact';
import { useT } from '../i18n';

export function SiteLegalFooter() {
  const t = useT();

  return (
    <footer className="site-legal-footer">
      <div className="site-legal-footer__links">
        <Link to="/terms">{t('Terms')}</Link>
        <Link to="/privacy">{t('Privacy')}</Link>
        <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{t('Contact')}</a>
      </div>
      <p className="site-legal-footer__note">
        {t(
          'Sign-in uses cookies. Photos live in object storage, and a shared link is public — treat it that way.',
        )}
      </p>
    </footer>
  );
}
