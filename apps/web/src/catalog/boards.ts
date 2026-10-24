// Board picker data: one row per board revision + variant, with the chip and module behind it.
import type { Catalog } from '@pinout/engine';
import type { BoardStatus } from '@pinout/schema';

export interface BoardOption {
  /** `<board.id>@<revision>`, as the engine expects. */
  ref: string;
  variant: string;
  name: string;
  vendor: string;
  revision: string;
  module: string;
  chip: string;
  family: string;
  status: BoardStatus;
  /** Header pins on the board (aliases of another pin not counted); omitted when it has none. */
  pins?: number;
  /** Logic voltage of the headers in volts; omitted when the catalog has no value. */
  logicVoltage?: number;
}

/** Text and icon per board status: shown together, never colour alone. */
export const BOARD_STATUS_META: Record<BoardStatus, { label: string; icon: string; hint: string }> =
  {
    'fully-verified': {
      label: 'Fully verified',
      icon: '✔',
      hint: 'Every fact the engine uses was checked by two independent reviewers.',
    },
    'partially-verified': {
      label: 'Partially verified',
      icon: '◐',
      hint: 'Some facts are missing, interim or in conflict; results flag each one.',
    },
    'datasheet-required': {
      label: 'Datasheet required',
      icon: '!',
      hint: 'Key facts are missing until a datasheet is supplied; results are limited.',
    },
    unsupported: {
      label: 'Unsupported',
      icon: '✖',
      hint: 'This board cannot be used for pin selection yet.',
    },
  };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Pin count and logic voltage straight from the catalog; a missing value is left out. */
function pinFacts(b: Catalog['boards'][number]): Pick<BoardOption, 'pins' | 'logicVoltage'> {
  const pins = b.connectors.reduce(
    (n, c) => n + c.pins.filter((p) => p.alias_of === undefined).length,
    0,
  );
  const v = b.logic_voltage.value;
  return {
    ...(pins > 0 ? { pins } : {}),
    ...(typeof v === 'number' ? { logicVoltage: v } : {}),
  };
}

/** All board variants, sorted by vendor, name, revision, variant. */
export function boardOptions(catalog: Catalog): BoardOption[] {
  const modules = new Map(catalog.modules.map((m) => [m.id, m]));
  const chips = new Map(catalog.chips.map((c) => [c.id, c]));
  const rows: BoardOption[] = [];
  for (const b of catalog.boards) {
    for (const v of b.variants) {
      const mod = modules.get(v.module);
      const chip = mod ? chips.get(mod.chip) : undefined;
      rows.push({
        ref: `${b.id}@${b.revision}`,
        variant: v.id,
        name: b.name,
        vendor: b.vendor,
        revision: b.revision,
        module: v.module,
        chip: chip?.id ?? mod?.chip ?? 'unknown',
        family: chip?.family ?? 'unknown',
        status: b.status,
        ...pinFacts(b),
      });
    }
  }
  return rows.sort(
    (x, y) =>
      cmp(x.vendor, y.vendor) ||
      cmp(x.name, y.name) ||
      cmp(x.revision, y.revision) ||
      cmp(x.variant, y.variant),
  );
}

export type BoardFilterKey = 'vendor' | 'family' | 'chip' | 'module' | 'revision';
export type BoardFilters = Partial<Record<BoardFilterKey, string>>;

export const BOARD_FILTER_LABELS: Record<BoardFilterKey, string> = {
  vendor: 'Manufacturer',
  family: 'Family',
  chip: 'Chip',
  module: 'Module',
  revision: 'Revision',
};

/** Rows that match every set filter (an empty or missing value matches everything). */
export function filterBoards(rows: readonly BoardOption[], filters: BoardFilters): BoardOption[] {
  return rows.filter((r) =>
    (Object.keys(BOARD_FILTER_LABELS) as BoardFilterKey[]).every((k) => {
      const want = filters[k];
      return want === undefined || want === '' || r[k] === want;
    }),
  );
}

export interface HeaderPad {
  pad: string;
  /** Every header pin wired to this pad, e.g. "IO16 (J3 pin 12)". */
  places: { label: string; connector: string; position: number }[];
}

/**
 * GPIO pads exposed on a board's headers (for lock/reserve pickers), in header order. Display only:
 * whether a pad is usable is decided by the engine.
 */
export function headerPads(catalog: Catalog, ref: string): HeaderPad[] {
  const board = catalog.boards.find((b) => `${b.id}@${b.revision}` === ref);
  if (!board) return [];
  const byPad = new Map<string, HeaderPad>();
  for (const c of board.connectors) {
    for (const p of c.pins) {
      if (p.pad === undefined || p.alias_of !== undefined) continue;
      const entry = byPad.get(p.pad) ?? { pad: p.pad, places: [] };
      entry.places.push({ label: p.label, connector: c.id, position: p.position });
      byPad.set(p.pad, entry);
    }
  }
  return [...byPad.values()];
}

/** Distinct values of one filter field, sorted. */
export function filterValues(rows: readonly BoardOption[], key: BoardFilterKey): string[] {
  return [...new Set(rows.map((r) => r[key]))].sort(cmp);
}
