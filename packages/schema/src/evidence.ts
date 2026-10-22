import { z } from 'zod';
import { ClaimIdSchema, EntityIdSchema, NON_BLANK } from './primitives.js';

export const MAX_QUOTE_WORDS = 25;
export const MAX_QUOTE_CHARS = 400;
const nonBlank = z.string().regex(NON_BLANK, 'must not be blank');
/** Evidence links must be web links: `javascript:`, `data:`, `file:` and friends are rejected. */
const webUrl = z
  .string()
  // Plain string checks (not `z.url()`: Zod normalises a URL before later checks run, which would hide
  // leading/trailing whitespace). The `^https?://` pattern is also emitted into the JSON Schema.
  .regex(/^\S+$/, { error: 'URL must not contain whitespace', abort: true })
  .regex(/^https?:\/\//, {
    error: 'URL must start with http:// or https:// (lower-case scheme)',
    abort: true,
  })
  // No `@` in the authority (user:pass@host). A pattern, so editors get it from the JSON Schema too.
  .regex(/^https?:\/\/[^/?#@]*(?:[/?#]|$)/, 'URL must not contain credentials (user:pass@)')
  .refine((u) => URL.canParse(u), 'Invalid URL');

export const EvidenceKindSchema = z
  .enum([
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
  ])
  .describe('Kind of source document.');

export const ClaimSchema = z
  .strictObject({
    id: ClaimIdSchema.describe('Full claim id `<doc-id>#<slug>`; facts cite this exact string.'),
    locator: nonBlank.describe('Section, table, figure or page where the claim is found.'),
    quote: nonBlank
      .max(MAX_QUOTE_CHARS, `quote must be at most ${String(MAX_QUOTE_CHARS)} characters`)
      .refine(
        (q) => q.trim().split(/\s+/).length <= MAX_QUOTE_WORDS,
        `quote must be at most ${String(MAX_QUOTE_WORDS)} words`,
      )
      .describe(
        `Verbatim quote from the source (${String(MAX_QUOTE_WORDS)} words or fewer, at most ${String(MAX_QUOTE_CHARS)} characters).`,
      ),
    supports: nonBlank.describe('Which catalog fact(s) the quote supports.'),
  })
  .describe('One quoted claim inside an evidence record.');

export const EvidenceSchema = z
  .strictObject({
    id: EntityIdSchema.describe(
      'Document id, e.g. `esp32-ds-v5.3`; the `<doc-id>` part of claim ids.',
    ),
    title: nonBlank.describe('Document title as printed.'),
    publisher: nonBlank.describe('Publisher (vendor or standards body).'),
    doc_number: z.string().nullable().describe('Publisher document number, or null.'),
    revision: z
      .string()
      .nullable()
      .describe('Document revision as printed (quoted in YAML), or null.'),
    revision_date: z
      .string()
      .nullable()
      .describe('Revision date only if printed in the document, or null.'),
    url: webUrl.describe('Final URL the document was read from.'),
    url_original: webUrl.nullable().describe('Original URL before redirects, or null.'),
    accessed: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'accessed must be a YYYY-MM-DD string')
      .describe('Access date, YYYY-MM-DD, as a (quoted) string.'),
    sha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lower-case hex characters')
      .nullable()
      .describe('SHA-256 of the downloaded file; null for HTML pages.'),
    kind: EvidenceKindSchema,
    secondary: z.boolean().describe('True for a reputable secondary source (flagged to users).'),
    manual: z.boolean().describe('True when the human supplied the file in sources/manual/.'),
    claims: z.array(ClaimSchema).describe('Quoted claims that catalog facts cite.'),
  })
  .superRefine((ev, ctx) => {
    ev.claims.forEach((c, i) => {
      if (!c.id.startsWith(`${ev.id}#`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['claims', i, 'id'],
          message: `claim id must start with the evidence id "${ev.id}#"`,
        });
      }
    });
  })
  .describe(
    'An evidence record: one source document and the claims quoted from it (catalog/evidence/).',
  );
export type Evidence = z.infer<typeof EvidenceSchema>;
