import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
export const VALID_ROOT = fileURLToPath(new URL('./fixtures/valid/', import.meta.url));
export const INVALID_DIR = fileURLToPath(new URL('./fixtures/invalid/', import.meta.url));
/** The repository's real catalog. Its content grows with Phase 2a, so tests must not assume it is empty. */
export const REAL_CATALOG = fileURLToPath(new URL('../../../catalog/', import.meta.url));

const KIND_DIRS = ['evidence', 'chips', 'modules', 'boards', 'ics', 'breakouts', 'fixtures'];

/** A throw-away catalog root with the seven kind directories, each holding only a `.gitkeep`. */
export function makeEmptyCatalog(): string {
  const root = mkdtempSync(join(tmpdir(), 'empty-catalog-'));
  for (const kind of KIND_DIRS) {
    mkdirSync(join(root, kind));
    writeFileSync(join(root, kind, '.gitkeep'), '');
  }
  return root;
}

/** Shared empty catalog root for tests that prove an empty catalog validates and compiles. */
export const EMPTY_CATALOG = makeEmptyCatalog();

export interface InvalidCase {
  case: string;
  code: string;
  file: string;
  path_contains: string;
}

export function invalidCases(): InvalidCase[] {
  const text = readFileSync(
    fileURLToPath(new URL('./fixtures/invalid/cases.yaml', import.meta.url)),
    'utf8',
  );
  return parse(text) as InvalidCase[];
}

export function invalidRoot(name: string): string {
  return fileURLToPath(new URL(`./fixtures/invalid/${name}/`, import.meta.url));
}
