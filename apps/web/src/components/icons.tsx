import type { ReactElement } from 'react';

/** Small line icons, drawn inline (no files, no fonts). Decorative: the text beside them is the label. */
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10',
  board:
    'M7 7h10v10H7zM10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5',
  parts: 'M9 3v4M15 3v4M6.5 7h11v4.5a5.5 5.5 0 0 1-11 0zM12 17v4',
  rules: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  pins: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  shield: 'M12 3 5 6v5.5c0 4.3 2.8 7.6 7 9.5 4.2-1.9 7-5.2 7-9.5V6zM9 12l2.2 2.2L15.5 10',
  doc: 'M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M9.5 12h5M9.5 15.5h5',
  offline: 'M4 9.5a12 12 0 0 1 16 0M7 13a7.5 7.5 0 0 1 10 0M12 17h.01M4 4l16 16',
  folder:
    'M3.5 7.5v10a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 19 8h-7l-2-2.5H5A1.5 1.5 0 0 0 3.5 7z',
  sliders: 'M4 6h16M4 12h16M4 18h16M8 3.5v5M15 9.5v5M10 15.5v5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }): ReactElement {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Logo mark: a chip with pins and one lit pin. Decorative. */
export function LogoMark({ size = 32 }: { size?: number }): ReactElement {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="9" className="logo-bg" />
      <rect x="9" y="9" width="14" height="14" rx="3" className="logo-chip" />
      <path
        d="M12.5 5.5v3.5M16 5.5v3.5M19.5 5.5v3.5M12.5 23v3.5M16 23v3.5M5.5 12.5H9M5.5 16H9M5.5 19.5H9M23 12.5h3.5M23 16h3.5M23 19.5h3.5"
        className="logo-pins"
      />
      <circle cx="16" cy="16" r="2.6" className="logo-dot" />
    </svg>
  );
}
