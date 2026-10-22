import { z } from 'zod';
import { ClaimIdSchema, EntityIdSchema } from './primitives.js';

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
    locator: z.string().describe('Section, table, figure or page where the claim is found.'),
    quote: z.string().describe('Verbatim quote from the source (25 words or fewer).'),
    supports: z.string().describe('Which catalog fact(s) the quote supports.'),
  })
  .describe('One quoted claim inside an evidence record.');

export const EvidenceSchema = z
  .strictObject({
    id: EntityIdSchema.describe(
      'Document id, e.g. `esp32-ds-v5.3`; the `<doc-id>` part of claim ids.',
    ),
    title: z.string().describe('Document title as printed.'),
    publisher: z.string().describe('Publisher (vendor or standards body).'),
    doc_number: z.string().nullable().describe('Publisher document number, or null.'),
    revision: z
      .string()
      .nullable()
      .describe('Document revision as printed (quoted in YAML), or null.'),
    revision_date: z
      .string()
      .nullable()
      .describe('Revision date only if printed in the document, or null.'),
    url: z.url().describe('Final URL the document was read from.'),
    url_original: z.url().nullable().describe('Original URL before redirects, or null.'),
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
  .describe(
    'An evidence record: one source document and the claims quoted from it (catalog/evidence/).',
  );
export type Evidence = z.infer<typeof EvidenceSchema>;
