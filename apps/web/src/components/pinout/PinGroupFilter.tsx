// "Filter by pin group" chips: toggle buttons with counts. Matching pins stay bright, others dim.
import { GROUP_LABEL, PIN_GROUPS, type PinGroup } from './model';
import '../../pinout.css';

export function PinGroupFilter({
  counts,
  selected,
  onToggle,
  onClear,
  showAssigned,
}: {
  counts: Record<PinGroup, number>;
  selected: ReadonlySet<PinGroup>;
  onToggle: (g: PinGroup) => void;
  onClear: () => void;
  /** The Assigned group only makes sense when a project is shown. */
  showAssigned: boolean;
}) {
  const groups = PIN_GROUPS.filter((g) => g !== 'assigned' || showAssigned);
  return (
    <div className="pg-filter" role="group" aria-label="Filter by pin group">
      <span className="pg-filter-title">Filter by pin group</span>
      {groups.map((g) => {
        const on = selected.has(g);
        return (
          <button
            key={g}
            type="button"
            className={`pg-chip pg-chip-${g}${on ? ' is-on' : ''}`}
            aria-pressed={on}
            disabled={counts[g] === 0}
            onClick={() => {
              onToggle(g);
            }}
          >
            {GROUP_LABEL[g]} <span className="pg-count">{counts[g]}</span>
          </button>
        );
      })}
      {selected.size > 0 ? (
        <button type="button" className="pg-clear" onClick={onClear}>
          Show all pins
        </button>
      ) : null}
    </div>
  );
}
