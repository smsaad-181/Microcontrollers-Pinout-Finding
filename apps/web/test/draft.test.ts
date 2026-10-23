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
import { parseDraft, readDraft, writeDraft, type KeyValueStore } from '../src/project/storage';

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

describe('draft storage', () => {
  const memory = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return {
      data,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    };
  };

  it('round-trips a draft', () => {
    const store = memory();
    const s = draftReducer(withBoard, { type: 'add-module', breakout: 'x', base: 'x' });
    expect(writeDraft(store, s)).toBe(true);
    expect(readDraft(store)).toEqual(s);
  });

  it('falls back to memory when storage throws or is missing', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readDraft(throwing)).toEqual(EMPTY_DRAFT);
    expect(writeDraft(throwing, withBoard)).toBe(false);
    expect(readDraft(null)).toEqual(EMPTY_DRAFT);
    expect(writeDraft(null, withBoard)).toBe(false);
  });

  it('drops malformed stored data', () => {
    expect(parseDraft('not json')).toEqual(EMPTY_DRAFT);
    expect(parseDraft('[1]')).toEqual(EMPTY_DRAFT);
    const d = parseDraft(
      JSON.stringify({
        board: 1,
        modules: [{ breakout: 'a', instance: 'a' }, { x: 1 }],
        framework: 'cobol',
      }),
    );
    expect(d.board).toBeNull();
    expect(d.modules).toEqual([{ breakout: 'a', instance: 'a' }]);
    expect(d.framework).toBeNull();
  });
});
