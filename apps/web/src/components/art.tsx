// Illustrations drawn in code (no photos, no licences). Boards show the real shape class (size, chip
// family, headers); modules show an icon for their kind. They are pictures to recognise things, not
// exact photos: check the silkscreen of your own board.
import type { ReactElement } from 'react';
import { PHOTOS } from '../catalog/images';

const hue = (s: string): number => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};

export function BoardArt({
  name,
  vendor,
  family,
  pins,
}: {
  name: string;
  vendor: string;
  family: string;
  pins?: number;
}): ReactElement {
  const h = hue(vendor);
  const small = /zero|tiny|mini|pico|d1/i.test(name);
  const w = small ? 90 : 150;
  const x0 = (160 - w) / 2;
  const n = small ? 8 : 15;
  const dots = Array.from({ length: n }, (_, i) => x0 + 8 + (i * (w - 16)) / (n - 1));
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label={`Drawing of ${name}`} className="art">
      <rect x={x0} y="8" width={w} height="84" rx="6" fill={`hsl(${h} 45% 30%)`} />
      {dots.map((x) => (
        <g key={x}>
          <circle cx={x} cy="15" r="2.2" fill="#e9c46a" />
          <circle cx={x} cy="85" r="2.2" fill="#e9c46a" />
        </g>
      ))}
      <rect x={x0 + w - 24} y="32" width="20" height="36" fill="#c9ced6" stroke="#6b7280" />
      <text x={x0 + w - 14} y="54" fontSize="6" textAnchor="middle" fill="#111">
        {family.replace('ESP32-', '')}
      </text>
      <rect x={x0 + 8} y="38" width="20" height="24" rx="2" fill="#adb5bd" />
      <text x="80" y="53" fontSize="7" textAnchor="middle" fill="#fff">
        {pins ? `${pins} pins` : ''}
      </text>
    </svg>
  );
}

const ICONS: Record<string, ReactElement> = {
  temperature: (
    <path
      d="M50 20v38a12 12 0 1 0 12 0V20a6 6 0 0 0-12 0z"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  ),
  motion: (
    <path d="M20 60l15-30 15 20 15-35 15 45" fill="none" stroke="currentColor" strokeWidth="4" />
  ),
  distance: (
    <path
      d="M15 50h70M15 40v20M85 40v20M35 40l-8 10 8 10M65 40l8 10-8 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  ),
  display: <path d="M18 25h64v40H18zM38 80h24" fill="none" stroke="currentColor" strokeWidth="4" />,
  rfid: (
    <path
      d="M30 70a30 30 0 0 1 0-40M45 62a18 18 0 0 1 0-24M60 55a6 6 0 0 1 0-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  ),
  relay: (
    <path
      d="M18 30h64v40H18zM30 50h14l8-12 8 24 6-12h8"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  ),
  analog: (
    <path
      d="M15 70a35 35 0 0 1 70 0M50 70l20-26"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  ),
  input: (
    <path
      d="M25 50a25 25 0 1 0 50 0a25 25 0 1 0-50 0z"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
    />
  ),
  other: (
    <path d="M25 25h50v50H25zM40 40h20v20H40z" fill="none" stroke="currentColor" strokeWidth="4" />
  ),
};

export function ModuleArt({ category, name }: { category: string; name: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Icon for ${name}`}
      className="art art-module"
    >
      {ICONS[category] ?? ICONS.other}
    </svg>
  );
}

/** Real photo when one exists (with its credit as the tooltip), otherwise the drawn illustration. */
export function ItemPicture({
  id,
  name,
  category,
  board,
}: {
  id: string;
  name: string;
  category?: string;
  board?: { vendor: string; family: string };
}): ReactElement {
  const photo = PHOTOS[id];
  if (photo) {
    return (
      <img
        className="photo"
        src={photo.src}
        alt={name}
        loading="lazy"
        title={`Photo: ${photo.credit} (${photo.license})`}
      />
    );
  }
  return board ? (
    <BoardArt name={name} vendor={board.vendor} family={board.family} />
  ) : (
    <ModuleArt category={category ?? 'other'} name={name} />
  );
}
