// Pure catalog validation: SourceFile[] in, diagnostics + typed entities + coverage out.
// Error codes and interpretation follow packages/cli/test/fixtures/README.md (decisions 1-11).
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
  type Evidence,
  type Fixture,
  type IC,
  type Module,
  type Status,
} from '@pinout/schema';
import { parseDocument } from 'yaml';
import type { z } from 'zod';
import { loadCatalogSources } from './load.js';
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

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
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

function parseYaml(
  source: SourceFile,
  out: Diagnostic[],
): { ok: true; value: unknown } | { ok: false } {
  const doc = parseDocument(source.text, {
    version: '1.2',
    schema: 'core',
    uniqueKeys: true,
    prettyErrors: true,
  });
  const first = doc.errors[0];
  if (first) {
    out.push({
      severity: 'error',
      code: 'E_YAML',
      file: source.file,
      path: '',
      message: first.message.split('\n')[0] ?? first.message,
    });
    return { ok: false };
  }
  return { ok: true, value: doc.toJS({ maxAliasCount: 100 }) as unknown };
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

/** Board status rule (README decision 7), over the board plus its variants' modules and chips. */
function computeBoardStatus(board: Board, modules: Module[], chips: Chip[]): BoardStatus {
  const hasGpio = board.connectors.some((c) => c.pins.some((pin) => pin.kind === 'gpio'));
  if (!hasGpio) return 'datasheet-required';
  const facts = [board, ...modules, ...chips].flatMap((e) => collectFacts(e));
  return facts.every((f) => f.fact.status === 'verified') ? 'fully-verified' : 'partially-verified';
}

export function validateCatalog(sources: readonly SourceFile[]): ValidationResult {
  const diagnostics: Diagnostic[] = [];
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
  /** Ids of entities of `kind` that exist but are broken; `null` = a broken file whose id is unknown. */
  const brokenIds = (kind: Kind) =>
    new Set(
      parsed
        .filter((p) => p.source.kind === kind && p.entity === undefined)
        .map((p) => rawId(p.raw) ?? null),
    );

  // 3. Cross-field fact rules on every non-evidence entity that passed the shape check.
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

  // 4. Evidence resolution (decision 4): doc = text before the first '#', claim = the full id.
  const claimsByDoc = new Map<string, Set<string>>();
  for (const p of ok('evidence')) {
    const ev = p.entity as z.infer<typeof EvidenceSchema>;
    const set = claimsByDoc.get(ev.id) ?? new Set<string>();
    for (const c of ev.claims) set.add(c.id);
    claimsByDoc.set(ev.id, set);
  }
  const brokenDocs = brokenIds('evidence');
  for (const p of parsed) {
    if (p.entity === undefined || p.source.kind === 'evidence' || brokenDocs.has(null)) continue;
    for (const ref of collectClaimRefs(p.entity)) {
      const doc = ref.claim.slice(0, ref.claim.indexOf('#'));
      if (brokenDocs.has(doc)) continue; // that evidence file has its own error (decision 8)
      const claims = claimsByDoc.get(doc);
      if (!claims?.has(ref.claim)) {
        diagnostics.push({
          severity: 'error',
          code: 'E_EVIDENCE_UNKNOWN',
          file: p.source.file,
          path: ref.path,
          message: claims
            ? `unknown claim "${ref.claim}" in evidence document "${doc}"`
            : `unknown evidence document "${doc}" (cited as "${ref.claim}")`,
        });
      }
    }
  }

  // 5. Boards: pin numbering (decision 6) and status (decision 7), with dependency skipping (decision 8).
  const modulesById = new Map(
    ok('modules').map((p) => [(p.entity as Module).id, p.entity as Module]),
  );
  const chipsById = new Map(ok('chips').map((p) => [(p.entity as Chip).id, p.entity as Chip]));
  const brokenModules = brokenIds('modules');
  const brokenChips = brokenIds('chips');
  const boardStatuses: Coverage['boards'] = [];
  const warnDangling = (file: string, path: string, what: string, id: string) => {
    diagnostics.push({
      severity: 'warning',
      code: 'W_DANGLING_REF',
      file,
      path,
      message: `${what} "${id}" is not in the catalog`,
    });
  };

  for (const p of ok('boards')) {
    const board = p.entity as Board;
    const file = p.source.file;
    // Resolve each variant to (module, chip); `blocked` = a dependency is itself broken.
    let blocked = brokenModules.has(null) || brokenChips.has(null);
    const resolved: { variant: string; module: Module; chip: Chip }[] = [];
    board.variants.forEach((v, i) => {
      const mod = modulesById.get(v.module);
      if (!mod) {
        if (brokenModules.has(v.module)) blocked = true;
        else warnDangling(file, `variants.${String(i)}.module`, 'module', v.module);
        return;
      }
      const chip = chipsById.get(mod.chip);
      if (!chip) {
        if (brokenChips.has(mod.chip)) blocked = true;
        return; // a dangling module.chip is reported on the module file
      }
      resolved.push({ variant: v.id, module: mod, chip });
    });

    let pinErrors = 0;
    board.connectors.forEach((conn, ci) => {
      conn.pins.forEach((pin, pi) => {
        if (pin.kind !== 'gpio') return;
        const at = `connectors.${String(ci)}.pins.${String(pi)}`;
        const where = `gpio pin ${conn.id}-${String(pin.position)}`;
        if (pin.label.trim() === '') {
          pinErrors++;
          diagnostics.push({
            severity: 'error',
            code: 'E_PIN_NUMBERING',
            file,
            path: `${at}.label`,
            message: `${where} has an empty silkscreen label`,
          });
        }
        if (pin.pad === undefined) {
          pinErrors++;
          diagnostics.push({
            severity: 'error',
            code: 'E_PIN_NUMBERING',
            file,
            path: `${at}.pad`,
            message: `${where} has no pad, so no chip GPIO number`,
          });
          return;
        }
        const pad = pin.pad;
        const missingIn = resolved.filter((r) => !Object.hasOwn(r.chip.pads, pad));
        if (missingIn.length > 0) {
          pinErrors++;
          const list = missingIn.map((r) => `${r.chip.id} (variant ${r.variant})`).join(', ');
          diagnostics.push({
            severity: 'error',
            code: 'E_PIN_NUMBERING',
            file,
            path: `${at}.pad`,
            message: `${where}: pad "${pad}" is not a pad of chip ${list}`,
          });
        }
      });
    });

    let computed: BoardStatus | null = null;
    if (board.status !== 'unsupported' && pinErrors === 0 && !blocked) {
      const mods = [...new Map(resolved.map((r) => [r.module.id, r.module])).values()];
      const chips = [...new Map(resolved.map((r) => [r.chip.id, r.chip])).values()];
      computed = computeBoardStatus(board, mods, chips);
      if (computed !== board.status) {
        diagnostics.push({
          severity: 'error',
          code: 'E_BOARD_STATUS',
          file,
          path: 'status',
          message: `board status is "${board.status}" but its facts (board + variant modules + chips) give "${computed}"`,
        });
      }
    }
    boardStatuses.push({ ref: boardRef(board), declared: board.status, computed });
  }

  // 6. Dangling references: warnings only (no Phase 1 error code, README decision 11).
  for (const p of ok('modules')) {
    const m = p.entity as Module;
    if (!chipsById.has(m.chip) && !brokenChips.has(m.chip))
      warnDangling(p.source.file, 'chip', 'chip', m.chip);
  }
  const icIds = new Set(ok('ics').map((p) => (p.entity as { id: string }).id));
  const brokenIcs = brokenIds('ics');
  for (const p of ok('breakouts')) {
    const b = p.entity as z.infer<typeof BreakoutSchema>;
    if (!icIds.has(b.ic) && !brokenIcs.has(b.ic)) warnDangling(p.source.file, 'ic', 'IC', b.ic);
  }
  const boardsByRef = new Map(
    ok('boards').map((p) => [boardRef(p.entity as Board), p.entity as Board]),
  );
  const breakoutIds = new Set(ok('breakouts').map((p) => (p.entity as { id: string }).id));
  const boardsBroken = brokenIds('boards').size > 0;
  const breakoutsBroken = brokenIds('breakouts').size > 0;
  for (const p of ok('fixtures')) {
    const f = p.entity as z.infer<typeof FixtureSchema>;
    const board = boardsByRef.get(f.board);
    if (!board) {
      if (!boardsBroken) warnDangling(p.source.file, 'board', 'board', f.board);
    } else if (!board.variants.some((v) => v.id === f.variant)) {
      warnDangling(p.source.file, 'variant', `variant of ${f.board}`, f.variant);
    }
    f.project.modules.forEach((m, i) => {
      if (!breakoutIds.has(m.breakout) && !breakoutsBroken) {
        warnDangling(
          p.source.file,
          `project.modules.${String(i)}.breakout`,
          'breakout',
          m.breakout,
        );
      }
    });
  }

  // 7. Coverage (facts counted on every parsed file; a fact = mapping with status + evidence).
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

  // Entities sorted by id for a stable compile order.
  const sortedEntities = <T>(kind: Kind, key: (e: T) => string): T[] =>
    ok(kind)
      .map((p) => p.entity as T)
      .sort((a, b) => byCodeUnit(key(a), key(b)));
  const id = (e: { id: string }) => e.id;
  const catalog: CatalogEntities = {
    evidence: sortedEntities<Evidence>('evidence', id),
    chips: sortedEntities<Chip>('chips', id),
    modules: sortedEntities<Module>('modules', id),
    boards: sortedEntities<Board>('boards', boardRef),
    ics: sortedEntities<IC>('ics', id),
    breakouts: sortedEntities<Breakout>('breakouts', id),
    fixtures: sortedEntities<Fixture>('fixtures', id),
  };

  diagnostics.sort(
    (a, b) =>
      byCodeUnit(a.file, b.file) || byCodeUnit(a.path, b.path) || byCodeUnit(a.code, b.code),
  );
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

/** Load + validate a catalog root (the loader's own warnings are merged in). */
export function validateRoot(root: string): ValidationResult {
  const { sources, diagnostics } = loadCatalogSources(root);
  const result = validateCatalog(sources);
  if (diagnostics.length === 0) return result;
  const all = [...diagnostics, ...result.diagnostics].sort(
    (a, b) =>
      byCodeUnit(a.file, b.file) || byCodeUnit(a.path, b.path) || byCodeUnit(a.code, b.code),
  );
  return { ...result, diagnostics: all, warningCount: result.warningCount + diagnostics.length };
}
