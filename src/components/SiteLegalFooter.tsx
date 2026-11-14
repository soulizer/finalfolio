import { Link } from 'react-router-dom';
import { SITE_CONTACT_EMAIL } from '../legal/contact';

export function SiteLegalFooter() {
  return (
    <footer className="site-legal-footer">
      <div className="site-legal-footer__links">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <a href={`mailto:${SITE_CONTACT_EMAIL}`}>Contact</a>
      </div>
      <p className="site-legal-footer__note">
        Session cookies keep accounts signed in. Uploads are stored on object storage, and shared folio links should be treated as public.
      </p>
    </footer>
  );
}
