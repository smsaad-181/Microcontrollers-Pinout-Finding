// Pure compile: a clean ValidationResult in, deterministic catalog + manifest text out.
//
// Version scheme (content-addressed): `version` = first 12 hex chars of SHA-256 over the canonical
// JSON of { format, entities }. Same catalog content ⇒ same version and byte-identical
// `<version>.json`, whatever the machine, clock or git state; any content change ⇒ a new file name,
// so old files can stay deployed for share links. The `date` (a human "as of" label) lives ONLY in
// the manifest, so it can never make two catalog files with the same name differ.
import { createHash } from 'node:crypto';
import { stableStringify } from './stable-json.js';
import { BOARD_STATUSES, type ValidationResult } from './types.js';

/** Bump when the compiled JSON layout changes (it is part of the hashed content). */
export const CATALOG_FORMAT = 1;
export const MANIFEST_FILE = 'catalog-manifest.json';

export interface CompileOptions {
  /** YYYY-MM-DD; see `resolveCatalogDate` in cli.ts for how the CLI derives it. */
  date: string;
  /** Free-form note on where the date came from (recorded in the manifest). */
  dateSource?: string;
}

export interface CompiledCatalog {
  version: string;
  fileName: string;
  catalogText: string;
  manifestText: string;
  sha256: string;
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * Compiles a clean validation result into the deterministic catalog JSON + manifest text. The
 * `version` is content-addressed (see the file header). Throws if the result has any error.
 */
export function compileCatalog(result: ValidationResult, options: CompileOptions): CompiledCatalog {
  if (result.errorCount > 0) {
    throw new Error(
      `refusing to compile: catalog has ${String(result.errorCount)} validation error(s)`,
    );
  }
  // Fixtures are test inputs, not runtime data: they are validated but not compiled.
  const { evidence, chips, modules, boards, ics, breakouts } = result.catalog;
  const entities = { boards, breakouts, chips, evidence, ics, modules };
  const version = sha256(stableStringify({ entities, format: CATALOG_FORMAT })).slice(0, 12);
  const catalogText = `${stableStringify({ ...entities, format: CATALOG_FORMAT, version })}\n`;
  const digest = sha256(catalogText);
  const fileName = `${version}.json`;

  const boardStatus = Object.fromEntries(BOARD_STATUSES.map((s) => [s, 0]));
  for (const b of boards) boardStatus[b.status] = (boardStatus[b.status] ?? 0) + 1;

  const manifest = {
    board_status: boardStatus,
    bytes: Buffer.byteLength(catalogText, 'utf8'),
    counts: Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, v.length])),
    date: options.date,
    ...(options.dateSource === undefined ? {} : { date_source: options.dateSource }),
    facts: result.coverage.facts,
    file: fileName,
    format: CATALOG_FORMAT,
    sha256: digest,
    version,
  };
  return {
    version,
    fileName,
    catalogText,
    manifestText: `${stableStringify(manifest, 2)}\n`,
    sha256: digest,
  };
}
