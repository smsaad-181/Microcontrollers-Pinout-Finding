import type { Recommendation, Warning } from '@pinout/schema';
import { describe, expect, it } from 'vitest';
import {
  countByLevel,
  describeConflict,
  describePart,
  describeRelaxation,
  headerPosition,
  LEVEL_META,
  sortWarnings,
  WARNING_LEVELS,
  wiringRows,
} from '../src/results/explain';

const names = {
  breakout: (id: string) => (id === 'ads1115-breakout' ? 'ADS1115 breakout' : undefined),
};

const w = (level: Warning['level'], code: string): Warning => ({
  level,
  code,
  message: 'm',
  pads: [],
  evidence: [],
});

describe('warning levels', () => {
  it('has a text label and an icon for each of the four levels', () => {
    expect(WARNING_LEVELS).toEqual(['critical', 'warning', 'caution', 'info']);
    for (const l of WARNING_LEVELS) {
      expect(LEVEL_META[l].label.length).toBeGreaterThan(0);
      expect(LEVEL_META[l].icon.length).toBeGreaterThan(0);
    }
    expect(new Set(WARNING_LEVELS.map((l) => LEVEL_META[l].icon)).size).toBe(4);
  });

  it('sorts by severity then code, and counts per level', () => {
    const list = [w('info', 'A'), w('critical', 'Z'), w('caution', 'B'), w('critical', 'C')];
    expect(sortWarnings(list).map((x) => `${x.level}:${x.code}`)).toEqual([
      'critical:C',
      'critical:Z',
      'caution:B',
      'info:A',
    ]);
    expect(countByLevel(list)).toEqual({ critical: 2, warning: 0, caution: 1, info: 1 });
  });
});

describe('unsat tokens', () => {
  it.each([
    ['locked:pot.WIPER=GPIO25', 'pot.WIPER=GPIO25'],
    ['adc2-wifi:GPIO25', 'Wi-Fi'],
    ['consumed:GPIO16', 'GPIO16'],
    ['i2c-controllers:esp32:2', '2 I2C controller'],
    [
      'i2c-address:ads1115-breakout:9-devices-vs-8-addresses',
      'ADS1115 breakout (9 devices vs 8 addresses)',
    ],
  ])('describes conflict %j', (token, text) => {
    expect(describeConflict(token, names)).toContain(text);
  });

  it.each([
    ['unlock:pot.WIPER', 'Unlock pot.WIPER'],
    ['wifi:false', 'Turn Wi-Fi off'],
    ['add-external-adc:ads1115-breakout', 'ADS1115 breakout'],
    ['remove-module:potentiometer-10k', 'Remove potentiometer-10k'],
    ['add-i2c-multiplexer', 'multiplexer'],
    ['different-variant:esp32-devkitc-32e', 'esp32-devkitc-32e'],
  ])('describes relaxation %j', (token, text) => {
    expect(describeRelaxation(token, names)).toContain(text);
  });

  it('shows unknown tokens unchanged', () => {
    expect(describeConflict('new-kind:x', names)).toBe('new-kind:x');
    expect(describeRelaxation('new-fix:y', names)).toBe('new-fix:y');
  });
});

describe('wiringRows', () => {
  const rec = {
    assignments: [
      {
        instance: 'sw1',
        role: 'SW',
        pad: 'GPIO34',
        gpio: 34,
        label: 'I34',
        connector: 'J2',
        position: 5,
      },
      {
        instance: 'env',
        role: 'SDA',
        pad: 'GPIO21',
        gpio: 21,
        label: 'IO21',
        connector: 'J3',
        position: 6,
      },
    ],
    required_parts: [{ kind: 'resistor', role: 'pull-up', count: 1, pads: ['GPIO34'] }],
  } as unknown as Recommendation;

  it('marks pins that need a part and maps module pin labels', () => {
    const rows = wiringRows(rec, { 'sw1.SW': 'Terminal A' });
    expect(rows[0]).toMatchObject({ modulePin: 'Terminal A', boardLabel: 'I34', gpio: 34 });
    expect(rows[0]?.parts.map(describePart)).toEqual(['pull-up resistor']);
    expect(rows[1]).toMatchObject({ modulePin: null, parts: [] });
  });

  it('formats header positions and part values', () => {
    expect(headerPosition('J3', 12)).toBe('J3 pin 12');
    expect(describePart({ kind: 'resistor', role: 'pull-down', count: 4, value: '10 kΩ' })).toBe(
      '10 kΩ pull-down resistor',
    );
  });
});
