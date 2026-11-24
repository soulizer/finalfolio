import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useModalFocus } from './useModalFocus';

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type EnqueueConfirm = (options: ConfirmOptions) => Promise<boolean>;

let enqueueConfirm: EnqueueConfirm | null = null;

/**
 * Imperative confirmation used by editor/admin action factories that are not React
 * components. Falls back to the native dialog only when the provider is not mounted
 * (for example in unit-level tests).
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (!enqueueConfirm) {
    const text = options.body ? `${options.title}\n\n${options.body}` : options.title;
    return Promise.resolve(typeof window === 'undefined' ? false : window.confirm(text));
  }

  return enqueueConfirm(options);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const current = queue[0] ?? null;
  useModalFocus(dialogRef, { active: Boolean(current) });

  const enqueue = useCallback<EnqueueConfirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setQueue((existing) => [...existing, { ...options, resolve }]);
      }),
    [],
  );

  useEffect(() => {
    enqueueConfirm = enqueue;
    return () => {
      if (enqueueConfirm === enqueue) {
        enqueueConfirm = null;
      }
    };
  }, [enqueue]);

  const settle = useCallback((value: boolean) => {
    setQueue((existing) => {
      const [first, ...rest] = existing;
      first?.resolve(value);
      return rest;
    });
  }, []);

  useEffect(() => {
    if (!current) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current, settle]);

  return (
    <>
      {children}
      {current ? (
        <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            settle(false);
          }
        }}>
          <div
            ref={dialogRef}
            className="confirm-dialog surface-popover"
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={current.body ? 'confirm-dialog-body' : undefined}
          >
            <p className="eyebrow">{t('Please confirm')}</p>
            <h2 id="confirm-dialog-title">{t(current.title)}</h2>
            {current.body ? <p id="confirm-dialog-body">{t(current.body)}</p> : null}
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => settle(false)}
              >
                {current.cancelLabel ? t(current.cancelLabel) : t('Cancel')}
              </button>
              <button
                type="button"
                className={`button button--small ${current.tone === 'danger' ? 'button--danger' : 'button--primary'}`}
                onClick={() => settle(true)}
              >
                {current.confirmLabel ? t(current.confirmLabel) : t('Continue')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
