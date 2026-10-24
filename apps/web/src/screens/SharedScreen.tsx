// `#/p/<data>`: a project shared as a link. Nothing is replaced until the user opens it.
import { useMemo } from 'react';
import { decodeShare } from '../project/projectFile';
import { hrefFor } from '../route';
import { useAppState } from '../state/AppState';
import { PageHeading, type HeadingRef } from './shared';

export function SharedScreen({ data, headingRef }: { data: string; headingRef: HeadingRef }) {
  const { latest, draft: current, dispatch } = useAppState();
  const read = useMemo(() => decodeShare(data), [data]);

  if (!read.ok) {
    return (
      <>
        <PageHeading headingRef={headingRef}>Shared project</PageHeading>
        <p role="alert" className="notice">
          This link cannot be opened. {read.message}
        </p>
        <p>
          <a href={hrefFor('/board')}>Start a new project</a>
        </p>
      </>
    );
  }
  const { draft, catalog } = read;
  const same =
    latest !== null && latest.version === catalog.version && latest.sha256 === catalog.sha256;
  const open = (pinned: boolean) => {
    dispatch({ type: 'load', draft: { ...draft, catalogPin: pinned && !same ? catalog : null } });
    location.hash = hrefFor('/results');
  };
  const hasWork = current.board !== null || current.modules.length > 0;

  return (
    <>
      <PageHeading headingRef={headingRef}>Shared project</PageHeading>
      <dl className="facts">
        <div className="facts-row">
          <dt>Board</dt>
          <dd>
            <code>{draft.board}</code> variant <code>{draft.variant}</code>
          </dd>
        </div>
        <div className="facts-row">
          <dt>Modules</dt>
          <dd>{draft.modules.map((m) => m.instance).join(', ') || 'none'}</dd>
        </div>
        <div className="facts-row">
          <dt>Locked / reserved pins</dt>
          <dd>
            {draft.locked.length} / {draft.reserved.length + draft.connections.length}
          </dd>
        </div>
        <div className="facts-row">
          <dt>Made with catalog</dt>
          <dd>
            <code>{catalog.version}</code>
          </dd>
        </div>
      </dl>
      {hasWork ? (
        <p className="notice">Opening this link replaces the project you are working on.</p>
      ) : null}
      {same || latest === null ? (
        <p>
          <button
            type="button"
            onClick={() => {
              open(true);
            }}
          >
            Open this project
          </button>
        </p>
      ) : (
        <>
          <p className="notice" role="note">
            This link was made with catalog <code>{catalog.version}</code>; the latest is{' '}
            <code>{latest.version}</code>. Facts and rules may have changed since, so the result can
            differ.
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                open(false);
              }}
            >
              Open and re-check against the latest catalog
            </button>
            <button
              type="button"
              onClick={() => {
                open(true);
              }}
            >
              Open with catalog {catalog.version} (as shared)
            </button>
          </div>
        </>
      )}
    </>
  );
}
