import { describe, expect, it } from 'vitest';
import {
  draftReducer,
  EMPTY_DRAFT,
  instanceBase,
  projectKey,
  toProject,
  uniqueInstance,
  type ProjectDraft,
} from '../src/project/draft';
import {
  loadDraft,
  memoryStore,
  parseDraft,
  SafeStore,
  saveDraft,
  type AsyncStore,
} from '../src/project/storage';

const withBoard: ProjectDraft = draftReducer(EMPTY_DRAFT, {
  type: 'select-board',
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
});

describe('instance names', () => {
  it('slugs a base and numbers duplicates', () => {
    expect(instanceBase('GY-BME280')).toBe('gy_bme280');
    expect(instanceBase('10k pot')).toBe('m_10k_pot');
    expect(uniqueInstance('bme280', [])).toBe('bme280');
    expect(uniqueInstance('bme280', ['bme280', 'bme280_2'])).toBe('bme280_3');
  });
});

describe('draftReducer', () => {
  it('adds modules with unique instance names and removes their locks with them', () => {
    let s = draftReducer(withBoard, {
      type: 'add-module',
      breakout: 'push-button',
      base: 'push-button',
    });
    s = draftReducer(s, { type: 'add-module', breakout: 'push-button', base: 'push-button' });
    expect(s.modules.map((m) => m.instance)).toEqual(['push_button', 'push_button_2']);
    s = draftReducer(s, {
      type: 'add-lock',
      lock: { instance: 'push_button', role: 'SW', pad: 'GPIO34' },
    });
    s = draftReducer(s, { type: 'remove-module', instance: 'push_button' });
    expect(s.modules).toHaveLength(1);
    expect(s.locked).toEqual([]);
  });

  it('replaces a lock on the same signal and removes it on unlock', () => {
    let s = draftReducer(withBoard, {
      type: 'add-lock',
      lock: { instance: 'a', role: 'SW', pad: 'GPIO1' },
    });
    s = draftReducer(s, { type: 'add-lock', lock: { instance: 'a', role: 'SW', pad: 'GPIO2' } });
    expect(s.locked).toEqual([{ instance: 'a', role: 'SW', pad: 'GPIO2' }]);
    s = draftReducer(s, { type: 'remove-lock', instance: 'a', role: 'SW' });
    expect(s.locked).toEqual([]);
  });

  it('toggles reserved pads in natural order', () => {
    let s = draftReducer(withBoard, { type: 'toggle-reserved', pad: 'GPIO10' });
    s = draftReducer(s, { type: 'toggle-reserved', pad: 'GPIO2' });
    expect(s.reserved).toEqual(['GPIO2', 'GPIO10']);
    s = draftReducer(s, { type: 'toggle-reserved', pad: 'GPIO2' });
    expect(s.reserved).toEqual(['GPIO10']);
  });

  it('clears pin constraints, but keeps modules, when the board changes', () => {
    let s = draftReducer(withBoard, { type: 'add-module', breakout: 'x', base: 'x' });
    s = draftReducer(s, { type: 'toggle-reserved', pad: 'GPIO2' });
    s = draftReducer(s, { type: 'select-board', board: 'raspberry-pi-pico@Rev3', variant: 'v' });
    expect(s.reserved).toEqual([]);
    expect(s.modules).toHaveLength(1);
    expect(draftReducer(s, { type: 'select-board', board: s.board ?? '', variant: 'v' })).toBe(s);
  });

  it('renames only to a valid, free name and carries locks along', () => {
    let s = draftReducer(withBoard, { type: 'add-module', breakout: 'x', base: 'a' });
    s = draftReducer(s, { type: 'add-module', breakout: 'x', base: 'b' });
    s = draftReducer(s, { type: 'add-lock', lock: { instance: 'a', role: 'SW', pad: 'GPIO1' } });
    expect(draftReducer(s, { type: 'rename-module', instance: 'a', to: 'b' })).toBe(s);
    expect(draftReducer(s, { type: 'rename-module', instance: 'a', to: 'Bad Name' })).toBe(s);
    const r = draftReducer(s, { type: 'rename-module', instance: 'a', to: 'env' });
    expect(r.modules[0]?.instance).toBe('env');
    expect(r.locked[0]?.instance).toBe('env');
  });
});

describe('toProject', () => {
  it('is null without a board', () => {
    expect(toProject(EMPTY_DRAFT)).toBeNull();
  });

  it('maps the draft to the engine Project and omits an unset framework', () => {
    const s = draftReducer(withBoard, { type: 'set-wifi', wifi: true });
    const p = toProject(s);
    expect(p).toEqual({
      board: 'esp32-devkitc-v4@V4',
      variant: 'esp32-devkitc-32e',
      wifi: true,
      modules: [],
      locked: [],
      reserved: [],
    });
    const f = toProject(draftReducer(s, { type: 'set-framework', framework: 'arduino' }));
    expect(f?.framework).toBe('arduino');
    if (p && f) expect(projectKey(p)).not.toBe(projectKey(f));
  });
});

describe('constraints added in stage B', () => {
  it('keeps existing connections free by sending their pads as reserved', () => {
    let s = draftReducer(withBoard, { type: 'toggle-reserved', pad: 'GPIO10' });
    s = draftReducer(s, {
      type: 'add-connection',
      connection: { pad: 'GPIO2', note: '  status LED  ' },
    });
    s = draftReducer(s, { type: 'add-connection', connection: { pad: 'GPIO10', note: '' } });
    expect(s.connections).toEqual([
      { pad: 'GPIO2', note: 'status LED' },
      { pad: 'GPIO10', note: '' },
    ]);
    expect(toProject(s)?.reserved).toEqual(['GPIO2', 'GPIO10']);
    s = draftReducer(s, { type: 'remove-connection', pad: 'GPIO2' });
    expect(s.connections).toEqual([{ pad: 'GPIO10', note: '' }]);
    expect(
      draftReducer(s, { type: 'select-board', board: 'raspberry-pi-pico@Rev3', variant: 'v' })
        .connections,
    ).toEqual([]);
  });

  it('accepts only a sensible wire length and passes it to the engine', () => {
    const s = draftReducer(withBoard, { type: 'set-wiring-length', metres: 0.5 });
    expect(toProject(s)?.wiring_length_m).toBe(0.5);
    expect(draftReducer(s, { type: 'set-wiring-length', metres: -1 })).toBe(s);
    expect(draftReducer(s, { type: 'set-wiring-length', metres: Number.NaN })).toBe(s);
    expect(draftReducer(s, { type: 'set-wiring-length', metres: 1000 })).toBe(s);
    const cleared = draftReducer(s, { type: 'set-wiring-length', metres: null });
    expect(toProject(cleared)).not.toHaveProperty('wiring_length_m');
  });

  it('loads a whole draft and drops the catalog pin on re-check', () => {
    const pinned = { ...withBoard, catalogPin: { version: 'old', sha256: 'a'.repeat(64) } };
    const s = draftReducer(EMPTY_DRAFT, { type: 'load', draft: pinned });
    expect(s).toBe(pinned);
    expect(draftReducer(s, { type: 'unpin-catalog' }).catalogPin).toBeNull();
    expect(draftReducer(withBoard, { type: 'unpin-catalog' })).toBe(withBoard);
  });
});

describe('draft storage', () => {
  const failWrite = () => Promise.reject(new Error('quota'));
  const throwing: AsyncStore = {
    get: () => Promise.reject(new Error('blocked')),
    set: failWrite,
  };

  it('round-trips a draft through the store', async () => {
    const store = new SafeStore(memoryStore());
    const s = draftReducer(withBoard, { type: 'add-module', breakout: 'x', base: 'x' });
    expect(await saveDraft(store, s)).toBe(true);
    expect(await loadDraft(store)).toEqual(s);
    expect(store.backend).toBe('indexeddb');
  });

  it('falls back to memory when storage throws, and keeps working', async () => {
    const store = new SafeStore(throwing);
    expect(await loadDraft(store)).toEqual(EMPTY_DRAFT);
    expect(store.backend).toBe('memory');
    expect(await saveDraft(store, withBoard)).toBe(false);
    expect(await loadDraft(store)).toEqual(withBoard);
  });

  it('switches to memory when only writes fail (quota) without losing the value', async () => {
    const readOnly: AsyncStore = { get: () => Promise.resolve(undefined), set: failWrite };
    const store = new SafeStore(readOnly);
    expect(await saveDraft(store, withBoard)).toBe(false);
    expect(store.backend).toBe('memory');
    expect(await loadDraft(store)).toEqual(withBoard);
  });

  it('uses memory when there is no storage at all', async () => {
    const store = new SafeStore(null);
    expect(store.backend).toBe('memory');
    expect(await saveDraft(store, withBoard)).toBe(false);
    expect(await loadDraft(store)).toEqual(withBoard);
  });

  it('drops malformed stored data', () => {
    expect(parseDraft('not json')).toEqual(EMPTY_DRAFT);
    expect(parseDraft('[1]')).toEqual(EMPTY_DRAFT);
    const d = parseDraft(
      JSON.stringify({
        board: 1,
        modules: [{ breakout: 'a', instance: 'a' }, { x: 1 }],
        connections: [{ pad: 'GPIO1', note: 'x'.repeat(200) }, { pad: 2 }],
        framework: 'cobol',
        wiringLengthM: -3,
        catalogPin: { version: '../etc', sha256: 'a'.repeat(64) },
      }),
    );
    expect(d.board).toBeNull();
    expect(d.modules).toEqual([{ breakout: 'a', instance: 'a' }]);
    expect(d.connections).toHaveLength(1);
    expect(d.connections[0]?.note).toHaveLength(80);
    expect(d.framework).toBeNull();
    expect(d.wiringLengthM).toBeNull();
    expect(d.catalogPin).toBeNull();
  });
});
