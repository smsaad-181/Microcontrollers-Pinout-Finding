// `pnpm check:rules-disabled`: disabling any one of R1-R8 (DISABLE_RULE, honoured by
// packages/rules/test/helpers.ts) must make at least one rules test fail. Baseline must pass.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('../../packages/rules/', import.meta.url));
const vitest = fileURLToPath(new URL('../../node_modules/vitest/vitest.mjs', import.meta.url));

function run(disabled) {
  const env = { ...process.env };
  delete env.DISABLE_RULE;
  if (disabled) env.DISABLE_RULE = disabled;
  const r = spawnSync(process.execPath, [vitest, 'run', '--reporter=dot'], {
    cwd: pkg,
    env,
    encoding: 'utf8',
  });
  const m = /Tests\s+(?:(\d+) failed \|\s*)?(\d+) passed/.exec(r.stdout);
  return { status: r.status, failed: Number(m?.[1] ?? 0) };
}

const base = run(undefined);
if (base.status !== 0) {
  console.error('baseline rules tests fail; fix them first');
  process.exit(1);
}
let bad = 0;
for (const id of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']) {
  const r = run(id);
  const ok = r.status !== 0;
  console.log(`${id} disabled: ${ok ? `${r.failed} test(s) fail (good)` : 'NO TEST FAILS (bad)'}`);
  if (!ok) bad++;
}
process.exit(bad === 0 ? 0 : 1);
