import { useId, useState, type SyntheticEvent } from 'react';
import type { BreakoutOption, ModuleGroup } from '../catalog/search';
import { CATEGORIES, categoryOf } from '../catalog/categories';
import { ItemPicture } from '../components/art';
import { INTERFACE_LABELS } from '../results/explain';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';

/** Decides what picking a search group does: add directly, or ask which breakout. */
export function groupAction(
  group: ModuleGroup,
): { kind: 'add'; breakout: BreakoutOption } | { kind: 'ask' } {
  const only = group.breakouts[0];
  return group.breakouts.length === 1 && only !== undefined
    ? { kind: 'add', breakout: only }
    : { kind: 'ask' };
}

function ModulePicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
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
    <>
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

      <section aria-labelledby={`${id}-chosen`} className="card">
        <h2 id={`${id}-chosen`}>Modules in this project ({draft.modules.length})</h2>
        {draft.modules.length === 0 ? (
          <p>No modules yet. Search above to add one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Name in project</th>
                <th scope="col">Module</th>
                <th scope="col">Part</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.modules.map((m) => {
                const b = data.search.byId(m.breakout);
                return (
                  <tr key={m.instance}>
                    <td>
                      <code>{m.instance}</code>
                    </td>
                    <td>{b?.name ?? m.breakout}</td>
                    <td>{b?.part ?? ''}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          dispatch({ type: 'remove-module', instance: m.instance });
                          setAnnounce(`Removed ${m.instance}.`);
                        }}
                      >
                        Remove<span className="visually-hidden"> {m.instance}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="actions">
          <a className="button" href={hrefFor('/constraints')}>
            Next: constraints
          </a>
          <a className="button" href={hrefFor('/results')}>
            Find pins now
          </a>
        </p>
      </section>
    </>
  );
}

export function ModulesScreen({ headingRef }: { headingRef: HeadingRef }) {
  const { draft } = useAppState();
  return (
    <>
      <PageHeading headingRef={headingRef}>Add modules</PageHeading>
      {draft.board === null ? (
        <p className="notice">
          No board chosen yet. <a href={hrefFor('/board')}>Choose a board first</a>; you can still
          add modules now.
        </p>
      ) : null}
      <WithCatalog>{(data) => <ModulePicker data={data} />}</WithCatalog>
    </>
  );
}
