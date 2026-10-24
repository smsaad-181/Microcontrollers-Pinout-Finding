import { useId, useState } from 'react';
import { filterCards } from '../catalog/boardGroups';
import { shortVendor } from '../catalog/platforms';
import { boardHref } from '../boardIntent';
import { Icon } from '../components/icons';
import { CatalogStatus } from '../components/CatalogStatus';
import { OpenProjectFile } from '../components/ProjectActions';
import { hrefFor } from '../route';
import { useAppState } from '../state/AppState';
import { PageHeading, type HeadingRef } from './shared';

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
  ['Pick your board', 'Choose the exact board you have in front of you.', 'board'],
  ['Add your parts', 'Sensors, displays, relays, buttons: whatever you want to connect.', 'parts'],
  ['Set your rules', 'Optional: lock a pin, keep some free, or say you use Wi-Fi.', 'rules'],
  ['Get your pins', 'See which pin each part goes on, how to wire it, and why it is safe.', 'pins'],
] as const;

const BENEFITS = [
  ['shield', 'No AI guessing', 'Every pin choice comes from datasheet facts, never from a guess.'],
  ['doc', 'Datasheet citations', 'Each answer links to the document and page it came from.'],
  [
    'offline',
    'Works offline',
    'Once the page has loaded you can keep using it without a connection.',
  ],
] as const;

/** Quick pills: each opens the Board step already filtered. */
const QUICK_PILLS = [
  ['ESP32', { platform: 'ESP (ESP32 / ESP8266)' }],
  ['Arduino', { platform: 'Arduino' }],
  ['Raspberry Pi', { platform: 'Raspberry Pi' }],
  ['Waveshare', { q: 'Waveshare' }],
] as const;

/** Big search on the home page: finds boards; choosing one opens the Board step showing its card. */
function HeroSearch() {
  const { catalog } = useAppState();
  const [query, setQuery] = useState('');
  const id = useId();
  const boards = catalog.status === 'ready' ? catalog.data.boards : [];
  const found = query.trim() === '' ? [] : filterCards(boards, { query, vendor: '', family: '' });
  const shown = found.slice(0, 6);
  const go = (name: string) => {
    window.location.hash = boardHref({ q: name });
  };
  return (
    <div className="hero-search">
      <form
        role="search"
        className="big-search"
        onSubmit={(e) => {
          e.preventDefault();
          const first = shown[0];
          if (first && shown.length === 1) go(first.name);
          else if (query.trim() !== '') window.location.hash = boardHref({ q: query.trim() });
        }}
      >
        <label htmlFor={`${id}-q`} className="visually-hidden">
          Search boards by name
        </label>
        <span className="big-search-icon">
          <Icon name="search" size={22} />
        </span>
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Search boards: ESP32 DevKit, Uno, Pico, Waveshare…"
          aria-describedby={`${id}-count`}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
        />
      </form>
      <p id={`${id}-count`} role="status" className="hero-search-status">
        {query.trim() === ''
          ? ''
          : catalog.status !== 'ready'
            ? 'Loading the board list…'
            : `${String(found.length)} board${found.length === 1 ? '' : 's'} match.`}
      </p>
      {shown.length > 0 ? (
        <ul className="search-hits" aria-label="Matching boards">
          {shown.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => {
                  go(c.name);
                }}
              >
                <strong>{c.name}</strong>
                <span>{shortVendor(c.vendor)}</span>
                <Icon name="arrow" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

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
        <PageHeading headingRef={headingRef}>Pinout Finder</PageHeading>
        <p className="lede">
          Tell us which board you have and what you want to plug into it. We tell you which pin to
          use for each part, and why.
        </p>
        <HeroSearch />
        <ul className="pill-row" aria-label="Browse boards by brand">
          {QUICK_PILLS.map(([label, intent]) => (
            <li key={label}>
              <a className="pill" href={boardHref(intent)}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hero-actions">
          <a className="button big" href={hrefFor('/board')}>
            Start: choose a board
          </a>
          <button type="button" className="secondary big" onClick={tryExample}>
            Try an example
          </button>
        </div>
        <p className="muted hero-note">
          Not sure? The example is an ESP32 board with a temperature sensor and a humidity sensor.
          It opens the finished answer so you can see what you get.
        </p>
      </section>

      <ul className="benefits" aria-label="What you get">
        {BENEFITS.map(([icon, title, text]) => (
          <li key={title} className="benefit">
            <span className="icon-tile">
              <Icon name={icon} size={22} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="how-heading" className="how">
        <h2 id="how-heading">How it works</h2>
        <ol className="intro-steps">
          {HOW.map(([title, text, icon], i) => (
            <li key={title}>
              <span className="how-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="icon-tile">
                <Icon name={icon} size={22} />
              </span>
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
