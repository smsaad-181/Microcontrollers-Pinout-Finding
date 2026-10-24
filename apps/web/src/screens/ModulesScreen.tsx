import { useId, useState, type SyntheticEvent } from 'react';
import type { BreakoutOption, ModuleGroup } from '../catalog/search';
import { CATEGORIES, categoryOf } from '../catalog/categories';
import { ItemPicture } from '../components/art';
import { Spec, Specs } from '../components/common';
import { Icon } from '../components/icons';
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
  const [part, setPart] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const id = useId();
  const allGroups: ModuleGroup[] = [];
  for (const o of data.search.all) {
    const g = allGroups.find((x) => x.ic === o.ic);
    if (g) g.breakouts.push(o);
    else allGroups.push({ ic: o.ic, part: o.part, breakouts: [o] });
  }
  const found = query.trim() === '' ? allGroups : data.search.search(query);
  const inCat = (g: ModuleGroup, c: string) => c === '' || categoryOf(g.ic) === c;
  const groups = found.filter((g) => inCat(g, cat) && (part === '' || g.ic === part));
  const catCount = (c: string) => found.filter((g) => inCat(g, c)).length;
  const focused = focusId === null ? undefined : data.search.byId(focusId);
  const focusedGroup = focused ? allGroups.find((g) => g.ic === focused.ic) : undefined;

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
      <div className="board-layout tree-layout">
        <nav aria-label="Parts by type" className="board-tree">
          <form role="search" onSubmit={onSubmit} className="search tree-search">
            <label htmlFor={`${id}-q`}>Search modules by part number, name or nickname</label>
            <span className="search-field">
              <span className="big-search-icon">
                <Icon name="search" size={20} />
              </span>
              <input
                id={`${id}-q`}
                type="search"
                value={query}
                autoComplete="off"
                placeholder="e.g. BME280, RC522, relay"
                aria-describedby={`${id}-hint`}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFocusId(null);
                }}
              />
            </span>
            <span id={`${id}-hint`} className="muted">
              Or open a type below. Press Enter to add when exactly one part matches.
            </span>
          </form>
          <ul className="tree-root">
            <li className="tree-cat">
              <button
                type="button"
                className="tree-head"
                aria-expanded={cat === ''}
                onClick={() => {
                  setCat('');
                  setPart('');
                  setFocusId(null);
                }}
              >
                <span className="tree-caret" aria-hidden="true">
                  {cat === '' ? '▾' : '▸'}
                </span>
                All parts <span className="tree-count">{catCount('')}</span>
              </button>
            </li>
            {CATEGORIES.map((c) => {
              const n = catCount(c.id);
              if (n === 0) return null;
              const open = cat === c.id;
              return (
                <li key={c.id} className="tree-cat">
                  <button
                    type="button"
                    className="tree-head"
                    aria-expanded={open}
                    onClick={() => {
                      setCat(open ? '' : c.id);
                      setPart('');
                      setFocusId(null);
                    }}
                  >
                    <span className="tree-caret" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                    {c.label} <span className="tree-count">{n}</span>
                  </button>
                  {open ? (
                    <ul className="tree-sub">
                      {found
                        .filter((g) => inCat(g, c.id))
                        .map((g) => {
                          const pOpen = part === g.ic;
                          return (
                            <li key={g.ic}>
                              <button
                                type="button"
                                className="tree-head tree-brand"
                                aria-expanded={pOpen}
                                onClick={() => {
                                  setPart(pOpen ? '' : g.ic);
                                  setFocusId(null);
                                }}
                              >
                                <span className="tree-caret" aria-hidden="true">
                                  {pOpen ? '▾' : '▸'}
                                </span>
                                {g.part} <span className="tree-count">{g.breakouts.length}</span>
                              </button>
                              {pOpen ? (
                                <ul className="tree-leaves">
                                  {g.breakouts.map((b, i) => (
                                    <li key={b.id}>
                                      <button
                                        type="button"
                                        className="tree-leaf"
                                        aria-current={focusId === b.id ? 'true' : undefined}
                                        onClick={() => {
                                          setFocusId(b.id);
                                        }}
                                      >
                                        {b.name}
                                        {g.breakouts.length > 1
                                          ? ` (${String(b.pins.length)}-pin)`
                                          : ''}
                                        <span className="visually-hidden">
                                          , version {String(i + 1)} of {String(g.breakouts.length)}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="tree-main parts-main">
          <PartsPanel data={data} onAnnounce={setAnnounce} />

          {focused && focusedGroup ? (
            <section className="board-focus" aria-label={`${focused.name} details`}>
              <div className="board-focus-head">
                <div className="board-focus-pic">
                  <ItemPicture
                    id={focused.id}
                    category={categoryOf(focused.ic)}
                    name={focused.name}
                  />
                </div>
                <div>
                  <h2>{focused.name}</h2>
                  <p className="muted maker">
                    {focused.part} · {focused.vendor}
                    {focusedGroup.breakouts.length > 1
                      ? ` · version ${String(focusedGroup.breakouts.indexOf(focused) + 1)} of ${String(focusedGroup.breakouts.length)}`
                      : ''}
                  </p>
                  <Specs>
                    <Spec label="Pins" value={String(focused.pins.length)} />
                    <Spec label="Type" value={CATEGORY_LABEL[categoryOf(focused.ic)] ?? 'Other'} />
                  </Specs>
                  {focused.interfaces.length > 0 ? (
                    <ul className="tags" aria-label="Interfaces">
                      {focused.interfaces.map((k) => (
                        <li key={k} className="chip-tag">
                          {INTERFACE_LABELS[k] ?? k}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <h3 className="small-h">Pins printed on this board</h3>
                  <ul className="tags" aria-label="Pins on this board">
                    {focused.pins.map((p, i) => (
                      <li key={`${p}${String(i)}`} className="chip-tag">
                        {p}
                      </li>
                    ))}
                  </ul>
                  {focused.names.length > 1 ? (
                    <p className="muted">Also sold as: {focused.names.slice(1).join('; ')}</p>
                  ) : null}
                  {focusedGroup.breakouts.length > 1 ? (
                    <p className="muted">
                      Several different boards carry this chip. Pick the one whose pins match the
                      pins printed on yours.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="primary"
                    onClick={() => {
                      add(focused);
                    }}
                  >
                    Add to my project
                    <span className="visually-hidden"> {focused.name}</span>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFocusId(null);
                }}
              >
                Back to the list
              </button>
            </section>
          ) : (
            <>
              <p role="status" className="muted">
                {groups.length} part{groups.length === 1 ? '' : 's'} shown.
              </p>
              <ul className="card-grid" aria-label="Search results">
                {groups.flatMap((g) =>
                  g.breakouts.map((b) => (
                    <li key={b.id} className="pick-card">
                      <ItemPicture id={b.id} category={categoryOf(g.ic)} name={b.name} />
                      <h2>{b.name}</h2>
                      <p className="muted maker">
                        {g.part} · {b.vendor}
                        {g.breakouts.length > 1
                          ? ` · version ${String(g.breakouts.indexOf(b) + 1)} of ${String(g.breakouts.length)}`
                          : ''}
                      </p>
                      <Specs>
                        <Spec label="Pins" value={String(b.pins.length)} />
                        <Spec label="Type" value={CATEGORY_LABEL[categoryOf(g.ic)] ?? 'Other'} />
                      </Specs>
                      {b.interfaces.length > 0 ? (
                        <ul className="tags" aria-label="Interfaces">
                          {b.interfaces.map((k) => (
                            <li key={k} className="chip-tag">
                              {INTERFACE_LABELS[k] ?? k}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="muted pin-names">{b.pins.join(', ')}</p>
                      <button
                        type="button"
                        onClick={() => {
                          add(b);
                        }}
                      >
                        Add
                        <span className="visually-hidden"> {b.name}</span>
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setFocusId(b.id);
                        }}
                      >
                        View details<span className="visually-hidden"> of {b.name}</span>
                      </button>
                    </li>
                  )),
                )}
              </ul>
            </>
          )}
        </div>
      </div>
      <p aria-live="polite" className="visually-hidden">
        {announce}
      </p>
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
