// Pure data layer of the pinout diagram: groups, function classification, pills and filters.
// Everything shown comes from the catalog (chip pad functions, strap, ADC, input-only, board pins);
// a pad without a function list shows only its GPIO and kind. Nothing is invented.
import type { Catalog } from '@pinout/engine';
import type { Chip, Pad } from '@pinout/schema';
import type { ViewConnector, ViewPin } from '../../catalog/boardView';

export const PIN_GROUPS = [
  'gpio',
  'i2c',
  'spi',
  'uart',
  'analog',
  'power',
  'ground',
  'assigned',
] as const;
export type PinGroup = (typeof PIN_GROUPS)[number];

export const GROUP_LABEL: Record<PinGroup, string> = {
  gpio: 'GPIO',
  i2c: 'I2C',
  spi: 'SPI',
  uart: 'UART',
  analog: 'Analog',
  power: 'Power',
  ground: 'Ground',
  assigned: 'Assigned',
};

/** Visual class of a pill. `other` is a plain GPIO function (touch, JTAG, RTC ...). */
export type PillKind =
  | 'label'
  | 'i2c'
  | 'spi'
  | 'uart'
  | 'analog'
  | 'power'
  | 'ground'
  | 'strap'
  | 'restricted'
  | 'assigned'
  | 'other'
  | 'more';

export interface Pill {
  kind: PillKind;
  text: string;
  /** Filter group this pill belongs to (dimmed with the filter), when it has one. */
  group: PinGroup | null;
}

export interface PinFunction {
  fn: string;
  text: string;
  kind: 'i2c' | 'spi' | 'uart' | 'analog' | 'other';
  routing: string;
}

export interface PinoutPin extends ViewPin {
  key: string;
  gpio: number | null;
  /** Functions of the pad from the catalog (without the plain "GPIO"). Empty when unknown. */
  functions: PinFunction[];
  groups: Set<PinGroup>;
  /** Strap, input-only, radio conflict, glitch, errata, restriction. */
  warnings: string[];
  /** Assigned module signals ("bme280.SDA"). */
  assigned: string[];
  evidence: string[];
  /** Facts shown in the info panel as "Name: value". */
  facts: { name: string; value: string }[];
  /** False when the pad has no catalog record (only GPIO number and kind are shown). */
  hasPad: boolean;
}

export interface PinoutConnector {
  id: string;
  side: ViewConnector['side'];
  pins: PinoutPin[];
}

export const pinKey = (p: Pick<ViewPin, 'connector' | 'position'>): string =>
  `${p.connector}:${String(p.position)}`;

const RE_I2C = /I2C|^SCL\d|^SDA\d/i;
const RE_SPI = /SPI|MISO|MOSI|^RSPCK|^SSL[AB]/i;
const RE_UART = /UART|^U\d(TX|RX|RT|CT)|^(RXD|TXD|CTS|RTS)\d/i;
const RE_ANALOG = /^(ADC|AN\d|DAC|DA\d|VREF)/i;

/** Classifies a catalog function name; unknown names stay `other`. */
export function classifyFunction(fn: string): PinFunction['kind'] {
  if (RE_ANALOG.test(fn)) return 'analog';
  if (RE_I2C.test(fn)) return 'i2c';
  if (RE_SPI.test(fn)) return 'spi';
  if (RE_UART.test(fn)) return 'uart';
  return 'other';
}

/** "SPI3.SCK" -> "SPI3 SCK", "ADC1_CH4" -> "ADC1 CH4". */
export const functionText = (fn: string): string => fn.replace(/[._]+/g, ' ').trim();

const GROUP_ORDER: Record<PinFunction['kind'], number> = {
  analog: 0,
  uart: 1,
  i2c: 2,
  spi: 3,
  other: 4,
};

export function padFunctions(pad: Pad | undefined): PinFunction[] {
  if (!pad) return [];
  const seen = new Set<string>();
  const out: PinFunction[] = [];
  const add = (fn: string, routing: string) => {
    const text = functionText(fn);
    if (fn === 'GPIO' || seen.has(text)) return;
    seen.add(text);
    out.push({ fn, text, kind: classifyFunction(fn), routing });
  };
  for (const f of pad.functions) add(f.fn, f.routing);
  if (pad.adc && !out.some((f) => f.kind === 'analog' && /^ADC/i.test(f.fn)))
    add(`${pad.adc.unit}_CH${String(pad.adc.channel)}`, 'fixed');
  if (pad.dac && !out.some((f) => /^DAC/i.test(f.fn)))
    add(`DAC_${String(pad.dac.channel)}`, 'fixed');
  if (pad.touch && !out.some((f) => /^TOUCH/i.test(f.fn)))
    add(`TOUCH${String(pad.touch.channel)}`, 'fixed');
  return out;
}

const factValue = <T>(f: { value: T | null } | undefined): T | null => (f ? f.value : null);

function strapOf(pad: Pad): { role: string; required: string } | null {
  const v = factValue(pad.strap);
  return v !== null && typeof v === 'object'
    ? { role: v.role, required: v.required_at_reset }
    : null;
}

function describePad(pad: Pad) {
  const warnings: string[] = [];
  const facts: { name: string; value: string }[] = [];
  const evidence = new Set<string>();
  const cite = (f: { evidence: readonly string[] } | undefined) => {
    for (const e of f?.evidence ?? []) evidence.add(e);
  };
  const strap = strapOf(pad);
  if (strap)
    warnings.push(
      `Strapping pin (${strap.role}): ${
        strap.required === 'any'
          ? 'the level at reset selects a mode'
          : `keep it ${strap.required} at reset for a normal boot`
      }.`,
    );
  cite(pad.strap);
  if (factValue(pad.input_only) === true)
    warnings.push('Input only: this pad cannot drive an output.');
  cite(pad.input_only);
  if (pad.adc) {
    const conflict = factValue(pad.adc.radio_conflict);
    facts.push({ name: 'ADC', value: `${pad.adc.unit} channel ${String(pad.adc.channel)}` });
    if (conflict === true) warnings.push('This ADC channel is unusable while Wi-Fi is on.');
    cite(pad.adc.radio_conflict);
  }
  const glitch = factValue(pad.power_up_glitch);
  if (glitch !== null && typeof glitch === 'object')
    warnings.push(`Power-up glitch: ${glitch.level} for ${String(glitch.duration_s)} s.`);
  cite(pad.power_up_glitch);
  if (pad.errata.length > 0) warnings.push(`Errata: ${pad.errata.join(', ')}.`);
  const reset = factValue(pad.reset_state);
  if (reset !== null) facts.push({ name: 'State at reset', value: reset });
  cite(pad.reset_state);
  if (pad.jtag) facts.push({ name: 'JTAG', value: pad.jtag });
  if (pad.dac) facts.push({ name: 'DAC', value: `channel ${String(pad.dac.channel)}` });
  if (pad.touch) facts.push({ name: 'Touch', value: `channel ${String(pad.touch.channel)}` });
  return {
    warnings,
    facts,
    evidence: [...evidence],
    input: factValue(pad.input_only) === true,
    strap,
  };
}

/** Pins of a board variant enriched with chip pad data; null when the board is unknown. */
export function pinoutConnectors(
  catalog: Catalog,
  ref: string,
  variant: string,
  view: ViewConnector[],
): PinoutConnector[] {
  const board = catalog.boards.find((b) => `${b.id}@${b.revision}` === ref);
  const moduleId = board?.variants.find((v) => v.id === variant)?.module;
  const mod = catalog.modules.find((m) => m.id === moduleId);
  const chip: Chip | undefined = catalog.chips.find((c) => c.id === mod?.chip);
  return view.map((c) => ({
    id: c.id,
    side: c.side,
    pins: c.pins.map((p) => enrichPin(p, p.pad === null ? undefined : chip?.pads[p.pad])),
  }));
}

export function enrichPin(p: ViewPin, pad: Pad | undefined): PinoutPin {
  const functions = padFunctions(pad);
  const info = pad ? describePad(pad) : null;
  const warnings = info ? [...info.warnings] : [];
  if (p.state === 'restricted' && p.detail !== '') warnings.push(`Restricted: ${p.detail}.`);
  const assigned =
    p.state === 'assigned' || p.state === 'bus' ? p.detail.split(', ').filter((s) => s !== '') : [];
  const groups = new Set<PinGroup>();
  if (p.kind === 'gpio') groups.add('gpio');
  if (p.kind === 'power') groups.add('power');
  if (p.kind === 'ground') groups.add('ground');
  if (p.kind === 'analog' || p.kind === 'analog-ref') groups.add('analog');
  for (const f of functions) if (f.kind !== 'other') groups.add(f.kind);
  if (assigned.length > 0) groups.add('assigned');
  return {
    ...p,
    key: pinKey(p),
    gpio: pad?.gpio ?? null,
    functions,
    groups,
    warnings,
    assigned,
    evidence: info?.evidence ?? [],
    facts: info?.facts ?? [],
    hasPad: pad !== undefined,
  };
}

/** Main label of a pin: silkscreen label, plus the GPIO number when the label does not show it. */
export function pinTitle(p: PinoutPin): string {
  if (p.gpio === null || p.kind !== 'gpio') return p.label;
  const g = `GPIO${String(p.gpio)}`;
  const compact = p.label.replace(/[^0-9a-z]/gi, '').toUpperCase();
  return compact === g || compact === `IO${String(p.gpio)}` || compact === `GP${String(p.gpio)}`
    ? p.label
    : `${p.label} · ${g}`;
}

const MAX_FUNCTION_PILLS = 2;
const MAX_ASSIGNED_PILLS = 2;

/** The pills drawn beside a pin, nearest the board first. The panel lists everything. */
export function pinPills(p: PinoutPin): Pill[] {
  const labelKind: PillKind =
    p.kind === 'power'
      ? 'power'
      : p.kind === 'ground'
        ? 'ground'
        : p.kind === 'gpio'
          ? 'label'
          : p.kind === 'analog' || p.kind === 'analog-ref'
            ? 'analog'
            : 'restricted';
  const labelGroup: PinGroup | null =
    p.kind === 'power'
      ? 'power'
      : p.kind === 'ground'
        ? 'ground'
        : p.kind === 'gpio'
          ? 'gpio'
          : null;
  const pills: Pill[] = [{ kind: labelKind, text: pinTitle(p), group: labelGroup }];
  for (const a of p.assigned.slice(0, MAX_ASSIGNED_PILLS))
    pills.push({ kind: 'assigned', text: a, group: 'assigned' });
  if (p.assigned.length > MAX_ASSIGNED_PILLS)
    pills.push({
      kind: 'more',
      text: `+${String(p.assigned.length - MAX_ASSIGNED_PILLS)}`,
      group: 'assigned',
    });
  if (p.state === 'restricted') pills.push({ kind: 'restricted', text: 'Restricted', group: null });
  const extra: Pill[] = [];
  if (p.warnings.some((w) => w.startsWith('Strapping')))
    extra.push({ kind: 'strap', text: 'Strap', group: null });
  if (p.warnings.some((w) => w.startsWith('Input only')))
    extra.push({ kind: 'restricted', text: 'Input only', group: null });
  const fns = [...p.functions].sort((a, b) => GROUP_ORDER[a.kind] - GROUP_ORDER[b.kind]);
  for (const f of fns)
    extra.push({ kind: f.kind, text: f.text, group: f.kind === 'other' ? null : f.kind });
  pills.push(...extra.slice(0, MAX_FUNCTION_PILLS));
  if (extra.length > MAX_FUNCTION_PILLS)
    pills.push({
      kind: 'more',
      text: `+${String(extra.length - MAX_FUNCTION_PILLS)}`,
      group: null,
    });
  return pills;
}

/** A pin matches when no group is selected, or it belongs to any selected group. */
export function matchesFilter(p: PinoutPin, selected: ReadonlySet<PinGroup>): boolean {
  if (selected.size === 0) return true;
  for (const g of selected) if (p.groups.has(g)) return true;
  return false;
}

export function groupCounts(pins: readonly PinoutPin[]): Record<PinGroup, number> {
  const out = Object.fromEntries(PIN_GROUPS.map((g) => [g, 0])) as Record<PinGroup, number>;
  for (const p of pins) for (const g of p.groups) out[g] += 1;
  return out;
}

/** Which column a connector sits in: by side, otherwise alternating by order. */
export function columnOf(c: Pick<PinoutConnector, 'side'>, index: number): 'left' | 'right' {
  if (c.side === 'right') return 'right';
  if (c.side === 'left') return 'left';
  return index % 2 === 0 ? 'left' : 'right';
}

/** Rough text width in SVG units at the diagram font size (no DOM measuring: works in tests). */
export const textWidth = (s: string, size = 13): number => Math.ceil(s.length * size * 0.62);
