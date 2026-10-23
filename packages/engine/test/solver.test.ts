import { describe, expect, it } from 'vitest';
import type { Project } from '@pinout/schema';
import { assess } from '../src/assess.js';
import { composePinView } from '../src/compose.js';
import type { ExpandedSignal } from '../src/signals.js';
import { solve, solveDetailed } from '../src/solver.js';
import { realCatalog } from './helpers.js';

const { index } = realCatalog();

const devkitc = (over: Partial<Project> = {}): Project => ({
  board: 'esp32-devkitc-v4@V4',
  variant: 'esp32-devkitc-32e',
  wifi: true,
  modules: [],
  locked: [],
  reserved: [],
  ...over,
});
const pico = (over: Partial<Project> = {}): Project => ({
  board: 'raspberry-pi-pico-w@Rev3',
  variant: 'pico-w',
  modules: [],
  locked: [],
  reserved: [],
  ...over,
});
const padOf = (r: ReturnType<typeof solve>, id: string): string | undefined =>
  r.assignments.find((a) => `${a.instance}.${a.role}` === id)?.pad;
const codes = (r: ReturnType<typeof solve>, level?: string): string[] =>
  r.warnings.filter((w) => level === undefined || w.level === level).map((w) => w.code);

const envOled = (): Project =>
  devkitc({
    modules: [
      { breakout: 'gy-bme280-4pin', instance: 'env' },
      { breakout: 'ssd1306-128x64-i2c-4pin', instance: 'oled' },
    ],
  });

describe('solve: DevKitC V4 + BME280 + SSD1306 on one I2C bus', () => {
  const r = solve(index, envOled());
  const clean = [
    'GPIO16',
    'GPIO17',
    'GPIO18',
    'GPIO19',
    'GPIO21',
    'GPIO22',
    'GPIO23',
    'GPIO25',
    'GPIO26',
    'GPIO27',
    'GPIO32',
    'GPIO33',
  ];
  it('is ok with both modules on I2C and a shared bus', () => {
    expect(r.status).toBe('ok');
    expect(r.interfaces.env?.kind).toBe('i2c');
    expect(r.interfaces.oled?.kind).toBe('i2c');
    expect(padOf(r, 'env.SDA')).toBe(padOf(r, 'oled.SDA'));
    expect(padOf(r, 'env.SCL')).toBe(padOf(r, 'oled.SCL'));
    expect(padOf(r, 'env.SDA')).not.toBe(padOf(r, 'env.SCL'));
  });
  it('uses clean pads only and reaches risk tier 1 = 0', () => {
    expect(clean).toContain(padOf(r, 'env.SDA'));
    expect(clean).toContain(padOf(r, 'env.SCL'));
    expect(r.score[0]).toBe(0);
  });
  it('has no critical warning and the expected catalog-gap cautions', () => {
    expect(codes(r, 'critical')).toEqual([]);
    for (const c of [
      'I2C_PULLUP_UNKNOWN',
      'I2C_ADDRESS_UNKNOWN',
      'MODULE_REGULATOR_UNKNOWN',
      'RAIL_BUDGET_UNKNOWN',
    ]) {
      expect(r.warnings.find((w) => w.code === c)?.level).toBe('caution');
    }
  });
  it('explains every assignment with a trace, evidence and up to three alternatives', () => {
    for (const a of r.assignments) {
      expect(a.trace.length).toBeGreaterThan(2);
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.alternatives.length).toBeLessThanOrEqual(3);
      for (const alt of a.alternatives) expect([1, 2, 3, 4]).toContain(alt.lower_tier);
    }
    expect(r.assignments[0]?.alternatives.length).toBeGreaterThan(0);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(solve(index, envOled()))).toBe(JSON.stringify(r));
  });
});

describe('solve: Pico W reserved GPIO', () => {
  const r = solve(
    index,
    pico({
      modules: [
        { breakout: 'potentiometer-10k', instance: 'pot1' },
        { breakout: 'potentiometer-10k', instance: 'pot2' },
        { breakout: 'potentiometer-10k', instance: 'pot3' },
        { breakout: 'ssd1306-128x64-i2c-4pin', instance: 'oled' },
        { breakout: 'relay-board-4ch-transistor', instance: 'relays' },
      ],
    }),
  );
  it('never assigns the radio pads and puts the pots on GPIO26-28', () => {
    expect(r.status).toBe('ok');
    const pads = r.assignments.map((a) => a.pad);
    for (const p of ['GPIO23', 'GPIO24', 'GPIO25', 'GPIO29']) expect(pads).not.toContain(p);
    expect(['pot1', 'pot2', 'pot3'].map((i) => padOf(r, `${i}.WIPER`)).sort()).toEqual([
      'GPIO26',
      'GPIO27',
      'GPIO28',
    ]);
  });
  it('keeps SDA and SCL on one I2C instance', () => {
    const sda = r.assignments.find((a) => a.role === 'SDA');
    const scl = r.assignments.find((a) => a.role === 'SCL');
    expect(sda?.peripheral_instance).toBeDefined();
    expect(sda?.peripheral_instance).toBe(scl?.peripheral_instance);
  });
  it('reports the floating relay load and the unknown ADC range', () => {
    expect(codes(r)).toContain('FLOATING_AT_RESET_LOAD');
    expect(codes(r)).toContain('ADC_RANGE_UNKNOWN');
  });
});

describe('solve: unsatisfiable projects', () => {
  it('4 potentiometers on a Pico W: unsat with the ADC shortage and relaxations', () => {
    const r = solve(
      index,
      pico({
        modules: [1, 2, 3, 4].map((n) => ({
          breakout: 'potentiometer-10k',
          instance: `pot${String(n)}`,
        })),
      }),
    );
    expect(r.status).toBe('unsat');
    expect(r.assignments).toEqual([]);
    expect(r.unsat?.minimal_conflict).toContain('adc:4-analog-signals-vs-3-adc-pads');
    expect(r.unsat?.relaxations).toContain('add-external-adc:ads1115-breakout');
    expect(r.unsat?.relaxations).toContain('remove-module:potentiometer-10k');
  });
  it('ADC2 pad locked with Wi-Fi on: unsat naming the lock and the radio', () => {
    const r = solve(
      index,
      devkitc({
        modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
        locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO25' }],
      }),
    );
    expect(r.status).toBe('unsat');
    expect(r.unsat?.minimal_conflict).toEqual(
      expect.arrayContaining(['locked:pot.WIPER=GPIO25', 'adc2-wifi:GPIO25']),
    );
    expect(r.unsat?.relaxations).toEqual(
      expect.arrayContaining(['unlock:pot.WIPER', 'wifi:false']),
    );
  });
  it('the same lock is fine without Wi-Fi', () => {
    const r = solve(
      index,
      devkitc({
        wifi: false,
        modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
        locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO25' }],
      }),
    );
    expect(r.status).toBe('ok');
    expect(padOf(r, 'pot.WIPER')).toBe('GPIO25');
  });
  it('a free ADC signal avoids ADC2 pads while Wi-Fi is on', () => {
    const r = solve(
      index,
      devkitc({ modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }] }),
    );
    expect(r.status).toBe('ok');
    const gpio = Number(padOf(r, 'pot.WIPER')?.slice(4));
    expect([32, 33, 34, 35, 36, 39]).toContain(gpio);
  });
});

describe('solve: D1 mini A0', () => {
  const r = solve(index, {
    board: 'lolin-d1-mini@V4.0.0',
    variant: 'lolin-d1-mini-v4',
    wifi: true,
    modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
    locked: [],
    reserved: [],
  });
  it('places the wiper on the only ADC pad (A0 = TOUT)', () => {
    expect(r.status).toBe('ok');
    expect(padOf(r, 'pot.WIPER')).toBe('TOUT');
    expect(r.assignments[0]?.label).toBe('A0');
    expect(r.assignments[0]?.gpio).toBe(-1);
  });
  it('warns about the range and the unknown radio behaviour', () => {
    expect(r.warnings.find((w) => w.code === 'ADC_OVER_RANGE')?.level).toBe('warning');
    expect(r.warnings.find((w) => w.code === 'ADC_RADIO_UNKNOWN')?.level).toBe('caution');
    expect(r.required_parts.some((p) => p.kind === 'divider')).toBe(true);
  });
});

describe('solve: input-only GPIO34', () => {
  it('accepts a button locked on GPIO34 and asks for an external pull-up', () => {
    const r = solve(
      index,
      devkitc({
        modules: [{ breakout: 'push-button', instance: 'sw1' }],
        locked: [{ instance: 'sw1', role: 'SW', pad: 'GPIO34' }],
      }),
    );
    expect(r.status).toBe('ok');
    expect(padOf(r, 'sw1.SW')).toBe('GPIO34');
    const pull = r.required_parts.find((p) => p.kind === 'resistor' && p.role === 'pull-up');
    expect(pull?.count).toBe(1);
    expect(pull?.pads).toEqual(['GPIO34']);
    expect(codes(r, 'critical')).toEqual([]);
  });
  it('rejects an output locked on GPIO34', () => {
    const r = solve(
      index,
      devkitc({
        modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'rel' }],
        locked: [{ instance: 'rel', role: 'COIL[1]', pad: 'GPIO34' }],
      }),
    );
    expect(r.status).toBe('unsat');
    expect(r.unsat?.minimal_conflict).toEqual(
      expect.arrayContaining(['locked:rel.COIL[1]=GPIO34', 'input-only:GPIO34']),
    );
  });
  it('free outputs never land on input-only pads', () => {
    const r = solve(
      index,
      devkitc({ modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'rel' }] }),
    );
    expect(r.status).toBe('ok');
    for (const a of r.assignments) expect([34, 35, 36, 39]).not.toContain(a.gpio);
  });
});

describe('solve: invariants', () => {
  it('locked pins never move and no pad is used twice', () => {
    const r = solve(
      index,
      devkitc({
        modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'rel' }],
        locked: [{ instance: 'rel', role: 'COIL[1]', pad: 'GPIO21' }],
      }),
    );
    expect(padOf(r, 'rel.COIL[1]')).toBe('GPIO21');
    const pads = r.assignments.map((a) => a.pad);
    expect(new Set(pads).size).toBe(pads.length);
  });
  it('reports needs_variant for an unknown variant', () => {
    const r = solve(index, devkitc({ variant: 'nope' }));
    expect(r.status).toBe('needs_variant');
    expect(r.variant_candidates).toEqual(expect.arrayContaining(['esp32-devkitc-32e']));
  });
  it('flags an exhausted node budget', () => {
    const o = solveDetailed(
      index,
      devkitc({ modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'rel' }] }),
      { maxNodes: 2 },
    );
    expect(o.stats.budgetExhausted).toBe(true);
    expect(o.recommendation.warnings.map((w) => w.code)).toContain('BUDGET_EXHAUSTED');
  });
  it('an empty project is trivially ok', () => {
    expect(solve(index, devkitc()).status).toBe('ok');
  });
  it('a strap pad with an undocumented resting level is allowed with a caution and a risk point', () => {
    const r = solve(
      index,
      devkitc({
        modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'rel' }],
        locked: [{ instance: 'rel', role: 'COIL[1]', pad: 'GPIO12' }],
      }),
    );
    expect(r.status).toBe('ok');
    expect(codes(r, 'caution')).toContain('FLOATING_AT_RESET_UNKNOWN');
    expect(r.score[0]).toBeGreaterThanOrEqual(1);
  });
});

describe('assess: R6 blocked strap pad', () => {
  const comp = composePinView(index, 'esp32-devkitc-v4@V4', 'esp32-devkitc-32e');
  if (comp.status !== 'ok') throw new Error('compose');
  const pin = comp.view.pins.find((x) => x.pad === 'GPIO12');
  const chip = index.chip(comp.view.variant.chip);
  const board = index.board('esp32-devkitc-v4@V4');
  if (!pin || !chip || !board) throw new Error('fixture data');
  const sig: ExpandedSignal = {
    id: 'x.COIL',
    instance: 'x',
    breakout: 'b',
    ic: 'i',
    interface: 'digital',
    role: 'COIL',
    dir: 'out',
    deviceDir: 'in',
    drive: 'push-pull',
    peripheral: 'GPIO',
    maxHz: null,
    shareable: 'exclusive',
    actsOnLevel: true,
    restingLevelAtReset: 'high',
    restingKnown: true,
    evidence: [],
  };
  const project: Project = devkitc();
  it('a load resting high on GPIO12 (must be low at reset) is blocked', () => {
    const a = assess({ index, project, chip, board, disabled: [] }, [sig], pin, null, null);
    expect(a.blocked).toBe('strap:GPIO12');
    expect(a.cost[0]).toBeGreaterThanOrEqual(1);
    expect(a.rules.some((e) => e.result.rule === 'R6' && e.result.blocked === true)).toBe(true);
  });
  it('removing R6 removes the block', () => {
    const a = assess({ index, project, chip, board, disabled: ['R6'] }, [sig], pin, null, null);
    expect(a.blocked).toBeUndefined();
  });
});
