import { useId, useRef, useState } from 'react';
import { BOARD_STATUS_META } from '../catalog/boards';
import { filterCards, type BoardCard } from '../catalog/boardGroups';
import { platformOf, platformTree, shortVendor } from '../catalog/platforms';
import { ItemPicture } from '../components/art';
import { StatusBadge } from '../components/common';
import { Help, Term } from '../components/Help';
import { StepHeader } from '../components/StepHeader';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { WithCatalog, type HeadingRef } from './shared';

function BoardPicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [vendor, setVendor] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const searchRef = useRef<HTMLInputElement>(null);

  const tree = platformTree(data.boards);
  const selected = data.boards.find((b) => b.ref === draft.board && b.variant === draft.variant);
  const activePlatform = platform || (selected ? platformOf(selected) : (tree[0]?.name ?? ''));
  const searching = query.trim() !== '';
  const scope = searching
    ? data.boards
    : data.boards.filter(
        (b) =>
          platformOf(b) === activePlatform && (vendor === '' || shortVendor(b.vendor) === vendor),
      );
  const cards = filterCards(scope, { query, vendor: '', family: '' });
  const where = vendor === '' ? activePlatform : vendor;

  const choose = (c: BoardCard) => {
    const only = c.versions[0];
    if (c.versions.length === 1 && only) {
      dispatch({ type: 'select-board', board: only.ref, variant: only.variant });
      setOpen(null);
    } else {
      setOpen(c.key);
    }
  };
  const isCardSelected = (c: BoardCard) =>
    c.versions.some((v) => v.ref === draft.board && v.variant === draft.variant);

  return (
    <>
      <section className="selected-bar" aria-label="Your board">
        {selected ? (
          <>
            <div className="selected-thumb">
              <ItemPicture
                id={selected.ref.split('@')[0] ?? selected.ref}
                name={selected.name}
                board={{ vendor: selected.vendor, family: selected.family }}
              />
            </div>
            <div className="selected-text">
              <h2>Selected</h2>
              <p>
                <strong>{selected.name}</strong> ({shortVendor(selected.vendor)})
                {selected.name.includes(selected.module) ? '' : ` · ${selected.module}`}{' '}
                <StatusBadge status={selected.status} />
              </p>
              <p className="muted">{BOARD_STATUS_META[selected.status].hint}</p>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                searchRef.current?.focus();
                searchRef.current?.scrollIntoView({ block: 'center' });
              }}
            >
              Change<span className="visually-hidden"> board</span>
            </button>
          </>
        ) : (
          <p className="selected-none">No board picked yet. Choose one from the list below.</p>
        )}
      </section>

      <form
        role="search"
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label htmlFor={`${id}-q`}>Search all boards by name</label>
        <input
          id={`${id}-q`}
          ref={searchRef}
          type="search"
          value={query}
          autoComplete="off"
          placeholder="e.g. DevKit, NodeMCU, Pico, Zero"
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
      </form>

      <div className="board-layout">
        <div>
          <p role="status" className="muted">
            {searching
              ? `${String(cards.length)} boards match your search.`
              : `${String(cards.length)} boards in ${where}.`}
          </p>
          {cards.length === 0 ? <p>No board matches. Clear the search.</p> : null}
          <ul className="card-grid" aria-label="Boards">
            {cards.map((c) => {
              const sel = isCardSelected(c);
              return (
                <li key={c.key} className={`pick-card${sel ? ' is-selected' : ''}`}>
                  <ItemPicture
                    id={c.versions[0]?.ref.split('@')[0] ?? c.key}
                    name={c.name}
                    board={{ vendor: c.vendor, family: c.family }}
                  />
                  <h2>{c.name}</h2>
                  <p className="muted">
                    {shortVendor(c.vendor)} · {c.family}
                  </p>
                  <StatusBadge status={c.status} />
                  <button
                    type="button"
                    aria-pressed={sel}
                    onClick={() => {
                      choose(c);
                    }}
                  >
                    {sel ? 'Selected' : 'Use this board'}
                    <span className="visually-hidden"> {c.name}</span>
                  </button>
                  {open === c.key && c.versions.length > 1 ? (
                    <fieldset>
                      <legend>Which version do you have?</legend>
                      {c.versions.map((v) => (
                        <label key={`${v.ref}|${v.variant}`} className="field-inline">
                          <input
                            type="radio"
                            name={`${id}-${c.key}`}
                            checked={v.ref === draft.board && v.variant === draft.variant}
                            onChange={() => {
                              dispatch({ type: 'select-board', board: v.ref, variant: v.variant });
                            }}
                          />
                          <span>{v.label}</span>
                        </label>
                      ))}
                      <p className="muted">
                        Not sure? Read the text printed on the metal-shielded chip module on your
                        board.
                      </p>
                    </fieldset>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <nav aria-label="Board brands" className="side-nav">
          <ul className="cat-list">
            {tree.map((p) => {
              const on = !searching && p.name === activePlatform;
              return (
                <li key={p.name}>
                  <button
                    type="button"
                    aria-current={on && vendor === ''}
                    onClick={() => {
                      setPlatform(p.name);
                      setVendor('');
                      setQuery('');
                    }}
                  >
                    {p.name} ({p.count})
                  </button>
                  {on && p.vendors.length > 1 ? (
                    <ul className="cat-sub">
                      {p.vendors.map((v) => (
                        <li key={v.name}>
                          <button
                            type="button"
                            aria-current={vendor === v.name}
                            onClick={() => {
                              setVendor(v.name);
                            }}
                          >
                            {v.label} ({v.count})
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}

export function BoardScreen({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <>
      <StepHeader
        headingRef={headingRef}
        step={1}
        title="Choose your board"
        intro="Pick the microcontroller board you own. Everything else depends on it, because every board has different pins."
        help={
          <Help>
            <Term word="Board version">
              Some boards were sold in several versions with different pins or chips. If we show
              more than one, pick the one that matches the text printed on your board or on the
              metal-shielded module.
            </Term>
            <Term word="Boot pins">
              A few pins are read when the board starts up. Wiring the wrong thing to them can stop
              it from booting. You do not need to remember which: the app avoids them for you.
            </Term>
            <Term word="Verified">
              How well the board's pin facts are checked against datasheets. The badge on each card
              tells you.
            </Term>
          </Help>
        }
      />
      <WithCatalog>{(data) => <BoardPicker data={data} />}</WithCatalog>
    </>
  );
}
