import { useEffect, useId, useState, type SyntheticEvent } from 'react';
import { headerPads, type HeaderPad } from '../catalog/boards';
import { FRAMEWORK_LABELS, FRAMEWORKS, type Framework } from '../project/draft';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog } from '../state/AppState';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';

export const padText = (p: HeaderPad): string =>
  `${p.pad} · ${p.places.map((x) => `${x.label} (${x.connector} pin ${String(x.position)})`).join(', ')}`;

function LockForm({ data, pads }: { data: LoadedCatalog; pads: HeaderPad[] }) {
  const { draft, dispatch } = useAppState();
  const id = useId();
  const [instance, setInstance] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [pad, setPad] = useState('');
  const breakout = draft.modules.find((m) => m.instance === instance)?.breakout;

  useEffect(() => {
    let live = true;
    setRoles([]);
    setRole('');
    if (breakout === undefined) return;
    // The engine (in the worker) lists the lockable signal roles of this module.
    void data.client.lockRoles(breakout).then(
      (r) => {
        if (live) setRoles(r);
      },
      () => {
        if (live) setRoles([]);
      },
    );
    return () => {
      live = false;
    };
  }, [breakout, data.client]);

  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (instance === '' || role === '' || pad === '') return;
    dispatch({ type: 'add-lock', lock: { instance, role, pad } });
    setRole('');
    setPad('');
  };

  if (draft.modules.length === 0) {
    return (
      <p>
        Add modules first to lock their pins. <a href={hrefFor('/modules')}>Add modules</a>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="lock-form">
      <div className="field">
        <label htmlFor={`${id}-inst`}>Module</label>
        <select
          id={`${id}-inst`}
          value={instance}
          onChange={(e) => {
            setInstance(e.target.value);
          }}
        >
          <option value="">Choose…</option>
          {draft.modules.map((m) => (
            <option key={m.instance} value={m.instance}>
              {m.instance}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-role`}>Signal</label>
        <select
          id={`${id}-role`}
          value={role}
          disabled={roles.length === 0}
          onChange={(e) => {
            setRole(e.target.value);
          }}
        >
          <option value="">Choose…</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-pad`}>Pin</label>
        <select
          id={`${id}-pad`}
          value={pad}
          onChange={(e) => {
            setPad(e.target.value);
          }}
        >
          <option value="">Choose…</option>
          {pads.map((p) => (
            <option key={p.pad} value={p.pad}>
              {padText(p)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={instance === '' || role === '' || pad === ''}>
        Lock pin
      </button>
    </form>
  );
}

function ConstraintsForm({ data }: { data: LoadedCatalog }) {
  const { draft, dispatch } = useAppState();
  const id = useId();
  if (draft.board === null) {
    return (
      <p className="notice">
        Choose a board first: pins depend on it. <a href={hrefFor('/board')}>Choose a board</a>
      </p>
    );
  }
  const pads = headerPads(data.catalog, draft.board);

  return (
    <>
      <section aria-labelledby={`${id}-general`} className="card">
        <h2 id={`${id}-general`}>Project</h2>
        <div className="field-inline">
          <input
            id={`${id}-wifi`}
            type="checkbox"
            checked={draft.wifi}
            onChange={(e) => {
              dispatch({ type: 'set-wifi', wifi: e.target.checked });
            }}
          />
          <label htmlFor={`${id}-wifi`}>
            This project uses Wi-Fi (some ADC channels may become unusable)
          </label>
        </div>
        <div className="field">
          <label htmlFor={`${id}-fw`}>Framework</label>
          <select
            id={`${id}-fw`}
            value={draft.framework ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              dispatch({
                type: 'set-framework',
                framework: (FRAMEWORKS as readonly string[]).includes(v) ? (v as Framework) : null,
              });
            }}
          >
            <option value="">Not set</option>
            {FRAMEWORKS.map((f) => (
              <option key={f} value={f}>
                {FRAMEWORK_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-labelledby={`${id}-locks`} className="card">
        <h2 id={`${id}-locks`}>Locked pins</h2>
        <p className="muted">
          A locked pin is never moved. If it cannot work, the result says why and how to relax it.
        </p>
        <LockForm data={data} pads={pads} />
        {draft.locked.length > 0 ? (
          <ul className="plain-list">
            {draft.locked.map((l) => (
              <li key={`${l.instance}.${l.role}`}>
                <code>
                  {l.instance}.{l.role}
                </code>{' '}
                → <code>{l.pad}</code>{' '}
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'remove-lock', instance: l.instance, role: l.role });
                  }}
                >
                  Unlock
                  <span className="visually-hidden">
                    {' '}
                    {l.instance}.{l.role}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby={`${id}-res`} className="card">
        <h2 id={`${id}-res`}>Reserved pins</h2>
        <p className="muted">Reserved pins are kept free (for wiring you already have).</p>
        <fieldset className="pad-grid">
          <legend>Pins to keep free</legend>
          {pads.map((p) => (
            <label key={p.pad} className="field-inline">
              <input
                type="checkbox"
                checked={draft.reserved.includes(p.pad)}
                onChange={() => {
                  dispatch({ type: 'toggle-reserved', pad: p.pad });
                }}
              />
              <span>{padText(p)}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <p>
        <a className="button" href={hrefFor('/results')}>
          Find pins
        </a>
      </p>
    </>
  );
}

export function ConstraintsScreen({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <>
      <PageHeading headingRef={headingRef}>Constraints</PageHeading>
      <p>All optional. Leave everything as it is to let the engine choose every pin.</p>
      <WithCatalog>{(data) => <ConstraintsForm data={data} />}</WithCatalog>
    </>
  );
}
