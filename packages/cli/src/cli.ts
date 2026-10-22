// Thin CLI layer: argument parsing, file output and exit codes. Testable in-process via `runCli`.
//   exit 0 = ok, 1 = validation errors (compile refuses to emit), 2 = usage / root not found.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MANIFEST_FILE, compileCatalog } from './compile.js';
import { formatCoverage, formatDiagnostic, formatSummary } from './report.js';
import type { ValidationResult } from './types.js';
import { validateRoot } from './validate.js';

export interface CliIo {
  cwd: string;
  env: Record<string, string | undefined>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export const DEFAULT_ROOT = 'catalog';
export const DEFAULT_OUT = 'apps/web/public/catalog';

const USAGE = [
  'usage: catalog validate [--root <dir>]',
  '       catalog compile  [--root <dir>] [--out <dir>]',
  `defaults: --root ${DEFAULT_ROOT}  --out ${DEFAULT_OUT}  (relative to the working directory)`,
].join('\n');

interface Args {
  command: 'validate' | 'compile';
  root: string;
  out: string;
}

function parseArgs(argv: readonly string[]): Args | string {
  const [command, ...rest] = argv;
  if (command !== 'validate' && command !== 'compile') {
    return command === undefined ? 'missing command' : `unknown command "${command}"`;
  }
  const allowed = command === 'compile' ? ['--root', '--out'] : ['--root'];
  const values: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] ?? '';
    const eq = arg.indexOf('=');
    const name = eq >= 0 ? arg.slice(0, eq) : arg;
    if (!allowed.includes(name)) return `unknown option "${arg}"`;
    const value = eq >= 0 ? arg.slice(eq + 1) : rest[++i];
    if (value === undefined || value === '') return `option ${name} needs a value`;
    values[name] = value;
  }
  return { command, root: values['--root'] ?? DEFAULT_ROOT, out: values['--out'] ?? DEFAULT_OUT };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deterministic "as of" date for the manifest, never the wall clock:
 *   1. SOURCE_DATE_EPOCH (reproducible-builds convention), as a UTC date;
 *   2. committer date of the last git commit touching the catalog root (`git log -1 --format=%cs`);
 *   3. the latest evidence `accessed` date; 4. 1970-01-01.
 */
export function resolveCatalogDate(
  root: string,
  env: CliIo['env'],
  result: ValidationResult,
): { date: string; source: string } {
  const epoch = env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && /^\d+$/.test(epoch)) {
    return {
      date: new Date(Number(epoch) * 1000).toISOString().slice(0, 10),
      source: 'SOURCE_DATE_EPOCH',
    };
  }
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', '.'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (DATE.test(out)) return { date: out, source: 'git' };
  } catch {
    // git missing or not a repository: fall through.
  }
  const accessed = result.catalog.evidence.map((e) => e.accessed).sort();
  const latest = accessed.at(-1);
  if (latest !== undefined) return { date: latest, source: 'evidence' };
  return { date: '1970-01-01', source: 'none' };
}

function validateAndReport(
  rootArg: string,
  io: CliIo,
): { result: ValidationResult; root: string } | number {
  const root = resolve(io.cwd, rootArg);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    io.stderr(`catalog: root "${rootArg}" is not a directory`);
    return 2;
  }
  const result = validateRoot(root);
  for (const d of result.diagnostics)
    (d.severity === 'error' ? io.stderr : io.stdout)(formatDiagnostic(d));
  for (const line of formatCoverage(result)) io.stdout(line);
  io.stdout(formatSummary(result, rootArg));
  return { result, root };
}

export function runCli(argv: readonly string[], io: CliIo): number {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.stderr(`catalog: ${args}\n${USAGE}`);
    return 2;
  }
  const validated = validateAndReport(args.root, io);
  if (typeof validated === 'number') return validated;
  const { result, root } = validated;
  if (result.errorCount > 0) {
    if (args.command === 'compile')
      io.stderr('catalog compile: refusing to emit output because validation failed');
    return 1;
  }
  if (args.command === 'validate') return 0;

  const { date, source } = resolveCatalogDate(root, io.env, result);
  const compiled = compileCatalog(result, { date, dateSource: source });
  const out = resolve(io.cwd, args.out);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, compiled.fileName), compiled.catalogText);
  writeFileSync(join(out, MANIFEST_FILE), compiled.manifestText);
  io.stdout(
    `catalog compile: wrote ${args.out}/${compiled.fileName} and ${args.out}/${MANIFEST_FILE} ` +
      `(version ${compiled.version}, date ${date} from ${source}, sha256 ${compiled.sha256})`,
  );
  return 0;
}
