// Sidebar tree for the board picker: platform -> company. Display grouping only.
import type { BoardOption } from './boards';

export const platformOf = (b: Pick<BoardOption, 'vendor' | 'family'>): string => {
  if (/^arduino/i.test(b.vendor)) return 'Arduino';
  if (/raspberry/i.test(b.vendor)) return 'Raspberry Pi';
  if (/^esp/i.test(b.family)) return 'ESP (ESP32 / ESP8266)';
  return 'Other';
};

const SHORT: [RegExp, string][] = [
  [/espressif/i, 'Espressif'],
  [/waveshare/i, 'Waveshare'],
  [/doit/i, 'DOIT'],
  [/ai-thinker/i, 'Ai-Thinker'],
  [/lilygo/i, 'LilyGO'],
  [/adafruit/i, 'Adafruit'],
  [/wemos|lolin/i, 'WEMOS / LOLIN'],
  [/arduino/i, 'Arduino'],
  [/raspberry/i, 'Raspberry Pi'],
];

export const shortVendor = (v: string): string => SHORT.find(([re]) => re.test(v))?.[1] ?? v;

export interface PlatformNode {
  name: string;
  count: number;
  vendors: { name: string; label: string; count: number }[];
}

export function platformTree(rows: readonly BoardOption[]): PlatformNode[] {
  const boards = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const p = platformOf(r);
    const m = boards.get(p) ?? new Map<string, Set<string>>();
    const s = m.get(shortVendor(r.vendor)) ?? new Set<string>();
    s.add(`${r.vendor}|${r.name}`);
    m.set(shortVendor(r.vendor), s);
    boards.set(p, m);
  }
  const order = ['ESP (ESP32 / ESP8266)', 'Arduino', 'Raspberry Pi', 'Other'];
  return [...boards.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([name, m]) => ({
      name,
      count: [...m.values()].reduce((n, s) => n + s.size, 0),
      vendors: [...m.entries()]
        .map(([v, s]) => ({ name: v, label: v, count: s.size }))
        .sort((a, b) => (a.label < b.label ? -1 : 1)),
    }));
}
