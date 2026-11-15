import { useT } from '../i18n';
export function SiteSkipLink() {
  const t = useT();
  return (
    <a className="skip-link" href="#main-content">
      {t('Skip to content')}</a>
  );
}
