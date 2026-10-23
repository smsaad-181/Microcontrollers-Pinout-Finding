// Draft persistence for the current tab. Storage can be missing or throw (private windows, blocked
// site data), so every access is wrapped and the app keeps working from memory.
import { EMPTY_DRAFT, FRAMEWORKS, type ProjectDraft } from './draft';

const KEY = 'pinout-finder:draft:v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses a stored draft; anything malformed gives the empty draft. */
export function parseDraft(text: string | null): ProjectDraft {
  if (text === null) return EMPTY_DRAFT;
  try {
    const v = JSON.parse(text) as unknown;
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
    const framework = (FRAMEWORKS as readonly unknown[]).includes(v.framework)
      ? (v.framework as ProjectDraft['framework'])
      : null;
    return {
      board: str(v.board),
      variant: str(v.variant),
      modules: modules.map((m) => ({ breakout: m.breakout, instance: m.instance })),
      locked: locked.map((l) => ({ instance: l.instance, role: l.role, pad: l.pad })),
      reserved: isStringArray(v.reserved) ? v.reserved : [],
      framework,
      wifi: v.wifi === true,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function readDraft(store: KeyValueStore | null): ProjectDraft {
  if (store === null) return EMPTY_DRAFT;
  try {
    return parseDraft(store.getItem(KEY));
  } catch {
    return EMPTY_DRAFT;
  }
}

/** Saves the draft; returns false when storage is unavailable (the app continues in memory). */
export function writeDraft(store: KeyValueStore | null, draft: ProjectDraft): boolean {
  if (store === null) return false;
  try {
    store.setItem(KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** `sessionStorage`, or null where it is missing or access throws. */
export function sessionStore(): KeyValueStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
