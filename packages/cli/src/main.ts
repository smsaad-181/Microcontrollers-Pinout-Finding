// Entry point for `pnpm catalog:validate` / `pnpm catalog:compile` (run from the repo root, so
// `--root`/`--out` and their defaults are relative to process.cwd()).
import { runCli } from './cli.js';

try {
  process.exitCode = runCli(process.argv.slice(2), {
    cwd: process.cwd(),
    env: process.env,
    stdout: (line) => {
      process.stdout.write(`${line}\n`);
    },
    stderr: (line) => {
      process.stderr.write(`${line}\n`);
    },
  });
} catch (e) {
  // runCli reports its own failures; this is the last line of defence (e.g. a closed stdout).
  process.stderr.write(`error: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
