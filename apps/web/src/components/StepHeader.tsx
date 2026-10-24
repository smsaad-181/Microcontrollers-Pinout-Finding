import type { ReactNode } from 'react';
import { PageHeading, type HeadingRef } from '../screens/shared';

/** The top of a workflow screen: where you are, the page heading, one plain sentence, help. */
export function StepHeader({
  headingRef,
  step,
  optional = false,
  title,
  intro,
  help,
}: {
  headingRef: HeadingRef;
  step: number;
  optional?: boolean;
  title: string;
  intro: ReactNode;
  help?: ReactNode;
}) {
  return (
    <header className="step-header">
      <p className="step-eyebrow">
        Step {step} of 4{optional ? ' · optional' : ''}
      </p>
      <PageHeading headingRef={headingRef}>{title}</PageHeading>
      <p className="step-intro">{intro}</p>
      {help}
    </header>
  );
}
