// Phase 1 fix round 2: pad identity, pad references, duplicate pads, unknown directories (N1, N4, N7).
// Fixture-driven cases live in fixtures/invalid/ (see make-invalid.py); these tests cover edges.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Chip } from '@pinout/schema';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadCatalogSources,
  validateCatalog,
  validateRoot,
  type SourceFile,
} from '../src/index.js';
import { checkChipPads } from '../src/integrity.js';
import { VALID_ROOT } from './helpers.js';

const valid = () => loadCatalogSources(VALID_ROOT).sources;
const brief = (r: ReturnType<typeof validateCatalog>) =>
  r.diagnostics.filter((d) => d.severity === 'error').map((d) => [d.code, d.file, d.path] as const);

function patched(prefix: string, old: string, next: string, from = valid()): SourceFile[] {
  return from.map((s) => {
    if (!s.file.startsWith(prefix)) return s;
    expect(s.text.split(old).length, `${prefix}: ${old}`).toBe(2);
    return { ...s, text: s.text.replace(old, () => next) };
  });
}

const BONDED = 'bonded_pads: [GPIO0, GPIO1, GPIO2, GPIO3]';

const chipOf = (pads: Record<string, number>) =>
  ({
    pads: Object.fromEntries(Object.entries(pads).map(([k, gpio]) => [k, { gpio }])),
  }) as unknown as Chip;
const paths = (pads: Record<string, number>) => checkChipPads(chipOf(pads)).map((i) => i.path);

/** The valid catalog with pad GPIO3 renamed to PX3 (chip key, module bonded list and consumed key). */
function renamedGpio3(gpio?: number): SourceFile[] {
  let s = patched('chips/', '\n  GPIO3:\n', '\n  PX3:\n');
  if (gpio !== undefined) s = patched('chips/', '    gpio: 3\n', `    gpio: ${String(gpio)}\n`, s);
  s = patched('modules/', BONDED, 'bonded_pads: [GPIO0, GPIO1, GPIO2, PX3]', s);
  return patched('modules/', '\n  GPIO3: {', '\n  PX3: {', s);
}

describe('chip pad identity (E_PAD_KEY)', () => {
  it.each(['GPIO', 'GP', 'IO', 'BCM', 'gpio', 'Gp', 'bcm'])('%s<n> must equal gpio', (prefix) => {
    expect(paths({ [`${prefix}2`]: 2 })).toEqual([]);
    expect(paths({ [`${prefix}2`]: 3 })).toEqual([`pads.${prefix}2.gpio`]);
  });

  it('leading zeros are numerically equal', () => {
    expect(paths({ GPIO02: 2 })).toEqual([]);
    expect(paths({ GPIO02: 20 })).toEqual(['pads.GPIO02.gpio']);
  });

  it('other naming schemes are not checked against the number (PA5, A0, D13, P0.13)', () => {
    expect(paths({ PA5: 5, PB5: 21, A0: 14, D13: 13, 'P0.13': 113 })).toEqual([]);
  });

  it('suffixed or partial names are not covered by the key rule', () => {
    expect(paths({ GPIO2_A: 7, GPIOX2: 9, GPIO: 4 })).toEqual([]);
  });

  it('a gpio number used twice is reported at the later pad, naming the first', () => {
    const issues = checkChipPads(chipOf({ PA5: 5, PB5: 5 }));
    expect(issues.map((i) => i.path)).toEqual(['pads.PB5.gpio']);
    expect(issues[0]?.message).toContain('PA5');
  });

  it('through the validator: a non-GPIO-style duplicate is E_PAD_KEY on the chip file', () => {
    expect(brief(validateCatalog(renamedGpio3(2)))).toEqual([
      ['E_PAD_KEY', 'chips/demo-mcu-1.yaml', 'pads.PX3.gpio'],
    ]);
  });

  it('a pad without gpio is fine under a non-GPIO-style key, and several may omit it', () => {
    const chip = { pads: { TOUT: {}, VBAT: {}, GPIO2: { gpio: 2 } } } as unknown as Chip;
    expect(checkChipPads(chip)).toEqual([]);
  });

  it('a GPIO-style key without gpio is reported (the name promises a number)', () => {
    const chip = { pads: { GPIO4: {} } } as unknown as Chip;
    expect(checkChipPads(chip).map((i) => i.path)).toEqual(['pads.GPIO4.gpio']);
  });

  it('through the validator: a non-GPIO-style key with any unique number is fine', () => {
    expect(brief(validateCatalog(renamedGpio3()))).toEqual([]);
  });
});

describe('pad references (E_REF_UNRESOLVED)', () => {
  it('reports every unknown pad, at the exact element', () => {
    let s = patched('boards/', 'uses_pad: [GPIO1]', 'uses_pad: [GPIO7, GPIO1, GPIO8]');
    s = patched('modules/', BONDED, 'bonded_pads: [GPIO9, GPIO0, GPIO1, GPIO2, GPIO3]', s);
    expect(brief(validateCatalog(s))).toEqual([
      ['E_REF_UNRESOLVED', 'boards/demo-board-1@r1.yaml', 'onboard.0.uses_pad.0'],
      ['E_REF_UNRESOLVED', 'boards/demo-board-1@r1.yaml', 'onboard.0.uses_pad.2'],
      ['E_REF_UNRESOLVED', 'modules/demo-module-1.yaml', 'bonded_pads.0'],
    ]);
  });

  it('a board with an unresolved pad reference gets no computed status', () => {
    const r = validateCatalog(patched('boards/', 'uses_pad: [GPIO1]', 'uses_pad: [GPIO99]'));
    expect(r.coverage.boards).toEqual([
      { ref: 'demo-board-1@r1', declared: 'partially-verified', computed: null },
    ]);
  });

  it('does not double-report when the module is unresolved or the chip is broken', () => {
    const a = patched('boards/', 'uses_pad: [GPIO1]', 'uses_pad: [GPIO99]');
    const b = patched('boards/', 'module: demo-module-1 }', 'module: nope }', a);
    expect(brief(validateCatalog(b))).toEqual([
      ['E_REF_UNRESOLVED', 'boards/demo-board-1@r1.yaml', 'variants.0.module'],
    ]);
    let c = patched('chips/', '    gpio: 2\n', '    gpio: "four"\n');
    c = patched('modules/', BONDED, 'bonded_pads: [GPIO0, GPIO99]', c);
    expect(brief(validateCatalog(c)).map((e) => e[0])).toEqual(['E_SCHEMA']);
  });

  it('a pad that is on the chip but not bonded is not a dangling reference', () => {
    const s = patched('modules/', BONDED, 'bonded_pads: [GPIO0, GPIO2, GPIO3]');
    // GPIO1 exists on the chip; only the existing header-pin rule reports it.
    expect(brief(validateCatalog(s)).map((e) => e[0])).toEqual(['E_PIN_NUMBERING']);
  });

  it('a header pad that the module consumes internally need not be bonded (per-variant unbonded pad)', () => {
    const entry =
      '  GPIO1: { evidence: [demo-datasheet-1#module-pads], reviewers: [hardware-researcher, hardware-fact-auditor], status: verified, value: psram }';
    let s = patched('modules/', BONDED, 'bonded_pads: [GPIO0, GPIO2, GPIO3]');
    s = patched('modules/', 'consumed:\n', `consumed:\n${entry}\n`, s); // GPIO1: a header pin of the demo board
    expect(brief(validateCatalog(s))).toEqual([]);
  });

  it('a consumed pad does not excuse another unbonded header pad', () => {
    const s = patched('modules/', BONDED, 'bonded_pads: [GPIO0, GPIO2]'); // GPIO1 is not consumed
    expect(brief(validateCatalog(s)).map((e) => e[0])).toEqual(['E_PIN_NUMBERING']);
  });

  it('resolves against every variant: a pad missing on any variant chip is reported', () => {
    const text = (prefix: string) => valid().find((x) => x.file.startsWith(prefix))?.text ?? '';
    const chip2 = text('chips/')
      .replace('id: demo-mcu-1', 'id: demo-mcu-2')
      .replace('\n  GPIO2:\n', '\n  GPIO12:\n')
      .replace('    gpio: 2\n', '    gpio: 12\n');
    const mod2 = text('modules/')
      .replace('id: demo-module-1', 'id: demo-module-2')
      .replace('chip: demo-mcu-1', 'chip: demo-mcu-2')
      .replace('GPIO2, GPIO3]', 'GPIO12, GPIO3]');
    let s: SourceFile[] = [
      ...valid(),
      { file: 'chips/demo-mcu-2.yaml', kind: 'chips', text: chip2 },
      { file: 'modules/demo-module-2.yaml', kind: 'modules', text: mod2 },
    ];
    const v1 = '  - { id: demo-variant-a, module: demo-module-1 }\n';
    s = patched('boards/', v1, `${v1}  - { id: demo-variant-b, module: demo-module-2 }\n`, s);
    s = patched('boards/', 'uses_pad: [GPIO1]', 'uses_pad: [GPIO2]', s);
    const errs = validateCatalog(s).diagnostics.filter(
      (d) => d.code === 'E_REF_UNRESOLVED' && d.path === 'onboard.0.uses_pad.0',
    );
    expect(errs).toHaveLength(1);
    expect(errs[0]?.message).toContain('demo-mcu-2');
  });
});

describe('same pad on two connector pins (E_PIN_NUMBERING)', () => {
  it('pins without a pad (ground, nc) are never compared', () => {
    const s = patched(
      'boards/',
      '    side: left\n',
      '    side: left\n  - id: J2\n    pins:\n      - { kind: ground, label: GND, position: 1 }\n      - { kind: ground, label: GND, position: 2 }\n      - { kind: nc, label: NC, position: 3 }\n',
    );
    expect(brief(validateCatalog(s))).toEqual([]);
  });

  it('names the first occurrence in the message', () => {
    const s = patched(
      'boards/',
      '{ kind: gpio, label: "1", pad: GPIO1, position: 4 }',
      '{ kind: gpio, label: "1", pad: GPIO0, position: 4 }',
    );
    const d = validateCatalog(s).diagnostics.find((x) => x.code === 'E_PIN_NUMBERING');
    expect(d?.message).toContain('J1-3');
  });
});

describe('unknown directories (E_UNKNOWN_DIR)', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });
  const root = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'pinout-dirs-'));
    roots.push(dir);
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), text);
    }
    return dir;
  };

  it('reports every YAML file inside an unknown directory, including nested ones', () => {
    const r = validateRoot(
      root({ 'chip/a.yaml': 'x: 1', 'board/sub/b.yml': 'x: 1', 'board/B.YAML': 'x: 1' }),
    );
    expect(brief(r)).toEqual([
      ['E_UNKNOWN_DIR', 'board/B.YAML', ''],
      ['E_UNKNOWN_DIR', 'board/sub/b.yml', ''],
      ['E_UNKNOWN_DIR', 'chip/a.yaml', ''],
    ]);
  });

  it('ignores directories without YAML, dot-directories and node_modules', () => {
    const r = validateRoot(
      root({
        'docs/readme.md': '# hi',
        '.git/config': 'x',
        '.github/workflows/ci.yml': 'x: 1',
        'node_modules/pkg/a.yaml': 'x: 1',
        LICENSE: 'x',
      }),
    );
    expect(r.diagnostics).toEqual([]);
  });
});
