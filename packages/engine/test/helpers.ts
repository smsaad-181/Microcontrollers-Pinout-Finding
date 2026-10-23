// Test-only: loads the real catalog through the CLI validator. The engine itself never reads files.
import { fileURLToPath } from 'node:url';
import { validateRoot } from '../../cli/src/index.js';
import { indexCatalog, type Catalog, type CatalogIndex } from '../src/catalog.js';

let cached: { catalog: Catalog; index: CatalogIndex } | undefined;

export function realCatalog(): { catalog: Catalog; index: CatalogIndex } {
  if (cached) return cached;
  const root = fileURLToPath(new URL('../../../catalog', import.meta.url));
  const result = validateRoot(root);
  if (result.errorCount > 0) throw new Error('catalog does not validate');
  const { chips, modules, boards, ics, breakouts } = result.catalog;
  const catalog: Catalog = { chips, modules, boards, ics, breakouts };
  cached = { catalog, index: indexCatalog(catalog) };
  return cached;
}
