// Module search: MiniSearch over breakout names, IC part numbers, vendors and compact aliases.
// Results are grouped by IC so the UI can ask "which board?" whenever more than one breakout of the
// same part matches (variant prompt). The search never picks a variant on the user's behalf.
import MiniSearch from 'minisearch';
import type { Catalog } from '@pinout/engine';

export interface BreakoutOption {
  id: string;
  /** First sold-under name, used as the display name. */
  name: string;
  names: readonly string[];
  vendor: string;
  ic: string;
  part: string;
  interfaces: readonly string[];
  /** Breakout pin labels, in catalog order (helps tell variants apart). */
  pins: readonly string[];
  notes: string | undefined;
}

export interface ModuleGroup {
  ic: string;
  part: string;
  /** Matching breakouts; more than one means the UI must ask which one. */
  breakouts: BreakoutOption[];
}

interface Doc {
  id: string;
  names: string;
  compact: string;
  part: string;
  vendor: string;
  icVendor: string;
  ic: string;
}

/** Short part name: the text before any parenthetical description. */
export const shortPart = (part: string): string => part.split(' (')[0]?.trim() ?? part;

const compact = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function breakoutOptions(catalog: Catalog): BreakoutOption[] {
  const ics = new Map(catalog.ics.map((i) => [i.id, i]));
  return catalog.breakouts.map((b) => {
    const ic = ics.get(b.ic);
    return {
      id: b.id,
      name: b.variant_names[0] ?? b.id,
      names: b.variant_names,
      vendor: b.vendor,
      ic: b.ic,
      part: shortPart(ic?.part ?? b.ic),
      interfaces: b.interfaces_exposed,
      pins: b.pins.map((p) => p.label),
      notes: b.notes,
    };
  });
}

export interface ModuleSearch {
  search: (query: string) => ModuleGroup[];
  byId: (id: string) => BreakoutOption | undefined;
  all: readonly BreakoutOption[];
}

export function createModuleSearch(catalog: Catalog): ModuleSearch {
  const options = breakoutOptions(catalog);
  const byId = new Map(options.map((o) => [o.id, o]));
  const ics = new Map(catalog.ics.map((i) => [i.id, i]));
  const mini = new MiniSearch<Doc>({
    fields: ['names', 'compact', 'part', 'vendor', 'icVendor', 'ic', 'id'],
    searchOptions: {
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
      boost: { names: 2, part: 2, compact: 1.5 },
    },
  });
  mini.addAll(
    options.map((o) => ({
      id: o.id,
      names: o.names.join(' | '),
      compact: [...o.names, o.part, o.id].map(compact).join(' '),
      part: o.part,
      vendor: o.vendor,
      icVendor: ics.get(o.ic)?.vendor ?? '',
      ic: o.ic,
    })),
  );

  const search = (query: string): ModuleGroup[] => {
    const q = query.trim();
    if (q === '') return [];
    const hits = mini.search(q);
    const groups = new Map<string, ModuleGroup>();
    for (const h of hits) {
      const o = byId.get(String(h.id));
      if (!o) continue;
      const g = groups.get(o.ic) ?? { ic: o.ic, part: o.part, breakouts: [] };
      g.breakouts.push(o);
      groups.set(o.ic, g);
    }
    return [...groups.values()];
  };

  return { search, byId: (id) => byId.get(id), all: options };
}
