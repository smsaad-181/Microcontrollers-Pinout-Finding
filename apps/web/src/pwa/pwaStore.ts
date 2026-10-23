// Service-worker state shared with React, kept apart from `virtual:pwa-register` so the UI (and its
// tests) never import the registration code.
import { useSyncExternalStore } from 'react';

export interface PwaState {
  /** A new version (app or catalog) is downloaded and waiting. */
  needRefresh: boolean;
  /** Everything needed to work offline is cached. */
  offlineReady: boolean;
}

let state: PwaState = { needRefresh: false, offlineReady: false };
let applyUpdate: () => void = () => undefined;
const listeners = new Set<() => void>();

export function setPwaState(next: Partial<PwaState>): void {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

/** Registers the function that activates the waiting service worker and reloads. */
export function setUpdateHandler(fn: () => void): void {
  applyUpdate = fn;
}

export function updateNow(): void {
  applyUpdate();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => state;

export function usePwaState(): PwaState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
