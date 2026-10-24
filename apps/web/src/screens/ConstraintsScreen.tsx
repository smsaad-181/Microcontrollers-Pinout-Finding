import { useEffect, useId, useState, type SyntheticEvent } from 'react';
import { headerPads, type HeaderPad } from '../catalog/boards';
import { boardView } from '../catalog/boardView';
import { BoardView } from '../components/BoardView';
import { Citations } from '../components/common';
import {
  FRAMEWORK_LABELS,
  FRAMEWORKS,
  MAX_NOTE_LENGTH,
  MAX_WIRING_LENGTH_M,
  type Framework,
} from '../project/draft';
import { STOP_AFTER_CHOICES } from '../project/settings';
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

const FACT_STATUS_TEXT: Record<string, string> = {
  verified: 'verified',
  'single-source': 'single source',
  interim: 'interim (related source)',
  community: 'community source',
  conflict: 'sources disagree',
  missing: 'not documented',
};

type Voltage = number | { min: number; max: number } | null;
const voltageText = (v: Voltage): string =>
  v === null
    ? 'unknown'
    : typeof v === 'number'
      ? `${String(v)} V`
      : `${String(v.min)}–${String(v.max)} V`;

/** The board's supply rails with their documented voltage and current limit (read-only facts). */
function Rails({ data, boardRef }: { data: LoadedCatalog; boardRef: string }) {
  const id = useId();
  const board = data.catalog.boards.find((b) => `${b.id}@${b.revision}` === boardRef);
  if (!board || board.rails.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-rails`} className="card">
      <h2 id={`${id}-rails`}>Voltage rails</h2>
      <p className="muted">
        The engine powers each module from a rail that fits its supply range and adds up the current
        per rail. These values come from the catalog; check them against your board.
      </p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Voltage rails table (scrolls sideways)"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Rail</th>
              <th scope="col">Voltage</th>
              <th scope="col">Current limit</th>
              <th scope="col">Supplied by</th>
              <th scope="col">Sources</th>
            </tr>
          </thead>
          <tbody>
            {board.rails.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>
                  {voltageText(r.voltage.value)}{' '}
                  <span className="muted">
                    ({FACT_STATUS_TEXT[r.voltage.status] ?? r.voltage.status})
                  </span>
                </td>
                <td>
                  {r.max_current.value === null ? 'unknown' : `${String(r.max_current.value)} mA`}{' '}
                  <span className="muted">
                    ({FACT_STATUS_TEXT[r.max_current.status] ?? r.max_current.status})
                  </span>
                </td>
                <td>{r.source}</td>
                <td>
                  <Citations
                    ids={[...new Set([...r.voltage.evidence, ...r.max_current.evidence])]}
                    cite={data.cite}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Wires already on the board: the pad is kept free, and the note is shown on the header view. */
function Connections({ pads }: { pads: HeaderPad[] }) {
  const { draft, dispatch } = useAppState();
  const id = useId();
  const [pad, setPad] = useState('');
  const [note, setNote] = useState('');
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (pad === '') return;
    dispatch({ type: 'add-connection', connection: { pad, note } });
    setPad('');
    setNote('');
  };
  return (
    <section aria-labelledby={`${id}-conn`} className="card">
      <h2 id={`${id}-conn`}>Existing connections</h2>
      <p className="muted">
        Pins already wired to something (a LED, a jumper, another circuit). The engine keeps them
        free.
      </p>
      <form onSubmit={submit} className="lock-form">
        <div className="field">
          <label htmlFor={`${id}-cpad`}>Pin</label>
          <select
            id={`${id}-cpad`}
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
        <div className="field">
          <label htmlFor={`${id}-cnote`}>What is connected (optional)</label>
          <input
            id={`${id}-cnote`}
            type="text"
            maxLength={MAX_NOTE_LENGTH}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
          />
        </div>
        <button type="submit" disabled={pad === ''}>
          Add connection
        </button>
      </form>
      {draft.connections.length > 0 ? (
        <ul className="plain-list">
          {draft.connections.map((c) => (
            <li key={c.pad}>
              <code>{c.pad}</code>
              {c.note !== '' ? ` — ${c.note}` : ''}{' '}
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'remove-connection', pad: c.pad });
                }}
              >
                Remove<span className="visually-hidden"> connection on {c.pad}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Wire length input: kept as text while typing, applied when it is a valid number. */
function WireLength() {
  const { draft, dispatch } = useAppState();
  const id = useId();
  const [text, setText] = useState(draft.wiringLengthM === null ? '' : String(draft.wiringLengthM));
  const value = text.trim() === '' ? null : Number(text);
  const invalid =
    value !== null && (!Number.isFinite(value) || value <= 0 || value > MAX_WIRING_LENGTH_M);
  return (
    <div className="field">
      <label htmlFor={`${id}-len`}>Typical wire length in metres (optional)</label>
      <input
        id={`${id}-len`}
        type="text"
        inputMode="decimal"
        value={text}
        aria-invalid={invalid}
        aria-describedby={`${id}-len-hint`}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.trim();
          const n = t === '' ? null : Number(t);
          if (n === null || (Number.isFinite(n) && n > 0 && n <= MAX_WIRING_LENGTH_M))
            dispatch({ type: 'set-wiring-length', metres: n });
        }}
      />
      <span id={`${id}-len-hint`} className={invalid ? 'field-error' : 'muted'}>
        {invalid
          ? `Enter a number above 0 and up to ${String(MAX_WIRING_LENGTH_M)}.`
          : 'Used for I²C bus capacitance and long-wire warnings. Empty = engine default.'}
      </span>
    </div>
  );
}

function StopAfter() {
  const { settings, setSettings } = useAppState();
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={`${id}-stop`}>Stop a long search after</label>
      <select
        id={`${id}-stop`}
        value={settings.stopAfterS}
        onChange={(e) => {
          setSettings({ ...settings, stopAfterS: Number(e.target.value) });
        }}
      >
        {STOP_AFTER_CHOICES.map((s) => (
          <option key={s} value={s}>
            {s} seconds
          </option>
        ))}
      </select>
    </div>
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
  const view =
    draft.variant === null
      ? null
      : boardView(data.catalog, draft.board, draft.variant, {
          reserved: draft.reserved,
          connections: draft.connections,
          locked: draft.locked,
        });

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
        <WireLength />
        <StopAfter />
      </section>

      <Rails data={data} boardRef={draft.board} />

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

      <Connections pads={pads} />

      {view !== null ? (
        <section aria-labelledby={`${id}-view`} className="card">
          <h2 id={`${id}-view`}>Header view</h2>
          <BoardView connectors={view} title="Board headers with your locked and reserved pins" />
        </section>
      ) : null}

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
