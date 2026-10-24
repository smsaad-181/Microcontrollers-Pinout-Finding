import { useId, useRef, useState } from 'react';
import { BOARD_STATUS_META, type BoardOption } from '../catalog/boards';
import { filterCards, type BoardCard } from '../catalog/boardGroups';
import { platformOf, platformTree, shortVendor } from '../catalog/platforms';
import { ItemPicture } from '../components/art';
import { BoardDetails } from '../components/pinout/BoardDetails';
import { readBoardIntent } from '../boardIntent';
import { Spec, Specs, StatusBadge } from '../components/common';
import { Icon } from '../components/icons';
import { Help, Term } from '../components/Help';
import { StepHeader } from '../components/StepHeader';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { WithCatalog, type HeadingRef } from './shared';

/** Spec tiles for a board; a value the catalog does not have is simply left out. */
function BoardSpecs({ option }: { option: BoardOption }) {
  return (
    <>
      <Specs>
        {option.pins !== undefined ? <Spec label="Pins" value={String(option.pins)} /> : null}
        {option.logicVoltage !== undefined ? (
          <Spec label="Logic" value={`${String(option.logicVoltage)} V`} />
        ) : null}
        {option.family !== 'unknown' ? <Spec label="Chip family" value={option.family} /> : null}
      </Specs>
      <StatusBadge status={option.status} />
    </>
  );
}

function BoardPicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const [intent] = useState(readBoardIntent);
  const [query, setQuery] = useState(intent.q ?? '');
  const [platform, setPlatform] = useState(() =>
    platformTree(data.boards).some((p) => p.name === intent.platform)
      ? (intent.platform ?? '')
      : '',
  );
  const [vendor, setVendor] = useState('');
  const [focusKey, setFocusKey] = useState<string | null>(null);
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
  const allCards = filterCards(data.boards, { query: '', vendor: '', family: '' });
  const where = vendor === '' ? activePlatform : vendor;
  const focusCard = focusKey === null ? undefined : allCards.find((c) => c.key === focusKey);
  const focusVersion =
    focusCard?.versions.find((v) => v.ref === draft.board && v.variant === draft.variant) ??
    focusCard?.versions[0];
  const detailOption = focusVersion?.option ?? selected;

  const choose = (c: BoardCard) => {
    const only = c.versions[0];
    if (c.versions.length === 1 && only) {
      dispatch({ type: 'select-board', board: only.ref, variant: only.variant });
    } else {
      setFocusKey(c.key);
    }
  };
  const isCardSelected = (c: BoardCard) =>
    c.versions.some((v) => v.ref === draft.board && v.variant === draft.variant);
  const openBoard = (c: BoardCard) => {
    setFocusKey(c.key);
    setQuery('');
  };

  /** Boards of one brand, for the tree leaves. */
  const boardsOf = (platformName: string, vendorLabel: string) =>
    allCards.filter(
      (c) =>
        platformOf({ vendor: c.vendor, family: c.family }) === platformName &&
        shortVendor(c.vendor) === vendorLabel,
    );

  return (
    <>
      <section className={`selected-bar${selected ? ' has-board' : ''}`} aria-label="Your board">
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
              <p className="selected-name">
                <strong>{selected.name}</strong>
              </p>
              <p className="muted">
                {shortVendor(selected.vendor)}
                {selected.name.includes(selected.module) ? '' : ` · ${selected.module}`}
              </p>
              <BoardSpecs option={selected} />
              <p className="muted selected-hint">{BOARD_STATUS_META[selected.status].hint}</p>
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
          <p className="selected-none">
            No board picked yet. Open a group on the left, then choose your board.
          </p>
        )}
      </section>

      <div className="board-layout tree-layout">
        <nav aria-label="Boards by brand" className="board-tree">
          <form
            role="search"
            className="search tree-search"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <label htmlFor={`${id}-q`}>Search all boards by name</label>
            <span className="search-field">
              <span className="big-search-icon">
                <Icon name="search" size={20} />
              </span>
              <input
                id={`${id}-q`}
                ref={searchRef}
                type="search"
                value={query}
                autoComplete="off"
                placeholder="e.g. DevKit, NodeMCU, Pico"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFocusKey(null);
                }}
              />
            </span>
          </form>
          <ul className="tree-root">
            {tree.map((p) => {
              const open = !searching && p.name === activePlatform;
              return (
                <li key={p.name} className="tree-cat">
                  <button
                    type="button"
                    className="tree-head"
                    aria-expanded={open}
                    onClick={() => {
                      setPlatform(p.name);
                      setVendor('');
                      setQuery('');
                      setFocusKey(null);
                    }}
                  >
                    <span className="tree-caret" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                    {p.name} <span className="tree-count">{p.count}</span>
                  </button>
                  {open ? (
                    <ul className="tree-sub">
                      {p.vendors.map((v) => {
                        const vOpen = p.vendors.length === 1 || vendor === v.label;
                        return (
                          <li key={v.name}>
                            <button
                              type="button"
                              className="tree-head tree-brand"
                              aria-expanded={vOpen}
                              onClick={() => {
                                setVendor(vendor === v.label ? '' : v.label);
                                setFocusKey(null);
                              }}
                            >
                              <span className="tree-caret" aria-hidden="true">
                                {vOpen ? '▾' : '▸'}
                              </span>
                              {v.label} <span className="tree-count">{v.count}</span>
                            </button>
                            {vOpen ? (
                              <ul className="tree-leaves">
                                {boardsOf(p.name, v.label).map((c) => (
                                  <li key={c.key}>
                                    <button
                                      type="button"
                                      className="tree-leaf"
                                      aria-current={focusKey === c.key ? 'true' : undefined}
                                      onClick={() => {
                                        openBoard(c);
                                      }}
                                    >
                                      {c.name}
                                      {isCardSelected(c) ? (
                                        <span className="tree-picked">
                                          <span aria-hidden="true"> ✓</span>
                                          <span className="visually-hidden"> (selected)</span>
                                        </span>
                                      ) : null}
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

        <div className="tree-main">
          {focusCard && detailOption ? (
            <section className="board-focus" aria-label={`${focusCard.name} details`}>
              <div className="board-focus-head">
                <div className="board-focus-pic">
                  <ItemPicture
                    id={focusCard.versions[0]?.ref.split('@')[0] ?? focusCard.key}
                    name={focusCard.name}
                    board={{ vendor: focusCard.vendor, family: focusCard.family }}
                  />
                </div>
                <div>
                  <h2>{focusCard.name}</h2>
                  <p className="muted maker">{shortVendor(focusCard.vendor)}</p>
                  <BoardSpecs option={detailOption} />
                  {focusCard.versions.length > 1 ? (
                    <fieldset>
                      <legend>Which version do you have?</legend>
                      {focusCard.versions.map((v) => (
                        <label key={`${v.ref}|${v.variant}`} className="field-inline">
                          <input
                            type="radio"
                            name={`${id}-${focusCard.key}`}
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
                  ) : (
                    <button
                      type="button"
                      className="primary"
                      aria-pressed={isCardSelected(focusCard)}
                      onClick={() => {
                        const v = focusCard.versions[0];
                        if (v) dispatch({ type: 'select-board', board: v.ref, variant: v.variant });
                      }}
                    >
                      {isCardSelected(focusCard) ? 'Selected' : 'Pick this board'}
                      <span className="visually-hidden"> {focusCard.name}</span>
                    </button>
                  )}
                </div>
              </div>
              <BoardDetails board={detailOption} variant={detailOption.variant} data={data} />
            </section>
          ) : (
            <>
              <p role="status" className="muted">
                {searching
                  ? `${String(cards.length)} boards match your search.`
                  : `${String(cards.length)} boards in ${where}. Pick one below, or open it in the list on the left.`}
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
                      <p className="muted maker">{shortVendor(c.vendor)}</p>
                      {c.versions[0] ? <BoardSpecs option={c.versions[0].option} /> : null}
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
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          openBoard(c);
                        }}
                      >
                        View pinout<span className="visually-hidden"> of {c.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {focusCard ? (
            <p>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFocusKey(null);
                }}
              >
                Back to the list
              </button>
            </p>
          ) : null}
        </div>
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
