// @pinout/cli — catalog validate | compile. Core functions are pure (load → validate → report/compile);
// `runCli` is the thin process-facing layer used by src/main.ts.
export const PACKAGE_NAME = '@pinout/cli';

export * from './types.js';
export { loadCatalogSources, type LoadedSources } from './load.js';
export { validateCatalog, validateRoot } from './validate.js';
export { formatCoverage, formatDiagnostic, formatSummary } from './report.js';
export { stableStringify } from './stable-json.js';
export {
  CATALOG_FORMAT,
  MANIFEST_FILE,
  compileCatalog,
  type CompileOptions,
  type CompiledCatalog,
} from './compile.js';
export { DEFAULT_OUT, DEFAULT_ROOT, resolveCatalogDate, runCli, type CliIo } from './cli.js';
