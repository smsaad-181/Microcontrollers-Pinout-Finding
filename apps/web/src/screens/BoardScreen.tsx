import { useId, useState } from 'react';
import {
  BOARD_FILTER_LABELS,
  BOARD_STATUS_META,
  filterBoards,
  filterValues,
  type BoardFilterKey,
  type BoardFilters,
} from '../catalog/boards';
import { StatusBadge } from '../components/common';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';

function BoardPicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const [filters, setFilters] = useState<BoardFilters>({});
  const id = useId();
  const rows = filterBoards(data.boards, filters);
  const keys = Object.keys(BOARD_FILTER_LABELS) as BoardFilterKey[];
  const selected = data.boards.find((b) => b.ref === draft.board && b.variant === draft.variant);

  return (
    <>
      <fieldset className="filters">
        <legend>Filter boards</legend>
        {keys.map((k) => (
          <div key={k} className="field">
            <label htmlFor={`${id}-${k}`}>{BOARD_FILTER_LABELS[k]}</label>
            <select
              id={`${id}-${k}`}
              value={filters[k] ?? ''}
              onChange={(e) => {
                setFilters({ ...filters, [k]: e.target.value });
              }}
            >
              <option value="">Any</option>
              {filterValues(data.boards, k).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setFilters({});
          }}
        >
          Clear filters
        </button>
      </fieldset>

      <p role="status" className="muted">
        {rows.length} of {data.boards.length} board variants shown.
      </p>

      <fieldset className="board-list">
        <legend>Board and module variant</legend>
        {rows.length === 0 ? <p>No board matches these filters.</p> : null}
        {rows.map((b) => {
          const value = `${b.ref}|${b.variant}`;
          const checked = b.ref === draft.board && b.variant === draft.variant;
          const disabled = b.status === 'unsupported';
          return (
            <label key={value} className={`board-option${checked ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name={`${id}-board`}
                value={value}
                checked={checked}
                disabled={disabled}
                onChange={() => {
                  dispatch({ type: 'select-board', board: b.ref, variant: b.variant });
                }}
              />
              <span className="board-text">
                <strong>{b.name}</strong> <span className="muted">rev. {b.revision}</span>
                <br />
                {b.vendor} · {b.family} ({b.chip}) · module <code>{b.module}</code> · variant{' '}
                <code>{b.variant}</code>
              </span>
              <StatusBadge status={b.status} />
            </label>
          );
        })}
      </fieldset>

      {selected ? (
        <section className="card" aria-labelledby={`${id}-sel`}>
          <h2 id={`${id}-sel`}>Selected</h2>
          <p>
            {selected.name} rev. {selected.revision}, variant <code>{selected.variant}</code> —{' '}
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
        Pick the exact board revision and the module fitted on it. Variants matter: a different
        module on the same board can use some chip pins internally (for flash or PSRAM).
      </p>
      <WithCatalog>{(data) => <BoardPicker data={data} />}</WithCatalog>
    </>
  );
}
