import type { SVGProps } from 'react';

export type IconName =
  | 'archive'
  | 'arrowDown'
  | 'arrowDownToLine'
  | 'arrowUp'
  | 'arrowUpToLine'
  | 'bookmarkPlus'
  | 'chevronDown'
  | 'chevronUp'
  | 'copy'
  | 'download'
  | 'eraser'
  | 'externalLink'
  | 'filePlus'
  | 'image'
  | 'link'
  | 'pencil'
  | 'power'
  | 'refresh'
  | 'redo'
  | 'repeat'
  | 'rotate'
  | 'save'
  | 'sparkles'
  | 'trash'
  | 'undo'
  | 'upload'
  | 'x';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
};

/**
 * One icon language for the whole product.
 *
 * The paths follow the Lucide geometry (ISC) at a 24px grid, 1.75px stroke and
 * round joins. Keeping every glyph here prevents the hand-drawn, mismatched
 * icons that accumulated across the editor and admin screens.
 */
export function Icon({ name, strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {name === 'archive' ? (
        <>
          <rect width="20" height="5" x="2" y="3" rx="1" />
          <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
          <path d="M10 12h4" />
        </>
      ) : null}
      {name === 'arrowDown' ? (
        <>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </>
      ) : null}
      {name === 'arrowDownToLine' ? (
        <>
          <path d="M12 17V3" />
          <path d="m6 11 6 6 6-6" />
          <path d="M19 21H5" />
        </>
      ) : null}
      {name === 'arrowUp' ? (
        <>
          <path d="m5 12 7-7 7 7" />
          <path d="M12 19V5" />
        </>
      ) : null}
      {name === 'arrowUpToLine' ? (
        <>
          <path d="M5 3h14" />
          <path d="m18 13-6-6-6 6" />
          <path d="M12 7v14" />
        </>
      ) : null}
      {name === 'bookmarkPlus' ? (
        <>
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
          <path d="M12 7v6" />
          <path d="M9 10h6" />
        </>
      ) : null}
      {name === 'chevronDown' ? <path d="m6 9 6 6 6-6" /> : null}
      {name === 'chevronUp' ? <path d="m18 15-6-6-6 6" /> : null}
      {name === 'copy' ? (
        <>
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </>
      ) : null}
      {name === 'download' ? (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m7 10 5 5 5-5" />
          <path d="M12 15V3" />
        </>
      ) : null}
      {name === 'eraser' ? (
        <>
          <path d="m7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </>
      ) : null}
      {name === 'externalLink' ? (
        <>
          <path d="M15 3h6v6" />
          <path d="M10 14 21 3" />
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </>
      ) : null}
      {name === 'filePlus' ? (
        <>
          <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M3 15h6" />
          <path d="M6 12v6" />
        </>
      ) : null}
      {name === 'image' ? (
        <>
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
        </>
      ) : null}
      {name === 'link' ? (
        <>
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </>
      ) : null}
      {name === 'pencil' ? (
        <>
          <path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z" />
          <path d="m15 5 4 4" />
        </>
      ) : null}
      {name === 'power' ? (
        <>
          <path d="M12 2v10" />
          <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
        </>
      ) : null}
      {name === 'refresh' ? (
        <>
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </>
      ) : null}
      {name === 'repeat' ? (
        <>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </>
      ) : null}
      {name === 'redo' ? (
        <>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </>
      ) : null}
      {name === 'rotate' ? (
        <>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </>
      ) : null}
      {name === 'save' ? (
        <>
          <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8A2 2 0 0 1 21 8.8V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M17 21v-8H7v8" />
          <path d="M7 3v5h8" />
        </>
      ) : null}
      {name === 'sparkles' ? (
        <>
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          <path d="M5 3v4" />
          <path d="M3 5h4" />
          <path d="M19 17v4" />
          <path d="M17 19h4" />
        </>
      ) : null}
      {name === 'trash' ? (
        <>
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </>
      ) : null}
      {name === 'undo' ? (
        <>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </>
      ) : null}
      {name === 'upload' ? (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="m17 8-5-5-5 5" />
          <path d="M12 3v12" />
        </>
      ) : null}
      {name === 'x' ? (
        <>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </>
      ) : null}
    </svg>
  );
}
