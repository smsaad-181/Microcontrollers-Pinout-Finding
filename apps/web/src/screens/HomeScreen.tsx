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

/** The demo project: loaded into the draft, then shown on the results screen. */
export const DEMO = {
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
  modules: [
    { breakout: 'gy-bme280-4pin', base: 'bme280' },
    { breakout: 'dht11-3pin-module', base: 'dht11' },
  ],
} as const;

const HOW = [
  ['Pick your board', 'Choose the exact board you have in front of you.'],
  ['Add your parts', 'Sensors, displays, relays, buttons: whatever you want to connect.'],
  ['Get your pins', 'See which pin each part goes on, how to wire it, and why it is safe.'],
] as const;

export function HomeScreen({ headingRef }: { headingRef: HeadingRef }) {
  const { manifest, draft, dispatch } = useAppState();
  const tryExample = () => {
    const hasWork = draft.board !== null || draft.modules.length > 0;
    if (
      hasWork &&
      !window.confirm('This replaces the project you are working on with an example. Continue?')
    )
      return;
    dispatch({ type: 'reset' });
    dispatch({ type: 'select-board', board: DEMO.board, variant: DEMO.variant });
    for (const m of DEMO.modules) dispatch({ type: 'add-module', ...m });
    window.location.hash = hrefFor('/results');
  };
  return (
    <>
      <section className="hero">
        <div>
          <PageHeading headingRef={headingRef}>Pinout Finder</PageHeading>
          <p className="lede">
            Tell us which board you have and what you want to plug into it. We tell you which pin to
            use for each part, and why. Every answer comes from datasheets and links to its source.
          </p>
          <div className="hero-actions">
            <a className="button" href={hrefFor('/board')}>
              Start: choose a board
            </a>
            <button type="button" className="secondary" onClick={tryExample}>
              Try an example
            </button>
          </div>
          <p className="muted hero-note">
            Not sure? Try an example: an ESP32 board with a temperature sensor and a humidity
            sensor. It opens the finished answer so you can see what you get.
          </p>
          <ul className="trust" aria-label="What you get">
            <li>No AI guessing</li>
            <li>Datasheet citations</li>
            <li>Works offline</li>
          </ul>
        </div>
        <HeroArt />
      </section>
      <section aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="intro-steps">
          {HOW.map(([title, text]) => (
            <li key={title}>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>
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
