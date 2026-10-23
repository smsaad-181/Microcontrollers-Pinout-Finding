# Phase 2b gate review (phase-validator + electrical recompute)

Branch `phase-2b`, HEAD `050e974` (worktree clean). Reviewer read code and tests directly. No source was edited.
The electrical numbers were worked out from first principles, then compared with the code, the tests and live engine output.

**Verdict: FAIL.** One Major finding (M1) blocks. Everything else passes.

## 1. Gate commands

| Command | Result |
|---|---|
| `pnpm -s lint` | exit 0 |
| `pnpm -s typecheck` | exit 0 |
| `pnpm -s catalog:validate` | exit 0: 0 errors, 0 warnings, 119 files, 24 fixtures |
| `FC_RUNS=100 pnpm --filter @pinout/rules test` | 2 files, 80/80 pass |
| `FC_RUNS=100 pnpm --filter @pinout/engine test` | 11 files, 155/155 pass (59.7 s). Includes 24/24 golden fixtures, the property suite, unsat, perf and lock tests |
| `node tools/checks/boundaries.mjs` | "16 files in engine/src and rules/src are pure" |
| `node tools/checks/rules-disabled.mjs` | each of R1-R8 when disabled makes 6-14 tests fail |

Not re-run here: properties at 1,000 runs (the authors report a pass in `property-mutation-perf.md`) and Stryker.

## 2. Exit criteria

| Criterion | Evidence | Result |
|---|---|---|
| Engine is pure and deterministic (no DOM, fetch, Date or Math.random) | My own grep of `packages/{engine,rules}/src` for Date, Math.random, fetch, window, document, performance, process, require, dynamic import and `node:` found 0 hits. The boundary script is clean. The budget counts search nodes. A wall clock only applies when the caller injects `options.now`. Everything is sorted with an explicit `cmp`. Property (d) checks for identical JSON, also with a shuffled catalog | PASS |
| AI never picks pins | No AI or LLM code or dependency exists in engine, rules or schema. Assignments come only from the solver | PASS |
| Missing or conflict inputs never produce a pass | `Run.need` accepts only `verified`/`inferred` numbers. Anything else gives `caution` with `passed: false` (`rules/src/util.ts`). R6 `unknown` gives caution. R4 load is always `missing`, which gives `PIN_CURRENT_UNVERIFIED`. When Wi-Fi is on and radio compatibility is unknown, the engine emits `ADC_RADIO_UNKNOWN`. A `conflict` level-shifter fact gives a Caution. Tests exist for every rule | PASS (see L1, L2) |
| Unsat explanations are verified | QuickXplain runs with the solver as the oracle, then a deletion pass re-solves without each member (`unsat.ts`). A relaxation is kept only when re-solving the full project gives `ok`. Property (b) checks against brute force and (c) checks irreducibility. Both pass | PASS (see L4) |
| Traces cite evidence ids | `fixtures.test.ts` "worked example evidence" checks that every fixture evidence id cited by a catalog fact is in the engine trace. The second key in `hardware-audit.md` found every id SUPPORTED | PASS |
| Locks are never silently dropped | The BUG-1/BUG-2 fix in `solver.ts` works two ways. A lock with no signal in a branch makes that branch infeasible. Two different locks on one net set `lockConflict`, which empties the domain, so the result is unsat with `locked:` tokens. Dedicated tests are at `properties.test.ts:403`, and the `it.fails` markers are gone | PASS (see L3, L5) |
| Removing any rule fails a test | Confirmed by running `rules-disabled.mjs` | PASS |
| Solve p95 ≤ 200 ms | `perf.md` reports p95 57.9 ms. The 879 ms maximum is the unsat analysis of the nine-ADS1115 fixture | PASS |

## 3. Electrical recompute (first principles)

Rule formulas in `packages/rules/src/rules.ts`:

- **R1** passes when V_drv ≤ abs max. VDDIO + 0.3 is supported and the comparison is inclusive. OK.
- **R2** needs VOH,min ≥ VIH,min and VOL,max ≤ VIL,max. OK.
- **R3** computes Rp,min = (VDD − VOL)/IOL and Rp,max = tr/(0.8473·Cb). The tier table is 1000/300/120 ns for ≤100 kHz, ≤400 kHz and ≤1 MHz. Pull-ups combine in parallel. The suggested parallel resistor is 1/(1/Rp,max − 1/Rp,eff). OK.
- **R4** checks the per-pin current and the group sums. OK.
- **R5** checks Vin·(1±5 %)·R2/(R1+R2) against VDD, abs max and VIH. The suggested ratio window is VIH/(0.95·Vin) to min(VDD, abs)/(1.05·Vin). OK.
- **R7** checks each rail total against its regulator rating, then the grand total against the USB limit. Summing 3V3 and 5V currents is valid behind a linear regulator. OK.
- **R8** checks Vmax·ratio ≤ Vadc,max. Dead zone = Vadc,min/ratio. OK.

| Vector | My computation | Code / test | Match |
|---|---|---|---|
| T1 Rp,min | 2.9 V / 3 mA = 966.67 Ω | 966.7 | yes |
| T2, T3, T4 Rp,max | 300 ns/(0.8473·50 pF) = 7081 Ω; 1000 ns at 50 pF = 23 604 Ω; 300 ns at 100 pF = 3541 Ω | same | yes |
| T5, T6 | 4700/5 = 940 Ω, below 966.7; 10k‖4.7k = 3197 Ω | same | yes |
| T7, T8 divider | 5.25·2/3 = 3.50 V > 3.3 (reject). 5.25·0.6 = 3.15 V and 4.75·0.6 = 2.85 V ≥ 0.75·3.3 = 2.475 (accept) | same | yes |
| T9 LED | 3/220 = 13.64 mA > 8 (critical); 3/470 = 6.38 mA | same | yes |
| T10, T11 | 2.64 < 3.0 and 2.90 < 3.0 (fail) | same | yes |
| T12-T15 | 4·89.3 = 357.2 mA; 4·71.4 = 285.6 mA; Rb = 1.94/8.93 mA = 217 Ω; 100+9+10 = 119 mA; 1/66 ns = 15.15 MHz | same | yes |
| T16 ADC | 9.1/19.1 = 0.4764; 5 V → 2.382 V ≤ 2.45; dead zone 0.15/0.4764 = 0.315 V | same | yes |
| Fixture `i2c-pullup-stack-ten-kohm-five-boards` | 5 × 10k → 2000 Ω. Engine Cb = 5·10 + 0.2·100 = 70 pF, so Rp,max = 5058 Ω and R3 passes. With an MCU-pin term (80 pF), Rp,max = 4426 Ω and it still passes. The sensor-side branch caveat gives 1/(4e-4 + 2e-4) = 1666.7 Ω | consistent | yes |
| Fixture `uno-r4-minima-opto-relay-pin-current` | 5 V/1 kΩ = 5.0 mA, which is > 4 mA but ≤ 8 mA (Caution). 4 × 5 = 20 mA ≤ 30 mA (port) and ≤ 60 mA (all pins) | same | yes |
| Fixture `uno-r4-minima-d13-onboard-led-load` | 5/330 = 15.15 mA, above both 4 and 8 mA (Caution, since Vf is unknown) | same | yes |
| Fixture `d1-mini-a0-potentiometer-adc-fit` | 100/320 = 0.3125; 3.3·0.3125 = 1.031 V > 1.0 V; full scale 3.2 V (warning). Pot Thevenin ≤ 2.5 kΩ, which is 0.78 % of 320 kΩ | same | yes |
| Fixture `ads1115-nine-boards` | 2 controllers × 4 addresses = 8 slots, and 9 modules > 8, so unsat | same | yes |
| Worked example | 357.2 / 285.6 / 119 mA; ST7735 15 151 515 Hz; MFRC522 10 MHz | same | yes |

## 4. Findings

### Major (blocks)

**M1: the R3 bus-capacitance estimate omits the MCU-pin term, so R3 passes the plan's headline failing case.**

- **Code.** `packages/engine/src/modulechecks.ts:352` computes `cb = members × 10 pF + wire × 100 pF/m`.
- **Spec.** `electrical-rules` SKILL ("+ MCU pin") and `docs/PLAN.md` §349 both require an MCU-pin term in Cb.
- **Live probe.** I ran ESP32-DevKitC V4 with one `adafruit-bme280` (10 kΩ) at the default 0.2 m. The engine gives Cb = 30 pF and Rp,max = 11 802 Ω, so R3 passes with no `I2C_PULLUP_OUT_OF_RANGE`.
- **Expected.** With the MCU pin at ≤ 10 pF (UM10204), Cb = 40 pF and Rp,max = 8851 Ω. So 10 kΩ at 400 kHz must warn. This is PLAN table row 1 and skill T2.
- **Fix.** Add an MCU pin capacitance term, from a catalog fact or 10 pF with the assumption stated in the trace. Add an engine test for one 10 kΩ module at 400 kHz.
- **Impact.** No current fixture changes outcome.

### Critical

None.

### Later (minor, 8)

- **L1.** In `modulechecks.ts:268`, a `level_shifter: true` fact with a non-verified status (interim or community) suppresses an R1/R2 Critical with only a trace line. The caution branch at line 309 checks for `verified`, but this branch does not. No catalog record triggers it today.
- **L2.** In `assess.ts:529`, when an analog IC has no `analog_range_v`, R8's sensor maximum falls back to the board logic voltage as `inferred`. R8 can then pass without any warning that the range was assumed.
- **L3.** `allow_reassign: true` ignores every lock (`solver.ts:319`). No warning reports that a locked pin moved.
- **L4.** In `unsat.ts`, the `sat()` oracle treats an exception, or a sub-solve that ran out of budget, as unsat. That could produce a conflict set that is not truly minimal. Consider propagating `budgetExhausted`.
- **L5.** `liveLocks` still filters properties (a) and (e) after the BUG-1/2 fix, so a BUG-1 regression would be masked there. Assert `liveLocks(...) === project.locked` for `ok` outcomes, or drop the filter.
- **L6.** R7 is never given `usbLimitMa`, so the USB-limit half of the rule is never evaluated by the engine.
- **L7.** First-principles hazard, owner-ruled (ruling 1). On an opto relay input (5 V → 1 kΩ → LED → IN), a floating or reset ESP32 pad sits near VCC − Vf (about 3.8 V). That holds GPIO12 high, selecting 1.8 V VDD_SDIO, and is above the 3.6 V abs max. The engine reports Caution only. Adding a `resting_level` catalog fact would make fixture 18 unsat again, as planned.
- **L8.** `packages/engine/dump.json` (47 KB debug output) is tracked in git. Remove it.
