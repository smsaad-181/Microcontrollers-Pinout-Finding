// Save, open, share and print the project. Files are made and read locally; nothing is uploaded.
import { useId, useState, type ChangeEvent } from 'react';
import { downloadText, fileStem } from '../project/download';
import {
  encodeShare,
  MAX_SHARE_LENGTH,
  projectFileText,
  readProjectFile,
  shareUrl,
  toProjectFile,
} from '../project/projectFile';
import { hrefFor } from '../route';
import { useAppState } from '../state/AppState';

/** Opens every <details> for printing, and restores them afterwards. */
export function printPage(): void {
  const closed = [...document.querySelectorAll('details:not([open])')];
  for (const d of closed) d.setAttribute('open', '');
  const restore = () => {
    for (const d of closed) d.removeAttribute('open');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  window.print();
}

/** Opens a project file chosen by the user and goes to the results. */
export function OpenProjectFile() {
  const { dispatch } = useAppState();
  const id = useId();
  const [message, setMessage] = useState('');
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void file.text().then(
      (text) => {
        const r = readProjectFile(text);
        if (!r.ok) {
          setMessage(r.message);
          return;
        }
        setMessage('');
        dispatch({ type: 'load', draft: r.draft });
        location.hash = hrefFor('/results');
      },
      () => {
        setMessage('The file could not be read.');
      },
    );
  };
  return (
    <div className="field">
      <label htmlFor={`${id}-open`}>Open a saved project file (.json)</label>
      <input id={`${id}-open`} type="file" accept=".json,application/json" onChange={onChange} />
      {message !== '' ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ProjectActions({ csv }: { csv?: () => string }) {
  const { draft, latest, catalog } = useAppState();
  const id = useId();
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const current =
    catalog.status === 'ready'
      ? { version: catalog.data.catalog.version, sha256: catalog.data.sha256 }
      : latest;
  if (current === null || draft.board === null) return null;
  const file = toProjectFile(draft, current);
  const stem = fileStem(`pinout-${draft.board}-${draft.variant ?? ''}`);

  const makeLink = () => {
    const payload = encodeShare(file);
    if (payload.length > MAX_SHARE_LENGTH) {
      setStatus('The project is too large for a link. Save it as a file instead.');
      return;
    }
    const url = shareUrl(location.href, payload);
    setLink(url);
    const clip = (navigator as Partial<Navigator>).clipboard;
    if (clip?.writeText === undefined) {
      setStatus('Copy the link below.');
      return;
    }
    clip.writeText(url).then(
      () => {
        setStatus('Link copied to the clipboard.');
      },
      () => {
        setStatus('Copy the link below.');
      },
    );
  };

  return (
    <section aria-labelledby={`${id}-h`} className="card no-print">
      <h2 id={`${id}-h`}>Save and share</h2>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            downloadText(`${stem}.json`, projectFileText(file), 'application/json');
          }}
        >
          Save project file (JSON)
        </button>
        {csv ? (
          <button
            type="button"
            onClick={() => {
              downloadText(`${stem}.csv`, csv(), 'text/csv');
            }}
          >
            Export pin table (CSV)
          </button>
        ) : null}
        <button type="button" onClick={makeLink}>
          Copy share link
        </button>
        <button type="button" onClick={printPage}>
          Print or save as PDF
        </button>
      </div>
      <p role="status" className="muted">
        {status}
      </p>
      {link !== '' ? (
        <div className="field">
          <label htmlFor={`${id}-link`}>Share link (the project is inside the link)</label>
          <input
            id={`${id}-link`}
            type="text"
            readOnly
            value={link}
            onFocus={(e) => {
              e.target.select();
            }}
          />
        </div>
      ) : null}
      <p className="muted">
        The link and the file record catalog <code>{file.catalog.version}</code>, so the same result
        can be reproduced later.
      </p>
      <OpenProjectFile />
    </section>
  );
}
