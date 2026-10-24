import type { BoardStatus } from '@pinout/schema';
import { BOARD_STATUS_META } from '../catalog/boards';
import type { CitationLookup } from '../catalog/evidence';
import { LEVEL_META, type WarningLevel } from '../results/explain';
import { hrefFor, STEPS, type StepName } from '../route';

/** Board status: icon + text (the icon is decorative; the text carries the meaning). */
export function StatusBadge({ status }: { status: BoardStatus }) {
  const meta = BOARD_STATUS_META[status];
  return (
    <span className={`badge badge-${status}`} title={meta.hint}>
      <span aria-hidden="true">{meta.icon}</span> {meta.label}
    </span>
  );
}

/** Warning level: icon + text, never colour alone. */
export function LevelBadge({ level }: { level: WarningLevel }) {
  const meta = LEVEL_META[level];
  return (
    <span className={`level level-${level}`}>
      <span aria-hidden="true" className="level-icon">
        {meta.icon}
      </span>{' '}
      {meta.label}
    </span>
  );
}

const STEP_LABELS: Record<StepName, string> = {
  board: 'Board',
  modules: 'Modules',
  constraints: 'Constraints',
  results: 'Results',
};

/** The four workflow steps; the current one is marked with aria-current. */
export function StepNav({ current }: { current: StepName | null }) {
  return (
    <nav aria-label="Workflow steps" className="steps">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s}>
            <a href={hrefFor(`/${s}`)} aria-current={s === current ? 'step' : undefined}>
              <span className="step-number">{i + 1}.</span> {STEP_LABELS[s]}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Evidence list for claim ids: document, revision, locator and quote, linked to the source URL. */
export function Citations({
  ids,
  cite,
  summary = 'Sources',
}: {
  ids: readonly string[];
  cite: CitationLookup;
  summary?: string;
}) {
  if (ids.length === 0) return null;
  return (
    <details className="citations">
      <summary>
        {summary} ({ids.length})
      </summary>
      <ul>
        {ids.map((id) => {
          const c = cite(id);
          if (!c.found) {
            return (
              <li key={id}>
                <span className="missing-source">Source record not found:</span> <code>{id}</code>
              </li>
            );
          }
          const doc = `${c.title}${c.revision === null ? '' : `, rev. ${c.revision}`}`;
          return (
            <li key={id}>
              {c.url === null ? (
                <span>{doc}</span>
              ) : (
                <a href={c.url} target="_blank" rel="noopener noreferrer">
                  {doc}
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              )}
              {c.secondary ? <span className="secondary-tag"> (secondary source)</span> : null}
              <span className="locator"> — {c.locator}</span>
              <q className="quote">{c.quote}</q> <code className="claim-id">{id}</code>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
