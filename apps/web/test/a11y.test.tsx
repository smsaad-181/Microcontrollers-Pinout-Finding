// @vitest-environment jsdom
// axe-core on every screen, rendered in jsdom with the real catalog and the real engine (run
// in-thread through the same WorkerHandle interface the Web Worker uses). jsdom has no layout, so
// axe reports colour contrast as "incomplete" here; the Playwright run in a real browser covers it.
import axe from 'axe-core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { draftReducer, EMPTY_DRAFT, type ProjectDraft } from '../src/project/draft';
import { encodeShare, toProjectFile } from '../src/project/projectFile';
import { DRAFT_KEY, memoryStore, SafeStore } from '../src/project/storage';
import type { AppServices } from '../src/state/AppState';
import { createEngineHost } from '../src/worker/engineHost';
import type { WorkerHandle } from '../src/worker/solverClient';
import { compiledCatalog } from './realCatalog';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const { text, sha256, version } = compiledCatalog();

function inThreadWorker(): WorkerHandle {
  const host = createEngineHost(() => performance.now());
  return {
    init: (c, s) => {
      host.init(c, s);
      return Promise.resolve();
    },
    solve: (p) => Promise.resolve(host.solve(p)),
    lockRoles: (id) => Promise.resolve(host.lockRoles(id)),
    terminate: () => undefined,
  };
}

const fetchFn = (url: string): Promise<Response> => {
  if (url.endsWith('/catalog/catalog-manifest.json')) {
    const manifest = { version, date: '2026-01-01', sha256, file: `${version}.json` };
    return Promise.resolve(
      new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json' } }),
    );
  }
  if (url.endsWith(`/catalog/${version}.json`)) return Promise.resolve(new Response(text));
  return Promise.resolve(new Response('not found', { status: 404 }));
};

let worked: ProjectDraft = draftReducer(EMPTY_DRAFT, {
  type: 'select-board',
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
});
for (const [breakout, base] of [
  ['gy-bme280-6pin', 'env'],
  ['rfid-rc522-blue', 'rfid'],
  ['st7735s-1.8-spi-tft', 'tft'],
  ['relay-board-4ch-transistor', 'relays'],
  ['push-button', 'sw'],
] as const) {
  worked = draftReducer(worked, { type: 'add-module', breakout, base });
}
worked = draftReducer(worked, { type: 'set-wifi', wifi: true });
worked = draftReducer(worked, {
  type: 'add-connection',
  connection: { pad: 'GPIO2', note: 'LED' },
});

async function services(draft: ProjectDraft): Promise<AppServices> {
  const store = new SafeStore(memoryStore());
  await store.set(DRAFT_KEY, draft);
  return { fetchFn, workerFactory: inThreadWorker, store };
}

let root: Root | null = null;
let container: HTMLElement | null = null;

async function renderAt(hash: string, draft: ProjectDraft = worked): Promise<void> {
  window.location.hash = hash;
  container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  const s = await services(draft);
  const r = createRoot(container);
  root = r;
  await act(async () => {
    r.render(<App services={s} />);
    await Promise.resolve();
  });
}

/** Every violation, any impact (the gate needs 0 serious/critical; we hold the line at 0). */
async function violations(): Promise<string[]> {
  const result = await axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}

const shown = (needle: string) =>
  vi.waitFor(
    () => {
      expect(document.body.textContent).toContain(needle);
    },
    { timeout: 20_000, interval: 50 },
  );

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no canvas; axe only uses it for an optional icon-contrast check.
  HTMLCanvasElement.prototype.getContext = () => null;
  document.documentElement.lang = 'en';
  document.title = 'Pinout Finder';
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
});

describe('accessibility (axe-core, WCAG 2.1 A/AA + best practice)', () => {
  it.each([
    ['home', '#/', 'Continue a saved project'],
    ['board', '#/board', 'ESP32-DevKitC'],
    ['modules', '#/modules', 'relays'],
    ['constraints', '#/constraints', 'Voltage rails'],
    ['results', '#/results', 'Pins assigned'],
    ['not found', '#/nope', 'Page not found'],
  ])('%s screen has no axe violations', async (_name, hash, needle) => {
    await renderAt(hash);
    await act(() => shown(needle));
    expect(await violations()).toEqual([]);
  });

  it('shared-link screen has no axe violations', async () => {
    const payload = encodeShare(toProjectFile(worked, { version, sha256 }));
    await renderAt(`#/p/${payload}`, EMPTY_DRAFT);
    await act(() => shown('Open this project'));
    expect(await violations()).toEqual([]);
  });

  it('results show the header view with labelled, keyboard-reachable pins', async () => {
    await renderAt('#/results');
    await act(() => shown('Header view'));
    const pins = [...document.querySelectorAll('.board-headers [role="button"]')];
    expect(pins.length).toBeGreaterThan(30);
    // One tab stop for the whole view; every pin has a spoken label.
    expect(pins.filter((p) => p.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(pins.every((p) => (p.getAttribute('aria-label') ?? '').length > 0)).toBe(true);
    expect(pins.some((p) => (p.getAttribute('aria-label') ?? '').includes(', Bus, '))).toBe(true);
    expect(
      pins.some((p) => (p.getAttribute('aria-label') ?? '').includes('existing connection: LED')),
    ).toBe(true);
    // Arrow down moves the tab stop to the next pin.
    const first = pins.find((p) => p.getAttribute('tabindex') === '0') as SVGGElement;
    act(() => {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    const now = [...document.querySelectorAll('.board-headers [role="button"]')];
    expect(now.findIndex((p) => p.getAttribute('tabindex') === '0')).toBe(1);
  });
});
