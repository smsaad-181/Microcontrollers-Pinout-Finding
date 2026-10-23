import { CatalogStatus } from '../components/CatalogStatus';
import { hrefFor } from '../route';
import { useAppState } from '../state/AppState';
import { PageHeading, type HeadingRef } from './shared';

export function HomeScreen({ headingRef }: { headingRef: HeadingRef }) {
  const { manifest } = useAppState();
  return (
    <>
      <PageHeading headingRef={headingRef}>Pinout Finder</PageHeading>
      <p>
        Pick your board, add the modules you want to connect, and get a pin assignment for the whole
        project. Every pin is chosen by a deterministic rule engine from cited datasheet facts, and
        every fact links to its source.
      </p>
      <ol className="intro-steps">
        <li>Choose the exact board and module variant.</li>
        <li>Add sensors, displays and other modules.</li>
        <li>Optionally lock or reserve pins.</li>
        <li>Read the allocation, wiring, warnings and sources.</li>
      </ol>
      <p>
        <a className="button" href={hrefFor('/board')}>
          Start: choose a board
        </a>
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
