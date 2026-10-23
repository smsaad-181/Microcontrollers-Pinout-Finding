import { useEffect, useId, useState } from 'react';
import type { Recommendation } from '@pinout/schema';
import { Citations, LevelBadge } from '../components/common';
import { projectKey, toProject } from '../project/draft';
import {
  countByLevel,
  describeConflict,
  describePart,
  describeRelaxation,
  headerPosition,
  INTERFACE_LABELS,
  LEVEL_META,
  sortWarnings,
  WARNING_LEVELS,
  wiringRows,
  type NameLookup,
} from '../results/explain';
import { hrefFor } from '../route';
import { useAppState, type LoadedCatalog, type SolveState } from '../state/AppState';
import type { SolveResponse } from '../worker/api';
import { HARD_TIMEOUT_MS, SLOW_NOTICE_MS } from '../worker/solverClient';
import { PageHeading, WithCatalog, type HeadingRef } from './shared';

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

function Progress({ slow, onCancel }: { slow: boolean; onCancel: () => void }) {
  return (
    <section className="card" aria-labelledby="solve-progress">
      <h2 id="solve-progress">Finding pins…</h2>
      <progress aria-label="Solving" />
      <p>
        Elapsed: <Elapsed />
      </p>
      <p role="status">
        {slow
          ? `This is taking longer than the engine's ${String(SLOW_NOTICE_MS / 1000)} s limit. It will stop by itself after ${String(HARD_TIMEOUT_MS / 1000)} s, or you can cancel now and simplify the project.`
          : 'The engine runs in the background; the page stays usable.'}
      </p>
      <button type="button" onClick={onCancel}>
        Cancel
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
          For each pin, open “Why this pin” and follow at least one source link to the datasheet
          section quoted.
        </li>
        <li>Read every Critical, Warning and Caution item and apply or check the fix.</li>
        <li>Fit the required parts (pull-ups, pull-downs, level shifters) before powering up.</li>
        <li>Power the board without modules first, then add one module at a time.</li>
        <li>Measure supply voltages and check that no pin gets hot.</li>
      </ol>
    </section>
  );
}

function Warnings({ rec, data }: { rec: Recommendation; data: LoadedCatalog }) {
  const id = useId();
  const sorted = sortWarnings(rec.warnings);
  const counts = countByLevel(rec.warnings);
  return (
    <section aria-labelledby={`${id}-w`}>
      <h2 id={`${id}-w`}>Warnings ({rec.warnings.length})</h2>
      <p>
        {WARNING_LEVELS.map((l) => (
          <span key={l} className="count-chip">
            <LevelBadge level={l} />: {counts[l]}
          </span>
        ))}
      </p>
      {sorted.length === 0 ? <p>No warnings.</p> : null}
      <ul className="warnings">
        {sorted.map((w, i) => (
          <li key={`${w.code}-${String(i)}`} className={`warning warning-${w.level}`}>
            <p>
              <LevelBadge level={w.level} /> <code>{w.code}</code>
              <span className="visually-hidden"> — {LEVEL_META[w.level].hint}</span>
            </p>
            <ul className="message-parts">
              {w.message.split('; ').map((part, j) => (
                <li key={j}>{part}</li>
              ))}
            </ul>
            {w.pads.length > 0 ? <p className="muted">Pins: {w.pads.join(', ')}</p> : null}
            <Citations ids={w.evidence} cite={data.cite} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function OkResult({ response, data }: { response: SolveResponse; data: LoadedCatalog }) {
  const id = useId();
  const rec = response.outcome.recommendation;
  const rows = wiringRows(rec, response.pinLabels);
  const unattached = rec.required_parts.filter((p) => p.pads === undefined || p.pads.length === 0);
  return (
    <>
      <section aria-labelledby={`${id}-if`}>
        <h2 id={`${id}-if`}>Interfaces</h2>
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
                <td>{INTERFACE_LABELS[i.kind] ?? i.kind}</td>
                <td>Interface rule {i.decided_by_rule}</td>
                <td>
                  {i.alternatives.length === 0
                    ? 'none'
                    : i.alternatives.map((k) => INTERFACE_LABELS[k] ?? k).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby={`${id}-alloc`}>
        <h2 id={`${id}-alloc`}>Pin allocation</h2>
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby={`${id}-alloc`}>
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
      </section>

      <section aria-labelledby={`${id}-wire`}>
        <h2 id={`${id}-wire`}>Wiring instructions</h2>
        <ol className="wiring">
          {rows.map((r) => (
            <li key={`${r.instance}.${r.role}`}>
              Connect <code>{r.instance}</code> pin <strong>{r.modulePin ?? r.role}</strong>
              {r.modulePin !== null && r.modulePin !== r.role ? ` (${r.role})` : ''} to board pin{' '}
              <strong>{r.boardLabel}</strong> ({headerPosition(r.connector, r.position)}, GPIO
              {r.gpio}).{' '}
              {r.parts.length === 0 ? (
                <span className="tag tag-direct">Direct wire</span>
              ) : (
                <span className="tag tag-part">
                  Needs part: {r.parts.map(describePart).join('; ')}
                </span>
              )}
            </li>
          ))}
        </ol>
        <p>
          Connect every module GND to a board GND pin. Power each module from a supply within its
          rated voltage; the power budget below shows what the engine counted per rail.
        </p>
        {rec.required_parts.length > 0 ? (
          <>
            <h3>Required parts</h3>
            <ul>
              {rec.required_parts.map((p, i) => (
                <li key={i}>
                  {p.count} × {describePart(p)}
                  {p.pads && p.pads.length > 0 ? ` on ${p.pads.join(', ')}` : ''}
                </li>
              ))}
            </ul>
            {unattached.length > 0 ? (
              <p className="muted">Parts without a pin apply to the module or rail as a whole.</p>
            ) : null}
          </>
        ) : null}
      </section>

      <Warnings rec={rec} data={data} />

      <section aria-labelledby={`${id}-why`}>
        <h2 id={`${id}-why`}>Why this pin</h2>
        {rec.assignments.map((a) => (
          <details key={`${a.instance}.${a.role}`} className="why">
            <summary>
              <code>
                {a.instance}.{a.role}
              </code>{' '}
              → GPIO{a.gpio} ({a.label}, {headerPosition(a.connector, a.position)})
            </summary>
            <h3 className="small-h">Rule trace</h3>
            <ul>
              {a.trace.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {a.alternatives.length > 0 ? (
              <>
                <h3 className="small-h">Alternatives (ranked lower)</h3>
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
      </section>

      {rec.budgets.length > 0 ? (
        <section aria-labelledby={`${id}-bud`}>
          <h2 id={`${id}-bud`}>Power budget</h2>
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
                    {b.limit_ma === null ? 'unknown (not documented)' : `${String(b.limit_ma)} mA`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}

function UnsatResult({ rec, data }: { rec: Recommendation; data: LoadedCatalog }) {
  const id = useId();
  const names: NameLookup = { breakout: (b) => data.search.byId(b)?.name };
  const u = rec.unsat;
  return (
    <>
      <section className="card unsat" aria-labelledby={`${id}-u`}>
        <h2 id={`${id}-u`}>
          <span aria-hidden="true">✖ </span>No safe assignment
        </h2>
        <p>
          The engine proved that these requirements cannot all be met on this board. The smallest
          set of requirements that conflict:
        </p>
        <ul>
          {(u?.minimal_conflict ?? []).map((t) => (
            <li key={t}>
              {describeConflict(t, names)} <code className="claim-id">{t}</code>
            </li>
          ))}
        </ul>
        <h3>Ways to fix it (best first)</h3>
        {u && u.relaxations.length > 0 ? (
          <ol>
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
      </section>
      {rec.warnings.length > 0 ? <Warnings rec={rec} data={data} /> : null}
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
}: {
  response: SolveResponse;
  data: LoadedCatalog;
  boardText: string;
}) {
  const { outcome, elapsedMs } = response;
  const rec = outcome.recommendation;
  const statusText =
    rec.status === 'ok'
      ? 'Pins assigned'
      : rec.status === 'unsat'
        ? 'No safe assignment'
        : 'Variant needed';
  return (
    <>
      <dl className="facts summary">
        <div className="facts-row">
          <dt>Board</dt>
          <dd>{boardText}</dd>
        </div>
        <div className="facts-row">
          <dt>Result</dt>
          <dd>{statusText}</dd>
        </div>
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
      {outcome.stats.budgetExhausted ? (
        <p className="notice" role="alert">
          <LevelBadge level="warning" /> The search stopped at its {SLOW_NOTICE_MS / 1000} s / node
          limit before it could finish. The answer below may not be the best one, and “no safe
          assignment” may be wrong. Simplify the project and try again.
        </p>
      ) : null}
      {rec.status === 'ok' ? <OkResult response={response} data={data} /> : null}
      {rec.status === 'unsat' ? <UnsatResult rec={rec} data={data} /> : null}
      {rec.status === 'needs_variant' ? <NeedsVariant rec={rec} /> : null}
    </>
  );
}

function Results({ data }: { data: LoadedCatalog }) {
  const { draft, solve, runSolve, cancelSolve } = useAppState();
  const project = toProject(draft);
  const key = project ? projectKey(project) : null;
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
        Add at least one module. <a href={hrefFor('/modules')}>Add modules</a>
      </p>
    );
  }
  return (
    <>
      {solve.status === 'running' && current ? (
        <Progress slow={solve.slow} onCancel={cancelSolve} />
      ) : null}
      {current &&
      (solve.status === 'cancelled' || solve.status === 'timeout' || solve.status === 'error') ? (
        <SolveProblem solve={solve} onRetry={runSolve} />
      ) : null}
      {solve.status === 'done' && current ? (
        <ResultView response={solve.response} data={data} boardText={boardText} />
      ) : null}
      <Disclaimer />
    </>
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
