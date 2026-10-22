// Generates docs/schema.md from the JSON Schema files in dist/ (which come from the Zod .describe() text).
// Usage: node scripts/emit-docs.mjs [outFile]   (run after `build`)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const out = process.argv[2] ?? join(here, '..', '..', '..', 'docs', 'schema.md');

const isFact = (s) =>
  s?.type === 'object' &&
  s.properties &&
  'status' in s.properties &&
  'evidence' in s.properties &&
  'value' in s.properties;

function typeOf(s) {
  if (!s) return 'any';
  if (isFact(s)) return `Fact<${typeOf(s.properties.value).replace(/ \| null$/, '')}>`;
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
  if (s.const !== undefined) return JSON.stringify(s.const);
  const alts = s.anyOf ?? s.oneOf;
  if (alts) return [...new Set(alts.map(typeOf))].join(' | ');
  if (Array.isArray(s.type)) return s.type.join(' | ');
  if (s.type === 'array') return `${typeOf(s.items)}[]`;
  if (s.type === 'object') {
    if (s.properties) return 'object';
    if (s.additionalProperties && typeof s.additionalProperties === 'object')
      return `Record<string, ${typeOf(s.additionalProperties)}>`;
    return 'object';
  }
  if (s.pattern && s.type === 'string') return 'string (pattern)';
  return s.type ?? 'any';
}

const clean = (t) =>
  (t ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

function rows(schema, prefix, req, list) {
  for (const [key, sub] of Object.entries(schema.properties ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    list.push({
      path,
      type: typeOf(sub),
      required: req.has(key),
      description: sub.description ?? '',
    });
    if (isFact(sub)) continue;
    let node = sub;
    let p = path;
    if (node.type === 'array' && node.items) {
      node = node.items;
      p = `${path}[]`;
    } else if (
      node.type === 'object' &&
      !node.properties &&
      typeof node.additionalProperties === 'object'
    ) {
      node = node.additionalProperties;
      p = `${path}.*`;
    }
    if (node.type === 'object' && node.properties && !isFact(node))
      rows(node, p, new Set(node.required ?? []), list);
  }
}

const files = readdirSync(dist)
  .filter((f) => f.endsWith('.schema.json'))
  .sort();
const lines = [
  '# Catalog schema reference',
  '',
  '> Generated from the Zod schemas in `packages/schema` (their `.describe()` text) by',
  '> `pnpm docs:schema`. Do not edit by hand. The normative design is the TypeScript reference in',
  '> `.claude/skills/catalog-schema/SKILL.md`; a test keeps the Zod schemas equal to it.',
  '',
  '`Fact<T>` is the evidence-backed wrapper every engine-read value uses:',
  '`{ value, unit?, conditions?, evidence[], status, reviewers?, readings?, active?, transcribed?, note? }`.',
  'A fact with status `missing` has `value: null` and no evidence; a `verified` fact needs at least two',
  'distinct reviewers.',
  '',
  '## Contents',
  '',
  ...files.map((f) => `- [${f.replace('.schema.json', '')}](#${f.replace('.schema.json', '')})`),
  '',
];

for (const f of files) {
  const name = f.replace('.schema.json', '');
  const schema = JSON.parse(readFileSync(join(dist, f), 'utf8'));
  lines.push(`## ${name}`, '');
  if (schema.description) lines.push(clean(schema.description), '');
  const list = [];
  rows(schema, '', new Set(schema.required ?? []), list);
  lines.push('| Field | Type | Required | Description |', '| --- | --- | --- | --- |');
  for (const r of list)
    lines.push(
      `| \`${r.path}\` | ${clean(r.type)} | ${r.required ? 'yes' : 'no'} | ${clean(r.description)} |`,
    );
  lines.push('');
}

writeFileSync(out, lines.join('\n'), { encoding: 'utf8' });
console.log(`wrote ${out} (${files.length} schemas)`);
