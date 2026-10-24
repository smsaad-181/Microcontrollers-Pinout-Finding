import type { ReactNode } from 'react';

/** A "?" disclosure that explains the jargon used on one screen. Native <details>: no script. */
export function Help({
  title = 'What do these words mean?',
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="help">
      <summary>
        <span className="help-mark" aria-hidden="true">
          ?
        </span>
        <span>{title}</span>
      </summary>
      <div className="help-body">{children}</div>
    </details>
  );
}

/** A term and its plain-words meaning, for use inside <Help>. */
export function Term({ word, children }: { word: string; children: ReactNode }) {
  return (
    <p className="term">
      <strong>{word}</strong>
      {': '}
      {children}
    </p>
  );
}
