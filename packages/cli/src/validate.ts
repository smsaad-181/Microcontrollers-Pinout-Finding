// Pure catalog validation: SourceFile[] in, diagnostics + typed entities + coverage out.
// Error codes and interpretation follow packages/cli/test/fixtures/README.md (decisions 1-18).
import {
  BoardSchema,
  BreakoutSchema,
  ChipSchema,
  EvidenceSchema,
  FixtureSchema,
  ICSchema,
  ModuleSchema,
  checkFactRules,
  collectClaimRefs,
  collectFacts,
  type Board,
  type BoardStatus,
  type Breakout,
  type Chip,
  type ConnectorPin,
  type Evidence,
  type Fixture,
  type IC,
  type Module,
  type Status,
} from '@pinout/schema';
import { isAlias, isMap, isNode, isScalar, isSeq, parseDocument, type Document } from 'yaml';
import type { z } from 'zod';
import { checkChipPads } from './integrity.js';
import { loadCatalogSources } from './load.js';
import { byCodeUnit, compareDiagnostics } from './order.js';
import {
  KINDS,
  STATUSES,
  type CatalogEntities,
  type Coverage,
  type Diagnostic,
  type Kind,
  type SourceFile,
  type StatusCounts,
  type ValidationResult,
} from './types.js';

const SCHEMAS: Record<Kind, z.ZodType> = {
  evidence: EvidenceSchema,
  chips: ChipSchema,
  modules: ModuleSchema,
  boards: BoardSchema,
  ics: ICSchema,
  breakouts: BreakoutSchema,
  fixtures: FixtureSchema,
};

interface Parsed {
  source: SourceFile;
  /** YAML data, when the YAML parsed. */
  raw?: unknown;
  /** Typed entity, when the shape check passed. */
  entity?: unknown;
}

/** Keys that would reach `Object.prototype` machinery; rejected anywhere in a catalog file. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const zeroCounts = (): StatusCounts => ({
  verified: 0,
  'single-source': 0,
  conflict: 0,
  interim: 0,
  community: 0,
  missing: 0,
});
const boardRef = (b: Pick<Board, 'id' | 'revision'>) => `${b.id}@${b.revision}`;

function rawId(raw: unknown): string | undefined {
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = raw.id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}

function zodPath(path: readonly PropertyKey[]): string {
  return path.map(String).join('.');
}

const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

interface AstScan {
  /** First anchor / alias / merge key found (catalog files must be plain data). */
  yamlProblem?: string;
  /** Dot paths of forbidden record keys. */
  forbiddenKeys: string[];
}

/**
 * Walks the YAML AST (before any expansion). Anchors, aliases and merge keys are refused outright:
 * they let a tiny file expand into a huge one (alias bomb) and hide values from review. Keys such as
 * `__proto__` are collected so they can be rejected instead of being silently dropped later.
 */
function scanAst(doc: Document, text: string): AstScan {
  const scan: AstScan = { forbiddenKeys: [] };
  const problem = (node: unknown, what: string) => {
    if (scan.yamlProblem !== undefined) return;
    const range = isNode(node) ? node.range : undefined;
    const at = range ? `line ${String(lineOf(text, range[0]))}: ` : '';
    scan.yamlProblem = `${at}${what} are not allowed in catalog files; write the value out in full`;
  };
  const walk = (node: unknown, path: string): void => {
    if (isAlias(node)) {
      problem(node, 'YAML aliases (*name)');
      return;
    }
    if (isNode(node) && 'anchor' in node && node.anchor) problem(node, 'YAML anchors (&name)');
    if (isMap(node)) {
      for (const pair of node.items) {
        const key = isScalar(pair.key) ? String(pair.key.value) : undefined;
        if (key === undefined) {
          if (isAlias(pair.key)) problem(pair.key, 'YAML aliases (*name)');
          continue;
        }
        const here = path === '' ? key : `${path}.${key}`;
        if (key === '<<') problem(pair.key, 'YAML merge keys (<<)');
        if (FORBIDDEN_KEYS.has(key)) scan.forbiddenKeys.push(here);
        walk(pair.value, here);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, i) => {
        walk(item, path === '' ? String(i) : `${path}.${String(i)}`);
      });
    }
  };
  walk(doc.contents, '');
  return scan;
}

function parseYaml(
  source: SourceFile,
  out: Diagnostic[],
): { ok: true; value: unknown } | { ok: false } {
  const yamlError = (message: string): { ok: false } => {
    out.push({ severity: 'error', code: 'E_YAML', file: source.file, path: '', message });
    return { ok: false };
  };
  try {
    const doc = parseDocument(source.text, {
      version: '1.2',
      schema: 'core',
      uniqueKeys: true,
      prettyErrors: true,
    });
    const first = doc.errors[0];
    if (first) return yamlError(first.message.split('\n')[0] ?? first.message);
    const scan = scanAst(doc, source.text);
    if (scan.yamlProblem !== undefined) return yamlError(scan.yamlProblem);
    if (scan.forbiddenKeys.length > 0) {
      for (const path of scan.forbiddenKeys) {
        out.push({
          severity: 'error',
          code: 'E_SCHEMA',
          file: source.file,
          path,
          message: `key "${path.split('.').at(-1) ?? ''}" is not allowed (reserved JavaScript object key)`,
        });
      }
      return { ok: false };
    }
    return { ok: true, value: doc.toJS({ maxAliasCount: 0 }) as unknown };
  } catch (e) {
    // e.g. nesting deep enough to overflow the parser's recursion: one diagnostic, never a crash.
    return yamlError(e instanceof Error ? e.message : String(e));
  }
}

/** True when the last key of `path` is absent from its (existing) parent object in `raw`. */
function isMissingKey(raw: unknown, path: readonly PropertyKey[]): boolean {
  let node: unknown = raw;
  for (const key of path.slice(0, -1)) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  const last = path.at(-1);
  return (
    last !== undefined &&
    typeof node === 'object' &&
    node !== null &&
    !Array.isArray(node) &&
    !(last in node)
  );
}

function shapeCheck(p: Parsed, out: Diagnostic[]): void {
  const result = SCHEMAS[p.source.kind].safeParse(p.raw);
  if (result.success) {
    p.entity = result.data;
    return;
  }
  for (const issue of result.error.issues) {
    let path = zodPath(issue.path);
    if (issue.code === 'unrecognized_keys' && issue.keys.length === 1) {
      path = zodPath([...issue.path, issue.keys[0] ?? '']);
    }
    const message = isMissingKey(p.raw, issue.path)
      ? `missing required key "${String(issue.path.at(-1))}"`
      : issue.message;
    out.push({ severity: 'error', code: 'E_SCHEMA', file: p.source.file, path, message });
  }
}

/** Most claim ids named in an `E_EVIDENCE_UNKNOWN` message, so a contributor can spot the typo. */
const MAX_LISTED_CLAIMS = 5;

/** ` (known claims: a, b, c, d, e, ...)`: the first claim ids of a document by code unit, or ''. */
function knownClaims(claims: ReadonlySet<string>): string {
  const sorted = [...claims].sort(byCodeUnit);
  if (sorted.length === 0) return ' (the document has no claims)';
  const more = sorted.length > MAX_LISTED_CLAIMS ? ', ...' : '';
  return ` (known claims: ${sorted.slice(0, MAX_LISTED_CLAIMS).join(', ')}${more})`;
}

/** Board status rule (README decision 7), over the board plus its variants' modules and chips. */
function computeBoardStatus(board: Board, modules: Module[], chips: Chip[]): BoardStatus {
  const hasGpio = board.connectors.some((c) => c.pins.some((pin) => pin.kind === 'gpio'));
  if (!hasGpio) return 'datasheet-required';
  const facts = [board, ...modules, ...chips].flatMap((e) => collectFacts(e));
  return facts.every((f) => f.fact.status === 'verified') ? 'fully-verified' : 'partially-verified';
}

/** Pin kinds whose silkscreen label must be non-empty (README decision 6, extended to rails). */
const LABELLED_KINDS: ReadonlySet<string> = new Set(['gpio', 'power', 'ground']);

/**
 * Validates a whole catalog given as in-memory sources (pure: no file system).
 *
 * Pipeline: YAML (E_YAML) -> shape (E_SCHEMA) -> duplicate ids (E_DUPLICATE_ID) -> fact rules
 * -> evidence resolution (E_EVIDENCE_UNKNOWN) -> boards (E_REF_UNRESOLVED, E_PIN_NUMBERING,
 * E_BOARD_STATUS) -> other references (E_REF_UNRESOLVED) -> coverage. An entity that fails an
 * earlier stage is skipped by later checks that depend on it (README decision 8). Never throws on
 * bad catalog content: every problem becomes a diagnostic.
 */
export function validateCatalog(sources: readonly SourceFile[]): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const error =
    (code: Extract<Diagnostic, { severity: 'error' }>['code'], p: Parsed | string) =>
    (path: string, message: string) => {
      diagnostics.push({
        severity: 'error',
        code,
        file: typeof p === 'string' ? p : p.source.file,
        path,
        message,
      });
    };
  const parsed: Parsed[] = [...sources]
    .sort((a, b) => byCodeUnit(a.file, b.file))
    .map((source) => ({ source }));

  // 1. YAML, 2. shape (E_SCHEMA). Entities failing either step are excluded from all later checks.
  for (const p of parsed) {
    const yaml = parseYaml(p.source, diagnostics);
    if (!yaml.ok) continue;
    p.raw = yaml.value;
    shapeCheck(p, diagnostics);
  }

  const ok = (kind: Kind) => parsed.filter((p) => p.source.kind === kind && p.entity !== undefined);
  const keyOf = (kind: Kind, p: Parsed): string =>
    kind === 'boards' ? boardRef(p.entity as Board) : (p.entity as { id: string }).id;

  // 3. Duplicate ids (E_DUPLICATE_ID): every file in a clash is reported; the clashing id is then
  // treated like a broken entity so nothing silently merges or picks a winner.
  const duplicated = Object.fromEntries(KINDS.map((k) => [k, new Set<string>()])) as Record<
    Kind,
    Set<string>
  >;
  for (const kind of KINDS) {
    const groups = new Map<string, Parsed[]>();
    for (const p of ok(kind)) {
      const key = keyOf(kind, p);
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    for (const [key, members] of groups) {
      if (members.length < 2) continue;
      duplicated[kind].add(key);
      for (const p of members) {
        const others = members.filter((m) => m !== p).map((m) => m.source.file);
        error('E_DUPLICATE_ID', p)(
          'id',
          `${kind} id "${key}" is defined more than once (also in ${others.join(', ')})`,
        );
      }
    }
  }
  for (const p of ok('evidence')) {
    const seen = new Map<string, number>();
    (p.entity as Evidence).claims.forEach((c, i) => {
      const first = seen.get(c.id);
      if (first === undefined) seen.set(c.id, i);
      else
        error('E_DUPLICATE_ID', p)(
          `claims.${String(i)}.id`,
          `claim id "${c.id}" is already defined at claims.${String(first)}`,
        );
    });
  }

  /** Ids of `kind` that exist but cannot be relied on: failed the shape check, or duplicated. `null` = unknown id. */
  const brokenIds = (kind: Kind) =>
    new Set<string | null>([
      ...parsed
        .filter((p) => p.source.kind === kind && p.entity === undefined)
        .map((p) => rawId(p.raw) ?? null),
      ...duplicated[kind],
    ]);
  /** Entities of `kind` keyed by id, without any duplicated id. */
  const uniqueByKey = <T>(kind: Kind): Map<string, T> =>
    new Map(
      ok(kind)
        .filter((p) => !duplicated[kind].has(keyOf(kind, p)))
        .map((p) => [keyOf(kind, p), p.entity as T]),
    );
  /** A missing reference is only the author's mistake when the target is not a broken file. */
  const targetMayBeBroken = (broken: Set<string | null>, id: string) =>
    broken.has(id) || broken.has(null);

  // 4. Cross-field fact rules on every non-evidence entity that passed the shape check.
  for (const p of parsed) {
    if (p.entity === undefined || p.source.kind === 'evidence') continue;
    for (const issue of checkFactRules(p.entity)) {
      diagnostics.push({
        severity: 'error',
        code: issue.code,
        file: p.source.file,
        path: issue.path,
        message: issue.message,
      });
    }
  }

  // 4b. Chip pad identity (decision 16): GPIO-style keys equal `gpio`; `gpio` numbers are unique.
  for (const p of ok('chips')) {
    for (const issue of checkChipPads(p.entity as Chip))
      error('E_PAD_KEY', p)(issue.path, issue.message);
  }

  // 5. Evidence resolution (decision 4): doc = text before the first '#', claim = the full id.
  const claimsByDoc = new Map<string, Set<string>>();
  for (const [id, ev] of uniqueByKey<Evidence>('evidence')) {
    claimsByDoc.set(id, new Set(ev.claims.map((c) => c.id)));
  }
  const brokenDocs = brokenIds('evidence');
  for (const p of parsed) {
    if (p.entity === undefined || p.source.kind === 'evidence' || brokenDocs.has(null)) continue;
    for (const ref of collectClaimRefs(p.entity)) {
      const doc = ref.claim.slice(0, ref.claim.indexOf('#'));
      if (brokenDocs.has(doc)) continue; // that evidence file has its own error (decision 8)
      const claims = claimsByDoc.get(doc);
      if (!claims?.has(ref.claim)) {
        error('E_EVIDENCE_UNKNOWN', p)(
          ref.path,
          claims
            ? `unknown claim "${ref.claim}" in evidence document "${doc}"${knownClaims(claims)}`
            : `unknown evidence document "${doc}" (cited as "${ref.claim}")`,
        );
      }
    }
  }

  // 6. Boards: references, pin numbering (decision 6) and status (decision 7), with dependency skipping.
  const modulesById = uniqueByKey<Module>('modules');
  const chipsById = uniqueByKey<Chip>('chips');
  const brokenModules = brokenIds('modules');
  const brokenChips = brokenIds('chips');
  const boardStatuses: Coverage['boards'] = [];

  for (const p of ok('boards')) {
    const board = p.entity as Board;
    const fail = error('E_PIN_NUMBERING', p);
    // Resolve each variant to (module, chip). `blocked` = some reference is unresolved or broken, so
    // the pad checks are incomplete and NO status may be computed (never a bogus pass).
    let blocked = brokenModules.has(null) || brokenChips.has(null);
    const resolved: { variant: string; module: Module; chip: Chip }[] = [];
    board.variants.forEach((v, i) => {
      const mod = modulesById.get(v.module);
      if (!mod) {
        blocked = true;
        if (!targetMayBeBroken(brokenModules, v.module)) {
          error('E_REF_UNRESOLVED', p)(
            `variants.${String(i)}.module`,
            `module "${v.module}" is not in the catalog`,
          );
        }
        return;
      }
      const chip = chipsById.get(mod.chip);
      if (!chip) {
        blocked = true; // reported on the module file (E_REF_UNRESOLVED) or the chip is broken
        return;
      }
      resolved.push({ variant: v.id, module: mod, chip });
    });

    // Errors that make the pad / status checks of this board incomplete: no status is computed.
    let pinErrors = 0;
    const bad = (path: string, message: string) => {
      pinErrors++;
      fail(path, message);
    };
    const badRef = (path: string, message: string) => {
      pinErrors++;
      error('E_REF_UNRESOLVED', p)(path, message);
    };
    const duplicate = (path: string, message: string) => {
      pinErrors++;
      error('E_DUPLICATE_ID', p)(path, message);
    };
    // Decision 17: ids repeated inside one board.
    const firstOf = (
      items: readonly string[],
      field: string,
      what: string,
      key: (s: string) => string = (s) => s,
    ) => {
      const seen = new Map<string, number>();
      items.forEach((raw, i) => {
        const id = key(raw);
        const first = seen.get(id);
        if (first === undefined) seen.set(id, i);
        else
          duplicate(
            `${field}.${String(i)}.${what === 'rail' ? 'name' : 'id'}`,
            `${what} "${raw}" is already defined at ${field}.${String(first)}`,
          );
      });
    };
    firstOf(
      board.variants.map((v) => v.id),
      'variants',
      'variant',
    );
    firstOf(
      board.connectors.map((c) => c.id),
      'connectors',
      'connector',
    );
    firstOf(
      board.rails.map((r) => r.name),
      'rails',
      'rail',
    );
    // Decision 18: pad references of the board must exist on the chip of every variant.
    const padRef = (path: string, pad: string) => {
      const missing = resolved.filter((r) => !Object.hasOwn(r.chip.pads, pad));
      if (missing.length > 0) {
        const list = missing.map((r) => `${r.chip.id} (variant ${r.variant})`).join(', ');
        badRef(path, `pad "${pad}" is not a pad of chip ${list}`);
      }
    };
    board.onboard.forEach((o, i) => {
      o.uses_pad.forEach((pad, j) => {
        padRef(`onboard.${String(i)}.uses_pad.${String(j)}`, pad);
      });
    });
    (board.os_overlays ?? []).forEach((o, i) => {
      for (const [role, pad] of Object.entries(o.pads)) {
        padRef(`os_overlays.${String(i)}.pads.${role}`, pad);
      }
    });
    const railNames = new Set(board.rails.map((r) => r.name));
    const padUsers = new Map<string, string>();
    // Decision 24: `<connector-id>:<position>` -> pin (first occurrence), and how many pins use each pad.
    const primaries = new Map<string, ConnectorPin>();
    const padCounts = new Map<string, number>();
    for (const conn of board.connectors) {
      for (const pin of conn.pins) {
        const key = `${conn.id}:${String(pin.position)}`;
        if (!primaries.has(key)) primaries.set(key, pin);
        if (pin.pad !== undefined) padCounts.set(pin.pad, (padCounts.get(pin.pad) ?? 0) + 1);
      }
    }
    board.connectors.forEach((conn, ci) => {
      const positions = new Map<number, number>();
      const gpioLabels = new Map<string, number>();
      conn.pins.forEach((pin, pi) => {
        const at = `connectors.${String(ci)}.pins.${String(pi)}`;
        const where = `${pin.kind} pin ${conn.id}-${String(pin.position)}`;
        const firstPosition = positions.get(pin.position);
        if (firstPosition === undefined) positions.set(pin.position, pi);
        else
          bad(
            `${at}.position`,
            `${where}: position ${String(pin.position)} is already used by pin ${String(firstPosition)} of connector ${conn.id}`,
          );
        const label = pin.label.trim();
        if (label === '' && LABELLED_KINDS.has(pin.kind)) {
          bad(`${at}.label`, `${where} has an empty silkscreen label`);
        }
        if (pin.kind === 'power' && pin.rail !== undefined && !railNames.has(pin.rail)) {
          badRef(`${at}.rail`, `${where}: rail "${pin.rail}" is not a rail of this board`);
        }
        if (pin.alias_of !== undefined) {
          // Decision 24: a declared alias of the primary pin that shares this pad.
          const alias = `${at}.alias_of`;
          const target = pin.alias_of;
          const primary = primaries.get(target);
          if (pin.pad === undefined) {
            bad(alias, `${where}: alias_of needs a pad; a pin without a pad aliases nothing`);
          } else if ((padCounts.get(pin.pad) ?? 0) < 2) {
            bad(
              alias,
              `${where}: alias_of "${target}" but pad "${pin.pad}" is on no other pin; an alias must share a pad`,
            );
          } else if (primary === undefined) {
            badRef(alias, `${where}: alias_of "${target}" is not a pin of this board`);
          } else if (primary === pin) {
            bad(alias, `${where}: alias_of "${target}" is the pin itself`);
          } else if (primary.pad !== pin.pad) {
            bad(
              alias,
              `${where}: alias_of "${target}" is on pad "${primary.pad ?? '(none)'}", not "${pin.pad}"`,
            );
          } else if (primary.alias_of !== undefined) {
            bad(
              alias,
              `${where}: alias_of "${target}" is itself an alias of "${primary.alias_of}"; point at the primary pin`,
            );
          }
        } else if (pin.pad !== undefined) {
          const first = padUsers.get(pin.pad);
          if (first === undefined) padUsers.set(pin.pad, `${conn.id}-${String(pin.position)}`);
          else
            bad(
              `${at}.pad`,
              `${where}: pad "${pin.pad}" is already on pin ${first}; one pad has one connector position unless the repeat declares alias_of`,
            );
        }
        if (pin.kind !== 'gpio') return;
        // GND/3V3 labels legitimately repeat; gpio silkscreen labels identify a pin, so they must not.
        const firstLabel = gpioLabels.get(label);
        if (label !== '' && firstLabel !== undefined) {
          bad(
            `${at}.label`,
            `${where}: label "${label}" is already used by pin ${String(firstLabel)} of connector ${conn.id}`,
          );
        } else if (label !== '') {
          gpioLabels.set(label, pi);
        }
        if (pin.pad === undefined) {
          bad(`${at}.pad`, `${where} has no pad, so no chip GPIO number`);
          return;
        }
        const pad = pin.pad;
        const missingIn = resolved.filter((r) => !Object.hasOwn(r.chip.pads, pad));
        if (missingIn.length > 0) {
          const list = missingIn.map((r) => `${r.chip.id} (variant ${r.variant})`).join(', ');
          bad(`${at}.pad`, `${where}: pad "${pad}" is not a pad of chip ${list}`);
        }
        const notBonded = resolved.filter(
          (r) =>
            Object.hasOwn(r.chip.pads, pad) &&
            !r.module.bonded_pads.includes(pad) &&
            // Per-variant unbonded pad: a module that consumes the pad internally (e.g. WROVER-E PSRAM on
            // GPIO16/17) may leave it out of bonded_pads; the engine reads `consumed` and skips the pad.
            !Object.hasOwn(r.module.consumed, pad),
        );
        if (notBonded.length > 0) {
          const list = notBonded.map((r) => `${r.module.id} (variant ${r.variant})`).join(', ');
          bad(`${at}.pad`, `${where}: pad "${pad}" is not bonded out by module ${list}`);
        }
      });
    });

    let computed: BoardStatus | null = null;
    if (board.status !== 'unsupported' && pinErrors === 0 && !blocked) {
      const mods = [...new Map(resolved.map((r) => [r.module.id, r.module])).values()];
      const chips = [...new Map(resolved.map((r) => [r.chip.id, r.chip])).values()];
      computed = computeBoardStatus(board, mods, chips);
      if (computed !== board.status) {
        error('E_BOARD_STATUS', p)(
          'status',
          `board status is "${board.status}" but its facts (board + variant modules + chips) give "${computed}"`,
        );
      }
    }
    boardStatuses.push({ ref: boardRef(board), declared: board.status, computed });
  }

  // 7. Other references (E_REF_UNRESOLVED): module -> chip, breakout -> ic, fixture -> board/variant/breakout.
  const unresolved = (p: Parsed, path: string, what: string, id: string) => {
    error('E_REF_UNRESOLVED', p)(path, `${what} "${id}" is not in the catalog`);
  };
  for (const p of ok('modules')) {
    const m = p.entity as Module;
    if (!chipsById.has(m.chip) && !targetMayBeBroken(brokenChips, m.chip))
      unresolved(p, 'chip', 'chip', m.chip);
  }
  // Decision 18: pad references inside modules and chips resolve to a pad of the chip.
  for (const p of ok('modules')) {
    const m = p.entity as Module;
    const chip = chipsById.get(m.chip);
    if (!chip) continue; // unresolved or broken chip: reported / skipped above
    const missing = (pad: string) => !Object.hasOwn(chip.pads, pad);
    m.bonded_pads.forEach((pad, i) => {
      if (missing(pad))
        error('E_REF_UNRESOLVED', p)(
          `bonded_pads.${String(i)}`,
          `pad "${pad}" is not a pad of chip ${chip.id}`,
        );
    });
    for (const pad of Object.keys(m.consumed)) {
      if (missing(pad))
        error('E_REF_UNRESOLVED', p)(
          `consumed.${pad}`,
          `pad "${pad}" is not a pad of chip ${chip.id}`,
        );
    }
  }
  for (const p of ok('chips')) {
    const chip = p.entity as Chip;
    for (const [name, per] of Object.entries(chip.peripherals)) {
      for (const [role, pad] of Object.entries(per.iomux_pins ?? {})) {
        if (!Object.hasOwn(chip.pads, pad))
          error('E_REF_UNRESOLVED', p)(
            `peripherals.${name}.iomux_pins.${role}`,
            `pad "${pad}" is not a pad of chip ${chip.id}`,
          );
      }
    }
  }
  const icsById = uniqueByKey<IC>('ics');
  const brokenIcs = brokenIds('ics');
  for (const p of ok('breakouts')) {
    const b = p.entity as Breakout;
    if (!icsById.has(b.ic) && !targetMayBeBroken(brokenIcs, b.ic)) unresolved(p, 'ic', 'IC', b.ic);
  }
  const boardsByRef = uniqueByKey<Board>('boards');
  const breakoutsById = uniqueByKey<Breakout>('breakouts');
  const brokenBoards = brokenIds('boards');
  const brokenBreakouts = brokenIds('breakouts');
  const anyBoardBroken = brokenBoards.size > 0; // refs are `id@rev`; a broken board's ref is unknown
  for (const p of ok('fixtures')) {
    const f = p.entity as Fixture;
    const checkBoard = (boardPath: string, variantPath: string, ref: string, variant: string) => {
      const board = boardsByRef.get(ref);
      if (!board) {
        if (!anyBoardBroken) unresolved(p, boardPath, 'board', ref);
      } else if (!board.variants.some((v) => v.id === variant)) {
        unresolved(p, variantPath, `variant of ${ref}`, variant);
      }
    };
    checkBoard('board', 'variant', f.board, f.variant);
    if (f.project.board !== f.board || f.project.variant !== f.variant)
      checkBoard('project.board', 'project.variant', f.project.board, f.project.variant);
    f.project.modules.forEach((m, i) => {
      if (!breakoutsById.has(m.breakout) && !targetMayBeBroken(brokenBreakouts, m.breakout)) {
        unresolved(p, `project.modules.${String(i)}.breakout`, 'breakout', m.breakout);
      }
    });
  }

  // 8. Coverage (facts counted on every parsed file; a fact = mapping with status + evidence).
  const entities = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
  const factsByKind = Object.fromEntries(KINDS.map((k) => [k, zeroCounts()])) as Record<
    Kind,
    StatusCounts
  >;
  const facts = zeroCounts();
  for (const p of parsed) {
    if (p.entity !== undefined) entities[p.source.kind]++;
    if (p.raw === undefined || p.source.kind === 'evidence') continue;
    for (const { fact } of collectFacts(p.raw)) {
      const s = fact.status;
      if (typeof s === 'string' && (STATUSES as readonly string[]).includes(s)) {
        facts[s as Status]++;
        factsByKind[p.source.kind][s as Status]++;
      }
    }
  }

  // Entities sorted by id (boards by `<id>@<revision>`) so compile order never depends on file order.
  const sortedEntities = <T>(kind: Kind): T[] =>
    [...ok(kind)]
      .sort((a, b) => byCodeUnit(keyOf(kind, a), keyOf(kind, b)))
      .map((p) => p.entity as T);
  const catalog: CatalogEntities = {
    evidence: sortedEntities<Evidence>('evidence'),
    chips: sortedEntities<Chip>('chips'),
    modules: sortedEntities<Module>('modules'),
    boards: sortedEntities<Board>('boards'),
    ics: sortedEntities<IC>('ics'),
    breakouts: sortedEntities<Breakout>('breakouts'),
    fixtures: sortedEntities<Fixture>('fixtures'),
  };

  diagnostics.sort(compareDiagnostics);
  boardStatuses.sort((a, b) => byCodeUnit(a.ref, b.ref));
  return {
    diagnostics,
    errorCount: diagnostics.filter((d) => d.severity === 'error').length,
    warningCount: diagnostics.filter((d) => d.severity === 'warning').length,
    fileCount: parsed.length,
    catalog,
    coverage: { entities, facts, factsByKind, boards: boardStatuses },
  };
}

/** Load + validate a catalog root: the loader's diagnostics (ignored / wrongly named files) are merged in. */
export function validateRoot(root: string): ValidationResult {
  const { sources, diagnostics } = loadCatalogSources(root);
  const result = validateCatalog(sources);
  if (diagnostics.length === 0) return result;
  const all = [...diagnostics, ...result.diagnostics].sort(compareDiagnostics);
  return {
    ...result,
    diagnostics: all,
    errorCount: all.filter((d) => d.severity === 'error').length,
    warningCount: all.filter((d) => d.severity === 'warning').length,
  };
}
