// Test-only: the compiled catalog exactly as `catalog:compile` ships it to the browser.
import { resolve } from 'node:path';
import { compileCatalog, validateRoot } from '@pinout/cli';
import type { WebCatalog } from '../src/catalog/loadCatalog';

let cached: { catalog: WebCatalog; text: string; sha256: string; version: string } | undefined;

export function compiledCatalog(): {
  catalog: WebCatalog;
  text: string;
  sha256: string;
  version: string;
} {
  if (cached) return cached;
  const root = resolve(import.meta.dirname, '../../../catalog');
  const result = validateRoot(root);
  if (result.errorCount > 0) throw new Error('catalog does not validate');
  const compiled = compileCatalog(result, { date: '2026-01-01' });
  cached = {
    catalog: JSON.parse(compiled.catalogText) as WebCatalog,
    text: compiled.catalogText,
    sha256: compiled.sha256,
    version: compiled.version,
  };
  return cached;
}
