// Build-only Vite plugin for `pnpm --filter web build:single` (vite.single.config.ts): one
// self-contained `pinout-finder.html` that works from file:// with no server and no network.
// - swaps three modules: catalog fetch -> catalog compiled in at build time, engine worker -> blob
//   worker with a main-thread fallback, service-worker registration -> no-op;
// - inlines the JS bundle, the stylesheet and the icon into the HTML;
// - adds a Content-Security-Policy that allows exactly those inline blocks (by hash) and nothing
//   from the network.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';

const SRC = normalizePath(fileURLToPath(new URL('./', import.meta.url)));
const WEB = fileURLToPath(new URL('../', import.meta.url));
export const SINGLE_FILE_NAME = 'pinout-finder.html';

/** Resolved source file -> its single-file replacement. */
const REPLACEMENTS = new Map([
  [`${SRC}net.ts`, `${SRC}single/inlineFetch.ts`],
  [`${SRC}worker/createWorker.ts`, `${SRC}single/createWorker.ts`],
]);
const PWA_REGISTER = 'virtual:pwa-register';
const INLINE_CATALOG = 'virtual:inline-catalog';
const RESOLVED_CATALOG = `\0${INLINE_CATALOG}`;
const SAFE_FILE = /^[0-9a-z][0-9a-z._-]*\.json$/;

export interface InlineCatalog {
  manifestText: string;
  catalogFile: string;
  catalogText: string;
}

/** Reads the compiled catalog (`pnpm catalog:compile`) and checks it against its manifest hash. */
export function readInlineCatalog(dir = join(WEB, 'public', 'catalog')): InlineCatalog {
  const manifestPath = join(dir, 'catalog-manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`${manifestPath} not found: run \`pnpm catalog:compile\` first`);
  }
  const manifestText = readFileSync(manifestPath, 'utf8');
  const m = JSON.parse(manifestText) as { version?: unknown; sha256?: unknown; file?: unknown };
  if (typeof m.version !== 'string' || typeof m.sha256 !== 'string') {
    throw new Error('catalog-manifest.json: missing version or sha256');
  }
  const catalogFile = typeof m.file === 'string' ? m.file : `${m.version}.json`;
  if (!SAFE_FILE.test(catalogFile))
    throw new Error(`catalog-manifest.json: bad file ${catalogFile}`);
  const catalogText = readFileSync(join(dir, catalogFile), 'utf8');
  const sha = createHash('sha256').update(catalogText, 'utf8').digest('hex');
  if (sha !== m.sha256) throw new Error(`${catalogFile}: SHA-256 does not match the manifest`);
  return { manifestText, catalogFile, catalogText };
}

const sha256b64 = (text: string): string =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** CSP for the single file: only the given inline blocks, a blob: worker, and data: images. */
export function singleFileCsp(scripts: readonly string[], styles: readonly string[]): string {
  return [
    "default-src 'none'",
    `script-src ${scripts.map(sha256b64).join(' ')}`,
    `style-src ${styles.map(sha256b64).join(' ')}`,
    'img-src data:',
    'worker-src blob:',
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/** Text placed inside <script>/<style> must not close the element or open an HTML comment. */
function inlineSafe(code: string, tag: 'script' | 'style', file: string): string {
  const safe = code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
  if (safe.includes('<!--')) throw new Error(`${file}: contains "<!--", cannot be inlined`);
  return safe;
}

/**
 * Replaces each `<script src>` / `<link rel="stylesheet">` that names a bundle file with the file's
 * content, adds the CSP meta tag, and throws if any other local reference is left.
 */
export function inlineHtml(html: string, files: ReadonlyMap<string, string>): string {
  const scripts: string[] = [];
  const styles: string[] = [];
  const take = (ref: string): { name: string; code: string } => {
    const name = ref.replace(/^\.?\//, '');
    const code = files.get(name);
    if (code === undefined) throw new Error(`single file: ${ref} is not in the bundle`);
    return { name, code };
  };
  // Tags become placeholders first, so the leftover check below sees only the page's own markup.
  const blocks: string[] = [];
  let out = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (_tag, src: string) => {
    const { name, code } = take(src);
    const text = inlineSafe(code, 'script', name);
    scripts.push(text);
    return `\0${String(blocks.push(`<script type="module">${text}</script>`) - 1)}\0`;
  });
  out = out.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g, (tag) => {
    const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
    if (href === undefined) throw new Error(`single file: stylesheet without href: ${tag}`);
    const { name, code } = take(href);
    const text = inlineSafe(code, 'style', name);
    styles.push(text);
    return `\0${String(blocks.push(`<style>${text}</style>`) - 1)}\0`;
  });
  const leftover = /\b(?:src|href)="(?!data:|#)([^"]*)"/.exec(out);
  if (leftover) throw new Error(`single file: external reference left: ${leftover[1] ?? ''}`);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${singleFileCsp(scripts, styles)}" />`;
  const withCsp = out.replace(/<meta charset="UTF-8"\s*\/?>/i, (m) => `${m}\n    ${meta}`);
  if (withCsp === out) throw new Error('single file: <meta charset="UTF-8"> not found');
  return withCsp.replace(/\0(\d+)\0/g, (_m, i: string) => blocks[Number(i)] ?? '');
}

export function singleFile(): Plugin {
  return {
    name: 'pinout-single-file',
    apply: 'build',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === PWA_REGISTER) return `${SRC}single/pwaRegister.ts`;
      if (source === INLINE_CATALOG) return RESOLVED_CATALOG;
      if (importer === undefined || !source.startsWith('.')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      return REPLACEMENTS.get(normalizePath(resolved.id)) ?? null;
    },
    load(id) {
      if (id !== RESOLVED_CATALOG) return null;
      const c = readInlineCatalog();
      return [
        `export const manifestText = ${JSON.stringify(c.manifestText)};`,
        `export const catalogFile = ${JSON.stringify(c.catalogFile)};`,
        `export const catalogText = ${JSON.stringify(c.catalogText)};`,
      ].join('\n');
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const svg = readFileSync(join(WEB, 'public', 'icon.svg'));
        const icon = `data:image/svg+xml;base64,${svg.toString('base64')}`;
        return html
          .replace(/\s*<!-- CSP meta tag:[^>]*-->/, '')
          .replace('href="/icon.svg"', `href="${icon}"`);
      },
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const page = bundle['index.html'];
        if (page?.type !== 'asset') throw new Error('single file: index.html missing from bundle');
        const files = new Map<string, string>();
        for (const [name, item] of Object.entries(bundle)) {
          if (name === 'index.html') continue;
          const text = item.type === 'chunk' ? item.code : item.source;
          if (typeof text !== 'string') throw new Error(`single file: binary asset ${name}`);
          files.set(name, text);
        }
        const html = inlineHtml(String(page.source), files);
        for (const name of Object.keys(bundle)) Reflect.deleteProperty(bundle, name);
        this.emitFile({ type: 'asset', fileName: SINGLE_FILE_NAME, source: html });
      },
    },
  };
}
