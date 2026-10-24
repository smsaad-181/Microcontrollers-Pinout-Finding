import { useId, useState, type ReactNode } from 'react';
import type { BoardStatus } from '@pinout/schema';
import { BOARD_STATUS_META } from '../catalog/boards';
import type { CitationLookup } from '../catalog/evidence';
import { LEVEL_META, type WarningLevel } from '../results/explain';
import { hrefFor, STEPS, type StepName } from '../route';
import { Icon, type IconName } from './icons';

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
  board: 'Pick board',
  modules: 'Add parts',
  constraints: 'Your rules',
  results: 'Get pins',
};

const STEP_ICONS: Record<StepName, IconName> = {
  board: 'board',
  modules: 'parts',
  constraints: 'rules',
  results: 'pins',
};

type StepState = 'done' | 'current' | 'todo';

/** What the project has so far; decides which steps show as done. */
export interface StepProgress {
  board: boolean;
  modules: number;
  rules: boolean;
}

/** Why a step cannot give a useful answer yet, or null when it can. */
export function stepNeeds(step: StepName, p: StepProgress): string | null {
  if (step !== 'results') return null;
  if (!p.board) return 'Needs a board first: pick one in step 1.';
  if (p.modules === 0) return 'Needs at least one part: add one in step 2.';
  return null;
}

export function stepState(step: StepName, current: StepName | null, p: StepProgress): StepState {
  if (step === current) return 'current';
  if (step === 'board') return p.board ? 'done' : 'todo';
  if (step === 'modules') return p.modules > 0 ? 'done' : 'todo';
  if (step === 'constraints') return p.rules ? 'done' : 'todo';
  return 'todo';
}

const STATE_TEXT: Record<StepState, string> = {
  done: 'done',
  current: 'you are here',
  todo: 'to do',
};

/** Top-bar navigation: Home plus the four workflow steps with done / current / to do states. */
export function StepNav({
  current,
  progress,
  onHome = false,
}: {
  current: StepName | null;
  progress: StepProgress;
  onHome?: boolean;
}) {
  const [hint, setHint] = useState<string | null>(null);
  const id = useId();
  return (
    <nav aria-label="Workflow steps" className="steps">
      <ol>
        <li className={`step step-home${onHome ? ' step-current' : ''}`}>
          <a href={hrefFor('/')} aria-current={onHome ? 'page' : undefined}>
            <span className="step-icon">
              <Icon name="home" />
            </span>
            <span className="step-text">Home</span>
          </a>
        </li>
        {STEPS.map((s, i) => {
          const state = stepState(s, current, progress);
          const needs = stepNeeds(s, progress);
          return (
            <li key={s} className={`step step-${state}${needs ? ' step-blocked' : ''}`}>
              <a
                href={hrefFor(`/${s}`)}
                aria-current={state === 'current' ? 'step' : undefined}
                {...(needs ? { 'aria-describedby': `${id}-${s}` } : {})}
                onMouseEnter={() => {
                  setHint(needs);
                }}
                onMouseLeave={() => {
                  setHint(null);
                }}
                onFocus={() => {
                  setHint(needs);
                }}
                onBlur={() => {
                  setHint(null);
                }}
              >
                <span className="step-icon">
                  <Icon name={STEP_ICONS[s]} />
                  {state === 'done' ? (
                    <span className="step-check" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </span>
                <span className="step-text">
                  {STEP_LABELS[s]}
                  {s === 'constraints' ? <span className="step-opt"> (optional)</span> : null}
                </span>
                <span className="visually-hidden">
                  {' '}
                  (step {i + 1}, {STATE_TEXT[state]})
                </span>
              </a>
              {needs ? (
                <span id={`${id}-${s}`} className="visually-hidden">
                  {needs}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="step-hint" aria-hidden="true" data-on={hint ? 'true' : 'false'}>
        {hint ?? ''}
      </p>
    </nav>
  );
}

/** One label/value spec tile (PINS 30). Rendered inside <Specs>. */
export function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** A row of spec tiles; leave out any tile whose value the catalog does not have. */
export function Specs({ children }: { children: ReactNode }) {
  return <dl className="specs">{children}</dl>;
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
