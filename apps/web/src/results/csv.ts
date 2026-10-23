// CSV export of a result: one row per assigned signal, with all three pin names and the wiring.
import type { Recommendation } from '@pinout/schema';
import { describePart, wiringRows } from './explain';

const HEADER = [
  'Module',
  'Signal',
  'Module pin',
  'Chip GPIO',
  'Chip pad',
  'Board label',
  'Header',
  'Header position',
  'Wiring',
  'Warnings on this pin',
];

/**
 * Quotes a cell (RFC 4180). Cells that a spreadsheet would run as a formula (=, +, -, @, tab, CR)
 * get a leading apostrophe so the file is never executable.
 */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function resultCsv(rec: Recommendation, pinLabels: Record<string, string>): string {
  const rows = wiringRows(rec, pinLabels).map((r) => {
    const warnings = rec.warnings
      .filter((w) => w.pads.includes(r.pad))
      .map((w) => `${w.level}: ${w.code}`)
      .join('; ');
    return [
      r.instance,
      r.role,
      r.modulePin ?? '',
      r.gpio,
      r.pad,
      r.boardLabel,
      r.connector,
      r.position,
      r.parts.length === 0 ? 'Direct wire' : `Needs part: ${r.parts.map(describePart).join('; ')}`,
      warnings,
    ];
  });
  const meta = [
    [`Catalog ${rec.catalog_version}`, `SHA-256 ${rec.catalog_sha256}`],
    [`Rule set ${rec.ruleset_version}`],
  ];
  return `${[HEADER, ...rows, [], ...meta].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
