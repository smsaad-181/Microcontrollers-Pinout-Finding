// Data for the SVG header view: every connector pin of a board with a display state. Display only;
// which pin a module uses is decided by the engine (assignments) or by the user (locks, reserves).
import type { Catalog } from '@pinout/engine';
import type { ConnectorPin, Recommendation } from '@pinout/schema';
import type { DraftConnection, DraftLock } from '../project/draft';

export const PIN_STATES = [
  'free',
  'assigned',
  'bus',
  'restricted',
  'power',
  'ground',
  'analog',
] as const;
export type PinState = (typeof PIN_STATES)[number];

/** Text for each state; the SVG also gives each state its own shape (never colour alone). */
export const PIN_STATE_META: Record<PinState, { label: string; hint: string }> = {
  free: { label: 'Free', hint: 'GPIO not used by this project' },
  assigned: { label: 'Assigned', hint: 'used by one module signal' },
  bus: { label: 'Bus', hint: 'shared bus signal (I²C or SPI)' },
  restricted: { label: 'Restricted', hint: 'reserved, already wired, used inside the module, or a control pin' },
  power: { label: 'Power', hint: 'supply rail pin' },
  ground: { label: 'Ground', hint: 'ground pin' },
  analog: { label: 'Analog', hint: 'analog-only or reference pin' },
};

export interface ViewPin {
  connector: string;
  position: number;
  label: string;
  kind: ConnectorPin['kind'];
  pad: string | null;
  state: PinState;
  /** What uses the pin, e.g. "env.SDA" or "reserved by you"; empty for free pins. */
  detail: string;
}

export interface ViewConnector {
  id: string;
  side: 'left' | 'right' | 'top' | 'bottom' | null;
  pins: ViewPin[];
}

export interface BoardViewInput {
  reserved: readonly string[];
  connections: readonly DraftConnection[];
  locked: readonly DraftLock[];
  /** The engine result, when there is one (its assignments replace the locks). */
  rec?: Recommendation | null;
}

const BUS_KINDS = new Set(['i2c', 'spi']);
/** Shared-bus signal roles (chip selects, resets and data/command lines are per module). */
export const BUS_ROLES = new Set(['SDA', 'SCL', 'SCK', 'SCLK', 'MOSI', 'MISO', 'SDI', 'SDO', 'COPI', 'CIPO']);
const CONTROL_KINDS: Partial<Record<ConnectorPin['kind'], string>> = {
  reset: 'reset or boot control pin',
  enable: 'enable pin',
  boot: 'boot control pin',
  nc: 'not connected',
};
const SIDE_ORDER = ['left', 'right', 'top', 'bottom'];

/** Header view of a board variant, or null when the board is not in the catalog. */
export function boardView(
  catalog: Catalog,
  ref: string,
  variant: string,
  input: BoardViewInput,
): ViewConnector[] | null {
  const board = catalog.boards.find((b) => `${b.id}@${b.revision}` === ref);
  if (!board) return null;
  const moduleId = board.variants.find((v) => v.id === variant)?.module;
  const consumed = catalog.modules.find((m) => m.id === moduleId)?.consumed ?? {};

  const users = new Map<string, string[]>();
  const busPads = new Set<string>();
  const use = (pad: string, who: string) => {
    users.set(pad, [...(users.get(pad) ?? []), who]);
  };
  if (input.rec) {
    for (const a of input.rec.assignments) {
      use(a.pad, `${a.instance}.${a.role}`);
      const kind = input.rec.interfaces[a.instance]?.kind;
      if (kind !== undefined && BUS_KINDS.has(kind) && BUS_ROLES.has(a.role)) busPads.add(a.pad);
    }
    for (const [pad, who] of users) if (who.length > 1) busPads.add(pad);
  } else {
    for (const l of input.locked) use(l.pad, `${l.instance}.${l.role} (locked)`);
  }
  const reserved = new Set(input.reserved);
  const wired = new Map(input.connections.map((c) => [c.pad, c.note]));

  const stateOf = (p: ConnectorPin): { state: PinState; detail: string } => {
    const pad = p.pad;
    if (pad !== undefined) {
      const who = users.get(pad);
      if (who) return { state: busPads.has(pad) ? 'bus' : 'assigned', detail: who.join(', ') };
      const note = wired.get(pad);
      if (note !== undefined)
        return { state: 'restricted', detail: `existing connection${note ? `: ${note}` : ''}` };
      if (reserved.has(pad)) return { state: 'restricted', detail: 'reserved by you' };
      const inside = consumed[pad];
      if (inside)
        return {
          state: 'restricted',
          detail: `used inside the module (${inside.value ?? 'internal'})`,
        };
    }
    if (p.kind === 'power') return { state: 'power', detail: p.rail ? `rail ${p.rail}` : 'power' };
    if (p.kind === 'ground') return { state: 'ground', detail: 'ground' };
    if (p.kind === 'analog' || p.kind === 'analog-ref')
      return { state: 'analog', detail: p.kind === 'analog-ref' ? 'analog reference' : '' };
    const control = CONTROL_KINDS[p.kind];
    if (control !== undefined) return { state: 'restricted', detail: control };
    return { state: 'free', detail: '' };
  };

  const connectors = board.connectors.map((c) => ({
    id: c.id,
    side: c.side ?? null,
    pins: [...c.pins]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        connector: c.id,
        position: p.position,
        label: p.label,
        kind: p.kind,
        pad: p.pad ?? null,
        ...stateOf(p),
      })),
  }));
  const rank = (s: string | null) => (s === null ? SIDE_ORDER.length : SIDE_ORDER.indexOf(s));
  return connectors
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.side) - rank(b.c.side) || a.i - b.i)
    .map((x) => x.c);
}

/** Spoken description of one pin: position, label, pad, state and use. */
export function pinDescription(p: ViewPin): string {
  const parts = [`${p.connector} pin ${String(p.position)}`, p.label];
  if (p.pad !== null && p.pad !== p.label) parts.push(p.pad);
  parts.push(PIN_STATE_META[p.state].label);
  if (p.detail !== '') parts.push(p.detail);
  return parts.join(', ');
}
