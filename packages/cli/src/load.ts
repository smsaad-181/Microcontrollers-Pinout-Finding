// The only part of validate that touches the file system: read `<root>/<kind>/**/*.yaml`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { byCodeUnit } from './order.js';
import { KINDS, type Diagnostic, type SourceFile } from './types.js';

export interface LoadedSources {
  sources: SourceFile[];
  diagnostics: Diagnostic[];
}

/** Root-relative paths use forward slashes on every platform (`readdir` returns `\` on Windows). */
export const toPosix = (p: string): string => p.replaceAll('\\', '/');

/** A YAML-looking name (`.yaml` or `.yml`, any case) that is not exactly `.yaml`. */
export const hasWrongYamlExtension = (name: string): boolean =>
  /\.ya?ml$/i.test(name) && !name.endsWith('.yaml');

/**
 * Reads every `*.yaml` under the seven kind directories (recursively), sorted by path.
 * - A YAML file directly in the root is ignored with a warning (`W_IGNORED_FILE`).
 * - A `.yml` / `.YAML` / `.Yaml` file inside a kind directory is an error (`E_FILE_EXTENSION`):
 *   it would otherwise be skipped silently and never validated or compiled.
 * Missing kind directories are treated as empty.
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
      const full = join(dir, name);
      const isYamlName = name.endsWith('.yaml') || hasWrongYamlExtension(name);
      if (!isYamlName || !statSync(full).isFile()) continue;
      if (hasWrongYamlExtension(name)) {
        diagnostics.push({
          severity: 'error',
          code: 'E_FILE_EXTENSION',
          file,
          path: '',
          message: 'catalog files must use the lower-case .yaml extension; this file is not loaded',
        });
        continue;
      }
      sources.push({ file, kind, text: readFileSync(full, 'utf8') });
    }
  }
  sources.sort((a, b) => byCodeUnit(a.file, b.file));
  return { sources, diagnostics };
}
