// In-memory catalog input and lookup index. The engine never touches the file system: callers pass a
// Catalog (e.g. the validated entities of the CLI, or the compiled JSON parsed by the web app).
import type { Board, Breakout, Chip, ClaimId, IC, Interface, Module, Status } from '@pinout/schema';

/** Interface kind of an IC or breakout (derived from the schema; the schema exports only the Zod enum). */
export type InterfaceKind = Interface['kind'];

export interface Catalog {
  chips: readonly Chip[];
  modules: readonly Module[];
  boards: readonly Board[];
  ics: readonly IC[];
  breakouts: readonly Breakout[];
}

export interface CatalogIndex {
  catalog: Catalog;
  chip: (id: string) => Chip | undefined;
  module: (id: string) => Module | undefined;
  board: (ref: string) => Board | undefined;
  ic: (id: string) => IC | undefined;
  breakout: (id: string) => Breakout | undefined;
}

export const boardRef = (b: Pick<Board, 'id' | 'revision'>): string => `${b.id}@${b.revision}`;

export function indexCatalog(catalog: Catalog): CatalogIndex {
  const chips = new Map(catalog.chips.map((c) => [c.id, c]));
  const modules = new Map(catalog.modules.map((m) => [m.id, m]));
  const boards = new Map(catalog.boards.map((b) => [boardRef(b), b]));
  const ics = new Map(catalog.ics.map((i) => [i.id, i]));
  const breakouts = new Map(catalog.breakouts.map((b) => [b.id, b]));
  return {
    catalog,
    chip: (id) => chips.get(id),
    module: (id) => modules.get(id),
    board: (ref) => boards.get(ref),
    ic: (id) => ics.get(id),
    breakout: (id) => breakouts.get(id),
  };
}

/** A fact value with its provenance. `value` is null when the fact is missing. */
export interface Prov<T> {
  value: T | null;
  status: Status;
  evidence: ClaimId[];
}

interface FactLike<T> {
  value: T | null;
  status: Status;
  evidence: readonly ClaimId[];
  active?: T;
}

/** Engine view of a fact: a `conflict` fact reads its most restrictive (`active`) reading. */
export function prov<T>(f: FactLike<T>): Prov<T> {
  const value = f.status === 'conflict' ? (f.active ?? f.value) : f.value;
  return {
    value: f.status === 'missing' ? null : value,
    status: f.status,
    evidence: [...f.evidence],
  };
}

const TRUST: readonly Status[] = [
  'verified',
  'single-source',
  'community',
  'interim',
  'conflict',
  'missing',
];

/** The least trustworthy of several statuses (verified when the list is empty). */
export function weakest(statuses: readonly Status[]): Status {
  let worst = 0;
  for (const s of statuses) worst = Math.max(worst, TRUST.indexOf(s));
  return TRUST[worst] ?? 'verified';
}

export const isWeak = (s: Status): boolean => s !== 'verified' && s !== 'single-source';

export const sortedUnique = (ids: readonly string[]): string[] =>
  [...new Set(ids)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
