// Filter chips + diagram + pin information for one board variant. Used by the Board step and by
// the Results page (with `input`, the module signals assigned to each pin are shown).
import { useMemo, useState } from 'react';
import type { Catalog } from '@pinout/engine';
import { boardView, type BoardViewInput } from '../../catalog/boardView';
import type { CitationLookup } from '../../catalog/evidence';
import { PinLegend } from '../BoardView';
import { PinGroupFilter } from './PinGroupFilter';
import { PinInfoPanel } from './PinInfoPanel';
import { PinoutDiagram } from './PinoutDiagram';
import { groupCounts, pinoutConnectors, type PinGroup } from './model';
import '../../pinout.css';

const NO_INPUT: BoardViewInput = { reserved: [], connections: [], locked: [] };

export function PinoutExplorer({
  catalog,
  cite,
  board,
  variant,
  input,
  title,
}: {
  catalog: Catalog;
  cite: CitationLookup;
  /** `<id>@<revision>` */
  board: string;
  variant: string;
  /** Project state; omit when browsing a board (no assignments are shown). */
  input?: BoardViewInput | undefined;
  title: string;
}) {
  const connectors = useMemo(() => {
    const view = boardView(catalog, board, variant, input ?? NO_INPUT);
    return view ? pinoutConnectors(catalog, board, variant, view) : null;
  }, [catalog, board, variant, input]);
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReadonlySet<PinGroup>>(new Set());
  if (connectors === null || connectors.length === 0)
    return <p>This board has no header data in the catalog.</p>;
  const pins = connectors.flatMap((c) => c.pins);
  const selected = pins.find((p) => p.key === active) ?? pins[0];
  const counts = groupCounts(pins);
  const moduleId = catalog.boards
    .find((b) => `${b.id}@${b.revision}` === board)
    ?.variants.find((v) => v.id === variant)?.module;
  const chipId = catalog.modules.find((m) => m.id === moduleId)?.chip;
  const chipLabel = catalog.chips.find((c) => c.id === chipId)?.series;
  const hasInput = input !== undefined;

  return (
    <div className="board-view pinout">
      <PinGroupFilter
        counts={counts}
        selected={filter}
        showAssigned={hasInput && counts.assigned > 0}
        onToggle={(g) => {
          setFilter((f) => {
            const next = new Set(f);
            if (next.has(g)) next.delete(g);
            else next.add(g);
            return next;
          });
        }}
        onClear={() => {
          setFilter(new Set());
        }}
      />
      <p className="muted pinout-help">
        Generated from the catalog. Select a pin (click, or Tab to the pins and use the arrow keys,
        Enter or Space) to see its details.
      </p>
      <div className="pinout-layout">
        <PinoutDiagram
          connectors={connectors}
          title={title}
          chipLabel={chipLabel}
          active={selected?.key ?? null}
          onActive={setActive}
          filter={filter}
        />
        <PinInfoPanel pin={selected} cite={cite} />
      </div>
      <details className="pinout-legend">
        <summary>Pin symbols</summary>
        <PinLegend />
      </details>
    </div>
  );
}
