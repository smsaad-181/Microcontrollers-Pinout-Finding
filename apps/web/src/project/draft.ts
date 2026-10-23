// The project being edited, as plain data, and a reducer over it. Turning the draft into an engine
// `Project` is a pure mapping; the UI never chooses pins (that is the engine's job).
import type { Project } from '@pinout/schema';

export const FRAMEWORKS = ['arduino', 'micropython', 'esp-idf', 'pico-sdk', 'rpi-python'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  arduino: 'Arduino',
  micropython: 'MicroPython',
  'esp-idf': 'ESP-IDF',
  'pico-sdk': 'Pico SDK',
  'rpi-python': 'Raspberry Pi Python',
};

export interface DraftModule {
  breakout: string;
  instance: string;
}

export interface DraftLock {
  instance: string;
  role: string;
  pad: string;
}

/** A wire that already exists on the board: its pad is kept free and the note says what it is. */
export interface DraftConnection {
  pad: string;
  note: string;
}

/** The catalog a project was made with (from a shared link or an imported file). */
export interface CatalogPin {
  version: string;
  sha256: string;
}

export interface ProjectDraft {
  board: string | null;
  variant: string | null;
  modules: DraftModule[];
  locked: DraftLock[];
  reserved: string[];
  /** Existing connections; their pads are sent to the engine as reserved. */
  connections: DraftConnection[];
  framework: Framework | null;
  wifi: boolean;
  /** Typical wire length in metres (the engine uses it for bus checks), or null for its default. */
  wiringLengthM: number | null;
  /** Non-null while the project is shown against the catalog it was made with, not the latest. */
  catalogPin: CatalogPin | null;
}

export const EMPTY_DRAFT: ProjectDraft = {
  board: null,
  variant: null,
  modules: [],
  locked: [],
  reserved: [],
  connections: [],
  framework: null,
  wifi: false,
  wiringLengthM: null,
  catalogPin: null,
};

/** Longest wire length the form accepts, in metres. */
export const MAX_WIRING_LENGTH_M = 100;
/** Longest note on an existing connection. */
export const MAX_NOTE_LENGTH = 80;

export type DraftAction =
  | { type: 'select-board'; board: string; variant: string }
  | { type: 'add-module'; breakout: string; base: string }
  | { type: 'remove-module'; instance: string }
  | { type: 'rename-module'; instance: string; to: string }
  | { type: 'add-lock'; lock: DraftLock }
  | { type: 'remove-lock'; instance: string; role: string }
  | { type: 'toggle-reserved'; pad: string }
  | { type: 'set-framework'; framework: Framework | null }
  | { type: 'set-wifi'; wifi: boolean }
  | { type: 'add-connection'; connection: DraftConnection }
  | { type: 'remove-connection'; pad: string }
  | { type: 'set-wiring-length'; metres: number | null }
  | { type: 'unpin-catalog' }
  | { type: 'load'; draft: ProjectDraft }
  | { type: 'reset' };

/** Instance names: lower-case letters, digits and underscores, starting with a letter. */
export const INSTANCE_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

/** A readable base for instance names, e.g. "gy-bme280-6pin" -> "gy_bme280_6pin". */
export function instanceBase(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return /^[a-z]/.test(slug) ? slug : `m_${slug}`.slice(0, 24);
}

/** First free name: `base`, then `base_2`, `base_3`, ... */
export function uniqueInstance(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const name = `${base}_${String(n)}`;
    if (!taken.includes(name)) return name;
  }
}

const byPad = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
const sortPads = (pads: string[]): string[] => [...new Set(pads)].sort(byPad);

/** True for a usable wire length (or null, meaning the engine default). */
export const isWiringLength = (m: number | null): boolean =>
  m === null || (Number.isFinite(m) && m > 0 && m <= MAX_WIRING_LENGTH_M);

export function draftReducer(state: ProjectDraft, action: DraftAction): ProjectDraft {
  switch (action.type) {
    case 'select-board': {
      if (state.board === action.board && state.variant === action.variant) return state;
      // Pads differ between boards and variants: drop pin constraints, keep the modules.
      return {
        ...state,
        board: action.board,
        variant: action.variant,
        locked: [],
        reserved: [],
        connections: [],
      };
    }
    case 'add-module': {
      const instance = uniqueInstance(
        instanceBase(action.base),
        state.modules.map((m) => m.instance),
      );
      return { ...state, modules: [...state.modules, { breakout: action.breakout, instance }] };
    }
    case 'remove-module':
      return {
        ...state,
        modules: state.modules.filter((m) => m.instance !== action.instance),
        locked: state.locked.filter((l) => l.instance !== action.instance),
      };
    case 'rename-module': {
      const taken = state.modules.map((m) => m.instance).filter((i) => i !== action.instance);
      if (!INSTANCE_PATTERN.test(action.to) || taken.includes(action.to)) return state;
      return {
        ...state,
        modules: state.modules.map((m) =>
          m.instance === action.instance ? { ...m, instance: action.to } : m,
        ),
        locked: state.locked.map((l) =>
          l.instance === action.instance ? { ...l, instance: action.to } : l,
        ),
      };
    }
    case 'add-lock': {
      const rest = state.locked.filter(
        (l) => !(l.instance === action.lock.instance && l.role === action.lock.role),
      );
      return { ...state, locked: [...rest, action.lock] };
    }
    case 'remove-lock':
      return {
        ...state,
        locked: state.locked.filter(
          (l) => !(l.instance === action.instance && l.role === action.role),
        ),
      };
    case 'toggle-reserved':
      return {
        ...state,
        reserved: state.reserved.includes(action.pad)
          ? state.reserved.filter((p) => p !== action.pad)
          : sortPads([...state.reserved, action.pad]),
      };
    case 'set-framework':
      return { ...state, framework: action.framework };
    case 'set-wifi':
      return { ...state, wifi: action.wifi };
    case 'add-connection': {
      const note = action.connection.note.trim().slice(0, MAX_NOTE_LENGTH);
      const rest = state.connections.filter((c) => c.pad !== action.connection.pad);
      const connections = [...rest, { pad: action.connection.pad, note }].sort((a, b) =>
        byPad(a.pad, b.pad),
      );
      return { ...state, connections };
    }
    case 'remove-connection':
      return { ...state, connections: state.connections.filter((c) => c.pad !== action.pad) };
    case 'set-wiring-length':
      return isWiringLength(action.metres) ? { ...state, wiringLengthM: action.metres } : state;
    case 'unpin-catalog':
      return state.catalogPin === null ? state : { ...state, catalogPin: null };
    case 'load':
      return action.draft;
    case 'reset':
      return EMPTY_DRAFT;
  }
}

/** The engine input for a draft, or null while no board is chosen. */
export function toProject(draft: ProjectDraft): Project | null {
  if (draft.board === null || draft.variant === null) return null;
  return {
    board: draft.board,
    variant: draft.variant,
    wifi: draft.wifi,
    modules: draft.modules.map((m) => ({ breakout: m.breakout, instance: m.instance })),
    locked: draft.locked.map((l) => ({ ...l })),
    // Existing connections occupy their pads: the engine keeps them free like reserved pads.
    reserved: sortPads([...draft.reserved, ...draft.connections.map((c) => c.pad)]),
    ...(draft.framework === null ? {} : { framework: draft.framework }),
    ...(draft.wiringLengthM === null ? {} : { wiring_length_m: draft.wiringLengthM }),
  };
}

/** Stable identity of an engine input (to know whether a result is stale). */
export const projectKey = (p: Project): string => JSON.stringify(p);
