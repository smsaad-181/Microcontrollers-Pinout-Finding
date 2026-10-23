// Which signals of an IC interface are actually wired to pins of a breakout. Shared by the interface
// selector (pin cost) and the signal expander. Pure catalog reading; no per-part logic.
import type { Breakout, IC, Interface, Signal } from '@pinout/schema';
import type { InterfaceKind } from './catalog.js';

export interface WiredSignal {
  signal: Signal;
  /** Breakout pin labels carrying this signal (several for e.g. a 4-channel relay board). */
  labels: string[];
}

export interface Wiring {
  kind: InterfaceKind;
  iface: Interface;
  wired: WiredSignal[];
  /** Breakout pins that map to no signal of the interface and are not power/ground/NC. */
  unmapped: string[];
  /** True when no breakout pin matched any signal and every signal was assumed wired once. */
  assumedAll: boolean;
}

const ALIASES: Record<string, string> = { SCLK: 'SCK', RES: 'RST', RESET: 'RST' };
export const normRole = (r: string): string => {
  const u = r.trim().toUpperCase();
  return ALIASES[u] ?? u;
};
const NON_SIGNAL = new Set(['VCC', 'GND', 'NC']);

export function wiringFor(breakout: Breakout, ic: IC, kind: InterfaceKind): Wiring | undefined {
  const iface = ic.interfaces.find((i) => i.kind === kind);
  if (!iface) return undefined;
  const byRole = new Map<string, WiredSignal>();
  for (const s of iface.signals) byRole.set(normRole(s.role), { signal: s, labels: [] });
  const unmapped: string[] = [];
  for (const pin of breakout.pins) {
    let hit = false;
    for (const token of pin.maps_to.split('/')) {
      const t = normRole(token);
      const w = byRole.get(t);
      if (w) {
        w.labels.push(pin.label);
        hit = true;
      }
    }
    const tokens = pin.maps_to.split('/').map(normRole);
    if (!hit && !tokens.every((t) => NON_SIGNAL.has(t))) unmapped.push(pin.label);
  }
  const wired = [...byRole.values()].filter((w) => w.labels.length > 0);
  if (wired.length === 0) {
    return {
      kind,
      iface,
      wired: iface.signals.map((s) => ({ signal: s, labels: [] })),
      unmapped: [],
      assumedAll: true,
    };
  }
  // keep the IC's signal order
  const order = iface.signals.map((s) => normRole(s.role));
  wired.sort(
    (a, b) => order.indexOf(normRole(a.signal.role)) - order.indexOf(normRole(b.signal.role)),
  );
  return { kind, iface, wired, unmapped, assumedAll: false };
}

/** Number of MCU pins a wired signal occupies (one per breakout pin; one when assumed). */
export const signalPinCount = (w: WiredSignal): number => Math.max(1, w.labels.length);
