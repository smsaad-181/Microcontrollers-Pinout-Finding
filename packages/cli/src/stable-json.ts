// Canonical JSON: object keys sorted by UTF-16 code unit at every depth (including integer-like keys,
// which JSON.stringify would emit first), arrays kept in order, undefined object values skipped.
import { byCodeUnit } from './order.js';

function ser(value: unknown, indent: number, depth: number): string | undefined {
  if (value === null || typeof value !== 'object') {
    // Primitives (number/string/boolean); undefined/functions → undefined (skipped by callers).
    return JSON.stringify(value);
  }
  const nl = indent > 0 ? `\n${' '.repeat(indent * (depth + 1))}` : '';
  const end = indent > 0 ? `\n${' '.repeat(indent * depth)}` : '';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((v: unknown) => ser(v, indent, depth + 1) ?? 'null');
    return `[${nl}${items.join(`,${nl}`)}${end}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort(byCodeUnit);
  const parts: string[] = [];
  for (const k of keys) {
    const v = ser(obj[k], indent, depth + 1);
    if (v !== undefined) parts.push(`${JSON.stringify(k)}:${indent > 0 ? ' ' : ''}${v}`);
  }
  if (parts.length === 0) return '{}';
  return `{${nl}${parts.join(`,${nl}`)}${end}}`;
}

export function stableStringify(value: unknown, indent = 0): string {
  return ser(value, indent, 0) ?? 'null';
}
