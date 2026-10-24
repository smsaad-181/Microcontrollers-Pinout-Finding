import { useEffect, useId, useState, type SyntheticEvent } from 'react';
import { headerPads, type HeaderPad } from '../catalog/boards';
import { boardView } from '../catalog/boardView';
import { BoardView } from '../components/BoardView';
import { Citations } from '../components/common';
import { Help, Term } from '../components/Help';
import { StepHeader } from '../components/StepHeader';
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
import { WithCatalog, type HeadingRef } from './shared';

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
        Add parts first, then you can choose their pins. <a href={hrefFor('/modules')}>Add parts</a>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="lock-form">
      <div className="field">
        <label htmlFor={`${id}-inst`}>Part</label>
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
        <label htmlFor={`${id}-role`}>Wire of that part</label>
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
        <label htmlFor={`${id}-pad`}>Pin on your board</label>
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
        Use this pin
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
      <h2 id={`${id}-rails`}>Voltage rails (power on your board)</h2>
      <p className="muted">
        Your board has power outputs (rails), such as 3.3 V and 5 V. Each part is powered from one
        that suits it. This is information only: there is nothing to set here.
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
      <h2 id={`${id}-conn`}>Pins already wired to something</h2>
      <p className="muted">
        Example: an LED or a jumper you already soldered to a pin. Tell us, and the app keeps that
        pin free.
      </p>
      <form onSubmit={submit} className="lock-form">
        <div className="field">
          <label htmlFor={`${id}-cpad`}>Pin on your board</label>
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
      <label htmlFor={`${id}-len`}>
        Wire length: how long are your wires, in metres? (optional)
      </label>
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
          : 'Example: 0.2 for short jumper wires, 2 for a cable. Long wires can make sensors unreliable, so we warn you. Empty is fine.'}
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

  const nothing =
    draft.locked.length === 0 &&
    draft.reserved.length === 0 &&
    draft.connections.length === 0 &&
    !draft.wifi &&
    draft.wiringLengthM === null &&
    draft.framework === null;

  return (
    <>
      {nothing ? (
        <section className="skip-box" aria-label="You can skip this step">
          <p>
            <strong>You can skip this:</strong> the app picks safe pins for you.
          </p>
          <a className="button big" href={hrefFor('/results')}>
            Get my pins
          </a>
        </section>
      ) : null}

      <section aria-labelledby={`${id}-general`} className="card">
        <h2 id={`${id}-general`}>About your project</h2>
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
        <h2 id={`${id}-locks`}>Use this pin for this part</h2>
        <p className="muted">
          Example: you want the screen's CS wire on GPIO5. We never move a pin you choose. If it
          cannot work, the result says why and how to change it.
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
        <h2 id={`${id}-res`}>Keep these pins free for me</h2>
        <p className="muted">
          Example: GPIO4 already runs a motor you built in, so tick it and nothing else gets it.
        </p>
        <fieldset className="pad-grid">
          <legend>Pins to keep free (tick any)</legend>
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
          <h2 id={`${id}-view`}>Your board's pins</h2>
          <BoardView connectors={view} title="Board headers with your locked and reserved pins" />
        </section>
      ) : null}
    </>
  );
}

export function ConstraintsScreen({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <>
      <StepHeader
        headingRef={headingRef}
        step={3}
        optional
        title="Your rules (optional)"
        intro="Only fill this in if you already have wiring or needs of your own. Otherwise leave everything empty."
        help={
          <Help>
            <Term word="Use this pin for this part (lock a pin)">
              You decide that one wire of a part goes to one exact pin. The app will not move it.
            </Term>
            <Term word="Keep these pins free (reserve a pin)">
              You tell the app not to use some pins, for example because something is already wired
              to them.
            </Term>
            <Term word="Wire length">
              Long wires pick up noise and can make sensors misbehave. Tell us roughly how long
              yours are, in metres, and we warn you if it could be a problem.
            </Term>
            <Term word="Parts that share a connection">
              Many parts can talk over the same two or four wires (I²C or SPI). The app works out
              the sharing for you, so there is nothing to set for it.
            </Term>
            <Term word="Boot pins">
              Pins read while the board starts. The app avoids them unless it has to, and warns you
              when it does.
            </Term>
          </Help>
        }
      />
      <section className="why-rules" aria-labelledby="why-rules-title">
        <h2 id="why-rules-title">Why does this step exist?</h2>
        <p>
          By default the app chooses every pin for you, so most people can skip this step. Your
          project is sometimes not a blank page, though: a wire may already be soldered, a pin may
          be saved for something else, or you may know something the app cannot see. Here you tell
          the app, and it plans around it instead of undoing your work.
        </p>
        <ul className="why-list">
          <li>
            <strong>Already wired something?</strong> Say which part goes on which pin, and the app
            keeps it there and fits everything else around it.
          </li>
          <li>
            <strong>Saving pins for later?</strong> Mark them free and the app will not use them,
            for example for a display you will add next month.
          </li>
          <li>
            <strong>Using Wi-Fi or long wires?</strong> Wi-Fi blocks some analog pins on ESP32
            boards, and long wires can disturb sensors. Tell us, and the answer and warnings take it
            into account.
          </li>
        </ul>
        <p className="muted">
          The app never hides a risk because of your choice: if a pin you fixed is risky, the
          Results page still warns you and says what could go wrong.
        </p>
      </section>
      <WithCatalog>{(data) => <ConstraintsForm data={data} />}</WithCatalog>
    </>
  );
}
