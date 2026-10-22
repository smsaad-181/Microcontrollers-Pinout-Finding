// Minimal, fictional (DEMO-*) sample entities used by the runtime tests. Typed against the verbatim
// reference so the samples themselves cannot drift from it. No real hardware facts.
import type * as Ref from './reference.js';

const R = ['hardware-researcher', 'hardware-fact-auditor'];

export function verified<T>(value: T, unit?: Ref.Unit): Ref.Fact<T> {
  return {
    value,
    evidence: ['demo-ds#a'],
    status: 'verified',
    reviewers: [...R],
    ...(unit === undefined ? {} : { unit }),
  };
}

export const evidence: Ref.Evidence = {
  id: 'demo-ds',
  title: 'Demo datasheet',
  publisher: 'Demo Corp',
  doc_number: null,
  revision: '1.0',
  revision_date: null,
  url: 'https://example.com/demo.pdf',
  url_original: null,
  accessed: '2026-10-22',
  sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  kind: 'datasheet',
  secondary: false,
  manual: false,
  claims: [{ id: 'demo-ds#a', locator: '§1', quote: 'q', supports: 's' }],
};

const pad = (gpio: number): Ref.Pad => ({
  gpio,
  functions: [{ fn: 'GPIO', routing: 'matrix' }],
  input_only: verified(false),
  reset_state: verified<Ref.ResetState>('input'),
  strap: verified<'none'>('none'),
  power_up_glitch: verified<'none'>('none'),
  errata: [],
});

export const chip: Ref.Chip = {
  id: 'demo-mcu',
  vendor: 'Demo Corp',
  family: 'DEMO',
  series: 'DEMO-MCU',
  revisions: ['v1'],
  vdd_io: verified(3.3, 'V'),
  electrical: {
    vih_min: verified<Ref.Expr>('VDDIO*0.75', 'V'),
    vil_max: verified<Ref.Expr>('VDDIO*0.25', 'V'),
    voh_min: verified<Ref.Expr>('VDD*0.8', 'V'),
    vol_max: verified<Ref.Expr>(0.4, 'V'),
    abs_max_vin: verified<Ref.Expr>('VDDIO+0.3', 'V'),
    pin_current_max: verified(10, 'mA'),
    cumulative_current_max: verified(40, 'mA'),
  },
  pads: { GPIO0: pad(0), GPIO1: pad(1) },
  peripherals: { I2C0: { kind: 'i2c', matrix_routable: true } },
};

export const module_: Ref.Module = {
  id: 'demo-module',
  chip: 'demo-mcu',
  bonded_pads: ['GPIO0', 'GPIO1'],
  consumed: {},
  flash_voltage: verified(3.3, 'V'),
};

export const board: Ref.Board = {
  id: 'demo-board',
  vendor: 'Demo Corp',
  name: 'DEMO-BOARD',
  revision: 'r1',
  variants: [{ id: 'a', module: 'demo-module' }],
  logic_voltage: verified(3.3, 'V'),
  rails: [
    { name: '3V3', voltage: verified(3.3, 'V'), max_current: verified(500, 'mA'), source: 'LDO' },
  ],
  connectors: [
    {
      id: 'J1',
      pins: [
        { position: 1, label: 'GND', kind: 'ground' },
        { position: 2, label: '0', kind: 'gpio', pad: 'GPIO0' },
      ],
    },
  ],
  onboard: [],
  numbering: { primary: 'gpio' },
  status: 'fully-verified',
};

export const ic: Ref.IC = {
  id: 'demo-sensor',
  vendor: 'Demo Corp',
  part: 'DEMO-SENSOR',
  interfaces: [
    {
      kind: 'i2c',
      signals: [{ role: 'SDA', dir: 'io', drive: 'open-drain', shareable: true }],
      limits: { i2c_modes: ['sm', 'fm'], addresses: [{ value: 64, strap: 'ADDR=GND' }] },
    },
  ],
  vdd_range: verified<[number, number]>([1.8, 3.6], 'V'),
  vio_range: verified<[number, number]>([1.8, 3.6], 'V'),
  input_abs_max: verified<Ref.Expr>('VDDIO+0.3', 'V'),
  supply_current: verified({ typ: 0.2 }, 'mA'),
};

export const breakout: Ref.Breakout = {
  id: 'demo-breakout',
  ic: 'demo-sensor',
  vendor: 'Demo Corp',
  variant_names: ['DEMO-BREAKOUT'],
  pins: [{ label: 'SDA', maps_to: 'SDA' }],
  regulator: verified({ present: false }),
  level_shifter: verified(false),
  pullups: [],
  hardwired: [{ strap: 'ADDR', value: 'GND' }],
  interfaces_exposed: ['i2c'],
  supply_current: verified({ max: 0.5 }, 'mA'),
};

export const project: Ref.Project = {
  board: 'demo-board@r1',
  variant: 'a',
  modules: [{ breakout: 'demo-breakout', instance: 'env' }],
  locked: [],
  reserved: [],
};

export const fixture: Ref.Fixture = {
  id: 'demo-fixture',
  board: 'demo-board@r1',
  variant: 'a',
  project,
  expect: { status: 'ok', properties: [{ no_pad_in: ['GPIO3'] }] },
  evidence: ['demo-ds#a'],
  derivations: ['because'],
};

export const warning: Ref.Warning = {
  level: 'caution',
  code: 'C_INTERIM',
  message: 'interim value',
  pads: ['GPIO0'],
  evidence: ['demo-ds#a'],
};

export const recommendation: Ref.Recommendation = {
  catalog_version: 'abc',
  catalog_sha256: '0'.repeat(64),
  ruleset_version: '0.0.0',
  status: 'ok',
  interfaces: { env: { kind: 'i2c', decided_by_rule: 1, alternatives: [] } },
  assignments: [
    {
      instance: 'env',
      role: 'SDA',
      pad: 'GPIO0',
      gpio: 0,
      label: '0',
      connector: 'J1',
      position: 2,
      routing: 'matrix',
      trace: ['t'],
      evidence: ['demo-ds#a'],
      alternatives: [{ pad: 'GPIO1', lower_tier: 3, reason: 'r' }],
    },
  ],
  required_parts: [],
  warnings: [warning],
  budgets: [{ rail: '3V3', demand_ma: 1, limit_ma: null }],
  score: [0, 0, 0, 0],
};
