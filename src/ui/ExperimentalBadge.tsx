import { useT } from '../i18n';

export function ExperimentalBadge() {
  const t = useT();
  return <span className="experimental-badge">{t('Experimental')}</span>;
}
