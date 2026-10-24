import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import type { BreakoutOption, ModuleGroup } from '../catalog/search';
import { CATEGORIES, categoryOf } from '../catalog/categories';
import { ModuleArt } from '../components/art';
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

function VariantPrompt({
  group,
  onPick,
  onCancel,
}: {
  group: ModuleGroup;
  onPick: (b: BreakoutOption) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [choice, setChoice] = useState<string>('');
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    const b = group.breakouts.find((x) => x.id === choice);
    if (b) onPick(b);
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form onSubmit={submit}>
        <h2 id={`${id}-title`}>Which {group.part} board do you have?</h2>
        <p>
          {group.breakouts.length} different boards carry this part. They differ in pins, pull-ups
          or regulators, so the engine needs the exact one. Check the silkscreen of your board.
        </p>
        <fieldset>
          <legend>Board variant</legend>
          {group.breakouts.map((b) => (
            <label key={b.id} className="variant-option">
              <input
                type="radio"
                name={`${id}-variant`}
                value={b.id}
                checked={choice === b.id}
                onChange={() => {
                  setChoice(b.id);
                }}
              />
              <span>
                <strong>{b.name}</strong> <span className="muted">({b.vendor})</span>
                <br />
                Pins: {b.pins.join(', ')} · Interfaces:{' '}
                {b.interfaces.map((k) => INTERFACE_LABELS[k] ?? k).join(', ')}
                {b.names.length > 1 ? (
                  <>
                    <br />
                    <span className="muted">Also sold as: {b.names.slice(1).join('; ')}</span>
                  </>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="actions">
          <button type="submit" disabled={choice === ''}>
            Add this board
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ModulePicker({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState<ModuleGroup | null>(null);
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
  const pick = (g: ModuleGroup) => {
    const a = groupAction(g);
    if (a.kind === 'add') add(a.breakout);
    else setAsking(g);
  };
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    const first = groups[0];
    if (groups.length === 1 && first) pick(first);
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
          {groups.map((g) => {
            const first = g.breakouts[0];
            const name = g.breakouts.length === 1 ? (first?.name ?? g.part) : g.part;
            return (
              <li key={g.ic} className="pick-card">
                <ModuleArt category={categoryOf(g.ic)} name={name} />
                <h3>{name}</h3>
                <p className="muted">
                  {g.breakouts.length === 1
                    ? `${first?.vendor ?? ''} · ${(first?.interfaces ?? []).map((k) => INTERFACE_LABELS[k] ?? k).join(', ')}`
                    : `${g.breakouts.length} board versions`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    pick(g);
                  }}
                >
                  {g.breakouts.length === 1 ? 'Add' : 'Choose variant…'}
                  <span className="visually-hidden"> {g.part}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {asking ? (
        <VariantPrompt
          group={asking}
          onPick={(b) => {
            add(b);
            setAsking(null);
          }}
          onCancel={() => {
            setAsking(null);
          }}
        />
      ) : null}

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
