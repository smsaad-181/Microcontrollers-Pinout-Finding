// Draft persistence. IndexedDB (idb-keyval) keeps the project across visits; storage can be missing
// or throw (private windows, blocked site data, quota), so every access is wrapped and the app
// falls back to memory for the rest of the session. Stored data is validated on the way in.
import { createStore, get, set } from 'idb-keyval';
import {
  EMPTY_DRAFT,
  FRAMEWORKS,
  isWiringLength,
  MAX_NOTE_LENGTH,
  type CatalogPin,
  type ProjectDraft,
} from './draft';

export const DRAFT_KEY = 'draft:v2';
export const SETTINGS_KEY = 'settings:v1';

/** An async key-value store (IndexedDB in the browser, a Map in tests and as the fallback). */
export interface AsyncStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/** Where the draft is being kept right now. */
export type StorageBackend = 'indexeddb' | 'memory';

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const HEX64 = /^[0-9a-f]{64}$/;
const VERSION = /^[0-9a-z][0-9a-z._-]{0,63}$/;

/** A catalog pin with a safe version (it becomes a file name) and a full SHA-256, or null. */
export function parseCatalogPin(v: unknown): CatalogPin | null {
  if (!isRecord(v)) return null;
  const { version, sha256 } = v;
  if (typeof version !== 'string' || typeof sha256 !== 'string') return null;
  if (!VERSION.test(version) || version.includes('..') || !HEX64.test(sha256)) return null;
  return { version, sha256 };
}

/** Validates a draft from storage, a file or a link; anything malformed is dropped field by field. */
export function draftFromUnknown(v: unknown): ProjectDraft {
  if (!isRecord(v)) return EMPTY_DRAFT;
  const str = (x: unknown) => (typeof x === 'string' ? x : null);
  const modules = Array.isArray(v.modules)
    ? v.modules.filter(
        (m): m is { breakout: string; instance: string } =>
          isRecord(m) && typeof m.breakout === 'string' && typeof m.instance === 'string',
      )
    : [];
  const locked = Array.isArray(v.locked)
    ? v.locked.filter(
        (l): l is { instance: string; role: string; pad: string } =>
          isRecord(l) &&
          typeof l.instance === 'string' &&
          typeof l.role === 'string' &&
          typeof l.pad === 'string',
      )
    : [];
  const connections = Array.isArray(v.connections)
    ? v.connections.filter(
        (c): c is { pad: string; note: string } =>
          isRecord(c) && typeof c.pad === 'string' && typeof c.note === 'string',
      )
    : [];
  const framework = (FRAMEWORKS as readonly unknown[]).includes(v.framework)
    ? (v.framework as ProjectDraft['framework'])
    : null;
  const wire = typeof v.wiringLengthM === 'number' ? v.wiringLengthM : null;
  return {
    board: str(v.board),
    variant: str(v.variant),
    modules: modules.map((m) => ({ breakout: m.breakout, instance: m.instance })),
    locked: locked.map((l) => ({ instance: l.instance, role: l.role, pad: l.pad })),
    reserved: isStringArray(v.reserved) ? v.reserved : [],
    connections: connections.map((c) => ({ pad: c.pad, note: c.note.slice(0, MAX_NOTE_LENGTH) })),
    framework,
    wifi: v.wifi === true,
    wiringLengthM: isWiringLength(wire) ? wire : null,
    catalogPin: parseCatalogPin(v.catalogPin),
  };
}

/** Parses a stored JSON draft; anything malformed gives the empty draft. */
export function parseDraft(text: string | null): ProjectDraft {
  if (text === null) return EMPTY_DRAFT;
  try {
    return draftFromUnknown(JSON.parse(text) as unknown);
  } catch {
    return EMPTY_DRAFT;
  }
}

/** A Map-backed store: the fallback when IndexedDB is unavailable. */
export function memoryStore(): AsyncStore {
  const data = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(data.get(key)),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

/** IndexedDB through idb-keyval, or null where IndexedDB is missing or access throws. */
export function indexedDbStore(): AsyncStore | null {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const store = createStore('pinout-finder', 'kv');
    return { get: (key) => get(key, store), set: (key, value) => set(key, value, store) };
  } catch {
    return null;
  }
}

/**
 * Wraps a primary store: the first failure (read or write) switches to memory for the rest of the
 * session, keeping the last value so nothing in the open tab is lost.
 */
export class SafeStore {
  private store: AsyncStore;
  private fallback: AsyncStore | null = null;

  constructor(primary: AsyncStore | null) {
    this.store = primary ?? this.toMemory();
  }

  get backend(): StorageBackend {
    return this.fallback === null ? 'indexeddb' : 'memory';
  }

  private toMemory(): AsyncStore {
    this.fallback ??= memoryStore();
    return this.fallback;
  }

  async get(key: string): Promise<unknown> {
    try {
      return await this.store.get(key);
    } catch {
      this.store = this.toMemory();
      return undefined;
    }
  }

  /** Saves a JSON copy; returns false when it could only be kept in memory. */
  async set(key: string, value: unknown): Promise<boolean> {
    const copy = JSON.parse(JSON.stringify(value)) as unknown;
    try {
      await this.store.set(key, copy);
      return this.fallback === null;
    } catch {
      this.store = this.toMemory();
      await this.store.set(key, copy);
      return false;
    }
  }
}

export async function loadDraft(store: SafeStore): Promise<ProjectDraft> {
  return draftFromUnknown(await store.get(DRAFT_KEY));
}

export function saveDraft(store: SafeStore, draft: ProjectDraft): Promise<boolean> {
  return store.set(DRAFT_KEY, draft);
}
