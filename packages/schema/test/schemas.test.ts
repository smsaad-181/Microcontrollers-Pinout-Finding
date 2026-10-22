import { describe, expect, it } from 'vitest';
import {
  BoardSchema,
  BreakoutSchema,
  ChipSchema,
  EvidenceSchema,
  ExprSchema,
  FixtureSchema,
  ICSchema,
  ModuleSchema,
  PinViewSchema,
  ProjectSchema,
  RecommendationSchema,
  WarningSchema,
  ENTITY_SCHEMAS,
} from '../src/index.js';
import * as sample from './samples.js';

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((i) => i.path.map(String).join('.'));
}

describe('entity schemas accept valid samples', () => {
  it.each([
    ['Evidence', EvidenceSchema, sample.evidence],
    ['Chip', ChipSchema, sample.chip],
    ['Module', ModuleSchema, sample.module_],
    ['Board', BoardSchema, sample.board],
    ['IC', ICSchema, sample.ic],
    ['Breakout', BreakoutSchema, sample.breakout],
    ['Project', ProjectSchema, sample.project],
    ['Fixture', FixtureSchema, sample.fixture],
    ['Warning', WarningSchema, sample.warning],
    ['Recommendation', RecommendationSchema, sample.recommendation],
  ] as const)('%s', (_name, schema, value) => {
    const r = schema.safeParse(value);
    expect(r.error?.issues).toBeUndefined();
    expect(r.success).toBe(true);
  });
});

describe('Expr', () => {
  it.each([3.3, 0, 'VDD*0.7', 'VDDIO+0.3', 'VDDIO*0.25', 'VDDIO+-0.3'])('accepts %s', (v) => {
    expect(ExprSchema.safeParse(v).success).toBe(true);
  });
  it.each(['3.3', 'VCC*0.7', 'VDD*abc', 'VDD+0.3', 'VDDIO*', ' VDD*0.7', true, null])(
    'rejects %s',
    (v) => {
      expect(ExprSchema.safeParse(v).success).toBe(false);
    },
  );
});

describe('shape errors (E_SCHEMA material)', () => {
  it('reports a wrongly typed pad gpio at pads.<PAD>.gpio', () => {
    const bad = structuredClone(sample.chip) as unknown as {
      pads: Record<string, { gpio: unknown }>;
    };
    (bad.pads.GPIO1 as { gpio: unknown }).gpio = 'four';
    expect(issuePaths(ChipSchema.safeParse(bad))).toEqual(['pads.GPIO1.gpio']);
  });

  it('reports a missing required key with a path ending in that key', () => {
    const bad = structuredClone(sample.fixture) as unknown as { expect: Record<string, unknown> };
    delete bad.expect.status;
    expect(issuePaths(FixtureSchema.safeParse(bad))).toEqual(['expect.status']);
  });

  it('rejects unknown keys (typos must not be silently stripped)', () => {
    const bad = { ...sample.module_, flash_volatge: sample.module_.flash_voltage };
    expect(ModuleSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown keys inside a fact', () => {
    const bad = structuredClone(sample.module_) as unknown as {
      flash_voltage: Record<string, unknown>;
    };
    bad.flash_voltage.reveiwers = ['x', 'y'];
    expect(issuePaths(ModuleSchema.safeParse(bad))).toEqual(['flash_voltage']);
  });

  it('rejects null for an optional field (optional means absent, README decision 10)', () => {
    const bad = { ...sample.ic, select_strap: null };
    expect(issuePaths(ICSchema.safeParse(bad))).toEqual(['select_strap']);
  });

  it('requires accessed as a YYYY-MM-DD string, not a Date or other format', () => {
    expect(EvidenceSchema.safeParse({ ...sample.evidence, accessed: '2026-1-2' }).success).toBe(
      false,
    );
    expect(EvidenceSchema.safeParse({ ...sample.evidence, accessed: new Date() }).success).toBe(
      false,
    );
  });

  it('requires sha256 to be 64 hex chars or null', () => {
    expect(EvidenceSchema.safeParse({ ...sample.evidence, sha256: 'abc' }).success).toBe(false);
    expect(EvidenceSchema.safeParse({ ...sample.evidence, sha256: null }).success).toBe(true);
  });

  it('requires claim ids of the form <doc>#<slug>', () => {
    const bad = structuredClone(sample.module_);
    bad.flash_voltage.evidence = ['no-hash'];
    expect(issuePaths(ModuleSchema.safeParse(bad))).toEqual(['flash_voltage.evidence.0']);
  });

  it('rejects an unknown status, unit, routing and connector-pin kind', () => {
    const s = structuredClone(sample.module_) as unknown as {
      flash_voltage: Record<string, unknown>;
    };
    s.flash_voltage.status = 'probably';
    expect(ModuleSchema.safeParse(s).success).toBe(false);
    const u = structuredClone(sample.module_) as unknown as {
      flash_voltage: Record<string, unknown>;
    };
    u.flash_voltage.unit = 'volts';
    expect(ModuleSchema.safeParse(u).success).toBe(false);
    const b = structuredClone(sample.board) as unknown as {
      connectors: { pins: Record<string, unknown>[] }[];
    };
    const pin = b.connectors[0]?.pins[0];
    if (pin) pin.kind = 'signal';
    expect(issuePaths(BoardSchema.safeParse(b))).toEqual(['connectors.0.pins.0.kind']);
  });

  it('enforces tuple lengths (score has 4 tiers, ranges have 2 ends)', () => {
    expect(
      RecommendationSchema.safeParse({ ...sample.recommendation, score: [0, 0, 0] }).success,
    ).toBe(false);
    const r = structuredClone(sample.ic) as unknown as { vdd_range: { value: unknown } };
    r.vdd_range.value = [1.8];
    expect(ICSchema.safeParse(r).success).toBe(false);
  });

  it('accepts a missing fact (value null, evidence []) at shape level', () => {
    const m = structuredClone(sample.board) as unknown as {
      rails: { max_current: unknown }[];
    };
    (m.rails[0] as { max_current: unknown }).max_current = {
      value: null,
      evidence: [],
      status: 'missing',
      unit: 'mA',
    };
    expect(BoardSchema.safeParse(m).success).toBe(true);
  });
});

describe('PinView (addition: not in the reference)', () => {
  it('accepts a composed pin', () => {
    const r = PinViewSchema.safeParse({
      connector: 'J1',
      position: 2,
      label: '0',
      kind: 'gpio',
      pad: 'GPIO0',
      gpio: 0,
      functions: [{ fn: 'GPIO', routing: 'matrix' }],
      flags: ['strap'],
      evidence: ['demo-ds#a'],
    });
    expect(r.error?.issues).toBeUndefined();
  });
});

describe('descriptions (feed docs/schema.md, task 1.9)', () => {
  it('every entity schema and every top-level field has a description', () => {
    for (const [name, schema] of Object.entries(ENTITY_SCHEMAS)) {
      expect(schema.description, name).toBeTruthy();
      for (const [key, field] of Object.entries(schema.shape)) {
        expect((field as { description?: string }).description, `${name}.${key}`).toBeTruthy();
      }
    }
  });
});
