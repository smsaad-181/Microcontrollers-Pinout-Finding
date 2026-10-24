// Per-browser preferences (not part of a project): when the engine worker is stopped.
import { isRecord } from './storage';

/** Choices for the hard stop, in seconds. The notice at 2 s always comes first. */
export const STOP_AFTER_CHOICES = [5, 10, 30, 60] as const;
export const DEFAULT_STOP_AFTER_S = 10;

export interface Settings {
  stopAfterS: number;
}

export const DEFAULT_SETTINGS: Settings = { stopAfterS: DEFAULT_STOP_AFTER_S };

export function parseSettings(v: unknown): Settings {
  if (!isRecord(v)) return DEFAULT_SETTINGS;
  const s = v.stopAfterS;
  return {
    stopAfterS:
      typeof s === 'number' && (STOP_AFTER_CHOICES as readonly number[]).includes(s)
        ? s
        : DEFAULT_STOP_AFTER_S,
  };
}
