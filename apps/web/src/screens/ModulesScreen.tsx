import { useId, useState, type SyntheticEvent } from 'react';
import type { BreakoutOption, ModuleGroup } from '../catalog/search';
import { CATEGORIES, categoryOf } from '../catalog/categories';
import { ItemPicture } from '../components/art';
import { Help, Term } from '../components/Help';
import { StepHeader } from '../components/StepHeader';
import { INTERFACE_LABELS } from '../results/explain';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { WithCatalog, type HeadingRef } from './shared';

/** Decides what picking a search group does: add directly, or ask which breakout. */
export function groupAction(
  group: ModuleGroup,
): { kind: 'add'; breakout: BreakoutOption } | { kind: 'ask' } {
  const only = group.breakouts[0];
  return group.breakouts.length === 1 && only !== undefined
    ? { kind: 'add', breakout: only }
    : { kind: 'ask' };
}

/** "Your parts (n)": always visible next to the cards, with a remove button for each part. */
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);

function PartsPanel({
  data,
  onAnnounce,
}: {
  data: LoadedCatalog;
  onAnnounce: (text: string) => void;
}) {
  const { draft, dispatch } = useAppState();
  const [open, setOpen] = useState(
    () =>
      typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 56rem)').matches,
  );
  return (
    <details
      className="parts-panel"
      open={open}
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
      }}
    >
      <summary>
        <h2>Your parts ({draft.modules.length})</h2>
      </summary>
      {draft.modules.length === 0 ? (
        <p className="parts-empty">
          No modules yet. Press <strong>Add</strong> on a card and it shows up here.
        </p>
      ) : (
        <ul className="parts-list">
          {draft.modules.map((m) => {
            const b = data.search.byId(m.breakout);
            return (
              <li key={m.instance}>
                <div className="parts-name">
                  <strong>{b?.name ?? m.breakout}</strong>
                  <span className="muted">
                    {b?.part ?? ''} · called <code>{m.instance}</code>
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    dispatch({ type: 'remove-module', instance: m.instance });
                    onAnnounce(`Removed ${m.instance}.`);
                  }}
                >
                  Remove<span className="visually-hidden"> {m.instance}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

function ModulePicker({ data }: { data: LoadedCatalog }) {
  const { dispatch } = useAppState();
  const [query, setQuery] = useState('');
  const [announce, setAnnounce] = useState('');
  const [cat, setCat] = useState('');
  const id = useId();
  const allGroups: ModuleGroup[] = [];
  for (const o of data.search.all) {
    const g = allGroups.find((x) => x.ic === o.ic);
    if (g) g.breakouts.push(o);
    else allGroups.push({ ic: o.ic, part: o.part, breakouts: [o] });
  }
  const found = query.trim() === '' ? allGroups : data.search.search(query);
  const groups = found.filter((g) => cat === '' || categoryOf(g.ic) === cat);
  const catCount = (c: string) => found.filter((g) => c === '' || categoryOf(g.ic) === c).length;

  const add = (b: BreakoutOption) => {
    dispatch({ type: 'add-module', breakout: b.id, base: b.ic });
    setAnnounce(`Added ${b.name}.`);
  };
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    const only = groups.length === 1 ? groups[0] : undefined;
    const b = only?.breakouts.length === 1 ? only.breakouts[0] : undefined;
    if (b) add(b);
  };

  return (
    <div className="parts-layout">
      <div className="parts-main">
        <form role="search" onSubmit={onSubmit} className="search">
          <label htmlFor={`${id}-q`}>
            Search modules by part number, name or nickname (or pick a category)
          </label>
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            autoComplete="off"
            placeholder="e.g. BME280, RC522, relay"
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
          <p id={`${id}-hint`} className="muted">
            Press Enter to add when exactly one part matches.
          </p>
        </form>

        <p role="status" className="muted">
          {groups.length} part{groups.length === 1 ? '' : 's'} shown.
        </p>

        <div className="module-layout">
          <nav aria-label="Module categories">
            <ul className="cat-list">
              {[{ id: '', label: 'All modules' }, ...CATEGORIES].map((c) =>
                c.id === '' || catCount(c.id) > 0 ? (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-current={cat === c.id}
                      onClick={() => {
                        setCat(c.id);
                      }}
                    >
                      {c.label} ({catCount(c.id)})
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </nav>
          <ul className="card-grid" aria-label="Search results">
            {groups.flatMap((g) =>
              g.breakouts.map((b) => (
                <li key={b.id} className="pick-card">
                  <ItemPicture id={b.id} category={categoryOf(g.ic)} name={b.name} />
                  <h2>{b.name}</h2>
                  <p className="muted">
                    {g.part} · {b.vendor}
                    {g.breakouts.length > 1
                      ? ` · version ${String(g.breakouts.indexOf(b) + 1)} of ${String(g.breakouts.length)}`
                      : ''}
                  </p>
                  <p>
                    {String(b.pins.length)} pins: {b.pins.join(', ')}
                  </p>
                  <p className="muted what">{CATEGORY_LABEL[categoryOf(g.ic)] ?? 'Other'}</p>
                  <p className="muted">
                    {b.interfaces.map((k) => INTERFACE_LABELS[k] ?? k).join(', ')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      add(b);
                    }}
                  >
                    Add
                    <span className="visually-hidden"> {b.name}</span>
                  </button>
                </li>
              )),
            )}
          </ul>
        </div>

        <p aria-live="polite" className="visually-hidden">
          {announce}
        </p>
      </div>
      <PartsPanel data={data} onAnnounce={setAnnounce} />
    </div>
  );
}

export function ModulesScreen({ headingRef }: { headingRef: HeadingRef }) {
  const { draft } = useAppState();
  return (
    <>
      <StepHeader
        headingRef={headingRef}
        step={2}
        title="Add parts"
        intro="Add everything you want to connect to your board: sensors, displays, relays, buttons. Parts are also called modules."
        help={
          <Help>
            <Term word="Part or module">
              A small board or component you wire to your main board, like a temperature sensor or a
              screen.
            </Term>
            <Term word="Version 1 of 3">
              The same chip is sold on different small boards, wired in different ways. Pick the one
              whose pins match the pins printed on yours.
            </Term>
            <Term word="I²C">
              A two-wire connection (called SDA and SCL) that many sensors and small displays can
              share.
            </Term>
            <Term word="SPI">
              A faster connection that uses about four wires. Screens and card readers often use it.
            </Term>
            <Term word="UART, 1-Wire, analog, digital">
              Other ways a part talks to the board: serial text, a single data wire, a changing
              voltage, or plain on/off.
            </Term>
          </Help>
        }
      />
      {draft.board === null ? (
        <p className="notice">
          No board chosen yet. <a href={hrefFor('/board')}>Choose a board first</a>; you can still
          add parts now.
        </p>
      ) : null}
      <WithCatalog>{(data) => <ModulePicker data={data} />}</WithCatalog>
    </>
  );
}
