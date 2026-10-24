import { useId, useState } from 'react';
import { BOARD_STATUS_META } from '../catalog/boards';
import { countBy, filterCards, type BoardCard } from '../catalog/boardGroups';
import { BoardArt } from '../components/art';
import { StatusBadge } from '../components/common';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';

function BoardPicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const [query, setQuery] = useState('');
  const [vendor, setVendor] = useState('');
  const [family, setFamily] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const cards = filterCards(data.boards, { query, vendor, family });
  const vendors = countBy(data.boards, 'vendor');
  const families = countBy(data.boards, 'family');
  const total = new Set(data.boards.map((b) => `${b.vendor}|${b.name}`)).size;
  const selected = data.boards.find((b) => b.ref === draft.board && b.variant === draft.variant);

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
        <label htmlFor={`${id}-q`}>Search your board by name</label>
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

      <div className="chips" role="group" aria-label="Filter by company">
        <button
          type="button"
          className={`chip${vendor === '' ? ' is-on' : ''}`}
          aria-pressed={vendor === ''}
          onClick={() => {
            setVendor('');
          }}
        >
          All companies ({total})
        </button>
        {vendors.map(([v, n]) => (
          <button
            key={v}
            type="button"
            className={`chip${vendor === v ? ' is-on' : ''}`}
            aria-pressed={vendor === v}
            onClick={() => {
              setVendor(vendor === v ? '' : v);
            }}
          >
            {v} ({n})
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`${id}-fam`}>Chip family</label>
        <select
          id={`${id}-fam`}
          value={family}
          onChange={(e) => {
            setFamily(e.target.value);
          }}
        >
          <option value="">All chip families</option>
          {families.map(([f, n]) => (
            <option key={f} value={f}>
              {f} ({n})
            </option>
          ))}
        </select>
      </div>

      <p role="status" className="muted">
        {cards.length} of {total} boards shown.
      </p>
      {cards.length === 0 ? <p>No board matches. Clear the search or the company filter.</p> : null}

      <ul className="card-grid" aria-label="Boards">
        {cards.map((c) => {
          const sel = isCardSelected(c);
          return (
            <li key={c.key} className={`pick-card${sel ? ' is-selected' : ''}`}>
              <BoardArt name={c.name} vendor={c.vendor} family={c.family} />
              <h2>{c.name}</h2>
              <p className="muted">
                {c.vendor} · {c.family}
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
                    Not sure? Read the text printed on the metal-shielded chip module on your board.
                  </p>
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ul>

      {selected ? (
        <section className="card" aria-labelledby={`${id}-sel`}>
          <h2 id={`${id}-sel`}>Selected</h2>
          <p>
            <strong>{selected.name}</strong> ({selected.vendor}) ·{' '}
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
        Search by the name printed on your board, or pick the company that made it. If a board comes
        in more than one version, we ask which one you have.
      </p>
      <WithCatalog>{(data) => <BoardPicker data={data} />}</WithCatalog>
    </>
  );
}
