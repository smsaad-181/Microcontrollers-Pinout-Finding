import { KINDS, STATUSES, type Diagnostic, type ValidationResult } from './types.js';

/** `error E_SCHEMA chips/demo-mcu-1.yaml pads.GPIO2.gpio: <message>` */
export function formatDiagnostic(d: Diagnostic): string {
  return `${d.severity} ${d.code} ${d.file} ${d.path === '' ? '(root)' : d.path}: ${d.message}`;
}

const plural = (n: number, word: string) => `${String(n)} ${word}${n === 1 ? '' : 's'}`;

/** One-line summary: error / warning / file counts and the catalog root. */
export function formatSummary(r: ValidationResult, root: string): string {
  return `catalog validate: ${plural(r.errorCount, 'error')}, ${plural(r.warningCount, 'warning')} in ${plural(r.fileCount, 'file')} (root: ${root})`;
}

/** Coverage report: fact counts per status × entity kind, entity counts, board statuses. */
export function formatCoverage(r: ValidationResult): string[] {
  const { coverage } = r;
  const factKinds = KINDS.filter((k) => k !== 'evidence' && k !== 'fixtures');
  const total = STATUSES.reduce((n, s) => n + coverage.facts[s], 0);
  const header = ['status', 'total', ...factKinds];
  const rows = STATUSES.map((s) => [
    s,
    String(coverage.facts[s]),
    ...factKinds.map((k) => String(coverage.factsByKind[k][s])),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? '').length)),
  );
  const line = (cells: string[]) =>
    `  ${cells.map((c, i) => (i === 0 ? c.padEnd(widths[i] ?? 0) : c.padStart(widths[i] ?? 0))).join('  ')}`;

  const out = [`Coverage: ${plural(total, 'fact')}`, line(header), ...rows.map(line)];
  out.push(`Entities: ${KINDS.map((k) => `${k} ${String(coverage.entities[k])}`).join(', ')}`);
  if (coverage.boards.length === 0) {
    out.push('Boards: none');
  } else {
    out.push('Boards:');
    for (const b of coverage.boards) {
      const note =
        b.computed === null
          ? ' (not computed)'
          : b.computed === b.declared
            ? ''
            : ` (computed: ${b.computed})`;
      out.push(`  ${b.ref}  ${b.declared}${note}`);
    }
  }
  return out;
}
