// Phase 2b schema round: optional strap default_pull, pad without gpio, new connector pin kinds,
// rail voltage range, and the fixture vocabulary registry.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- test documents are dynamic YAML/JSON */
import { describe, expect, it } from 'vitest';
import { BoardSchema, ChipSchema, FixtureSchema } from '../src/index.js';
import {
  CONFLICT_TOKEN_PREFIXES,
  LOCKED_ROLE_PATTERN,
  PROPERTY_KEYS,
  RELAXATION_TOKEN_PREFIXES,
  WARNING_CODES,
} from '../src/fixture-vocabulary.js';
import * as sample from './samples.js';

type Doc = Record<string, any>;
const clone = (x: unknown): Doc => structuredClone(x) as Doc;
const ok = (s: { safeParse: (x: unknown) => { success: boolean } }, x: unknown) =>
  s.safeParse(x).success;

describe('strap default_pull is optional', () => {
  const strap = (v: unknown) => {
    const c = clone(sample.chip);
    c.pads.GPIO0.strap = { ...sample.verified('none'), value: v };
    return c;
  };
  it('accepts a strap without default_pull and still accepts one with it', () => {
    expect(ok(ChipSchema, strap({ role: 'boot', required_at_reset: 'high' }))).toBe(true);
    expect(
      ok(ChipSchema, strap({ role: 'boot', required_at_reset: 'high', default_pull: 'up' })),
    ).toBe(true);
  });
  it('still rejects a bad default_pull and a missing role', () => {
    expect(
      ok(ChipSchema, strap({ role: 'boot', required_at_reset: 'high', default_pull: 'x' })),
    ).toBe(false);
    expect(ok(ChipSchema, strap({ required_at_reset: 'high' }))).toBe(false);
  });
});

describe('pad without a GPIO number', () => {
  it('accepts a pad with no gpio (named pad such as TOUT)', () => {
    const c = clone(sample.chip);
    const { gpio: _g, ...rest } = c.pads.GPIO1;
    c.pads.TOUT = rest;
    expect(ok(ChipSchema, c)).toBe(true);
  });
  it('still validates a given gpio as a non-negative integer', () => {
    const c = clone(sample.chip);
    c.pads.GPIO1.gpio = -1;
    expect(ok(ChipSchema, c)).toBe(false);
  });
});

describe('connector pin kinds', () => {
  it.each(['enable', 'boot', 'analog'])('accepts kind %s', (kind) => {
    const b = clone(sample.board);
    b.connectors[0].pins.push({ position: 3, label: 'X', kind });
    expect(ok(BoardSchema, b)).toBe(true);
  });
  it('still rejects an unknown kind', () => {
    const b = clone(sample.board);
    b.connectors[0].pins.push({ position: 3, label: 'X', kind: 'bogus' });
    expect(ok(BoardSchema, b)).toBe(false);
  });
});

describe('rail voltage range', () => {
  const rail = (v: unknown) => {
    const b = clone(sample.board);
    b.rails[0].voltage = { ...sample.verified(3.3, 'V'), value: v };
    return b;
  };
  it('accepts a single value and a {min,max} range', () => {
    expect(ok(BoardSchema, rail(3.3))).toBe(true);
    expect(ok(BoardSchema, rail({ min: 1.8, max: 5.5 }))).toBe(true);
  });
  it('rejects partial or extra-key ranges', () => {
    expect(ok(BoardSchema, rail({ min: 1.8 }))).toBe(false);
    expect(ok(BoardSchema, rail({ min: 1.8, max: 5.5, typ: 3 }))).toBe(false);
    expect(ok(BoardSchema, rail('3.3'))).toBe(false);
  });
});

describe('fixture vocabulary registry', () => {
  const fx = (expectPatch: Doc) => {
    const f = clone(sample.fixture);
    f.expect = { ...f.expect, ...expectPatch };
    return f;
  };
  it('exports the extracted vocabulary', () => {
    expect(WARNING_CODES).toContain('I2C_PULLUP_UNKNOWN');
    expect(WARNING_CODES).toContain('ADC2_WIFI_CONFLICT');
    expect(PROPERTY_KEYS).toContain('no_pad_in');
    expect(CONFLICT_TOKEN_PREFIXES).toEqual(
      expect.arrayContaining(['locked:', 'strap:', 'consumed:', 'adc2-wifi:']),
    );
    expect(RELAXATION_TOKEN_PREFIXES).toContain('unlock:');
    expect(LOCKED_ROLE_PATTERN.test('COIL[1]')).toBe(true);
    expect(LOCKED_ROLE_PATTERN.test('WIPER')).toBe(true);
    expect(LOCKED_ROLE_PATTERN.test('COIL[]')).toBe(false);
    expect(LOCKED_ROLE_PATTERN.test('co il')).toBe(false);
  });
  it('accepts known vocabulary', () => {
    const f = fx({
      warnings_include: [{ code: 'I2C_PULLUP_UNKNOWN', level: 'caution' }],
      minimal_conflict_includes: ['locked:pot.WIPER=GPIO25', 'strap:GPIO12'],
      relaxations_include: ['unlock:pot.WIPER', 'add-i2c-multiplexer'],
    });
    expect(ok(FixtureSchema, f)).toBe(true);
  });
  it('rejects an unknown warning code', () => {
    expect(ok(FixtureSchema, fx({ warnings_include: [{ code: 'NOPE', level: 'info' }] }))).toBe(
      false,
    );
  });
  it('rejects an unknown property key and a multi-key or non-object property', () => {
    expect(ok(FixtureSchema, fx({ properties: [{ nope: 1 }] }))).toBe(false);
    expect(ok(FixtureSchema, fx({ properties: [{ no_pad_in: [], i2c_collision: 'none' }] }))).toBe(
      false,
    );
    expect(ok(FixtureSchema, fx({ properties: ['no_pad_in'] }))).toBe(false);
  });
  it('rejects an unknown conflict or relaxation token prefix', () => {
    expect(ok(FixtureSchema, fx({ minimal_conflict_includes: ['weird:x'] }))).toBe(false);
    expect(ok(FixtureSchema, fx({ minimal_conflict_includes: ['no-colon'] }))).toBe(false);
    expect(ok(FixtureSchema, fx({ relaxations_include: ['weird:x'] }))).toBe(false);
    expect(ok(FixtureSchema, fx({ relaxations_include: ['unlock:'] }))).toBe(false);
  });
  it('rejects a malformed locked role', () => {
    const f = clone(sample.fixture);
    f.project.locked = [{ instance: 'a', role: 'COIL[]', pad: 'GPIO0' }];
    expect(ok(FixtureSchema, f)).toBe(false);
    f.project.locked = [{ instance: 'a', role: 'COIL[1]', pad: 'GPIO0' }];
    expect(ok(FixtureSchema, f)).toBe(true);
  });
  it('validates no_warning_code entries against the warning codes', () => {
    expect(
      ok(FixtureSchema, fx({ properties: [{ no_warning_code: ['ADC2_WIFI_CONFLICT'] }] })),
    ).toBe(true);
    expect(ok(FixtureSchema, fx({ properties: [{ no_warning_code: ['NOPE'] }] }))).toBe(false);
  });
});
