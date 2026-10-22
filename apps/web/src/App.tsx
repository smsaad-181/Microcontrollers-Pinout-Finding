import { useEffect, useRef, type RefObject } from 'react';
import type { ManifestState } from './manifest';
import { hrefFor, type Route } from './route';
import { useCatalogManifest } from './useCatalogManifest';
import { useHashRoute } from './useHashRoute';

type HeadingRef = RefObject<HTMLHeadingElement | null>;

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

function HomePage({ headingRef }: { headingRef: HeadingRef }) {
  const manifest = useCatalogManifest();
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Pinout Finder — coming soon
      </h1>
      <p>
        A tool for choosing microcontroller pins for your modules, with every fact traced back to
        its datasheet. It is under construction.
      </p>
      <section aria-labelledby="catalog-heading" className="card">
        <h2 id="catalog-heading">Catalog</h2>
        <div aria-live="polite">
          <CatalogStatus state={manifest} />
        </div>
      </section>
    </>
  );
}

function NotFoundPage({ path, headingRef }: { path: string; headingRef: HeadingRef }) {
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>
        Page not found
      </h1>
      <p>
        There is no page at <code>{path}</code>.
      </p>
      <p>
        <a href={hrefFor('/')}>Go to the Pinout Finder home page</a>
      </p>
    </>
  );
}

function routeKey(route: Route): string {
  return route.name === 'not-found' ? `not-found:${route.path}` : route.name;
}

export function App() {
  const route = useHashRoute();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const key = routeKey(route);

  // On route change (not first load), move focus to the new page heading for screen readers.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [key]);

  return (
    <>
      <header className="site-header">
        <a className="brand" href={hrefFor('/')}>
          Pinout Finder
        </a>
      </header>
      <main id="main">
        {route.name === 'home' ? (
          <HomePage headingRef={headingRef} />
        ) : (
          <NotFoundPage path={route.path} headingRef={headingRef} />
        )}
      </main>
    </>
  );
}
