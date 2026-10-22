// `alias_of` (README decision 24): one MCU pad on several header positions, declared on purpose.
// The valid fixture directory is never changed; these tests patch its board text in memory.
import { describe, expect, it } from 'vitest';
import {
  compileCatalog,
  loadCatalogSources,
  validateCatalog,
  type SourceFile,
} from '../src/index.js';
import { VALID_ROOT } from './helpers.js';

const validSources = () => loadCatalogSources(VALID_ROOT).sources;
const PIN4 = '{ kind: gpio, label: "1", pad: GPIO1, position: 4 }';
const PIN5 = '{ kind: gpio, label: "2", pad: GPIO2, position: 5 }';

function patched(old: string, next: string, from = validSources()): SourceFile[] {
  return from.map((s) => {
    if (!s.file.startsWith('boards/')) return s;
    expect(s.text.split(old).length, old).toBe(2);
    return { ...s, text: s.text.replace(old, () => next) };
  });
}
const errorsOf = (sources: SourceFile[]) =>
  validateCatalog(sources).diagnostics.filter((d) => d.severity === 'error');
const brief = (sources: SourceFile[]) => errorsOf(sources).map((e) => [e.code, e.path] as const);

/** Pin J1-4 repeats the pad of J1-3 (GPIO0) and declares it. */
const ALIAS4 = '{ alias_of: "J1:3", kind: gpio, label: "1", pad: GPIO0, position: 4 }';

describe('alias_of: a declared repeated pad is accepted', () => {
  it('accepts two pins on one pad when the second declares alias_of', () => {
    const sources = patched(PIN4, ALIAS4);
    expect(brief(sources)).toEqual([]);
    const result = validateCatalog(sources);
    expect(result.errorCount).toBe(0);
    // status is computed normally (same facts as the valid fixture: partially-verified)
    expect(result.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'partially-verified', computed: 'partially-verified' },
    ]);
  });

  it('accepts the alias declared BEFORE its primary (order does not matter)', () => {
    const swapped = patched(
      '{ kind: gpio, label: "0", pad: GPIO0, position: 3 }',
      '{ alias_of: "J1:4", kind: gpio, label: "0", pad: GPIO0, position: 3 }',
      patched(PIN4, '{ kind: gpio, label: "1", pad: GPIO0, position: 4 }'),
    );
    expect(brief(swapped)).toEqual([]);
  });

  it('accepts an alias on another connector', () => {
    const sources = patched(
      '    side: left\n',
      '    side: left\n  - id: J2\n    pins:\n      - { alias_of: "J1:3", kind: gpio, label: "9", pad: GPIO0, position: 1 }\n',
    );
    expect(brief(sources)).toEqual([]);
  });

  it('accepts several aliases of one primary', () => {
    const sources = patched(
      PIN5,
      '{ alias_of: "J1:3", kind: gpio, label: "2", pad: GPIO0, position: 5 }',
      patched(PIN4, ALIAS4),
    );
    expect(brief(sources)).toEqual([]);
  });

  it('keeps alias_of in the compiled JSON, unchanged', () => {
    const result = validateCatalog(patched(PIN4, ALIAS4));
    const compiled = compileCatalog(result, { date: '2026-01-01' });
    expect(compiled.catalogText).toContain('"alias_of":"J1:3"');
    const parsed = JSON.parse(compiled.catalogText) as {
      boards: { connectors: { pins: { position: number; alias_of?: string; pad?: string }[] }[] }[];
    };
    const pins = parsed.boards[0]?.connectors[0]?.pins ?? [];
    expect(pins.find((p) => p.position === 4)).toMatchObject({ alias_of: 'J1:3', pad: 'GPIO0' });
    expect(pins.find((p) => p.position === 3)).not.toHaveProperty('alias_of');
  });

  it('still requires unique labels and positions for an alias', () => {
    expect(brief(patched(PIN4, ALIAS4.replace('label: "1"', 'label: "0"')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.label'],
    ]);
    expect(brief(patched(PIN4, ALIAS4.replace('position: 4', 'position: 3')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.position'],
    ]);
  });
});

describe('alias_of: undeclared or malformed aliases are errors', () => {
  it('an undeclared duplicate pad is still an error', () => {
    expect(brief(patched(PIN4, PIN4.replace('GPIO1', 'GPIO0')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.pad'],
    ]);
  });

  it('a third pin on a pad without alias_of is an error, the declared alias is not', () => {
    const sources = patched(PIN5, PIN5.replace('GPIO2', 'GPIO0'), patched(PIN4, ALIAS4));
    expect(brief(sources)).toEqual([['E_PIN_NUMBERING', 'connectors.0.pins.4.pad']]);
  });

  it('a primary that is declared after an alias is not blamed', () => {
    // both pins undeclared: the later one is reported, not the first
    const sources = patched(PIN4, PIN4.replace('GPIO1', 'GPIO0'));
    expect(errorsOf(sources)).toHaveLength(1);
  });

  it('a malformed reference is unresolved', () => {
    for (const ref of ['J1-3', 'J1:', ':3', 'J1:x', 'J1:3:', '', 'J1:03']) {
      expect(brief(patched(PIN4, ALIAS4.replace('J1:3', ref))), ref).toEqual([
        ['E_REF_UNRESOLVED', 'connectors.0.pins.3.alias_of'],
      ]);
    }
  });

  it('an unknown connector is unresolved', () => {
    expect(brief(patched(PIN4, ALIAS4.replace('J1:3', 'J9:3')))).toEqual([
      ['E_REF_UNRESOLVED', 'connectors.0.pins.3.alias_of'],
    ]);
  });

  it('an alias of a pin on a different pad is an error', () => {
    expect(brief(patched(PIN4, ALIAS4.replace('J1:3', 'J1:5')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.alias_of'],
    ]);
  });

  it('an alias of a pin without a pad is an error', () => {
    expect(brief(patched(PIN4, ALIAS4.replace('J1:3', 'J1:2')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.alias_of'],
    ]);
  });

  it('an alias of itself is an error', () => {
    expect(brief(patched(PIN4, ALIAS4.replace('J1:3', 'J1:4')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.alias_of'],
    ]);
  });

  it('a chain of aliases is an error at the pin that points at an alias', () => {
    const sources = patched(
      PIN5,
      '{ alias_of: "J1:4", kind: gpio, label: "2", pad: GPIO0, position: 5 }',
      patched(PIN4, ALIAS4),
    );
    expect(brief(sources)).toEqual([['E_PIN_NUMBERING', 'connectors.0.pins.4.alias_of']]);
  });

  it('two aliases of each other are errors (neither is a primary)', () => {
    const sources = patched(
      '{ kind: gpio, label: "0", pad: GPIO0, position: 3 }',
      '{ alias_of: "J1:4", kind: gpio, label: "0", pad: GPIO0, position: 3 }',
      patched(PIN4, ALIAS4),
    );
    expect(
      brief(sources)
        .map((e) => e[1])
        .sort(),
    ).toEqual(['connectors.0.pins.2.alias_of', 'connectors.0.pins.3.alias_of']);
  });

  it('alias_of on a pad that is not shared is an error', () => {
    expect(brief(patched(PIN4, ALIAS4.replace('pad: GPIO0', 'pad: GPIO1')))).toEqual([
      ['E_PIN_NUMBERING', 'connectors.0.pins.3.alias_of'],
    ]);
  });

  it('alias_of on a pin without a pad is an error', () => {
    expect(
      brief(
        patched(
          '{ kind: ground, label: GND, position: 2 }',
          '{ alias_of: "J1:3", kind: ground, label: GND, position: 2 }',
        ),
      ),
    ).toEqual([['E_PIN_NUMBERING', 'connectors.0.pins.1.alias_of']]);
  });

  it('a board with an alias error gets no computed status', () => {
    const r = validateCatalog(patched(PIN4, ALIAS4.replace('J1:3', 'J1:5')));
    expect(r.coverage.boards[0]?.computed).toBeNull();
  });
});

describe('alias_of: each rule says which rule it is (messages)', () => {
  const messages = (sources: SourceFile[]) => errorsOf(sources).map((e) => e.message);
  it('names the broken rule', () => {
    expect(messages(patched(PIN4, ALIAS4.replace('J1:3', 'J1:4')))).toEqual([
      expect.stringContaining('is the pin itself'),
    ]);
    expect(messages(patched(PIN4, ALIAS4.replace('pad: GPIO0', 'pad: GPIO1')))).toEqual([
      expect.stringContaining('must share a pad'),
    ]);
    expect(
      messages(
        patched(
          '{ kind: ground, label: GND, position: 2 }',
          '{ alias_of: "J1:3", kind: ground, label: GND, position: 2 }',
        ),
      ),
    ).toEqual([expect.stringContaining('needs a pad')]);
    expect(messages(patched(PIN4, ALIAS4.replace('J1:3', 'J1:5')))).toEqual([
      expect.stringContaining('not "GPIO0"'),
    ]);
    expect(messages(patched(PIN4, ALIAS4.replace('J1:3', 'J1:9')))).toEqual([
      expect.stringContaining('is not a pin of this board'),
    ]);
  });
});
