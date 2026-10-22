// Phase 1 fix round 3: runtime pins for the hardware-critical schema constraints (S2, S4, S7, S9,
// S11, S12, S14, S15), a table-driven check of EVERY enum in the emitted JSON Schemas, and the JSON
// Schema keywords that express the rules an editor can check (CR11-R2).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BoardSchema,
  BreakoutSchema,
  ChipSchema,
  EvidenceSchema,
  FixtureSchema,
  ICSchema,
  ModuleSchema,
  PinViewSchema,
  ProjectSchema,
  RecommendationSchema,
  StatusSchema,
  UnitSchema,
  WarningSchema,
  jsonSchemas,
  type JsonSchemaName,
} from '../src/index.js';
import * as sample from './samples.js';

type Doc = Record<string, unknown>;
const clone = (x: unknown): Doc => structuredClone(x) as Doc;
const SCHEMAS = {
  evidence: EvidenceSchema,
  chip: ChipSchema,
  module: ModuleSchema,
  board: BoardSchema,
  ic: ICSchema,
  breakout: BreakoutSchema,
  fixture: FixtureSchema,
  project: ProjectSchema,
  warning: WarningSchema,
  recommendation: RecommendationSchema,
  'pin-view': PinViewSchema,
} as const;

/** Sets `doc[path[0]][path[1]]...` and returns the document (the intermediate nodes must exist). */
function setAt(doc: Doc, path: readonly (string | number)[], value: unknown): Doc {
  let node: unknown = doc;
  for (const key of path.slice(0, -1)) {
    node = (node as Record<string | number, unknown>)[key];
    if (typeof node !== 'object' || node === null) {
      throw new Error(`test base document has nothing at ${path.join('.')}`);
    }
  }
  const last = path.at(-1);
  if (last === undefined) throw new Error('empty path');
  (node as Record<string | number, unknown>)[last] = value;
  return doc;
}

const pathsOf = (r: { error?: { issues: { path: PropertyKey[] }[] } }) =>
  (r.error?.issues ?? []).map((i) => i.path.map(String).join('.'));

// ---------------------------------------------------------------------------------------------
// S2 entity ids
// ---------------------------------------------------------------------------------------------
describe('entity id format (S2)', () => {
  const withId = (name: keyof typeof ID_BASES, id: string): Doc => {
    const doc = clone(ID_BASES[name]);
    doc.id = id;
    if (name === 'evidence') {
      // claim ids must start with the evidence id (a separate rule); keep that rule satisfied
      doc.claims = [{ ...sample.evidence.claims[0], id: `${id}#a` }];
    }
    return doc;
  };
  const ID_BASES = {
    evidence: sample.evidence,
    chip: sample.chip,
    module: sample.module_,
    board: sample.board,
    ic: sample.ic,
    breakout: sample.breakout,
    fixture: sample.fixture,
  } as const;
  const names = Object.keys(ID_BASES) as (keyof typeof ID_BASES)[];

  const VALID = [
    'esp32-wroom-32e',
    'a',
    'a1',
    '0day',
    'esp32-ds-v5.3',
    'a_b',
    'demo-board-1',
    'a-b.c_d-1',
  ];
  const INVALID = [
    '',
    ' ',
    'Demo MCU',
    'Demo',
    'demo-MCU',
    'A',
    'demo mcu',
    ' a',
    'a ',
    'a\n',
    'a b',
    'a#b',
    'a@b',
    'demo-board-1@r1',
    'a/b',
    'a\\b',
    'a:b',
    '-a',
    'a-',
    '.a',
    'a.',
    '_a',
    'a_',
    'a--b',
    'a..b',
    'a-.b',
    'a._b',
    'é',
    'café',
    'ａｂ', // full-width "ab"
    'аbc', // Cyrillic a + bc
    'a​b', // zero-width space
    'ı', // dotless i
  ];

  for (const name of names) {
    it.each(VALID)(`${name}: accepts %j`, (id) => {
      const r = SCHEMAS[name].safeParse(withId(name, id));
      expect(r.error?.issues).toBeUndefined();
    });
    it.each(INVALID)(`${name}: rejects %j`, (id) => {
      const r = SCHEMAS[name].safeParse(withId(name, id));
      expect(r.success).toBe(false);
      expect(pathsOf(r)).toContain('id');
    });
  }

  it('a non-string id is rejected', () => {
    for (const bad of [1, null, undefined, ['a'], { a: 1 }]) {
      expect(ChipSchema.safeParse({ ...sample.chip, id: bad }).success).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// S15 strap, S12 consumed: hardware-critical enums
// ---------------------------------------------------------------------------------------------
describe('strap levels (S15)', () => {
  const chipWithStrap = (strap: unknown) => {
    const chip = clone(sample.chip);
    setAt(chip, ['pads', 'GPIO0', 'strap', 'value'], strap);
    return ChipSchema.safeParse(chip);
  };
  const strap = (over: Doc) => ({
    role: 'boot-mode',
    required_at_reset: 'high',
    default_pull: 'up',
    ...over,
  });

  it.each(['low', 'high', 'any'])('required_at_reset accepts %s', (v) => {
    expect(chipWithStrap(strap({ required_at_reset: v })).error?.issues).toBeUndefined();
  });
  it.each([
    'hgih',
    'HIGH',
    'High',
    'LOW',
    '',
    ' high',
    'high ',
    'up',
    'none',
    'both',
    1,
    null,
    true,
  ])('required_at_reset rejects %j', (v) => {
    expect(chipWithStrap(strap({ required_at_reset: v })).success).toBe(false);
  });
  it.each(['up', 'down', 'none'])('default_pull accepts %s', (v) => {
    expect(chipWithStrap(strap({ default_pull: v })).error?.issues).toBeUndefined();
  });
  it.each(['pullup', 'UP', 'Down', '', 'high', 'both', 0, null])('default_pull rejects %j', (v) => {
    expect(chipWithStrap(strap({ default_pull: v })).success).toBe(false);
  });
  it('the literal "none" is accepted, other strings are not', () => {
    expect(chipWithStrap('none').success).toBe(true);
    for (const v of ['None', 'NONE', 'no', '']) expect(chipWithStrap(v).success, v).toBe(false);
  });
  it('a strap needs all three keys and rejects unknown ones', () => {
    expect(chipWithStrap({ role: 'x', required_at_reset: 'low' }).success).toBe(false);
    expect(chipWithStrap({ ...strap({}), extra: 1 }).success).toBe(false);
  });
});

describe('module consumed kinds (S12)', () => {
  const moduleWith = (kind: unknown) => {
    const m = clone(sample.module_);
    m.consumed = { GPIO0: sample.verified(kind) };
    return ModuleSchema.safeParse(m);
  };
  it.each(['flash', 'psram', 'usb', 'crystal', 'internal'])('accepts %s', (v) => {
    expect(moduleWith(v).error?.issues).toBeUndefined();
  });
  it.each(['flsh', 'Flash', 'FLASH', 'spi', '', ' flash', 'flash ', 'ram', 1])(
    'rejects %j',
    (v) => {
      const r = moduleWith(v);
      expect(r.success).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------------------------
// S4 gpio, S14 position, S7 URL, S9 reading evidence, S11 community
// ---------------------------------------------------------------------------------------------
describe('pad gpio number (S4)', () => {
  const chipWithGpio = (gpio: unknown) => {
    const chip = clone(sample.chip);
    setAt(chip, ['pads', 'GPIO1', 'gpio'], gpio);
    return ChipSchema.safeParse(chip);
  };
  it.each([0, 1, 39, 255, Number.MAX_SAFE_INTEGER])('accepts %j', (v) => {
    expect(chipWithGpio(v).error?.issues).toBeUndefined();
  });
  it.each([
    -1,
    -0.5,
    2.5,
    1.0000001,
    '2',
    '',
    null,
    undefined,
    true,
    [],
    NaN,
    Infinity,
    -Infinity,
    1e21,
  ])('rejects %j', (v) => {
    const r = chipWithGpio(v);
    expect(r.success).toBe(false);
    expect(pathsOf(r)).toEqual(['pads.GPIO1.gpio']);
  });
});

describe('connector pin position (S14)', () => {
  const boardWithPosition = (position: unknown) => {
    const b = clone(sample.board);
    setAt(b, ['connectors', 0, 'pins', 0, 'position'], position);
    return BoardSchema.safeParse(b);
  };
  it.each([1, 2, 40, 1000])('accepts %j', (v) => {
    expect(boardWithPosition(v).error?.issues).toBeUndefined();
  });
  it.each([0, -1, -0, 1.5, 0.5, '1', '', null, undefined, NaN, Infinity])('rejects %j', (v) => {
    const r = boardWithPosition(v);
    expect(r.success).toBe(false);
    expect(pathsOf(r)).toEqual(['connectors.0.pins.0.position']);
  });
  it('the pin view uses the same rule', () => {
    const pv = {
      connector: 'J1',
      position: 1,
      label: '0',
      kind: 'gpio',
      functions: [],
      flags: [],
      evidence: [],
    };
    expect(PinViewSchema.safeParse(pv).success).toBe(true);
    for (const position of [0, -1, 1.5]) {
      expect(PinViewSchema.safeParse({ ...pv, position }).success, String(position)).toBe(false);
    }
  });
});

describe('evidence URL must parse as a URL (S7)', () => {
  const REJECT = [
    'https://', // passes ^\S+$ and ^https?://, has no credentials: only URL parsing rejects it
    'http://',
    'http://:80',
    'https://[::1',
    'http://exa mple.com',
    'https://exa%mple.com',
    'https://a.com:99999999',
  ];
  it.each(REJECT)('rejects %j in url and url_original', (u) => {
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url: u }).success).toBe(false);
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url_original: u }).success).toBe(false);
  });
  it.each([
    'https://example.com',
    'http://localhost:8080/x',
    'https://[::1]/x',
    'https://a.b/c?d=e#f',
  ])('accepts %j', (u) => {
    expect(EvidenceSchema.safeParse({ ...sample.evidence, url: u }).error?.issues).toBeUndefined();
  });
  it('reports the URL problem at url', () => {
    expect(pathsOf(EvidenceSchema.safeParse({ ...sample.evidence, url: 'https://' }))).toEqual([
      'url',
    ]);
  });
});

describe('conflict reading evidence ids (S9)', () => {
  const chipWithReading = (evidence: unknown) => {
    const chip = clone(sample.chip);
    setAt(chip, ['vdd_io'], {
      value: 3.3,
      unit: 'V',
      evidence: ['demo-ds#a'],
      status: 'conflict',
      readings: [
        { value: 3.3, evidence: ['demo-ds#a'] },
        { value: 5, evidence },
      ],
      active: 3.3,
    });
    return ChipSchema.safeParse(chip);
  };
  it('accepts claim ids', () => {
    expect(chipWithReading(['demo-ds#a', 'x#y']).error?.issues).toBeUndefined();
  });
  it.each(['no-hash', '', '#slug', 'doc#', 'a b#c', 'doc#a b', 'a#b\n', 5, null])(
    'rejects %j as a reading evidence id',
    (id) => {
      const r = chipWithReading([id]);
      expect(r.success).toBe(false);
      expect(pathsOf(r)).toEqual(['vdd_io.readings.1.evidence.0']);
    },
  );
  it('readings.N.evidence must be an array', () => {
    expect(chipWithReading('demo-ds#a').success).toBe(false);
  });
});

describe('community status (S11)', () => {
  it('is a valid status value', () => {
    expect(StatusSchema.safeParse('community').success).toBe(true);
    expect(StatusSchema.options).toContain('community');
  });
  it('a community fact is accepted where any fact is', () => {
    const m = clone(sample.module_);
    setAt(m, ['flash_voltage', 'status'], 'community');
    expect(ModuleSchema.safeParse(m).error?.issues).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// Every enum of every emitted JSON Schema: one valid value accepted, a bogus value rejected
// ---------------------------------------------------------------------------------------------
const STATUSES = ['verified', 'single-source', 'conflict', 'interim', 'community', 'missing'];
const UNITS = ['V', 'mV', 'A', 'mA', 'ohm', 'kohm', 's', 'ns', 'us', 'Hz', 'kHz', 'MHz', 'pF', 'W'];
const INTERFACE_KINDS = ['i2c', 'spi', 'uart', 'onewire', 'analog', 'digital'];
const ROUTING = ['iomux', 'matrix', 'fixed'];
const LEVELS = ['critical', 'warning', 'caution', 'info'];
const RESULT = ['ok', 'unsat', 'needs_variant'];
const PIN_KINDS = ['power', 'ground', 'gpio', 'reset', 'nc', 'analog-ref'];
const FRAMEWORKS = ['arduino', 'micropython', 'esp-idf', 'pico-sdk', 'rpi-python'];

/** The contract (skill catalog-schema, reference.ts): every non-fact enum, by schema and field path. */
const EXPECTED_ENUMS: Record<string, readonly (string | number)[]> = {
  'board:connectors.*.side': ['left', 'right', 'top', 'bottom'],
  'board:connectors.*.pins.*.kind': PIN_KINDS,
  'board:numbering.primary': ['gpio', 'label', 'physical'],
  'board:status': ['fully-verified', 'partially-verified', 'datasheet-required', 'unsupported'],
  'breakout:interfaces_exposed.*': INTERFACE_KINDS,
  'chip:pads.*.functions.*.routing': ROUTING,
  'chip:pads.*.reset_state.value': [
    'input',
    'pullup',
    'pulldown',
    'disabled',
    'output-high',
    'output-low',
  ],
  'chip:pads.*.strap.value.required_at_reset': ['low', 'high', 'any'],
  'chip:pads.*.strap.value.default_pull': ['up', 'down', 'none'],
  'chip:pads.*.power_up_glitch.value.level': ['high', 'low'],
  'chip:peripherals.*.kind': ['spi', 'i2c', 'uart', 'adc', 'pwm', 'onewire-capable'],
  'evidence:kind': [
    'board-guide',
    'datasheet',
    'trm',
    'errata',
    'schematic',
    'design-guide',
    'api-doc',
    'library',
    'app-note',
    'standard',
  ],
  'fixture:project.modules.*.interface': INTERFACE_KINDS,
  'fixture:project.framework': FRAMEWORKS,
  'fixture:expect.status': RESULT,
  'fixture:expect.warnings_include.*.level': LEVELS,
  'ic:interfaces.*.kind': INTERFACE_KINDS,
  'ic:interfaces.*.signals.*.dir': ['in', 'out', 'io'],
  'ic:interfaces.*.signals.*.drive': ['push-pull', 'open-drain', 'open-collector'],
  'ic:interfaces.*.signals.*.resting_level': ['high', 'low', 'float'],
  'ic:interfaces.*.limits.i2c_modes.*': ['sm', 'fm', 'fmp', 'hs'],
  'ic:select_strap.table.*.value.*': [0, 1],
  'ic:select_strap.table.*.selects': INTERFACE_KINDS,
  'module:consumed.*.value': ['flash', 'psram', 'usb', 'crystal', 'internal'],
  'pin-view:kind': PIN_KINDS,
  'pin-view:functions.*.routing': ROUTING,
  'pin-view:flags.*': [
    'input-only',
    'strap',
    'consumed',
    'onboard',
    'jtag',
    'power-up-glitch',
    'adc-radio-conflict',
    'unverified',
  ],
  'project:modules.*.interface': INTERFACE_KINDS,
  'project:framework': FRAMEWORKS,
  'recommendation:status': RESULT,
  'recommendation:interfaces.*.kind': INTERFACE_KINDS,
  'recommendation:interfaces.*.alternatives.*': INTERFACE_KINDS,
  'recommendation:assignments.*.routing': ROUTING,
  'recommendation:assignments.*.alternatives.*.lower_tier': [1, 2, 3, 4],
  'recommendation:required_parts.*.kind': [
    'resistor',
    'capacitor',
    'level-shifter',
    'buffer',
    'transistor',
    'diode',
    'regulator',
    'divider',
  ],
  'recommendation:warnings.*.level': LEVELS,
  'warning:level': LEVELS,
};

type JsonNode = Record<string, unknown>;
const isFactNode = (s: JsonNode): boolean => {
  const props = s.properties as JsonNode | undefined;
  return (
    s.type === 'object' &&
    props !== undefined &&
    'status' in props &&
    'evidence' in props &&
    'value' in props
  );
};

interface Walked {
  /** `<schema>:<field path>` -> enum values, for every enum that is not a Fact `status`/`unit`. */
  enums: Map<string, unknown[]>;
  /** Facts found, with the enum values of their `status` and `unit`. */
  facts: { where: string; status: unknown; unit: unknown }[];
}

/** Walks every emitted JSON Schema; `*` stands for "any array element / record value". */
function walkEnums(): Walked {
  const out: Walked = { enums: new Map(), facts: [] };
  const schemas = jsonSchemas() as unknown as Record<string, JsonNode>;
  const walk = (node: unknown, schema: string, path: string): void => {
    if (typeof node !== 'object' || node === null) return;
    const s = node as JsonNode;
    if (Array.isArray(s.enum)) out.enums.set(`${schema}:${path}`, s.enum as unknown[]);
    if (isFactNode(s)) {
      const props = s.properties as Record<string, JsonNode>;
      out.facts.push({
        where: `${schema}:${path}`,
        status: props.status?.enum,
        unit: props.unit?.enum,
      });
      walk(props.value, schema, `${path}.value`); // readings/active repeat the value schema
      return;
    }
    for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
      const alts = s[key];
      if (Array.isArray(alts)) for (const alt of alts) walk(alt, schema, path);
    }
    for (const [k, v] of Object.entries((s.properties as JsonNode | undefined) ?? {}))
      walk(v, schema, path === '' ? k : `${path}.${k}`);
    if (s.items !== undefined) walk(s.items, schema, `${path}.*`);
    if (typeof s.additionalProperties === 'object')
      walk(s.additionalProperties, schema, `${path}.*`);
  };
  for (const [name, schema] of Object.entries(schemas)) walk(schema, name, '');
  return out;
}

/** Documents that contain every enum-valued field at least once (optional fields filled in). */
const BASES: Record<JsonSchemaName, () => Doc> = {
  evidence: () => clone(sample.evidence),
  chip: () => {
    const chip = clone(sample.chip);
    setAt(
      chip,
      ['pads', 'GPIO0', 'strap'],
      sample.verified({ role: 'boot', required_at_reset: 'high', default_pull: 'up' }),
    );
    setAt(
      chip,
      ['pads', 'GPIO0', 'power_up_glitch'],
      sample.verified({ level: 'high', duration_s: 0.001 }),
    );
    return chip;
  },
  module: () => {
    const m = clone(sample.module_);
    m.consumed = { GPIO0: sample.verified('flash') };
    return m;
  },
  board: () => {
    const b = clone(sample.board);
    setAt(b, ['connectors', 0, 'side'], 'left');
    return b;
  },
  ic: () => {
    const ic = clone(sample.ic);
    setAt(ic, ['interfaces', 0, 'signals', 0, 'resting_level'], 'float');
    ic.select_strap = {
      pins: ['A0'],
      table: [{ value: { A0: 0 }, selects: 'i2c' }],
      evidence: ['demo-ds#a'],
    };
    return ic;
  },
  breakout: () => clone(sample.breakout),
  fixture: () => {
    const f = clone(sample.fixture);
    const project = clone(sample.project);
    project.framework = 'arduino';
    setAt(project, ['modules', 0, 'interface'], 'i2c');
    f.project = project;
    setAt(f, ['expect', 'warnings_include'], [{ code: 'C_X', level: 'caution' }]);
    return f;
  },
  project: () => {
    const p = clone(sample.project);
    p.framework = 'arduino';
    setAt(p, ['modules', 0, 'interface'], 'i2c');
    return p;
  },
  warning: () => clone(sample.warning),
  recommendation: () => {
    const r = clone(sample.recommendation);
    setAt(r, ['interfaces', 'env', 'alternatives'], ['spi']);
    r.required_parts = [{ kind: 'resistor', role: 'pull-up', count: 2 }];
    return r;
  },
  'pin-view': () => ({
    connector: 'J1',
    position: 2,
    label: '0',
    kind: 'gpio',
    pad: 'GPIO0',
    gpio: 0,
    functions: [{ fn: 'GPIO', routing: 'matrix' }],
    flags: ['strap'],
    evidence: ['demo-ds#a'],
  }),
};

/** Instance path for a walker path: `*` becomes the first existing key / index of the base document. */
function instancePath(doc: Doc, path: string): (string | number)[] {
  const out: (string | number)[] = [];
  let node: unknown = doc;
  for (const part of path.split('.')) {
    if (part === '*') {
      if (Array.isArray(node)) {
        out.push(0);
        node = node[0];
      } else if (typeof node === 'object' && node !== null) {
        const key = Object.keys(node)[0];
        if (key === undefined)
          throw new Error(`base document has an empty record at ${out.join('.')}`);
        out.push(key);
        node = (node as Doc)[key];
      } else {
        throw new Error(`base document has nothing at ${out.join('.')}.*`);
      }
    } else {
      out.push(part);
      node = typeof node === 'object' && node !== null ? (node as Doc)[part] : undefined;
    }
  }
  return out;
}

describe('every enum in the emitted JSON Schemas (CR2-R2 class of gaps)', () => {
  const walked = walkEnums();

  it('the walker finds enums at all (the test cannot go vacuous)', () => {
    expect(walked.enums.size).toBeGreaterThanOrEqual(Object.keys(EXPECTED_ENUMS).length);
    expect(walked.facts.length).toBeGreaterThan(30);
  });

  it('the set of enum fields and their values equals the contract: nothing added, widened or lost', () => {
    const found = Object.fromEntries([...walked.enums].sort(([a], [b]) => (a < b ? -1 : 1)));
    const expected = Object.fromEntries(
      Object.entries(EXPECTED_ENUMS).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
    expect(found).toEqual(expected);
  });

  it('every Fact has the contract status and unit enums', () => {
    for (const f of walked.facts) {
      expect(f.status, f.where).toEqual(STATUSES);
      expect(f.unit, f.where).toEqual(UNITS);
    }
  });

  it('Fact.status and Fact.unit accept every contract value and reject bogus ones', () => {
    const m = (patch: Doc) => {
      const doc = clone(sample.module_);
      Object.assign(doc.flash_voltage as Doc, patch);
      return ModuleSchema.safeParse(doc);
    };
    for (const status of STATUSES) expect(m({ status }).error?.issues, status).toBeUndefined();
    for (const unit of UNITS) expect(m({ unit }).error?.issues, unit).toBeUndefined();
    for (const bad of [
      'probably',
      'Verified',
      'VERIFIED',
      '',
      'single_source',
      'unverified',
      7,
      null,
    ])
      expect(m({ status: bad }).success, String(bad)).toBe(false);
    for (const bad of ['volts', 'v', 'MV', 'ohms', 'kΩ', 'µs', '', 5, null])
      expect(m({ unit: bad }).success, String(bad)).toBe(false);
    expect(StatusSchema.options).toEqual(STATUSES);
    expect(UnitSchema.options).toEqual(UNITS);
  });

  describe.each(Object.entries(EXPECTED_ENUMS))('%s', (key, values) => {
    const [schema, path] = key.split(':') as [JsonSchemaName, string];
    const bogus = (v: string | number): (string | number)[] =>
      typeof v === 'number'
        ? [99, -1, 0.5, String(v)]
        : [
            '__bogus__',
            '',
            v.toUpperCase() === v ? `${v}x` : v.toUpperCase(),
            `${v} `,
            v.slice(0, -1),
            0,
          ];

    it('the base document is valid, and every contract value is accepted at that field', () => {
      expect(SCHEMAS[schema].safeParse(BASES[schema]()).error?.issues).toBeUndefined();
      for (const value of values) {
        const doc = BASES[schema]();
        setAt(doc, instancePath(doc, path), value);
        const r = SCHEMAS[schema].safeParse(doc);
        expect(r.error?.issues, `${key} = ${String(value)}`).toBeUndefined();
      }
    });

    it('a bogus value is rejected at that field', () => {
      for (const value of values) {
        for (const wrong of bogus(value)) {
          if (values.includes(wrong)) continue;
          const doc = BASES[schema]();
          setAt(doc, instancePath(doc, path), wrong);
          expect(SCHEMAS[schema].safeParse(doc).success, `${key} = ${JSON.stringify(wrong)}`).toBe(
            false,
          );
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------
// CR11-R2: the emitted JSON Schema expresses what JSON Schema can express
// ---------------------------------------------------------------------------------------------
describe('emitted JSON Schema carries the expressible rules (CR11-R2)', () => {
  const schemas = jsonSchemas() as unknown as Record<string, JsonNode>;
  const at = (schema: string, ...path: string[]): JsonNode => {
    let node: unknown = schemas[schema];
    for (const key of path) {
      const n = node as JsonNode;
      node = key === '[]' ? n.items : (n.properties as JsonNode | undefined)?.[key];
    }
    return node as JsonNode;
  };
  /** Every `pattern` of a string node, including those under `allOf` (several regex checks). */
  const patterns = (node: JsonNode): RegExp[] => [
    ...(typeof node.pattern === 'string' ? [new RegExp(node.pattern)] : []),
    ...((node.allOf as JsonNode[] | undefined) ?? []).flatMap(patterns),
  ];
  const accepts = (node: JsonNode, value: string): boolean =>
    patterns(node).every((re) => re.test(value));

  it('claim ids: <doc>#<slug>, on the claim itself and on every evidence array', () => {
    const ids: JsonNode[] = [
      at('evidence', 'claims', '[]', 'id'),
      at('board', 'onboard', '[]', 'evidence', '[]'),
    ];
    ids.push(at('module', 'flash_voltage', 'evidence', '[]'), at('fixture', 'evidence', '[]'));
    for (const node of ids) {
      expect(patterns(node).length).toBeGreaterThan(0);
      for (const ok of ['demo-ds#a', 'esp32-ds-v5.3#strap-table', 'a#b#c'])
        expect(accepts(node, ok), ok).toBe(true);
      for (const bad of ['no-hash', '#x', 'doc#', 'a b#c', 'doc#a b', '', ' a#b'])
        expect(accepts(node, bad), bad).toBe(false);
    }
  });

  it('quote: at most 400 characters and not blank', () => {
    const quote = at('evidence', 'claims', '[]', 'quote');
    expect(quote.maxLength).toBe(400);
    expect(accepts(quote, 'a real quote')).toBe(true);
    expect(accepts(quote, '   ')).toBe(false);
  });

  it('url / url_original: http(s) only, no whitespace, no credentials', () => {
    const ok = [
      'https://example.com/a.pdf',
      'http://example.com',
      'https://example.com:8443/a@b.pdf?x=a@b',
      'https://e.com#a@b',
    ];
    const bad = [
      'javascript:alert(1)',
      'file:///etc/passwd',
      'HTTPS://example.com',
      ' https://example.com',
      'https://example.com/a b',
      'https://user:pass@example.com/a.pdf',
      'https://user@example.com',
      'https://@example.com',
    ];
    const url = at('evidence', 'url');
    for (const u of ok) expect(accepts(url, u), u).toBe(true);
    for (const u of bad) expect(accepts(url, u), u).toBe(false);
    // url_original is nullable: the string branch carries the same patterns
    const original = at('evidence', 'url_original');
    const branch = (original.anyOf as JsonNode[]).find((b) => b.type === 'string') ?? {};
    expect(patterns(branch).length).toBeGreaterThan(0);
    for (const u of ok) expect(accepts(branch, u), u).toBe(true);
    for (const u of bad) expect(accepts(branch, u), u).toBe(false);
  });

  it('reviewer keys: plain ASCII token, optionally padded with whitespace', () => {
    const reviewer = at('board', 'logic_voltage', 'reviewers', '[]');
    for (const ok of ['hardware-researcher', 'A_b.1', ' a ', '0day', 'Hardware-Auditor '])
      expect(accepts(reviewer, ok), ok).toBe(true);
    for (const bad of [
      '',
      '  ',
      'a b',
      '-a',
      'é',
      'hardware-researcher​',
      '​x',
      'hаrdware',
      '.a',
      'a/b',
    ])
      expect(accepts(reviewer, bad), JSON.stringify(bad)).toBe(false);
  });

  it('the emitted patterns agree with the Zod schemas on a shared table', () => {
    const reviewer = at('board', 'logic_voltage', 'reviewers', '[]');
    const url = at('evidence', 'url');
    const zodReviewer = (r: string) => {
      const chip = clone(sample.chip);
      (chip.vdd_io as Doc).reviewers = [r];
      return ChipSchema.safeParse(chip).success;
    };
    for (const r of ['a', ' a ', 'a b', '', ' ', 'é', 'K', '-x', 'ok.name_1', 'a​'])
      expect(accepts(reviewer, r), `reviewer ${JSON.stringify(r)}`).toBe(zodReviewer(r));
    for (const u of [
      'https://a.com',
      'https://u:p@a.com',
      'ftp://a.com',
      'https://a.com/ x',
      'http://a.com/a@b',
    ])
      expect(accepts(url, u), `url ${u}`).toBe(
        EvidenceSchema.safeParse({ ...sample.evidence, url: u }).success,
      );
  });

  it('entity ids on every entity: lower-case kebab-case pattern', () => {
    for (const name of ['evidence', 'chip', 'module', 'board', 'ic', 'breakout', 'fixture']) {
      const id = at(name, 'id');
      expect(patterns(id).length, name).toBeGreaterThan(0);
      for (const ok of ['esp32-wroom-32e', 'a', 'esp32-ds-v5.3', 'a_b'])
        expect(accepts(id, ok), `${name} ${ok}`).toBe(true);
      for (const bad of ['Demo MCU', 'A', 'a b', 'a#b', 'a@b', '-a', 'a-', 'a--b', '', 'é'])
        expect(accepts(id, bad), `${name} ${JSON.stringify(bad)}`).toBe(false);
    }
  });
});

describe('docs/schema.md names the rules JSON Schema cannot express (CR11-R2)', () => {
  const doc = readFileSync(new URL('../../../docs/schema.md', import.meta.url), 'utf8');
  it('says which rules are enforced by `catalog validate` only', () => {
    expect(doc).toContain('enforced by `catalog validate` only');
    expect(doc).toContain('at most 25 words');
    expect(doc).toContain('A claim id starts with the id of its own evidence record');
  });
});
