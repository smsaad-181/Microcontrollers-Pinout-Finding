import { useEffect, useId, useState } from 'react';
import type { Recommendation, Warning } from '@pinout/schema';
import type { BoardOption } from '../catalog/boards';
import { boardView } from '../catalog/boardView';
import { ItemPicture } from '../components/art';
import { BoardView } from '../components/BoardView';
import { Citations, LevelBadge, StatusBadge } from '../components/common';
import { ProjectActions } from '../components/ProjectActions';
import { toProject } from '../project/draft';
import { resultCsv } from '../results/csv';
import {
  countByLevel,
  describeConflict,
  describePart,
  describeRelaxation,
  headerPosition,
  LEVEL_META,
  sortWarnings,
  wiringRows,
  type NameLookup,
  type WiringRow,
} from '../results/explain';
import {
  groupOf,
  PLAIN_INTERFACE,
  PLAIN_ROLES,
  plainWarning,
  WARNING_GROUPS,
} from '../results/plain';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog, type SolveState } from '../state/AppState';
import type { SolveResponse } from '../worker/api';
import { SLOW_NOTICE_MS } from '../worker/solverClient';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';
import '../results.css';

function Elapsed() {
  const [start] = useState(() => performance.now());
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setMs(performance.now() - start);
    }, 100);
    return () => {
      clearInterval(t);
    };
  }, [start]);
  return <span>{(ms / 1000).toFixed(1)} s</span>;
}

function Progress({
  slow,
  stopAfterMs,
  onCancel,
}: {
  slow: boolean;
  stopAfterMs: number;
  onCancel: () => void;
}) {
  return (
    <section className="card" aria-labelledby="solve-progress">
      <h2 id="solve-progress">Finding pins…</h2>
      <progress aria-label="Solving" />
      <p>
        Elapsed: <Elapsed />
      </p>
      <p role="status">
        {slow
          ? `This is taking longer than the engine's ${String(SLOW_NOTICE_MS / 1000)} s limit. It will stop by itself after ${String(stopAfterMs / 1000)} s (change this under Your rules), or you can stop it now and simplify the project.`
          : 'The engine runs in the background; the page stays usable.'}
      </p>
      <button type="button" onClick={onCancel}>
        {slow ? 'Stop now' : 'Cancel'}
      </button>
    </section>
  );
}

function SolveProblem({ solve, onRetry }: { solve: SolveState; onRetry: () => void }) {
  let text = '';
  if (solve.status === 'cancelled') text = 'You cancelled the search.';
  else if (solve.status === 'timeout')
    text = `The engine did not answer within ${String(solve.afterMs / 1000)} s and was stopped. Try fewer modules, or remove locked pins.`;
  else if (solve.status === 'error') text = `The engine failed: ${solve.message}`;
  return (
    <div className="notice" role="alert">
      <p>{text}</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function Disclaimer() {
  return (
    <section className="card disclaimer" aria-labelledby="disclaimer-h">
      <h2 id="disclaimer-h">Before you wire anything</h2>
      <p>
        This result is computed from catalog facts and published rules. It is not a guarantee: a
        catalog fact can be wrong or incomplete, your board can differ from the documented revision,
        and the engine checks only the rules it knows. You are responsible for your hardware.
      </p>
      <h3>How to verify</h3>
      <ol>
        <li>Compare the board revision and module marking with the ones shown above.</li>
        <li>
          For each pin, open “Why these pins? (sources)” and follow at least one source link to the
          datasheet section quoted.
        </li>
        <li>
          Read every item under “Fix before you wire”, “Check this” and “Good to know”, and apply or
          check the fix.
        </li>
        <li>
          Fit the parts listed under “You also need” (resistors, level shifters) before powering up.
        </li>
        <li>Power the board without modules first, then add one module at a time.</li>
        <li>Measure supply voltages and check that no pin gets hot.</li>
      </ol>
    </section>
  );
}

/* ---------- warnings, in plain words ---------- */

function WarningItem({ w, data }: { w: Warning; data: LoadedCatalog }) {
  const plain = plainWarning(w);
  return (
    <li className={`warning warning-${w.level} r-warning`}>
      <p className="r-warning-what">
        <LevelBadge level={w.level} /> <span>{plain ? plain.what : w.message.split('; ')[0]}</span>
      </p>
      {plain ? (
        <p className="r-warning-todo">
          <strong>What to do:</strong> {plain.todo}
        </p>
      ) : null}
      {w.pads.length > 0 ? <p className="muted">Pins: {w.pads.join(', ')}</p> : null}
      <p className="muted r-code">
        Code: <code>{w.code}</code>
        <span className="visually-hidden"> — {LEVEL_META[w.level].hint}</span>
      </p>
      <details className="r-tech">
        <summary>Technical detail</summary>
        <ul className="message-parts">
          {w.message.split('; ').map((part, j) => (
            <li key={j}>{part}</li>
          ))}
        </ul>
        <Citations ids={w.evidence} cite={data.cite} />
      </details>
    </li>
  );
}

function Warnings({ rec, data }: { rec: Recommendation; data: LoadedCatalog }) {
  const id = useId();
  const sorted = sortWarnings(rec.warnings);
  return (
    <section aria-labelledby={`${id}-w`} id="warnings">
      <h2 id={`${id}-w`}>What to watch out for</h2>
      {sorted.length === 0 ? <p>Nothing to watch out for. The engine raised no warnings.</p> : null}
      {WARNING_GROUPS.map((g) => {
        const items = sorted.filter((w) => groupOf(w.level) === g.id);
        if (items.length === 0) return null;
        return (
          <div key={g.id} className={`r-group r-group-${g.id}`}>
            <h3>
              <span aria-hidden="true">{g.icon} </span>
              {g.title} ({items.length})
            </h3>
            <p className="muted">{g.hint}</p>
            <ul className="warnings">
              {items.map((w, i) => (
                <WarningItem key={`${w.code}-${String(i)}`} w={w} data={data} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/* ---------- wiring guide ---------- */

interface ModuleCardData {
  instance: string;
  breakout: string | null;
  name: string;
  rows: WiringRow[];
  powerPins: string[];
  groundPins: string[];
  parts: string[];
}

function moduleCards(
  rows: WiringRow[],
  modules: { instance: string; breakout: string }[],
  data: LoadedCatalog,
): ModuleCardData[] {
  const breakouts = new Map(data.catalog.breakouts.map((b) => [b.id, b]));
  return modules.map((m) => {
    const mine = rows.filter((r) => r.instance === m.instance);
    const b = breakouts.get(m.breakout);
    const tokens = (t: string) => t.split('/').map((x) => x.trim().toUpperCase());
    const pins = (kind: string) =>
      (b?.pins ?? []).filter((p) => tokens(p.maps_to).includes(kind)).map((p) => p.label);
    const parts = new Set<string>();
    for (const r of mine) {
      for (const p of r.parts) {
        const pad = p.pads && p.pads.length > 0 ? ` (on ${r.boardLabel})` : '';
        parts.add(`${String(p.count)} × ${describePart(p)}${pad}`);
      }
    }
    return {
      instance: m.instance,
      breakout: m.breakout,
      name: data.search.byId(m.breakout)?.name ?? m.breakout,
      rows: mine,
      powerPins: pins('VCC'),
      groundPins: pins('GND'),
      parts: [...parts],
    };
  });
}

function copyText(card: ModuleCardData): string {
  const lines = [`${card.name} (${card.instance})`];
  for (const r of card.rows)
    lines.push(
      `${r.modulePin ?? r.role} -> ${r.boardLabel} (header ${r.connector}, pin ${String(r.position)}, GPIO${String(r.gpio)})`,
    );
  for (const p of card.powerPins)
    lines.push(`${p} -> a power pin on the board (see the note on the card)`);
  for (const g of card.groundPins) lines.push(`${g} -> GND`);
  if (card.parts.length > 0) lines.push(`You also need: ${card.parts.join('; ')}`);
  return lines.join('\n');
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState('');
  const onClick = () => {
    const clip = (navigator as Partial<Navigator>).clipboard;
    if (clip?.writeText === undefined) {
      setState('Copy not available here');
      return;
    }
    clip.writeText(text).then(
      () => {
        setState('Copied');
      },
      () => {
        setState('Copy failed');
      },
    );
  };
  return (
    <span className="no-print">
      <button type="button" onClick={onClick}>
        Copy wiring
      </button>{' '}
      <span role="status" className="muted">
        {state}
      </span>
    </span>
  );
}

function ModuleCard({ card, headingId }: { card: ModuleCardData; headingId: string }) {
  return (
    <li className="r-module">
      <div className="r-module-head">
        <div className="r-module-pic">
          {card.breakout !== null ? <ItemPicture id={card.breakout} name={card.name} /> : null}
        </div>
        <div>
          <h3 id={headingId}>{card.name}</h3>
          <p className="muted">
            Name in this project: <code>{card.instance}</code>
          </p>
        </div>
      </div>
      <p className="r-list-head">Module pin → Board pin</p>
      <ul className="r-wires" aria-labelledby={headingId}>
        {card.rows.map((r) => (
          <li key={r.role}>
            <span className="r-from">{r.modulePin ?? r.role}</span>
            <span className="r-arrow" aria-label="goes to">
              →
            </span>
            <span className="r-to">{r.boardLabel}</span>
            <span className="r-where">
              (header {r.connector}, pin {r.position})
              {PLAIN_ROLES[r.role.toUpperCase()]
                ? ` · ${PLAIN_ROLES[r.role.toUpperCase()] ?? ''}`
                : ''}
            </span>
          </li>
        ))}
        {card.powerPins.map((p) => (
          <li key={`v-${p}`} className="r-power">
            <span className="r-from">{p}</span>
            <span className="r-arrow" aria-label="goes to">
              →
            </span>
            <span className="r-to">3V3 or 5V pin</span>
            <span className="r-where">(power: use the voltage printed on the module)</span>
          </li>
        ))}
        {card.groundPins.map((p) => (
          <li key={`g-${p}`} className="r-power">
            <span className="r-from">{p}</span>
            <span className="r-arrow" aria-label="goes to">
              →
            </span>
            <span className="r-to">GND</span>
            <span className="r-where">(any GND pin on the board)</span>
          </li>
        ))}
      </ul>
      {card.parts.length > 0 ? (
        <p className="r-need">
          <span aria-hidden="true">🔧 </span>
          <strong>You also need:</strong> {card.parts.join('; ')}
        </p>
      ) : null}
      <CopyButton text={copyText(card)} />
    </li>
  );
}

function WiringGuide({
  rec,
  response,
  data,
}: {
  rec: Recommendation;
  response: SolveResponse;
  data: LoadedCatalog;
}) {
  const id = useId();
  const { draft } = useAppState();
  const rows = wiringRows(rec, response.pinLabels);
  const cards = moduleCards(rows, draft.modules, data).filter((c) => c.rows.length > 0);
  const loose = rec.required_parts.filter((p) => p.pads === undefined || p.pads.length === 0);
  return (
    <section aria-labelledby={`${id}-wire`}>
      <h2 id={`${id}-wire`}>Wiring guide</h2>
      <p>
        Wire one module at a time. Each line reads “pin on the module → pin on the board”. The board
        pin name is the one printed on your board; the header and pin number tell you where to find
        it.
      </p>
      <ul className="r-modules">
        {cards.map((c) => (
          <ModuleCard key={c.instance} card={c} headingId={`${id}-m-${c.instance}`} />
        ))}
      </ul>
      {loose.length > 0 ? (
        <p className="r-need">
          <span aria-hidden="true">🔧 </span>
          <strong>You also need (for the whole project):</strong>{' '}
          {loose.map((p) => `${String(p.count)} × ${describePart(p)}`).join('; ')}
        </p>
      ) : null}
      <p className="muted">
        Connect every module GND to a board GND pin. Power each module from a supply within its
        rated voltage; “Power budget” under Technical details shows what the engine counted.
      </p>
    </section>
  );
}

/* ---------- technical sections ---------- */

function FullPinTable({ rec }: { rec: Recommendation }) {
  return (
    <details className="r-fold">
      <summary>Full pin table</summary>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Pin allocation table (scrolls sideways)"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Signal</th>
              <th scope="col">Chip GPIO</th>
              <th scope="col">Board label</th>
              <th scope="col">Header position</th>
              <th scope="col">Routing</th>
            </tr>
          </thead>
          <tbody>
            {rec.assignments.map((a) => (
              <tr key={`${a.instance}.${a.role}`}>
                <td>
                  <code>{a.instance}</code>
                </td>
                <td>{a.role}</td>
                <td>
                  GPIO{a.gpio} <span className="muted">({a.pad})</span>
                </td>
                <td>{a.label}</td>
                <td>{headerPosition(a.connector, a.position)}</td>
                <td>
                  {a.peripheral_instance ? `${a.peripheral_instance}, ` : ''}
                  {a.routing}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function WhyPins({ rec, data }: { rec: Recommendation; data: LoadedCatalog }) {
  return (
    <details className="r-fold">
      <summary>Why these pins? (sources)</summary>
      <p className="muted">
        For each pin: the rules the engine applied, the pins it ranked lower, and the datasheet
        passages it relied on.
      </p>
      {rec.assignments.map((a) => (
        <details key={`${a.instance}.${a.role}`} className="why">
          <summary>
            <code>
              {a.instance}.{a.role}
            </code>{' '}
            → GPIO{a.gpio} ({a.label}, {headerPosition(a.connector, a.position)})
          </summary>
          <h4 className="small-h">Rule trace</h4>
          <ul>
            {a.trace.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          {a.alternatives.length > 0 ? (
            <>
              <h4 className="small-h">Alternatives (ranked lower)</h4>
              <ul>
                {a.alternatives.map((alt) => (
                  <li key={alt.pad}>
                    {alt.pad} — tier {alt.lower_tier}: {alt.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <Citations ids={a.evidence} cite={data.cite} summary="Sources for this pin" />
        </details>
      ))}
    </details>
  );
}

function TechnicalDetails({ response }: { response: SolveResponse }) {
  const { outcome, elapsedMs } = response;
  const rec = outcome.recommendation;
  return (
    <details className="r-fold">
      <summary>Technical details</summary>
      <dl className="facts summary">
        <div className="facts-row">
          <dt>Catalog</dt>
          <dd>
            <code>{rec.catalog_version}</code> (SHA-256{' '}
            <code>{rec.catalog_sha256.slice(0, 12)}…</code>)
          </dd>
        </div>
        <div className="facts-row">
          <dt>Rule set</dt>
          <dd>
            <code>{rec.ruleset_version}</code>
          </dd>
        </div>
        <div className="facts-row">
          <dt>Solve time</dt>
          <dd>
            {Math.round(elapsedMs)} ms, {outcome.stats.nodes} search nodes
          </dd>
        </div>
      </dl>
      {rec.status === 'ok' ? (
        <>
          <h4 className="small-h">Interfaces (how each module talks to the board)</h4>
          <table>
            <thead>
              <tr>
                <th scope="col">Module</th>
                <th scope="col">Interface</th>
                <th scope="col">Decided by</th>
                <th scope="col">Other options</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rec.interfaces).map(([inst, i]) => (
                <tr key={inst}>
                  <td>
                    <code>{inst}</code>
                  </td>
                  <td>{PLAIN_INTERFACE[i.kind] ?? i.kind}</td>
                  <td>Interface rule {i.decided_by_rule}</td>
                  <td>
                    {i.alternatives.length === 0
                      ? 'none'
                      : i.alternatives.map((k) => PLAIN_INTERFACE[k] ?? k).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rec.budgets.length > 0 ? (
            <>
              <h4 className="small-h">Power budget (current each power pin must supply)</h4>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Rail</th>
                    <th scope="col">Demand</th>
                    <th scope="col">Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {rec.budgets.map((b) => (
                    <tr key={b.rail}>
                      <td>{b.rail}</td>
                      <td>{b.demand_ma} mA</td>
                      <td>
                        {b.limit_ma === null
                          ? 'unknown (not documented)'
                          : `${String(b.limit_ma)} mA`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      ) : null}
    </details>
  );
}

/* ---------- banner ---------- */

function BoardStrip({
  board,
  boardText,
  modules,
}: {
  board: BoardOption | undefined;
  boardText: string;
  modules: number;
}) {
  return (
    <div className="r-board">
      <div className="r-board-pic">
        {board ? (
          <ItemPicture
            id={board.ref.split('@')[0] ?? board.ref}
            name={board.name}
            board={{ vendor: board.vendor, family: board.family }}
          />
        ) : null}
      </div>
      <div>
        <p className="r-board-name">
          {board?.name ?? boardText} {board ? <StatusBadge status={board.status} /> : null}
        </p>
        <p className="muted">
          {board
            ? `rev. ${board.revision}, variant ${board.variant} (module ${board.module}) · `
            : ''}
          {modules} {modules === 1 ? 'module' : 'modules'}
        </p>
      </div>
    </div>
  );
}

function OkBanner({
  rec,
  board,
  boardText,
  modules,
}: {
  rec: Recommendation;
  board: BoardOption | undefined;
  boardText: string;
  modules: number;
}) {
  const counts = countByLevel(rec.warnings);
  return (
    <section
      className={`r-banner ${counts.critical > 0 ? 'r-banner-warn' : 'r-banner-ok'}`}
      aria-labelledby="r-banner-h"
    >
      <p className="r-kicker">
        <span aria-hidden="true">{counts.critical > 0 ? '⛔' : '✔'} </span>
        Pins assigned
      </p>
      <h2 id="r-banner-h">Your pins are ready</h2>
      <p className="r-lead">
        {rec.assignments.length} wires to connect. Follow the wiring guide below, one module at a
        time.
      </p>
      {counts.critical > 0 ? (
        <p className="r-alert">
          <span aria-hidden="true">⛔ </span>
          <strong>
            {counts.critical} {counts.critical === 1 ? 'item needs' : 'items need'} fixing first.
          </strong>{' '}
          <a href="#warnings">See “Fix before you wire”</a>
        </p>
      ) : counts.warning > 0 ? (
        <p className="r-alert">
          <span aria-hidden="true">▲ </span>
          {counts.warning} {counts.warning === 1 ? 'thing' : 'things'} to check.{' '}
          <a href="#warnings">See “Check this”</a>
        </p>
      ) : null}
      <BoardStrip board={board} boardText={boardText} modules={modules} />
    </section>
  );
}

function UnsatResult({
  rec,
  data,
  board,
  boardText,
  modules,
}: {
  rec: Recommendation;
  data: LoadedCatalog;
  board: BoardOption | undefined;
  boardText: string;
  modules: number;
}) {
  const names: NameLookup = { breakout: (b) => data.search.byId(b)?.name };
  const u = rec.unsat;
  const conflict = u?.minimal_conflict ?? [];
  return (
    <>
      <section className="r-banner r-banner-bad" aria-labelledby="r-banner-h">
        <p className="r-kicker">
          <span aria-hidden="true">✖ </span>No safe assignment
        </p>
        <h2 id="r-banner-h">No safe way to connect all of this</h2>
        <p className="r-lead">
          The engine proved that these requirements cannot all be met on this board at once.
        </p>
        <ul>
          {conflict.map((t) => (
            <li key={t}>
              {describeConflict(t, names)} <code className="claim-id">{t}</code>
            </li>
          ))}
        </ul>
        <h3>Ways to fix it (best first)</h3>
        {u && u.relaxations.length > 0 ? (
          <ol className="r-fixes">
            {u.relaxations.map((t) => (
              <li key={t}>
                {describeRelaxation(t, names)} <code className="claim-id">{t}</code>
              </li>
            ))}
          </ol>
        ) : (
          <p>The engine found no single change that fixes this. Try another board.</p>
        )}
        <p className="muted">Each suggested fix was checked by solving the project again.</p>
        <p className="actions">
          <a className="button-link" href={hrefFor('/constraints')}>
            Change constraints
          </a>
          <a className="button-link" href={hrefFor('/modules')}>
            Change modules
          </a>
          <a className="button-link" href={hrefFor('/board')}>
            Change board
          </a>
        </p>
        <BoardStrip board={board} boardText={boardText} modules={modules} />
      </section>
      {rec.warnings.length > 0 ? <Warnings rec={rec} data={data} /> : null}
    </>
  );
}

function OkResult({
  response,
  data,
  board,
  boardText,
}: {
  response: SolveResponse;
  data: LoadedCatalog;
  board: BoardOption | undefined;
  boardText: string;
}) {
  const id = useId();
  const rec = response.outcome.recommendation;
  const { draft } = useAppState();
  const view =
    draft.board === null || draft.variant === null
      ? null
      : boardView(data.catalog, draft.board, draft.variant, {
          reserved: draft.reserved,
          connections: draft.connections,
          locked: draft.locked,
          rec,
        });
  return (
    <>
      <OkBanner rec={rec} board={board} boardText={boardText} modules={draft.modules.length} />
      <ProjectActions csv={() => resultCsv(rec, response.pinLabels)} />
      <WiringGuide rec={rec} response={response} data={data} />
      <Warnings rec={rec} data={data} />
      {view !== null ? (
        <section aria-labelledby={`${id}-view`}>
          <h2 id={`${id}-view`}>Header view: where each pin is</h2>
          <p>
            These are the pin rows (headers) of your board. The highlighted pins are the ones used
            above; the legend names every symbol, so colour is never the only clue.
          </p>
          <BoardView connectors={view} title="Board headers with the assigned pins" />
        </section>
      ) : null}
      <section aria-labelledby={`${id}-tech`}>
        <h2 id={`${id}-tech`}>For checking your work</h2>
        <p className="muted">
          Open a section to see the full table, the sources, or engine details.
        </p>
        <FullPinTable rec={rec} />
        <WhyPins rec={rec} data={data} />
        <TechnicalDetails response={response} />
      </section>
    </>
  );
}

function NeedsVariant({ rec }: { rec: Recommendation }) {
  const { draft, dispatch } = useAppState();
  return (
    <section className="card" aria-labelledby="nv-h">
      <h2 id="nv-h">Which module variant is on your board?</h2>
      <p>The engine needs the exact variant before it can choose pins.</p>
      <ul className="plain-list">
        {(rec.variant_candidates ?? []).map((v) => (
          <li key={v}>
            <button
              type="button"
              onClick={() => {
                if (draft.board !== null)
                  dispatch({ type: 'select-board', board: draft.board, variant: v });
              }}
            >
              Use variant <code>{v}</code>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultView({
  response,
  data,
  boardText,
  board,
}: {
  response: SolveResponse;
  data: LoadedCatalog;
  boardText: string;
  board: BoardOption | undefined;
}) {
  const { outcome } = response;
  const rec = outcome.recommendation;
  const { draft } = useAppState();
  return (
    <>
      {outcome.stats.budgetExhausted ? (
        <p className="notice" role="alert">
          <LevelBadge level="warning" /> The search stopped at its {SLOW_NOTICE_MS / 1000} s / node
          limit before it could finish. The answer below may not be the best one, and “no safe
          assignment” may be wrong. Simplify the project and try again.
        </p>
      ) : null}
      {rec.status === 'ok' ? (
        <OkResult response={response} data={data} board={board} boardText={boardText} />
      ) : null}
      {rec.status === 'unsat' ? (
        <UnsatResult
          rec={rec}
          data={data}
          board={board}
          boardText={boardText}
          modules={draft.modules.length}
        />
      ) : null}
      {rec.status === 'needs_variant' ? <NeedsVariant rec={rec} /> : null}
      {rec.status !== 'ok' ? (
        <section className="r-fold-wrap">
          <TechnicalDetails response={response} />
        </section>
      ) : null}
    </>
  );
}

function PinnedNotice({ data }: { data: LoadedCatalog }) {
  const { latest, dispatch } = useAppState();
  if (!data.pinned) return null;
  return (
    <div className="notice" role="note">
      <p>
        This project is shown with catalog <code>{data.catalog.version}</code>, the one it was
        shared or saved with.
        {latest !== null ? (
          <>
            {' '}
            The latest catalog is <code>{latest.version}</code>; facts and rules may have changed.
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'unpin-catalog' });
        }}
      >
        Re-check against the latest catalog
      </button>
    </div>
  );
}

function Results({ data }: { data: LoadedCatalog }) {
  const { draft, solve, solveKey: key, runSolve, cancelSolve } = useAppState();
  const project = toProject(draft);
  const current = solve.status !== 'idle' && solve.key === key;
  const board = data.boards.find((b) => b.ref === draft.board && b.variant === draft.variant);
  const boardText = board
    ? `${board.name} rev. ${board.revision}, variant ${board.variant} (module ${board.module})`
    : `${draft.board ?? ''} ${draft.variant ?? ''}`;

  useEffect(() => {
    if (key !== null && !current) runSolve();
  }, [key, current, runSolve]);

  if (project === null) {
    return (
      <p className="notice">
        Choose a board first. <a href={hrefFor('/board')}>Choose a board</a>
      </p>
    );
  }
  if (project.modules.length === 0) {
    return (
      <p className="notice">
        Add at least one part. <a href={hrefFor('/modules')}>Add parts</a>
      </p>
    );
  }
  const done = solve.status === 'done' && current ? solve.response : null;
  const showActionsHere = done !== null && done.outcome.recommendation.status !== 'ok';
  return (
    <div className="results-page">
      <PinnedNotice data={data} />
      {solve.status === 'running' && current ? (
        <Progress slow={solve.slow} stopAfterMs={solve.stopAfterMs} onCancel={cancelSolve} />
      ) : null}
      {current &&
      (solve.status === 'cancelled' || solve.status === 'timeout' || solve.status === 'error') ? (
        <SolveProblem solve={solve} onRetry={runSolve} />
      ) : null}
      {solve.status === 'done' && current ? (
        <ResultView response={solve.response} data={data} boardText={boardText} board={board} />
      ) : null}
      {done === null || showActionsHere ? <ProjectActions /> : null}
      <Disclaimer />
    </div>
  );
}

export function ResultsScreen({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <>
      <PageHeading headingRef={headingRef}>Results</PageHeading>
      <WithCatalog>{(data) => <Results data={data} />}</WithCatalog>
    </>
  );
}
