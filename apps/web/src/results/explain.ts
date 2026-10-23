// Presentation helpers for an engine Recommendation: plain-language text for warning levels,
// conflict and relaxation tokens, and wiring rows. Pure; reads the engine's answer, decides nothing.
import type { Recommendation, Warning } from '@pinout/schema';

export type WarningLevel = Warning['level'];
export type Assignment = Recommendation['assignments'][number];
export type RequiredPart = Recommendation['required_parts'][number];

/** Level order, most severe first. Each level has a text label and an icon (never colour alone). */
export const WARNING_LEVELS: readonly WarningLevel[] = ['critical', 'warning', 'caution', 'info'];

export const LEVEL_META: Record<WarningLevel, { label: string; icon: string; hint: string }> = {
  critical: {
    label: 'Critical',
    icon: '⛔',
    hint: 'Can damage hardware or stop the board booting.',
  },
  warning: { label: 'Warning', icon: '▲', hint: 'Likely to misbehave unless you apply the fix.' },
  caution: {
    label: 'Caution',
    icon: '◆',
    hint: 'A fact is unverified or missing; check it yourself.',
  },
  info: { label: 'Info', icon: 'ℹ', hint: 'Good to know; no action needed.' },
};

/** Warnings sorted by severity, then code (stable for equal keys). */
export function sortWarnings(warnings: readonly Warning[]): Warning[] {
  return [...warnings].sort(
    (a, b) =>
      WARNING_LEVELS.indexOf(a.level) - WARNING_LEVELS.indexOf(b.level) ||
      a.code.localeCompare(b.code),
  );
}

export function countByLevel(warnings: readonly Warning[]): Record<WarningLevel, number> {
  const out: Record<WarningLevel, number> = { critical: 0, warning: 0, caution: 0, info: 0 };
  for (const w of warnings) out[w.level] += 1;
  return out;
}

/** Names for ids in tokens (breakout id -> display name). */
export interface NameLookup {
  breakout: (id: string) => string | undefined;
}

const split = (token: string): [string, string] => {
  const at = token.indexOf(':');
  return at === -1 ? [token, ''] : [token.slice(0, at), token.slice(at + 1)];
};

/** Plain-language text for one `unsat.minimal_conflict` token (unknown tokens are shown raw). */
export function describeConflict(token: string, names: NameLookup): string {
  const [kind, detail] = split(token);
  switch (kind) {
    case 'locked':
      return `Your locked pin ${detail}.`;
    case 'reserved':
      return `Your reserved pin ${detail}.`;
    case 'consumed':
      return `${detail} is used on the module or board itself (for example flash, PSRAM or USB).`;
    case 'adc2-wifi':
      return `${detail} is an ADC2 channel, which cannot be read while Wi-Fi is on.`;
    case 'adc':
      return `Not enough usable ADC channels (${detail}).`;
    case 'strap':
      return `${detail} is a strapping pin that this signal could disturb at boot.`;
    case 'i2c-address': {
      const [breakout, what] = detail.split(':');
      const name = breakout === undefined ? detail : (names.breakout(breakout) ?? breakout);
      return `I2C addresses: ${name}${what === undefined ? '' : ` (${what.replaceAll('-', ' ')})`}.`;
    }
    case 'i2c-controllers': {
      const [chip, n] = detail.split(':');
      return `The ${chip ?? 'chip'} has ${n ?? 'a limited number of'} I2C controller(s).`;
    }
    default:
      return token;
  }
}

/** Plain-language text for one ranked relaxation token (unknown tokens are shown raw). */
export function describeRelaxation(token: string, names: NameLookup): string {
  const [kind, detail] = split(token);
  switch (kind) {
    case 'unlock':
      return `Unlock ${detail} and let the engine choose its pin.`;
    case 'wifi':
      return detail === 'false' ? 'Turn Wi-Fi off for this project.' : `Set Wi-Fi to ${detail}.`;
    case 'remove-module':
      return `Remove ${names.breakout(detail) ?? detail} from the project.`;
    case 'add-external-adc':
      return `Add an external ADC (${names.breakout(detail) ?? detail}).`;
    case 'different-variant':
      return `Use the board variant ${detail}.`;
    case 'add-i2c-multiplexer':
      return 'Add an I2C multiplexer so devices with the same address sit on separate channels.';
    default:
      return token;
  }
}

export interface WiringRow {
  instance: string;
  role: string;
  /** Pin label printed on the module, when the catalog maps it. */
  modulePin: string | null;
  gpio: number;
  pad: string;
  boardLabel: string;
  connector: string;
  position: number;
  /** Extra parts the engine requires on this pad (empty = wire directly). */
  parts: RequiredPart[];
}

/** One row per assignment, in the engine's order, with the parts the engine attached to its pad. */
export function wiringRows(rec: Recommendation, pinLabels: Record<string, string>): WiringRow[] {
  return rec.assignments.map((a) => ({
    instance: a.instance,
    role: a.role,
    modulePin: pinLabels[`${a.instance}.${a.role}`] ?? null,
    gpio: a.gpio,
    pad: a.pad,
    boardLabel: a.label,
    connector: a.connector,
    position: a.position,
    parts: rec.required_parts.filter((p) => p.pads?.includes(a.pad) ?? false),
  }));
}

/** "10 kΩ pull-down resistor" style text for a required part. */
export function describePart(p: RequiredPart): string {
  const value = p.value === undefined ? '' : `${p.value} `;
  return `${value}${p.role} ${p.kind}`.trim();
}

/** Header position text, e.g. "J3 pin 12". */
export const headerPosition = (connector: string, position: number): string =>
  `${connector} pin ${String(position)}`;

/** Interface kinds as users read them. */
export const INTERFACE_LABELS: Record<string, string> = {
  i2c: 'I²C',
  spi: 'SPI',
  uart: 'UART',
  onewire: '1-Wire',
  analog: 'Analog',
  digital: 'Digital',
};
