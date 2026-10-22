// The only part of validate that touches the file system: read `<root>/<kind>/**/*.yaml`.
import { readFileSync, readdirSync } from 'node:fs';
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

const isYamlLike = (name: string): boolean => /\.ya?ml$/i.test(name);

/** Directories of the catalog root that are never scanned for stray YAML. */
const isIgnoredDir = (name: string): boolean => name.startsWith('.') || name === 'node_modules';

interface Walked {
  /** Regular files, relative to the walked directory, forward slashes, sorted by code unit. */
  files: string[];
  /** Symbolic links and junctions (never followed), same path form. */
  links: string[];
}

/**
 * Recursive walk that never follows links: a link (to a file or a directory, even a dangling one)
 * is only recorded. Following links would let a catalog read files outside its root, and the result
 * would differ between operating systems.
 */
function walk(dir: string, prefix = ''): Walked {
  const out: Walked = { files: [], links: [] };
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    byCodeUnit(a.name, b.name),
  );
  for (const entry of entries) {
    const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isSymbolicLink()) {
      out.links.push(rel);
    } else if (entry.isDirectory()) {
      const inner = walk(join(dir, entry.name), rel);
      out.files.push(...inner.files);
      out.links.push(...inner.links);
    } else if (entry.isFile()) {
      out.files.push(rel);
    }
  }
  out.files.sort(byCodeUnit);
  out.links.sort(byCodeUnit);
  return out;
}

const linkWarning = (file: string): Diagnostic => ({
  severity: 'warning',
  code: 'W_SYMLINK_SKIPPED',
  file,
  path: '',
  message:
    'symbolic link or junction skipped: catalog files must be real files in real directories ' +
    '(links are never followed, so a catalog cannot read outside its root)',
});

/**
 * Reads every `*.yaml` under the seven kind directories (recursively), sorted by path.
 * - A YAML file directly in the root is ignored with a warning (`W_IGNORED_FILE`).
 * - A `.yml` / `.YAML` / `.Yaml` file inside a kind directory is an error (`E_FILE_EXTENSION`):
 *   it would otherwise be skipped silently and never validated or compiled.
 * - A YAML file inside any other directory of the root (`chip/`, `board/` misspellings, `Chips/`) is
 *   an error (`E_UNKNOWN_DIR`); directories without YAML, dot-directories and `node_modules` are
 *   ignored. Kind directory names are matched exactly (case-sensitive), so what is loaded does not
 *   depend on the file system.
 * - A symbolic link or junction in the root or anywhere under a kind directory is skipped with a
 *   warning (`W_SYMLINK_SKIPPED`).
 * Missing kind directories are treated as empty.
 */
export function loadCatalogSources(root: string): LoadedSources {
  const sources: SourceFile[] = [];
  const diagnostics: Diagnostic[] = [];
  const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) =>
    byCodeUnit(a.name, b.name),
  );

  for (const entry of entries) {
    if (isIgnoredDir(entry.name)) continue;
    if (entry.isSymbolicLink()) {
      diagnostics.push(linkWarning(entry.name));
    } else if (entry.isFile() && isYamlLike(entry.name)) {
      diagnostics.push({
        severity: 'warning',
        code: 'W_IGNORED_FILE',
        file: entry.name,
        path: '',
        message: `ignored: catalog files belong in one of ${KINDS.join('/, ')}/`,
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || (KINDS as readonly string[]).includes(entry.name)) continue;
    if (isIgnoredDir(entry.name)) continue;
    const lower = entry.name.toLowerCase();
    const hint = (KINDS as readonly string[]).includes(lower)
      ? `directory names are case-sensitive: use lower-case "${lower}/" (Linux CI does not load "${entry.name}/")`
      : `expected one of ${KINDS.join('/, ')}/; this file is not loaded`;
    for (const name of walk(join(root, entry.name)).files) {
      if (!isYamlLike(name)) continue;
      diagnostics.push({
        severity: 'error',
        code: 'E_UNKNOWN_DIR',
        file: `${entry.name}/${name}`,
        path: '',
        message: `"${entry.name}/" is not a catalog directory (${hint})`,
      });
    }
  }

  for (const kind of KINDS) {
    const entry = entries.find((e) => e.name === kind);
    if (!entry?.isDirectory()) continue; // missing, a file, or a link (already warned about)
    const { files, links } = walk(join(root, kind));
    for (const link of links) diagnostics.push(linkWarning(`${kind}/${link}`));
    for (const name of files) {
      const file = `${kind}/${name}`;
      if (!name.endsWith('.yaml') && !hasWrongYamlExtension(name)) continue;
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
      sources.push({ file, kind, text: readFileSync(join(root, kind, name), 'utf8') });
    }
  }
  sources.sort((a, b) => byCodeUnit(a.file, b.file));
  return { sources, diagnostics };
}
