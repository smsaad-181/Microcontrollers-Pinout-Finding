# Phase 2b property, mutation and performance checks (tasks 2b.8, 2b.10, 2b.11)

## Property tests (2b.8): `packages/engine/test/properties.test.ts`

fast-check 4.10.2 (exact, devDependency of `@pinout/engine`). Random projects on the 6 MVP boards (every variant): 0-4 modules from the real catalog, optional interface override, Wi-Fi flag, reserved pads, locks (kept at the solver's pad or moved to a random pad). 1000 runs per property, fixed seed 20260601 (`FC_SEED`, `FC_RUNS` env overrides; the failing seed and the project are printed). Suite takes about 4 minutes on a laptop, per-test timeout 15 min.

| Property | Result |
|---|---|
| (a) every `ok` solution satisfies the hard constraints (exclusive pads/nets, every signal placed once, reserved/consumed/unusable pads unused, locks unmoved, I2C address unique per bus, ADC pad and no ADC2-with-Wi-Fi, no output on input-only pad, SPI clock <= carries.maxHz) | pass, 726 ok of 1000 |
| (b) `unsat` confirmed by brute force over the removable members (small instances, <= 9 members) | pass, 268 cases |
| (c) the conflict set is irreducible (unsat whole, satisfiable without any one member) | pass, 274 cases |
| (d) determinism, also with the catalog arrays in shuffled order | pass |
| (e) locked pins never move | pass |
| extra: potentiometer oracle (bipartite matching of pots to distinct usable ADC pads) agrees with ok/unsat | pass |

### Bugs found (reported, not fixed; engine source untouched)

Both are `it.fails` tests in the properties file ("known defects"); they turn red when the bug is fixed, so remove the `.fails` then.

- BUG-1: a lock on a bus signal that makes the auto-chosen interface (I2C) infeasible silently falls back to another interface (SPI); result `ok`, the locked pad is unused, no warning. Example: esp32-s3-devkitc-1 + adafruit-bme280, lock `m1.SDA = GPIO43`.
- BUG-2: two modules on one shared I2C bus with locks on the same line at different pads (`m1.SCL = GPIO36`, `m2.SCL = GPIO16`, esp32-devkitc-v4, two BME280) give `ok`; one lock is silently ignored (GPIO36 is also input-only). Expected `unsat` naming both locks.

Properties (a) and (e) skip the locks affected by these two bugs (`liveLocks`) so they still test everything else.

## Mutation testing (2b.10): Stryker 10.0.0 + vitest-runner 10.0.0

`pnpm mutation` (not part of `pnpm test`; output in `reports/mutation/`, `.stryker-tmp/`, both git-ignored). Configs: `packages/rules/stryker.config.json` (gate: break below 85), `packages/engine/stryker.config.json` (report only).

- `@stryker-mutator/vitest-runner@10.0.0` filters tests by name with a regex that assumes vitest joins suite and test names with a space; vitest 5 joins with ` > `, so every mutant ran zero tests (score 1 %). Fixed with a pnpm patch (`patches/@stryker-mutator__vitest-runner@10.0.0.patch`, registered in `pnpm-workspace.yaml`). Drop the patch when a fixed runner release exists.
- On Windows `concurrency: 1` is needed (parallel runners race on the vitest cache, EPERM).

| Target | Mutants | Score |
|---|---|---|
| packages/rules (index, rules, util) first run, existing tests | 659 | 65.6 % |
| packages/rules after `test/traces.test.ts` (exact traces, parts, values, evidence, missing-input names per rule and branch) | 659 | 95.75 % (gate 85 %) |
| packages/engine `src/assignment.ts` (report only) | 107 | 83.2 % |

The 28 surviving rules mutants are redundant TypeScript narrowing guards (`x === undefined` checks that follow `run.incomplete`), one unreachable `slower === undefined` break, the `a < b + eps` boundary of `le`, and the evidence/exports string literals; equivalent or not worth pinning.

Solver constraint files other than `assignment.ts` are not mutated: their tests load the real catalog through `packages/cli` with paths relative to the package, which does not exist in the Stryker sandbox, and with `inPlace` 87 % of the mutants are "static" (run during test-file import) so each one needs the whole slow suite. They are exercised by the property suite and the 24 fixtures instead.

## Checks

- `pnpm check:rules-disabled`: with `DISABLE_RULE=Rn` the rules tests fail for every rule (R1 6, R2 6, R3 14, R4 6, R5 8, R6 7, R7 6, R8 8 failing tests; baseline passes). Script: `tools/checks/rules-disabled.mjs`.
- `pnpm check:boundaries`: static scan of `packages/engine/src` and `packages/rules/src` (16 files) for DOM/React/network/fs/os/process imports, `Date.now`, `new Date`, `Math.random`, `performance.now`, `fetch`, browser globals, `require`, dynamic `import()`. Clean. Script: `tools/checks/boundaries.mjs`.

## Performance (2b.11)

See `perf.md`: p50 3.6 ms, p95 57.9 ms, max 878.5 ms over the 24 fixtures (target p95 <= 200 ms met). Perf test: `packages/engine/test/perf.test.ts`.
