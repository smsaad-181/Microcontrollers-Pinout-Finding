import { CatalogStatus } from '../components/CatalogStatus';
import { OpenProjectFile } from '../components/ProjectActions';
import { hrefFor } from '../route';
import { useAppState } from '../state/AppState';
import { PageHeading, type HeadingRef } from './shared';

/** Decorative drawing of a dev board with traces; says nothing the text does not. */
function HeroArt() {
  const pins = Array.from({ length: 12 }, (_, i) => 52 + i * 22);
  return (
    <svg viewBox="0 0 360 260" aria-hidden="true" className="hero-art">
      <rect x="30" y="30" width="300" height="200" rx="14" fill="currentColor" opacity="0.12" />
      <rect
        x="30"
        y="30"
        width="300"
        height="200"
        rx="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      {pins.map((x) => (
        <g key={x}>
          <circle cx={x} cy="46" r="4.5" fill="#e9a23b" />
          <circle cx={x} cy="214" r="4.5" fill="#e9a23b" />
        </g>
      ))}
      <rect x="120" y="82" width="120" height="96" rx="6" fill="currentColor" />
      <path
        d="M52 46v22h50v14M96 46v40h24M140 46v24M184 214v-30M228 214v-40h12M272 214v-24h-32M272 46v34h-32"
        fill="none"
        stroke="#e9a23b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <rect
        x="44"
        y="104"
        width="46"
        height="52"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <circle cx="300" cy="130" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}

export function HomeScreen({ headingRef }: { headingRef: HeadingRef }) {
  const { manifest } = useAppState();
  return (
    <>
      <section className="hero">
        <div>
          <PageHeading headingRef={headingRef}>Pinout Finder</PageHeading>
          <p className="lede">
            Pick your board, add the modules you want to connect, and get a pin assignment for the
            whole project. Every pin is chosen by a deterministic rule engine from cited datasheet
            facts, and every fact links to its source.
          </p>
          <div className="hero-actions">
            <a className="button" href={hrefFor('/board')}>
              Start: choose a board
            </a>
          </div>
          <ul className="trust" aria-label="What you get">
            <li>No AI guessing</li>
            <li>Datasheet citations</li>
            <li>Works offline</li>
          </ul>
        </div>
        <HeroArt />
      </section>
      <ol className="intro-steps">
        <li>Choose the exact board and module variant.</li>
        <li>Add sensors, displays and other modules.</li>
        <li>Optionally lock or reserve pins.</li>
        <li>Read the allocation, wiring, warnings and sources.</li>
      </ol>
      <div className="home-grid">
        <section aria-labelledby="open-heading" className="card">
          <h2 id="open-heading">Continue a saved project</h2>
          <OpenProjectFile />
        </section>
        <section aria-labelledby="catalog-heading" className="card">
          <h2 id="catalog-heading">Catalog</h2>
          <div aria-live="polite">
            <CatalogStatus state={manifest} />
          </div>
        </section>
      </div>
    </>
  );
}
