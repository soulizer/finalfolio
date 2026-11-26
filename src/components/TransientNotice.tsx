import { useEffect, useRef } from 'react';
import { useT } from '../i18n';

const DISMISS_DELAY_MS = 3_000;
const DISMISS_EVENTS = ['pointerdown', 'keydown', 'wheel', 'focusin'] as const;

export function TransientNotice({
  message,
  onDismiss,
  label,
}: {
  message: string | null;
  onDismiss: () => void;
  label?: string;
}) {
  const t = useT();
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!message || typeof window === 'undefined') {
      return undefined;
    }

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) {
        return;
      }

      dismissed = true;
      dismissRef.current();
    };

    const timer = window.setTimeout(dismiss, DISMISS_DELAY_MS);

    DISMISS_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, dismiss, true);
    });

    return () => {
      window.clearTimeout(timer);
      DISMISS_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, dismiss, true);
      });
    };
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="admin-notice-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div className="admin-notice cookie-bar message-bar">
        <span className="admin-notice__label">{label ?? t('Notice')}</span>
        <p>{t(message)}</p>
      </div>
    </div>
  );
}
