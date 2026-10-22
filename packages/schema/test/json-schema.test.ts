import { describe, expect, it } from 'vitest';
import { JSON_SCHEMA_NAMES, jsonSchemas } from '../src/index.js';

describe('JSON Schema generation (packages/schema/dist/*.schema.json)', () => {
  const schemas = jsonSchemas();

  it('generates one schema per catalog/output entity', () => {
    expect(Object.keys(schemas).sort()).toEqual([...JSON_SCHEMA_NAMES].sort());
    expect(JSON_SCHEMA_NAMES).toEqual(
      expect.arrayContaining([
        'evidence',
        'chip',
        'module',
        'board',
        'ic',
        'breakout',
        'fixture',
        'project',
        'recommendation',
        'pin-view',
      ]),
    );
  });

  it('each schema is a serialisable draft 2020-12 object schema with descriptions', () => {
    for (const [name, s] of Object.entries(schemas)) {
      expect(s.$schema, name).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(s.type, name).toBe('object');
      expect(typeof s.description, name).toBe('string');
      expect(s.additionalProperties, name).toBe(false);
      expect(() => JSON.stringify(s)).not.toThrow();
    }
  });

  it('keeps Expr template literals as regex patterns', () => {
    const text = JSON.stringify(schemas.chip);
    expect(text).toContain('VDDIO');
    expect(text).toContain('pattern');
  });

  it('is deterministic', () => {
    expect(JSON.stringify(jsonSchemas())).toBe(JSON.stringify(schemas));
  });
});
