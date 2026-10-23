// Pin-view composer (task 2b.2): stacks Chip -> Module(variant) -> Board and computes, for every connector
// pin, the effective capabilities with provenance. Everything is derived from catalog data; there is no
// per-board logic. Engine rules (schema round 2b): the selected variant module's `consumed` decides what
// is unusable (never inferred from `bonded_pads`); a pad may have no GPIO number; a strap's default pull
// is optional.
import type {
  Board,
  Chip,
  ClaimId,
  ConnectorPin,
  Module,
  Pad,
  PadFunction,
  Routing,
} from '@pinout/schema';
import { boardRef, isWeak, prov, sortedUnique, type CatalogIndex, type Prov } from './catalog.js';

export type PinFlag =
  | 'input-only'
  | 'strap'
  | 'consumed'
  | 'onboard'
  | 'jtag'
  | 'power-up-glitch'
  | 'adc-radio-conflict'
  | 'unverified';

const FLAG_ORDER: readonly PinFlag[] = [
  'input-only',
  'strap',
  'consumed',
  'onboard',
  'jtag',
  'power-up-glitch',
  'adc-radio-conflict',
  'unverified',
];

export type StrapValue = Pad['strap']['value'];
export type PowerUpGlitch = Pad['power_up_glitch']['value'];
export type ResetState = Pad['reset_state']['value'];

export interface ComposedFunction {
  fn: string;
  routing: Routing;
  maxHz: Prov<number> | null;
}

/** One way a pad can carry a peripheral role (IO_MUX, GPIO matrix or fixed), with its clock limit. */
export interface CarryOption {
  /** Chip peripheral instance, e.g. 'SPI3'. */
  peripheral: string;
  /** Lower-case role, e.g. 'sck'; '*' for the GPIO matrix (any role of the peripheral). */
  role: string;
  routing: Routing;
  maxHz: Prov<number> | null;
}

export interface OnboardUse {
  part: string;
  effect: string;
  evidence: ClaimId[];
}

export interface ComposedPin {
  connector: string;
  position: number;
  label: string;
  kind: ConnectorPin['kind'];
  pad?: string;
  gpio?: number;
  /** `<connector>:<position>` of the primary pin when this pin is an alias of another header pin. */
  aliasOf?: string;
  /** True when the pad exists, is bonded and is not consumed by the module. */
  usable: boolean;
  unusableReason?: 'consumed' | 'not-bonded' | 'no-pad';
  consumed?: { by: Prov<string> };
  functions: ComposedFunction[];
  carries: CarryOption[];
  inputOnly: Prov<boolean>;
  resetState: Prov<ResetState>;
  strap: Prov<StrapValue>;
  powerUpGlitch: Prov<PowerUpGlitch>;
  jtag?: string;
  adc?: { unit: string; channel: number; radioConflict: Prov<boolean> };
  dac?: { channel: number };
  touch?: { channel: number };
  errata: string[];
  pinCurrentMaxMa: Prov<number>;
  onboard: OnboardUse[];
  flags: PinFlag[];
  /** Sorted, de-duplicated claim ids behind the composed view of this pin. */
  evidence: ClaimId[];
}

export interface UnavailablePad {
  pad: string;
  reason: 'consumed' | 'not-bonded';
  by: string | null;
  status: Prov<string>['status'];
  evidence: ClaimId[];
  /** True when a connector pin of this board is wired to the pad (e.g. WROVER-E GPIO16/17 on the DevKitC). */
  onConnector: boolean;
}

export interface ComposedView {
  board: string;
  variant: { id: string; module: string; chip: string };
  logicVoltage: Prov<number>;
  pins: ComposedPin[];
  unavailablePads: UnavailablePad[];
  /** Claim ids of the module facts that decide which pads are free (PSRAM fitted, consumed pads). */
  moduleEvidence: ClaimId[];
}

export type ComposeResult =
  | { status: 'ok'; view: ComposedView }
  | { status: 'needs_variant'; candidates: string[] }
  | { status: 'error'; code: 'UNKNOWN_BOARD' | 'UNKNOWN_MODULE' | 'UNKNOWN_CHIP'; message: string };

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function functionsOf(pad: Pad): ComposedFunction[] {
  return pad.functions.map((f: PadFunction) => ({
    fn: f.fn,
    routing: f.routing,
    maxHz: f.max_hz ? prov(f.max_hz) : null,
  }));
}

function carriesOf(chip: Chip, padId: string, pad: Pad): CarryOption[] {
  const out = new Map<string, CarryOption>();
  const peripherals = Object.entries(chip.peripherals);
  const limitFor = (key: string, routing: Routing): Prov<number> | null => {
    const lim = chip.peripherals[key]?.limits;
    const f =
      routing === 'iomux'
        ? lim?.iomux_max_hz
        : routing === 'matrix'
          ? lim?.matrix_max_hz
          : undefined;
    return f ? prov(f) : null;
  };
  const add = (peripheral: string, role: string, routing: Routing, own: Prov<number> | null) => {
    const k = `${peripheral}|${role}|${routing}`;
    if (!out.has(k))
      out.set(k, { peripheral, role, routing, maxHz: own ?? limitFor(peripheral, routing) });
  };
  // 1. IO_MUX table of the peripheral (the normative source for dedicated pads).
  for (const [key, per] of peripherals) {
    for (const [role, p] of Object.entries(per.iomux_pins ?? {})) {
      if (p === padId) add(key, role.toLowerCase(), 'iomux', null);
    }
  }
  // 2. Pad functions named `<PERIPHERAL>.<ROLE>` (e.g. RP2040 I2C0.SDA).
  for (const f of pad.functions) {
    const dot = f.fn.indexOf('.');
    if (dot < 0) continue;
    const key = peripherals.find(
      ([k]) => k.toLowerCase() === f.fn.slice(0, dot).toLowerCase(),
    )?.[0];
    if (key !== undefined) {
      add(key, f.fn.slice(dot + 1).toLowerCase(), f.routing, f.max_hz ? prov(f.max_hz) : null);
    }
  }
  // 3. GPIO matrix: any GPIO-capable pad can carry any role of a matrix-routable peripheral.
  if (pad.functions.some((f) => f.fn === 'GPIO')) {
    for (const [key, per] of peripherals) {
      if (per.matrix_routable) add(key, '*', 'matrix', null);
    }
  }
  return [...out.values()].sort(
    (a, b) => cmp(a.peripheral, b.peripheral) || cmp(a.role, b.role) || cmp(a.routing, b.routing),
  );
}

function composePin(
  board: Board,
  chip: Chip,
  mod: Module,
  connector: string,
  p: ConnectorPin,
): ComposedPin {
  const padId = p.pad;
  const pad = padId === undefined ? undefined : chip.pads[padId];
  const consumedFact = padId === undefined ? undefined : mod.consumed[padId];
  const bonded = padId !== undefined && mod.bonded_pads.includes(padId);

  const missing = <T>(): Prov<T> => ({ value: null, status: 'missing', evidence: [] });
  const base = {
    connector,
    position: p.position,
    label: p.label,
    kind: p.kind,
    ...(p.alias_of === undefined ? {} : { aliasOf: p.alias_of }),
  };

  if (padId === undefined || !pad) {
    return {
      ...base,
      usable: false,
      unusableReason: 'no-pad' as const,
      ...(padId === undefined ? {} : { pad: padId }),
      functions: [],
      carries: [],
      inputOnly: missing(),
      resetState: missing(),
      strap: missing(),
      powerUpGlitch: missing(),
      errata: [],
      pinCurrentMaxMa: missing(),
      onboard: [],
      flags: [],
      evidence: [],
    };
  }

  const onboard: OnboardUse[] = board.onboard
    .filter((o) => o.uses_pad.includes(padId))
    .map((o) => ({ part: o.part, effect: o.effect, evidence: [...o.evidence] }));
  const inputOnly = prov(pad.input_only);
  const resetState = prov(pad.reset_state);
  const strap = prov(pad.strap);
  const glitch = prov(pad.power_up_glitch);
  const current = prov(chip.electrical.pin_current_max);
  const adc = pad.adc
    ? { unit: pad.adc.unit, channel: pad.adc.channel, radioConflict: prov(pad.adc.radio_conflict) }
    : undefined;
  const consumed = consumedFact ? { by: prov(consumedFact) as Prov<string> } : undefined;

  const flags = new Set<PinFlag>();
  if (inputOnly.value === true) flags.add('input-only');
  if (strap.value !== null && strap.value !== 'none') flags.add('strap');
  if (consumed) flags.add('consumed');
  if (onboard.length > 0) flags.add('onboard');
  if (pad.jtag !== undefined) flags.add('jtag');
  if (glitch.value !== null && glitch.value !== 'none') flags.add('power-up-glitch');
  if (adc?.radioConflict.value === true) flags.add('adc-radio-conflict');
  if ([inputOnly, resetState, strap, glitch].some((f) => isWeak(f.status))) flags.add('unverified');

  const evidence = sortedUnique([
    ...inputOnly.evidence,
    ...resetState.evidence,
    ...strap.evidence,
    ...glitch.evidence,
    ...current.evidence,
    ...(adc?.radioConflict.evidence ?? []),
    ...(consumed?.by.evidence ?? []),
    ...onboard.flatMap((o) => o.evidence),
  ]);

  const usable = !consumed && bonded;
  return {
    ...base,
    pad: padId,
    ...(pad.gpio === undefined ? {} : { gpio: pad.gpio }),
    usable,
    ...(usable
      ? {}
      : { unusableReason: consumed ? ('consumed' as const) : ('not-bonded' as const) }),
    ...(consumed ? { consumed } : {}),
    functions: functionsOf(pad),
    carries: carriesOf(chip, padId, pad),
    inputOnly,
    resetState,
    strap,
    powerUpGlitch: glitch,
    ...(pad.jtag === undefined ? {} : { jtag: pad.jtag }),
    ...(adc ? { adc } : {}),
    ...(pad.dac ? { dac: { channel: pad.dac.channel } } : {}),
    ...(pad.touch ? { touch: { channel: pad.touch.channel } } : {}),
    errata: [...pad.errata],
    pinCurrentMaxMa: current,
    onboard,
    flags: FLAG_ORDER.filter((f) => flags.has(f)),
    evidence,
  };
}

/** Stack Chip -> Module(variant) -> Board. `variantId` must name a variant of the board revision. */
export function composePinView(index: CatalogIndex, ref: string, variantId: string): ComposeResult {
  const board = index.board(ref);
  if (!board) return { status: 'error', code: 'UNKNOWN_BOARD', message: `unknown board ${ref}` };
  const variant = board.variants.find((v) => v.id === variantId);
  if (!variant) {
    return { status: 'needs_variant', candidates: board.variants.map((v) => v.id).sort(cmp) };
  }
  const mod = index.module(variant.module);
  if (!mod) {
    return { status: 'error', code: 'UNKNOWN_MODULE', message: `unknown module ${variant.module}` };
  }
  const chip = index.chip(mod.chip);
  if (!chip) return { status: 'error', code: 'UNKNOWN_CHIP', message: `unknown chip ${mod.chip}` };

  const pins: ComposedPin[] = [];
  for (const c of board.connectors) {
    for (const p of [...c.pins].sort((a, b) => a.position - b.position)) {
      pins.push(composePin(board, chip, mod, c.id, p));
    }
  }

  const onConnector = new Set(board.connectors.flatMap((c) => c.pins.map((p) => p.pad)));
  const unavailablePads: UnavailablePad[] = [];
  for (const [pad, f] of Object.entries(mod.consumed)) {
    const pr = prov(f) as Prov<string>;
    unavailablePads.push({
      pad,
      reason: 'consumed',
      by: pr.value,
      status: pr.status,
      evidence: pr.evidence,
      onConnector: onConnector.has(pad),
    });
  }
  for (const pad of Object.keys(chip.pads)) {
    if (mod.bonded_pads.includes(pad) || pad in mod.consumed) continue;
    unavailablePads.push({
      pad,
      reason: 'not-bonded',
      by: null,
      status: 'verified',
      evidence: [],
      onConnector: onConnector.has(pad),
    });
  }
  unavailablePads.sort((a, b) => cmp(a.pad, b.pad));

  return {
    status: 'ok',
    view: {
      board: boardRef(board),
      variant: { id: variant.id, module: mod.id, chip: chip.id },
      logicVoltage: prov(board.logic_voltage),
      pins,
      unavailablePads,
      moduleEvidence: sortedUnique([
        ...(mod.psram ? prov(mod.psram).evidence : []),
        ...Object.values(mod.consumed).flatMap((f) => prov(f).evidence),
      ]),
    },
  };
}

/** Connector pins wired to a chip pad (more than one for aliased headers such as Uno A4/SDA). */
export function pinsForPad(view: ComposedView, pad: string): ComposedPin[] {
  return view.pins.filter((p) => p.pad === pad);
}
