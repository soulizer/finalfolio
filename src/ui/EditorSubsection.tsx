import { ReactNode, useState } from 'react';

/**
 * Secondary disclosure inside a panel, e.g. "Folio details", "Image corners"
 * or the frame/crop tools under Page content.
 *
 * It is a native <details> on purpose: the site-wide panel collapse listens for
 * [data-panel-toggle] and always collapses the nearest .editor-panel, so a
 * nested section must not use that control. Keeping the native element means
 * the sub-section can never fold the whole panel by accident.
 */
export function EditorSubsection({
  label,
  meta,
  defaultOpen = false,
  open,
  onToggle,
  className = '',
  children,
}: {
  label: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof open === 'boolean';
  const expanded = isControlled ? open : internalOpen;

  return (
    <details
      className={`editor-subsection ${className}`.trim()}
      open={expanded}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (!isControlled) {
          setInternalOpen(next);
        }
        onToggle?.(next);
      }}
    >
      <summary>
        <span className="editor-subsection__label">{label}</span>
        {meta ? <span className="editor-subsection__meta">{meta}</span> : null}
        <svg className="editor-subsection__chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="editor-subsection__body">{children}</div>
    </details>
  );
}
