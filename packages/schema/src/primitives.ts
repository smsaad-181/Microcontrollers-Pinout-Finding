// Primitives and the generic Fact<T> factory. Mirrors the "primitives" block of the normative
// reference in skill `catalog-schema`. Pure: no fs, no network.
import { z } from 'zod';

export const StatusSchema = z
  .enum(['verified', 'single-source', 'conflict', 'interim', 'community', 'missing'])
  .describe(
    'Fact status. verified = two independent reviewers; single-source = one cited source, one reviewer; ' +
      'conflict = sources disagree (most restrictive reading is active); interim = value from a cited related ' +
      'or secondary source, always shown as Caution; community = clone boards without official docs; ' +
      'missing = no usable source (value null).',
  );
export type Status = z.infer<typeof StatusSchema>;

export const UnitSchema = z
  .enum(['V', 'mV', 'A', 'mA', 'ohm', 'kohm', 's', 'ns', 'us', 'Hz', 'kHz', 'MHz', 'pF', 'W'])
  .describe('Unit of a fact value as written in the source.');
export type Unit = z.infer<typeof UnitSchema>;

/** `<doc-id>#<slug>`: the doc part has no `#` and no whitespace; the slug has no whitespace. */
export const CLAIM_ID_PATTERN = /^[^#\s]+#\S+$/;
export const ClaimIdSchema = z
  .string()
  .regex(CLAIM_ID_PATTERN, 'claim id must look like <doc-id>#<slug>')
  .describe(
    'Evidence claim id `<doc-id>#<slug>`; must resolve to a claims[].id of an evidence record.',
  );
export type ClaimId = z.infer<typeof ClaimIdSchema>;

export const PadIdSchema = z.string().min(1).describe("Chip pad name, e.g. 'GPIO21'.");
export type PadId = z.infer<typeof PadIdSchema>;

/** Kebab-case-ish entity id (dots allowed for document revisions such as `esp32-ds-v5.3`). */
export const ENTITY_ID_PATTERN = /^[a-z0-9]+(?:[-._][a-z0-9]+)*$/;
export const EntityIdSchema = z
  .string()
  .regex(ENTITY_ID_PATTERN, 'id must be lower-case kebab-case')
  .describe('Entity id, lower-case kebab-case (dots allowed).');

export const ExprSchema = z
  .union(
    [
      z.number(),
      z.templateLiteral(['VDD*', z.number()]),
      z.templateLiteral(['VDDIO+', z.number()]),
      z.templateLiteral(['VDDIO*', z.number()]),
    ],
    {
      error:
        'expected a number, or an expression of the form VDD*<k>, VDDIO+<v> or VDDIO*<k> ' +
        '(e.g. "VDDIO*0.75", "VDDIO+0.3"; <k> and <v> are plain numbers)',
    },
  )
  .describe(
    'A voltage threshold: an absolute number (in the fact unit) or an expression relative to a supply: ' +
      '`VDD*<k>`, `VDDIO+<v>` or `VDDIO*<k>`.',
  );
export type Expr = z.infer<typeof ExprSchema>;

/** A string with at least one non-whitespace character. */
export const NON_BLANK = /\S/;

/** Reviewer key charset after trim + lower-case: rejects zero-width characters and Unicode look-alikes. */
export const REVIEWER_KEY = /^[a-z0-9][a-z0-9._-]*$/;

/** Reviewer key: non-blank. Identity is `normalizeReviewer` (trim + lower-case). */
export const ReviewerSchema = z
  .string()
  .regex(NON_BLANK, 'reviewer key must not be blank')
  .refine(
    (r) => !NON_BLANK.test(r) || REVIEWER_KEY.test(normalizeReviewer(r)),
    'reviewer key must be plain ASCII letters, digits, ".", "_" or "-" (no spaces, zero-width or look-alike characters)',
  );

/** Canonical form of a reviewer key, used wherever reviewers are compared. */
export function normalizeReviewer(reviewer: string): string {
  return reviewer.trim().toLowerCase();
}

/**
 * Generic Fact<T> factory: wraps a value schema in the evidence envelope. Shape only; the cross-field
 * rules (evidence non-empty, value/status agreement, conflict readings, two reviewers) live in
 * `checkFactRules` so they keep their own error codes.
 */
export function fact<T extends z.ZodType>(value: T) {
  return z
    .strictObject({
      value: value.nullable().describe('The value; null only when status is missing.'),
      unit: UnitSchema.exactOptional(),
      conditions: z
        .record(z.string(), z.union([z.string(), z.number()]))
        .exactOptional()
        .describe(
          'Conditions under which the value holds (VDD, temperature, attenuation, revision…).',
        ),
      evidence: z
        .array(ClaimIdSchema)
        .describe('Claim ids supporting the value; at least one unless status is missing.'),
      status: StatusSchema,
      reviewers: z
        .array(ReviewerSchema)
        .exactOptional()
        .describe(
          'Reviewer keys (non-blank); at least two distinct after trim + lower-casing when status is verified.',
        ),
      readings: z
        .array(z.strictObject({ value, evidence: z.array(ClaimIdSchema) }))
        .exactOptional()
        .describe('Each source reading; required when status is conflict.'),
      active: value
        .exactOptional()
        .describe(
          'Most restrictive reading, used by the engine; required when status is conflict.',
        ),
      transcribed: z
        .boolean()
        .exactOptional()
        .describe('True when the value was transcribed from an image-only source.'),
      note: z.string().exactOptional().describe('Free-text reviewer note.'),
    })
    .describe('A fact: one value with unit, conditions, evidence ids, status and reviewers.');
}

/** Fact<T> as a type, derived from the factory (not hand-written). */
export type Fact<T> = z.infer<ReturnType<typeof fact<z.ZodType<T>>>>;
