// End-to-end: spawn the real `pnpm catalog:validate` script from the repo root to prove exit codes.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './helpers.js';

function pnpm(args: string[]) {
  const r = spawnSync('pnpm', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    shell: true,
    timeout: 120_000,
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('pnpm catalog:validate (spawned)', () => {
  it('exits 0 on the valid fixture root', () => {
    const r = pnpm(['catalog:validate', '--root', 'packages/cli/test/fixtures/valid']);
    expect(r.out).toContain('0 errors');
    expect(r.code).toBe(0);
  }, 120_000);

  it('exits non-zero on an invalid fixture root and prints the code', () => {
    const r = pnpm([
      'catalog:validate',
      '--root',
      'packages/cli/test/fixtures/invalid/pin-numbering',
    ]);
    expect(r.out).toContain(
      'error E_PIN_NUMBERING boards/demo-board-1@r1.yaml connectors.0.pins.3',
    );
    expect(r.code).not.toBe(0);
  }, 120_000);
});
