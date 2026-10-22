// The only part of validate that touches the file system: read `<root>/<kind>/**/*.yaml`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { KINDS, type Diagnostic, type SourceFile } from './types.js';

export interface LoadedSources {
  sources: SourceFile[];
  diagnostics: Diagnostic[];
}

const toPosix = (p: string) => p.replaceAll('\\', '/');
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Reads every `*.yaml` under the seven kind directories (recursively), sorted by path. `.yml` files
 * and YAML files directly in the root are reported as ignored (warning), so a misplaced file is never
 * silently skipped. Missing kind directories are treated as empty.
 */
export function loadCatalogSources(root: string): LoadedSources {
  const sources: SourceFile[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      diagnostics.push({
        severity: 'warning',
        code: 'W_IGNORED_FILE',
        file: entry.name,
        path: '',
        message: `ignored: catalog files belong in one of ${KINDS.join('/, ')}/`,
      });
    }
  }

  for (const kind of KINDS) {
    const dir = join(root, kind);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    const names = readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .map(toPosix)
      .sort(byCodeUnit);
    for (const name of names) {
      const file = `${kind}/${name}`;
      if (name.endsWith('.yml')) {
        diagnostics.push({
          severity: 'warning',
          code: 'W_IGNORED_FILE',
          file,
          path: '',
          message: 'ignored: catalog files must use the .yaml extension',
        });
        continue;
      }
      if (!name.endsWith('.yaml')) continue;
      const full = join(dir, name);
      if (!statSync(full).isFile()) continue;
      sources.push({ file, kind, text: readFileSync(full, 'utf8') });
    }
  }
  sources.sort((a, b) => byCodeUnit(a.file, b.file));
  return { sources, diagnostics };
}
