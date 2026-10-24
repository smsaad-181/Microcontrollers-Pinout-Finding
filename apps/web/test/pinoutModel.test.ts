import { describe, expect, it } from 'vitest';
import { boardView } from '../src/catalog/boardView';
import {
  classifyFunction,
  columnOf,
  functionText,
  groupCounts,
  matchesFilter,
  pinPills,
  pinoutConnectors,
} from '../src/components/pinout/model';
import { layoutPinout } from '../src/components/pinout/PinoutDiagram';
import { compiledCatalog } from './realCatalog';

const input = { reserved: [], connections: [], locked: [] };

describe('pinout model', () => {
  it('classifies function names without guessing', () => {
    expect(classifyFunction('I2C0.SDA')).toBe('i2c');
    expect(classifyFunction('RTC_I2C_SCL')).toBe('i2c');
    expect(classifyFunction('SPI3.MISO')).toBe('spi');
    expect(classifyFunction('UART0.TX')).toBe('uart');
    expect(classifyFunction('U0TXD')).toBe('uart');
    expect(classifyFunction('ADC1_CH3')).toBe('analog');
    expect(classifyFunction('TOUCH4')).toBe('other');
    expect(classifyFunction('JTAG.MTMS')).toBe('other');
    expect(functionText('ADC1_CH3')).toBe('ADC1 CH3');
    expect(functionText('SPI3.SCK')).toBe('SPI3 SCK');
  });

  it('places connectors in columns by side, else alternating', () => {
    expect(columnOf({ side: 'right' }, 0)).toBe('right');
    expect(columnOf({ side: 'left' }, 1)).toBe('left');
    expect(columnOf({ side: null }, 0)).toBe('left');
    expect(columnOf({ side: null }, 1)).toBe('right');
  });

  it('builds pins with catalog functions, groups, counts and filters', () => {
    const { catalog } = compiledCatalog();
    const view = boardView(catalog, 'esp32-devkitc-v4@V4', 'esp32-devkitc-32e', input);
    expect(view).not.toBeNull();
    const cons = pinoutConnectors(catalog, 'esp32-devkitc-v4@V4', 'esp32-devkitc-32e', view ?? []);
    const pins = cons.flatMap((c) => c.pins);
    const counts = groupCounts(pins);
    expect(counts.gpio).toBeGreaterThan(10);
    expect(counts.ground).toBeGreaterThan(0);
    expect(counts.power).toBeGreaterThan(0);
    expect(counts.assigned).toBe(0);
    const gnd = pins.find((p) => p.kind === 'ground');
    const gpio = pins.find((p) => p.kind === 'gpio' && p.functions.length > 0);
    expect(gnd && gpio).toBeTruthy();
    if (!gnd || !gpio) return;
    expect(matchesFilter(gnd, new Set())).toBe(true);
    expect(matchesFilter(gnd, new Set(['ground']))).toBe(true);
    expect(matchesFilter(gnd, new Set(['gpio']))).toBe(false);
    // Pills only use catalog functions, capped, with a "+N" overflow.
    const pills = pinPills(gpio);
    expect(pills[0]?.group).toBe('gpio');
    expect(pills.length).toBeLessThanOrEqual(6);
    for (const p of pills.slice(1))
      expect(
        p.kind === 'more' ||
          p.kind === 'strap' ||
          p.kind === 'restricted' ||
          gpio.functions.some((f) => f.text === p.text),
      ).toBe(true);
  });

  it('shows assigned signals and marks a strapping pin', () => {
    const { catalog } = compiledCatalog();
    const base = boardView(catalog, 'esp32-devkitc-v4@V4', 'esp32-devkitc-32e', input) ?? [];
    const pad = base.flatMap((c) => c.pins).find((p) => p.kind === 'gpio' && p.pad !== null)?.pad;
    const view =
      boardView(catalog, 'esp32-devkitc-v4@V4', 'esp32-devkitc-32e', {
        ...input,
        locked: [{ instance: 'env', role: 'SDA', pad: pad ?? '' }],
      }) ?? [];
    const cons = pinoutConnectors(catalog, 'esp32-devkitc-v4@V4', 'esp32-devkitc-32e', view);
    const used = cons.flatMap((c) => c.pins).find((p) => p.assigned.length > 0);
    expect(used?.assigned[0]).toContain('env.SDA');
    expect(used && pinPills(used).some((p) => p.kind === 'assigned')).toBe(true);
    const strap = cons
      .flatMap((c) => c.pins)
      .find((p) => p.warnings.some((w) => w.startsWith('Strapping')));
    expect(strap && pinPills(strap).some((p) => p.kind === 'strap')).toBe(true);
  });

  it('lays out two columns sized by pin count', () => {
    const { catalog } = compiledCatalog();
    const lay = (ref: string, variant: string) =>
      layoutPinout(
        pinoutConnectors(catalog, ref, variant, boardView(catalog, ref, variant, input) ?? []),
      );
    const s3 = lay('esp32-s3-devkitc-1@V1.1', 'esp32-s3-devkitc-1-n8');
    const pico = lay('raspberry-pi-pico@Rev3', 'pico');
    expect(s3.rows).toHaveLength(44);
    expect(s3.rows.filter((r) => r.side === 'left')).toHaveLength(22);
    expect(s3.boardH).toBeGreaterThan(pico.boardH - 1);
  });
});
