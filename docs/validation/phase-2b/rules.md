# packages/rules (task 2b.1)

R1-R8 are pure functions in `packages/rules/src/rules.ts`. Each takes a typed context of `Fact`
values (`{ value, status, evidence[] }`) and returns `RuleResult { rule, level, passed, requiredParts,
trace, evidence, values, blocked?, riskTierDelta? }`. Levels: critical | warning | caution | info.

- Unknown inputs (status missing/conflict or no value) give `caution`, `passed=false`, no computed values.
- Limits are inclusive (relative float epsilon 1e-9). Pass is `info`/`passed=true`.
- Named formula constants only: 0.8473, tr_max by speed (1000/300/120 ns), Vin tolerance 0.05.
  No datasheet constants in rule code; VOL/IOL/Cb limits/VIH etc. are inputs.
- Disable support: `evaluateRule(id, ctx, { disabled })`, `runRules(ctxs, { disabled })`. Tests call
  rules through `test/helpers.ts`, which honours `DISABLE_RULE=Rn` (scripted gate: each of R1-R8
  makes 4-10 tests fail; verified).
- All test vectors T1-T18 covered (T13 NPN base resistor and T15 SPI clock are not R1-R8 checks;
  they are formula helpers for later tasks and are not implemented here).

## Formula ambiguities in the skill

1. R3 trMax for speeds between tiers or above 1 MHz: skill lists three points only. Rule uses the
   first tier with fMax >= speed (so 200 kHz uses 300 ns); > 1 MHz gives caution.
2. R3 Cb limit (400 pF / 550 pF Fm+) is passed as an optional fact, not hard-coded.
3. R5 "receiver VDD min" vs nominal and "VIH at VDD max": caller resolves both to volts; rule
   only compares. Rail-tolerance policy belongs to the engine.
4. R6 "blocked" is driven by an explicit `effect` input (boot-mode/flash-voltage); the skill does not
   say how a floating net resolves, so float takes the strap's internal default level.
5. R7 USB limit is compared against the sum of all rails; skill does not say per-rail.
6. T13 (NPN Rb) and T15 (SPI cap) have formulas but no R1-R8 rule; left for the engine tasks.
7. R4 skill gives no per-port aggregation shape; modelled as generic groups.
