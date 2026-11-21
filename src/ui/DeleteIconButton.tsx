import type { MouseEvent } from 'react';

type DeleteIconButtonProps = {
  /** Accessible name, e.g. "Delete" or "Deleting…". */
  label: string;
  /** Optional tooltip; defaults to the label. */
  title?: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

/**
 * Destructive row action. House rule: delete is a trash icon, never a text
 * button, so lists and cards keep one predictable affordance.
 */
export function DeleteIconButton({ label, title, disabled, onClick, className = '' }: DeleteIconButtonProps) {
  return (
    <button
      type="button"
      className={`button button--danger-ghost button--icon ${className}`.trim()}
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 4.5h11M6 4.5V3.2h4v1.3M4 4.5l.6 8.2h6.8l.6-8.2M6.6 7v3.4M9.4 7v3.4" />
      </svg>
    </button>
  );
}
