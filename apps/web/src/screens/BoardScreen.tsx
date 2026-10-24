import { useId, useState } from 'react';
import { BOARD_STATUS_META } from '../catalog/boards';
import { filterCards, type BoardCard } from '../catalog/boardGroups';
import { platformOf, platformTree, shortVendor } from '../catalog/platforms';
import { ItemPicture } from '../components/art';
import { StatusBadge } from '../components/common';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';

function BoardPicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('');
  const [vendor, setVendor] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();

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

      {selected ? (
        <section className="card" aria-labelledby={`${id}-sel`}>
          <h2 id={`${id}-sel`}>Selected</h2>
          <p>
            <strong>{selected.name}</strong> ({shortVendor(selected.vendor)}) ·{' '}
            <StatusBadge status={selected.status} />
          </p>
          <p className="muted">{BOARD_STATUS_META[selected.status].hint}</p>
          <p>
            <a className="button" href={hrefFor('/modules')}>
              Next: add modules
            </a>
          </p>
        </section>
      ) : null}
    </>
  );
}

export function BoardScreen({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <>
      <PageHeading headingRef={headingRef}>Choose your board</PageHeading>
      <p>
        Pick the brand in the list on the right (ESP, Arduino, Raspberry Pi), or search by the name
        printed on your board. If a board comes in more than one version, we ask which one you have.
      </p>
      <WithCatalog>{(data) => <BoardPicker data={data} />}</WithCatalog>
    </>
  );
}
