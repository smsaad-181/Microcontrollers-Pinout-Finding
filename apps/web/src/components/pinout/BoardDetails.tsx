// Board step details: spec chips, then the pinout explorer. Without `project` it is a plain board
// browser (no assignments); mount it where the board is chosen.
import type { BoardViewInput } from '../../catalog/boardView';
import { BOARD_STATUS_META, type BoardOption } from '../../catalog/boards';
import { StatusBadge } from '../common';
import type { LoadedCatalog } from '../../state/AppState';
import { PinoutExplorer } from './PinoutExplorer';
import '../../pinout.css';

export function boardSpecs(
  data: Pick<LoadedCatalog, 'catalog'>,
  board: BoardOption,
  variant: string,
): { name: string; value: string }[] {
  const b = data.catalog.boards.find((x) => `${x.id}@${x.revision}` === board.ref);
  const specs: { name: string; value: string }[] = [];
  if (b) {
    const pins = b.connectors.reduce((n, c) => n + c.pins.length, 0);
    const gpio = b.connectors.reduce(
      (n, c) => n + c.pins.filter((p) => p.kind === 'gpio').length,
      0,
    );
    specs.push(
      { name: 'Header pins', value: String(pins) },
      { name: 'GPIO pins', value: String(gpio) },
    );
    const v = b.logic_voltage.value;
    if (v !== null) specs.push({ name: 'Logic voltage', value: `${String(v)} V` });
  }
  specs.push({ name: 'Chip family', value: board.family });
  const mod = b?.variants.find((x) => x.id === variant)?.module ?? board.module;
  specs.push({ name: 'Module', value: mod });
  return specs;
}

export function BoardDetails({
  board,
  variant,
  data,
  project,
}: {
  board: BoardOption;
  /** Defaults to the variant of `board`. */
  variant?: string | undefined;
  data: LoadedCatalog;
  /** Project state; leave out when browsing boards. */
  project?: BoardViewInput | undefined;
}) {
  const v = variant ?? board.variant;
  const specs = boardSpecs(data, board, v);
  return (
    <section className="board-details" aria-label={`${board.name} pinout`}>
      <ul className="spec-chips" aria-label="Board facts">
        {specs.map((s) => (
          <li key={s.name} className="spec-chip">
            <span className="spec-name">{s.name}</span> <strong>{s.value}</strong>
          </li>
        ))}
        <li className="spec-chip" title={BOARD_STATUS_META[board.status].hint}>
          <span className="spec-name">Status</span> <StatusBadge status={board.status} />
        </li>
      </ul>
      <PinoutExplorer
        catalog={data.catalog}
        cite={data.cite}
        board={board.ref}
        variant={v}
        input={project}
        title={`${board.name} header pins`}
      />
    </section>
  );
}
