import type { MouseEvent, ReactNode } from 'react';
import { useId } from 'react';
import { hrefFor, type StepName } from '../route';
import { useAppState } from '../state/AppState';

interface FooterSpec {
  back: { href: string; label: string };
  next: { href: string; label: string };
  /** A shortcut that skips the optional step. */
  skip?: { href: string; label: string };
  /** What is still missing (null when the step is complete) and what to do next otherwise. */
  missing: string | null;
  ready: string;
}

/** What each footer says, given what the project has so far. Pure, so it can be tested. */
export function footerSpec(
  step: Exclude<StepName, 'results'>,
  have: { board: boolean; modules: number },
): FooterSpec {
  const needBoardAndParts =
    !have.board && have.modules === 0
      ? 'Pick a board (step 1) and add a part (step 2) to get pins.'
      : !have.board
        ? 'Pick a board (step 1) to get pins.'
        : have.modules === 0
          ? 'Add at least one part to get pins.'
          : null;
  switch (step) {
    case 'board':
      return {
        back: { href: hrefFor('/'), label: 'Back' },
        next: { href: hrefFor('/modules'), label: 'Next: add parts' },
        missing: have.board ? null : 'Pick a board to continue.',
        ready: 'Board picked. Next, add the parts you want to connect.',
      };
    case 'modules':
      return {
        back: { href: hrefFor('/board'), label: 'Back' },
        next: { href: hrefFor('/constraints'), label: 'Next: your rules (optional)' },
        skip: { href: hrefFor('/results'), label: 'Skip rules, get my pins' },
        missing: needBoardAndParts,
        ready: `${String(have.modules)} part${have.modules === 1 ? '' : 's'} added. Add more, or continue.`,
      };
    case 'constraints':
      return {
        back: { href: hrefFor('/modules'), label: 'Back' },
        next: { href: hrefFor('/results'), label: 'Get my pins' },
        missing: needBoardAndParts,
        ready: 'All set. The app will pick safe pins for you.',
      };
  }
}

/** Sticky bar at the bottom of steps 1 to 3: Back, what is missing, and the next action. */
export function StepFooter({ step }: { step: Exclude<StepName, 'results'> }) {
  const { draft } = useAppState();
  const id = useId();
  const spec = footerSpec(step, { board: draft.board !== null, modules: draft.modules.length });
  const blocked = spec.missing !== null;
  const stop = (e: MouseEvent) => {
    if (blocked) e.preventDefault();
  };
  const link = (
    l: { href: string; label: string },
    cls: string,
    extra?: { disabled: boolean },
  ): ReactNode => (
    <a
      className={cls}
      href={l.href}
      {...(extra?.disabled ? { 'aria-disabled': 'true', 'aria-describedby': id } : {})}
      onClick={extra?.disabled ? stop : undefined}
    >
      {l.label}
    </a>
  );
  return (
    <div className="step-footer" role="region" aria-label="Next step">
      <div className="step-footer-inner">
        <a className="button secondary footer-back" href={spec.back.href}>
          {spec.back.label}
        </a>
        <p id={id} className={`footer-msg${blocked ? ' is-blocked' : ''}`} aria-live="polite">
          {spec.missing ?? spec.ready}
        </p>
        <div className="footer-actions">
          {spec.skip ? link(spec.skip, 'button secondary', { disabled: blocked }) : null}
          {link(spec.next, 'button', { disabled: blocked })}
        </div>
      </div>
    </div>
  );
}
