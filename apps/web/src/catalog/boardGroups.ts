// Board picker cards: one card per physical board (vendor + name); revisions and fitted modules are
// "versions" the user only has to pick when a board really comes in more than one.
import { filterBoards, type BoardOption } from './boards';

export interface BoardVersion {
  ref: string;
  variant: string;
  /** Plain-language label, e.g. "ESP32-WROOM-32E chip module". */
  label: string;
  option: BoardOption;
}

export interface BoardCard {
  key: string;
  name: string;
  vendor: string;
  family: string;
  chip: string;
  status: BoardOption['status'];
  versions: BoardVersion[];
}

const upper = (s: string): string => s.toUpperCase();

export function groupBoards(rows: readonly BoardOption[]): BoardCard[] {
  const cards = new Map<string, BoardCard>();
  const multiRev = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.vendor}|${r.name}`;
    const revs = multiRev.get(key) ?? new Set<string>();
    revs.add(r.revision);
    multiRev.set(key, revs);
  }
  for (const r of rows) {
    const key = `${r.vendor}|${r.name}`;
    const card = cards.get(key) ?? {
      key,
      name: r.name,
      vendor: r.vendor,
      family: r.family,
      chip: r.chip,
      status: r.status,
      versions: [],
    };
    const rev = (multiRev.get(key)?.size ?? 0) > 1 ? `Revision ${r.revision}, ` : '';
    card.versions.push({
      ref: r.ref,
      variant: r.variant,
      label: `${rev}${upper(r.module)} chip module`,
      option: r,
    });
    cards.set(key, card);
  }
  return [...cards.values()];
}

export interface CardFilters {
  query: string;
  vendor: string;
  family: string;
}

const compact = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function filterCards(rows: readonly BoardOption[], f: CardFilters): BoardCard[] {
  const base = filterBoards(rows, { vendor: f.vendor, family: f.family });
  const q = compact(f.query);
  return groupBoards(base).filter(
    (c) => q === '' || compact(`${c.name} ${c.vendor} ${c.family} ${c.chip}`).includes(q),
  );
}

/** Distinct values with counts of boards (cards), sorted by name. */
export function countBy(
  rows: readonly BoardOption[],
  key: 'vendor' | 'family',
): [string, number][] {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const s = seen.get(r[key]) ?? new Set<string>();
    s.add(`${r.vendor}|${r.name}`);
    seen.set(r[key], s);
  }
  return [...seen.entries()]
    .map(([k, s]): [string, number] => [k, s.size])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
