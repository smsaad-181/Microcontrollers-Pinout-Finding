# Phase 2b solver and explanation traces (tasks 2b.5, 2b.7)

Code: `packages/engine/src/{solver,assess,modulechecks}.ts`; tests `packages/engine/test/{solver,fixtures}.test.ts`.
New dependency: `@pinout/rules` (workspace) in `packages/engine/package.json` (lockfile updated with `pnpm install --offline`).

## API

- `solve(index, project, options?) -> Recommendation`; `solveDetailed` also returns `{ nodes, branchesTried, budgetExhausted }`.
- `SolveOptions`: `maxNodes` (default 200000, counts search nodes), `branchLimit` (16), `now` + `timeLimitMs` (2000; the wall-clock guard exists only when the caller injects a clock, the package never reads one), `disabledRules` (rule-disable gate), `catalogVersion`, `catalogSha256`.

## Model

- Variables are nets: a bus line shared by modules is one net (SDA/SCL per I2C bus, SCK/MOSI/MISO of the one SPI bus); everything else is one net per signal. Domains: pad usable (not consumed/unbonded, not reserved, not the board's USB-UART pads, not locked to another net), function (GPIO, ADC, or a `carries` entry of the chosen peripheral instance and role), direction (no output on input-only), ADC unit vs radio (`radioConflict === true` with Wi-Fi), R6 blocked.
- One peripheral instance per bus group, distinct instances per bus; interchangeable matrix-only instances (ESP32 I2C0/I2C1) are enumerated once.
- I2C addresses are decided before the search with `assignI2c` (fixes the bus count); an unknown address is never assumed distinct.
- Search: backtracking, forward checking, MRV (ties: more members), branch and bound on the componentwise lower bound of the 4-tier cost, strict improvement only, candidates ordered by (cost, connector, position). Interface branches from `enumerateBranches`, first satisfiable branch wins.
- Tier 1: strap, JTAG, power-up glitch, pad-specific errata (errata present on every pad are ignored), conflict facts relied on (reset state only for loads and strap pads), loads floating at reset. Tier 2: SPI line via matrix, ADC range unknown/over range. Tier 3: always 0 (no catalog data for library-default pads or adjacency). Tier 4: ADC/DAC/touch/IO_MUX-SPI pads used by other signals.
- Rules wired: R6 per strap pad (blocked pads leave the domain), R4 per load (load current missing, so Caution), R8 per ADC signal (sensor max falls back to the board logic voltage), R1/R2 per module direction, R5 (1 k / 2 k divider) when R1 fails on a device output, R3 per I2C bus (Cb estimated, see `modulechecks.ts` constants), R7 per rail. Missing/conflict facts give Caution through the rules.
- Explanations: per assignment a trace (domain size, chosen pad, routing and clock cap, notes, rule traces, score), evidence ids, up to 3 alternatives with the first tier where they rank lower (equal cost: tier 4, "tie-break by connector/position"). Warnings merged by (level, code), sorted critical to info.
- Budget exhausted: `ok` keeps the best found plus warning `BUDGET_EXHAUSTED`; without a solution the status is `unsat` with token `budget:exhausted` and a critical warning (the schema has no separate status).

## Extension point for task 2b.6

`diagnose()` in `solver.ts` is the first cut: empty domains explained by exclusion tokens, Hall check on identical domains (`adc:` token), else the most constrained nets. Replace it with deletion-based minimisation (re-run `searchOnce` on net subsets) and ranked relaxations; `relaxations()` is a heuristic list today. The contract `{ tokens, nets, reason }` stays.

## Fixture status

Task 2b.9: see `fixtures-run.md` (15 pass, 9 disputed) and `fixture-disputes.md`. The search bound is now an exact assignment-problem bound (`assignment.ts`).
