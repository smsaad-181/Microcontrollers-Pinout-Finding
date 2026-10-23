// Pure integrity checks over parsed entities that need no other entity (README decisions 16-18).
import type { Chip } from '@pinout/schema';

export interface IntegrityIssue {
  path: string;
  message: string;
}

/**
 * Pad keys of the form `GPIO<n>`, `GP<n>`, `IO<n>` or `BCM<n>` (any case) name their GPIO number.
 * Every other naming scheme (`PA5`, `D13`, `P0.13`, ...) is free: only uniqueness is checked for it.
 */
export const GPIO_STYLE_PAD = /^(?:GPIO|GP|IO|BCM)(\d+)$/i;

/** E_PAD_KEY: a GPIO-style pad key must equal `gpio`, and `gpio` is unique per chip. */
export function checkChipPads(chip: Chip): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const firstByGpio = new Map<number, string>();
  for (const [key, pad] of Object.entries(chip.pads)) {
    const path = `pads.${key}.gpio`;
    const named = GPIO_STYLE_PAD.exec(key);
    if (named && Number(named[1]) !== pad.gpio) {
      issues.push({
        path,
        message: `pad "${key}" is named for GPIO ${String(Number(named[1]))} but has ${pad.gpio === undefined ? 'no gpio' : `gpio: ${String(pad.gpio)}`}`,
      });
    }
    if (pad.gpio === undefined) continue; // a pad that is not a GPIO is identified by its key alone
    const first = firstByGpio.get(pad.gpio);
    if (first !== undefined) {
      issues.push({
        path,
        message: `gpio ${String(pad.gpio)} is already used by pad "${first}"; chip GPIO numbers are unique`,
      });
    } else {
      firstByGpio.set(pad.gpio, key);
    }
  }
  return issues;
}
