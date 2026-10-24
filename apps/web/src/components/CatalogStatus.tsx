import type { ManifestState } from '../manifest';

/** Shows the catalog manifest state: loading, not built, unreadable, failed, or version + counts. */
export function CatalogStatus({ state }: { state: ManifestState }) {
  switch (state.status) {
    case 'loading':
      return <p>Loading catalog information…</p>;
    case 'missing':
      return <p>Catalog not built yet.</p>;
    case 'invalid':
      return <p>Catalog manifest could not be read. {state.reason}</p>;
    case 'error':
      return <p>{state.message}</p>;
    case 'ready': {
      const { version, date, counts } = state.manifest;
      return (
        <dl className="facts">
          <div className="facts-row">
            <dt>Catalog version</dt>
            <dd>
              <code>{version}</code>
            </dd>
          </div>
          <div className="facts-row">
            <dt>Built</dt>
            <dd>{date}</dd>
          </div>
          {Object.entries(counts ?? {}).map(([name, n]) => (
            <div key={name} className="facts-row">
              <dt>{name}</dt>
              <dd>{n}</dd>
            </div>
          ))}
        </dl>
      );
    }
  }
}
