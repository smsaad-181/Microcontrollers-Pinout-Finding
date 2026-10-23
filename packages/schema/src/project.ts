import { z } from 'zod';
import { RoutingSchema } from './chip.js';
import { InterfaceKindSchema } from './ic.js';
import {
  LOCKED_ROLE_PATTERN,
  isConflictToken,
  isPropertyKey,
  isRelaxationToken,
  isWarningCode,
} from './fixture-vocabulary.js';
import { ClaimIdSchema, EntityIdSchema, PadIdSchema } from './primitives.js';

export const ProjectSchema = z
  .strictObject({
    board: z.string().describe('Board reference `<board.id>@<board.revision>`.'),
    variant: z.string().describe('Board variant id.'),
    wifi: z.boolean().exactOptional().describe('Project uses Wi-Fi (affects ADC2 on ESP32).'),
    modules: z
      .array(
        z.strictObject({
          breakout: z.string().describe('Breakout id.'),
          instance: z.string().describe('Instance name, unique in the project.'),
          interface: InterfaceKindSchema.exactOptional(),
          address_strap: z.string().exactOptional().describe('Chosen address strap.'),
        }),
      )
      .describe('Modules to connect.'),
    locked: z
      .array(z.strictObject({ instance: z.string(), role: z.string(), pad: PadIdSchema }))
      .describe('User-fixed assignments; never moved silently.'),
    reserved: z.array(PadIdSchema).describe('Pads the user keeps free.'),
    rails: z.record(z.string(), z.number()).exactOptional().describe('Rail voltage overrides.'),
    framework: z
      .enum(['arduino', 'micropython', 'esp-idf', 'pico-sdk', 'rpi-python'])
      .exactOptional()
      .describe('Code generation target.'),
    wiring_length_m: z.number().exactOptional().describe('Typical wire length in metres.'),
    allow_reassign: z.boolean().exactOptional().describe('Allow moving locked pins.'),
  })
  .describe('A user project: board, variant, modules, locked and reserved pins.');
export type Project = z.infer<typeof ProjectSchema>;

export const WarningSchema = z
  .strictObject({
    level: z.enum(['critical', 'warning', 'caution', 'info']).describe('Severity.'),
    code: z.string().describe('Stable warning code.'),
    message: z.string().describe('Human-readable message.'),
    pads: z.array(PadIdSchema).describe('Pads concerned.'),
    evidence: z.array(ClaimIdSchema).describe('Claim ids.'),
  })
  .describe('A warning attached to a recommendation.');
export type Warning = z.infer<typeof WarningSchema>;

const ResultStatusSchema = z
  .enum(['ok', 'unsat', 'needs_variant'])
  .describe('Solver result status.');

export const FixtureSchema = z
  .strictObject({
    id: EntityIdSchema,
    board: z.string().describe('Board reference `<board.id>@<board.revision>`.'),
    variant: z.string().describe('Board variant id.'),
    project: ProjectSchema,
    expect: z
      .strictObject({
        status: ResultStatusSchema,
        exact: z
          .record(z.string(), PadIdSchema)
          .exactOptional()
          .describe('`instance.role` to pad.'),
        properties: z.array(z.unknown()).exactOptional().describe('Property assertions.'),
        warnings_include: z
          .array(z.strictObject({ code: z.string(), level: WarningSchema.shape.level }))
          .exactOptional()
          .describe('Warnings that must be present.'),
        required_parts_include: z
          .array(z.unknown())
          .exactOptional()
          .describe('Parts that must be listed.'),
        minimal_conflict_includes: z
          .array(z.string())
          .exactOptional()
          .describe('For unsat results.'),
        relaxations_include: z.array(z.string()).exactOptional().describe('For unsat results.'),
      })
      .describe('Expected engine result, derived by hand from datasheets.'),
    evidence: z.array(ClaimIdSchema).describe('Claim ids the derivations rely on (a plain list).'),
    derivations: z.array(z.string()).describe('Hand derivations from the sources.'),
    changelog: z.array(z.string()).exactOptional().describe('Fixture change history.'),
  })
  .superRefine((f, ctx) => {
    const bad = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: 'custom', path, message });
    };
    f.project.locked.forEach((l, i) => {
      if (!LOCKED_ROLE_PATTERN.test(l.role))
        bad(
          ['project', 'locked', i, 'role'],
          `locked role "${l.role}" must look like WIPER or COIL[1]`,
        );
    });
    const e = f.expect;
    (e.warnings_include ?? []).forEach((w, i) => {
      if (!isWarningCode(w.code))
        bad(
          ['expect', 'warnings_include', i, 'code'],
          `unknown warning code "${w.code}" (see fixture-vocabulary.ts)`,
        );
    });
    (e.properties ?? []).forEach((p, i) => {
      const at = ['expect', 'properties', i];
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        bad(at, 'a property must be an object with exactly one key');
        return;
      }
      const keys = Object.keys(p);
      if (keys.length !== 1) bad(at, 'a property must have exactly one key');
      for (const k of keys) {
        if (!isPropertyKey(k))
          bad([...at, k], `unknown property key "${k}" (see fixture-vocabulary.ts)`);
      }
      const codes = (p as { no_warning_code?: unknown }).no_warning_code;
      if (Array.isArray(codes)) {
        codes.forEach((c, j) => {
          if (typeof c !== 'string' || !isWarningCode(c))
            bad(
              [...at, 'no_warning_code', j],
              `unknown warning code "${String(c)}" (see fixture-vocabulary.ts)`,
            );
        });
      }
    });
    (e.minimal_conflict_includes ?? []).forEach((t, i) => {
      if (!isConflictToken(t))
        bad(
          ['expect', 'minimal_conflict_includes', i],
          `conflict token "${t}" must start with a known prefix (see fixture-vocabulary.ts)`,
        );
    });
    (e.relaxations_include ?? []).forEach((t, i) => {
      if (!isRelaxationToken(t))
        bad(
          ['expect', 'relaxations_include', i],
          `relaxation token "${t}" must start with a known prefix (see fixture-vocabulary.ts)`,
        );
    });
  })
  .describe('A golden test fixture written by hand from datasheets (catalog/fixtures/).');
export type Fixture = z.infer<typeof FixtureSchema>;

export const RecommendationSchema = z
  .strictObject({
    catalog_version: z.string().describe('Catalog version used.'),
    catalog_sha256: z.string().describe('SHA-256 of the catalog JSON used.'),
    ruleset_version: z.string().describe('Rule-set version used.'),
    status: ResultStatusSchema,
    interfaces: z
      .record(
        z.string(),
        z.strictObject({
          kind: InterfaceKindSchema,
          decided_by_rule: z.number().describe('Interface-selection rule that decided.'),
          alternatives: z.array(InterfaceKindSchema),
        }),
      )
      .describe('Chosen interface per instance.'),
    assignments: z
      .array(
        z.strictObject({
          instance: z.string(),
          role: z.string(),
          pad: PadIdSchema,
          gpio: z.number(),
          label: z.string(),
          connector: z.string(),
          position: z.number(),
          peripheral_instance: z.string().exactOptional(),
          routing: RoutingSchema,
          trace: z.array(z.string()).describe('Rule trace.'),
          evidence: z.array(ClaimIdSchema),
          alternatives: z.array(
            z.strictObject({
              pad: PadIdSchema,
              lower_tier: z.literal([1, 2, 3, 4]),
              reason: z.string(),
            }),
          ),
        }),
      )
      .describe('Pin assignments with all three numbering systems.'),
    required_parts: z
      .array(
        z.strictObject({
          kind: z.enum([
            'resistor',
            'capacitor',
            'level-shifter',
            'buffer',
            'transistor',
            'diode',
            'regulator',
            'divider',
          ]),
          value: z.string().exactOptional(),
          role: z.string(),
          count: z.number(),
          pads: z.array(PadIdSchema).exactOptional(),
        }),
      )
      .describe('Extra parts required.'),
    warnings: z.array(WarningSchema).describe('Warnings.'),
    budgets: z
      .array(
        z.strictObject({
          rail: z.string(),
          demand_ma: z.number(),
          limit_ma: z.number().nullable(),
        }),
      )
      .describe('Rail current budgets.'),
    score: z
      .tuple([z.number(), z.number(), z.number(), z.number()])
      .describe('Lexicographic score, tiers 1-4.'),
    unsat: z
      .strictObject({ minimal_conflict: z.array(z.string()), relaxations: z.array(z.string()) })
      .exactOptional()
      .describe('Diagnosis when unsatisfiable.'),
    variant_candidates: z
      .array(z.string())
      .exactOptional()
      .describe('Candidates when needs_variant.'),
  })
  .describe('The engine output: interfaces, assignments, parts, warnings, budgets, score.');
export type Recommendation = z.infer<typeof RecommendationSchema>;
