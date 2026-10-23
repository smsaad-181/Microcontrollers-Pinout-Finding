import { describe, expect, it } from 'vitest';
import { BoardSchema, ConnectorPinSchema } from '../src/index.js';
import * as sample from './samples.js';

describe('ConnectorPin.alias_of', () => {
  const pin = { position: 7, label: 'A4', kind: 'gpio', pad: 'GPIO0' };

  it('is optional', () => {
    expect(ConnectorPinSchema.safeParse(pin).success).toBe(true);
  });

  it('accepts a string reference', () => {
    const r = ConnectorPinSchema.safeParse({ ...pin, alias_of: 'JANALOG:5' });
    expect(r.success).toBe(true);
  });

  it('rejects a non-string and an explicit undefined (exact optional)', () => {
    expect(ConnectorPinSchema.safeParse({ ...pin, alias_of: 5 }).success).toBe(false);
    expect(ConnectorPinSchema.safeParse({ ...pin, alias_of: undefined }).success).toBe(false);
  });

  it('still rejects unknown keys', () => {
    expect(ConnectorPinSchema.safeParse({ ...pin, aliasOf: 'J1:1' }).success).toBe(false);
  });

  it('is described in the schema', () => {
    expect(ConnectorPinSchema.shape.alias_of.description ?? '').toMatch(/alias|share/i);
  });

  it('is accepted inside a board', () => {
    const board = structuredClone(sample.board);
    const first = board.connectors[0];
    if (first === undefined) throw new Error('sample has no connector');
    first.pins.push({ position: 9, label: '9', kind: 'gpio', pad: 'GPIO0', alias_of: 'J1:2' });
    expect(BoardSchema.safeParse(board).success).toBe(true);
  });
});
