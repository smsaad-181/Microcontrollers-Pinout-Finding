// Signal expander (task 2b.4): turns a project (board + variant + module instances) into the signals the
// solver must place, with role, direction, drive type, peripheral, max clock, shareability and resting
// level at reset. Direction is seen from the MCU pin (a device input is an MCU output).
import type { ClaimId, Project } from '@pinout/schema';
import {
  prov,
  sortedUnique,
  weakest,
  type CatalogIndex,
  type InterfaceKind,
  type Prov,
} from './catalog.js';
import { isBusRole, selectInterfaces } from './interfaces.js';
import { normRole, wiringFor } from './wiring.js';

export type SignalPeripheral =
  | 'SPI.SCK'
  | 'SPI.MOSI'
  | 'SPI.MISO'
  | 'I2C.SDA'
  | 'I2C.SCL'
  | 'UART.TX'
  | 'UART.RX'
  | 'ONEWIRE'
  | 'ADC'
  | 'GPIO'
  | 'GPIO.IRQ';

export interface ExpandedSignal {
  /** `<instance>.<role>`; repeated roles carry an index, e.g. `relays.COIL[2]`. */
  id: string;
  instance: string;
  breakout: string;
  ic: string;
  interface: InterfaceKind;
  /** Role as the IC catalog names it (e.g. SCLK, COIL). */
  role: string;
  /** Breakout pin label carrying the signal, when known. */
  pinLabel?: string;
  /** MCU-side direction. */
  dir: 'in' | 'out' | 'io';
  /** Direction on the device side, as in the catalog. */
  deviceDir: 'in' | 'out' | 'io';
  drive: 'push-pull' | 'open-drain' | 'open-collector';
  /** The MCU function the pad must provide. */
  peripheral: SignalPeripheral;
  /** True when a UART line is crossed (device TX is the MCU RX). */
  crossover?: boolean;
  /** Device clock limit in Hz (null: not stated or not a clocked line). */
  maxHz: number | null;
  maxHzFact?: Prov<number>;
  shareable: 'bus' | 'exclusive';
  /** Relay, LED, MOSFET gate or buzzer input: a "load" in the risk score. */
  actsOnLevel: boolean;
  /** Level on the line while the MCU pad is at reset; `float` when the catalog does not state it. */
  restingLevelAtReset: 'high' | 'low' | 'float';
  restingKnown: boolean;
  needsPull?: 'up' | 'down';
  /** MISO only: whether the catalog proves the line is released when deselected (null = unproven). */
  miso?: { shareProven: boolean | null };
  lockedPad?: string;
  evidence: ClaimId[];
}

export interface ExpandDiagnostic {
  level: 'warning' | 'info';
  code: 'NO_INTERFACE' | 'BREAKOUT_PIN_UNMAPPED' | 'LOCK_UNMATCHED';
  instance: string;
  message: string;
}

export type ExpandResult =
  | { status: 'ok'; signals: ExpandedSignal[]; diagnostics: ExpandDiagnostic[] }
  | { status: 'needs_variant'; candidates: string[] }
  | { status: 'error'; code: string; message: string };

const IRQ_ROLES = new Set(['IRQ', 'INT', 'ALERT']);

function peripheralFor(kind: InterfaceKind, role: string): SignalPeripheral {
  const r = normRole(role);
  switch (kind) {
    case 'i2c':
      if (r === 'SDA') return 'I2C.SDA';
      if (r === 'SCL') return 'I2C.SCL';
      break;
    case 'spi':
      if (r === 'SCK') return 'SPI.SCK';
      if (r === 'MOSI') return 'SPI.MOSI';
      if (r === 'MISO') return 'SPI.MISO';
      break;
    case 'uart':
      if (r === 'TX') return 'UART.RX';
      if (r === 'RX') return 'UART.TX';
      break;
    case 'analog':
      return 'ADC';
    case 'onewire':
      return 'ONEWIRE';
    case 'digital':
      break;
  }
  return IRQ_ROLES.has(r) ? 'GPIO.IRQ' : 'GPIO';
}

const flip = (d: 'in' | 'out' | 'io'): 'in' | 'out' | 'io' =>
  d === 'in' ? 'out' : d === 'out' ? 'in' : 'io';

export function expandSignals(
  index: CatalogIndex,
  project: Project,
  interfaces?: Readonly<Record<string, InterfaceKind>>,
): ExpandResult {
  const selection = selectInterfaces(index, project);
  if (selection.status !== 'ok') return selection;
  const signals: ExpandedSignal[] = [];
  const diagnostics: ExpandDiagnostic[] = [];

  for (const m of project.modules) {
    const breakout = index.breakout(m.breakout);
    const ic = breakout ? index.ic(breakout.ic) : undefined;
    const choice = selection.modules.find((x) => x.instance === m.instance);
    if (!breakout || !ic || !choice) continue;
    const kind = interfaces?.[m.instance] ?? choice.chosen;
    const wiring = kind ? wiringFor(breakout, ic, kind) : undefined;
    if (!kind || !wiring) {
      diagnostics.push({
        level: 'warning',
        code: 'NO_INTERFACE',
        instance: m.instance,
        message: `no feasible interface for ${m.instance} (${m.breakout})`,
      });
      continue;
    }
    for (const label of wiring.unmapped) {
      diagnostics.push({
        level: 'info',
        code: 'BREAKOUT_PIN_UNMAPPED',
        instance: m.instance,
        message: `breakout pin ${label} carries no ${kind} signal`,
      });
    }
    const limits = wiring.iface.limits;
    const facts: Prov<number>[] = [];
    if (limits.max_hz) facts.push(prov(limits.max_hz));
    if (limits.tscyc_min_s) {
      const t = prov(limits.tscyc_min_s);
      if (t.value !== null && t.value > 0) {
        facts.push({ value: Math.floor(1 / t.value), status: t.status, evidence: t.evidence });
      } else facts.push({ value: null, status: t.status, evidence: t.evidence });
    }
    const known = facts.flatMap((f) => (f.value === null ? [] : [f.value]));
    const maxHz = known.length > 0 ? Math.min(...known) : null;
    const maxHzFact: Prov<number> | undefined =
      facts.length > 0
        ? {
            value: maxHz,
            status: weakest(facts.map((f) => f.status)),
            evidence: sortedUnique(facts.flatMap((f) => f.evidence)),
          }
        : undefined;
    const misoFact = limits.miso_tristate_when_deselected;

    for (const w of wiring.wired) {
      const s = w.signal;
      const count = Math.max(1, w.labels.length);
      for (let i = 0; i < count; i++) {
        const bus = isBusRole(kind, s.role);
        const role = s.role;
        const idRole = count > 1 ? `${role}[${String(i + 1)}]` : role;
        const open = s.drive === 'open-drain' || s.drive === 'open-collector';
        const label = w.labels[i];
        const lockedPad = project.locked.find(
          (l) => l.instance === m.instance && l.role === idRole,
        )?.pad;
        signals.push({
          id: `${m.instance}.${idRole}`,
          instance: m.instance,
          breakout: breakout.id,
          ic: ic.id,
          interface: kind,
          role,
          ...(label === undefined ? {} : { pinLabel: label }),
          dir: flip(s.dir),
          deviceDir: s.dir,
          drive: s.drive,
          peripheral: peripheralFor(kind, role),
          ...(kind === 'uart' && ['TX', 'RX'].includes(normRole(role)) ? { crossover: true } : {}),
          maxHz: bus ? maxHz : null,
          ...(bus && maxHzFact ? { maxHzFact } : {}),
          shareable: bus ? 'bus' : 'exclusive',
          actsOnLevel: s.acts_on_level === true,
          restingLevelAtReset: s.resting_level ?? 'float',
          restingKnown: s.resting_level !== undefined,
          ...(open ? { needsPull: 'up' as const } : {}),
          ...(kind === 'spi' && normRole(role) === 'MISO'
            ? { miso: { shareProven: misoFact ? prov(misoFact).value : null } }
            : {}),
          ...(lockedPad === undefined ? {} : { lockedPad }),
          evidence: bus && maxHzFact ? maxHzFact.evidence : [],
        });
      }
    }
  }

  for (const l of project.locked) {
    if (!signals.some((s) => s.instance === l.instance && s.id === `${l.instance}.${l.role}`)) {
      diagnostics.push({
        level: 'warning',
        code: 'LOCK_UNMATCHED',
        instance: l.instance,
        message: `locked role ${l.role} matches no signal of ${l.instance}`,
      });
    }
  }
  return { status: 'ok', signals, diagnostics };
}
