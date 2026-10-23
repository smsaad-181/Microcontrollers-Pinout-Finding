import { describe, expect, it } from 'vitest';
import type { Project } from '@pinout/schema';
import { solve, solveDetailed } from '../src/solver.js';
import { allMembers, analyzeUnsat, subproject, type ConflictMember } from '../src/unsat.js';
import { bruteForceMinimum } from './bruteforce.js';
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
const pots = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    breakout: 'potentiometer-10k',
    instance: `pot${String(i + 1)}`,
  }));
const ads = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    breakout: 'ads1115-breakout',
    instance: `adc${String(i + 1)}`,
  }));

interface Case {
  name: string;
  project: Project;
  size: number;
  tokens: string[];
  relaxations: string[];
}
const cases: Case[] = [
  {
    name: '4 pots on a Pico W',
    project: pico({ modules: pots(4) }),
    size: 4,
    tokens: ['adc:4-analog-signals-vs-3-adc-pads', 'consumed:GPIO29'],
    relaxations: ['add-external-adc:ads1115-breakout', 'remove-module:potentiometer-10k'],
  },
  {
    name: '4 pots plus unrelated modules and reserved pads on a Pico W',
    project: pico({
      modules: [...pots(4), { breakout: 'push-button', instance: 'sw' }],
      reserved: ['GPIO5', 'GPIO6'],
    }),
    size: 4,
    tokens: ['adc:4-analog-signals-vs-3-adc-pads'],
    relaxations: ['remove-module:potentiometer-10k'],
  },
  {
    name: 'ADC2 pad locked with Wi-Fi on',
    project: devkitc({
      modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
      locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO25' }],
    }),
    size: 3,
    tokens: ['locked:pot.WIPER=GPIO25', 'adc2-wifi:GPIO25'],
    relaxations: ['unlock:pot.WIPER', 'wifi:false'],
  },
  {
    name: 'nine ADS1115 on an ESP32',
    project: devkitc({ modules: ads(9) }),
    size: 9,
    tokens: ['i2c-address:ads1115-breakout:9-devices-vs-8-addresses', 'i2c-controllers:esp32:2'],
    relaxations: ['add-i2c-multiplexer', 'remove-module:ads1115-breakout'],
  },
  {
    // Stand-in for the GPIO12 relay fixture: the engine reports it ok today (the opto relay's resting
    // level is not a catalog fact, so R6 only warns), see the hand-off.
    name: 'button locked on a PSRAM-consumed pad (ESP32-S3 N8R8)',
    project: {
      board: 'esp32-s3-devkitc-1@V1.1',
      variant: 'esp32-s3-devkitc-1-n8r8',
      wifi: true,
      modules: [{ breakout: 'push-button', instance: 'sw1' }],
      locked: [{ instance: 'sw1', role: 'SW', pad: 'GPIO36' }],
      reserved: [],
    },
    size: 2,
    tokens: ['locked:sw1.SW=GPIO36', 'consumed:GPIO36'],
    relaxations: ['unlock:sw1.SW', 'different-variant:esp32-s3-devkitc-1-n8'],
  },
  {
    name: 'output locked on input-only GPIO34',
    project: devkitc({
      modules: [{ breakout: 'relay-board-4ch-transistor', instance: 'rel' }],
      locked: [{ instance: 'rel', role: 'COIL[1]', pad: 'GPIO34' }],
    }),
    size: 2,
    tokens: ['locked:rel.COIL[1]=GPIO34', 'input-only:GPIO34'],
    relaxations: ['unlock:rel.COIL[1]'],
  },
];

const unsatOracle =
  (project: Project) =>
  (subset: readonly ConflictMember[]): boolean =>
    solve(index, subproject(project, subset)).status !== 'ok';

describe.each(cases)('unsat analysis: $name', (c) => {
  const r = solveDetailed(index, c.project);
  const a = analyzeUnsat(index, c.project, (p, o) => solveDetailed(index, p, o), {});
  it('is unsat with the expected tokens and relaxations', () => {
    expect(r.recommendation.status).toBe('unsat');
    expect(r.recommendation.unsat?.minimal_conflict).toEqual(expect.arrayContaining(c.tokens));
    expect(r.recommendation.unsat?.relaxations).toEqual(expect.arrayContaining(c.relaxations));
    expect(r.recommendation.unsat?.relaxations.length).toBeGreaterThan(0);
  });
  it('the subset is irreducible: unsat itself, satisfiable without any member (re-solved)', () => {
    const unsat = unsatOracle(c.project);
    expect(unsat(a.members)).toBe(true);
    for (const m of a.members) {
      expect(unsat(a.members.filter((x) => x !== m)), `without ${m.kind}:${m.id}`).toBe(false);
    }
  });
  it('has the size of the brute-force minimum', () => {
    const bf = bruteForceMinimum(allMembers(c.project), unsatOracle(c.project));
    expect(bf?.size).toBe(c.size);
    expect(a.members.length).toBe(bf?.size);
  }, 300_000);
  it('is deterministic', () => {
    const again = solveDetailed(index, c.project);
    expect(JSON.stringify(again.recommendation)).toBe(JSON.stringify(r.recommendation));
  });
});

describe('unsat analysis: relaxations are verified by re-solving', () => {
  it('ranks unlock before wifi:false; each offered edit really is satisfiable', () => {
    const project = devkitc({
      modules: [{ breakout: 'potentiometer-10k', instance: 'pot' }],
      locked: [{ instance: 'pot', role: 'WIPER', pad: 'GPIO25' }],
    });
    const relax = solve(index, project).unsat?.relaxations ?? [];
    expect(relax.indexOf('unlock:pot.WIPER')).toBeLessThan(relax.indexOf('wifi:false'));
    expect(solve(index, { ...project, locked: [] }).status).toBe('ok');
    expect(solve(index, { ...project, wifi: false }).status).toBe('ok');
  });
  it('4 pots on a Pico W: an ADS1115 for one pot is offered before removing a pot', () => {
    const three = pots(3);
    expect(solve(index, pico({ modules: three })).status).toBe('ok');
    expect(
      solve(index, pico({ modules: [...three, { breakout: 'ads1115-breakout', instance: 'x' }] }))
        .status,
    ).toBe('ok');
    const relax = solve(index, pico({ modules: pots(4) })).unsat?.relaxations ?? [];
    expect(relax.indexOf('add-external-adc:ads1115-breakout')).toBeLessThan(
      relax.indexOf('remove-module:potentiometer-10k'),
    );
  });
  it('a satisfiable project has no unsat section', () => {
    expect(solve(index, pico({ modules: pots(3) })).unsat).toBeUndefined();
  });
});
