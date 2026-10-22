import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
export const VALID_ROOT = fileURLToPath(new URL('./fixtures/valid/', import.meta.url));
export const REAL_CATALOG = fileURLToPath(new URL('../../../catalog/', import.meta.url));

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
