# Phase 2b — Engine

**Goal:** the deterministic recommendation engine: variant resolution, interface selection, signal
expansion, constraint solver with rules R1–R8, lexicographic scoring, explanations, and
"no safe assignment" with minimal conflicts and suggested fixes.

Skills to load: `pin-allocation-engine`, `electrical-rules`, `interface-selection`,
`test-driven-development`, `systematic-debugging`, `golden-fixtures`.

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 2b.1 | `packages/rules`: R1–R8 as pure functions `(context) → RuleResult { level, passed, requiredParts[], trace[], evidence[] }`. Unit tests at exact boundaries from skill `electrical-rules` (test vectors table). TDD. | engine-developer | rules + tests |
| 2b.2 | Pin view composer: stack Chip → Module → Board to compute each pin's effective capabilities; never hand-typed. | engine-developer | composer |
| 2b.3 | Interface selection per module (rules 1–7 in skill `interface-selection`), producing candidate branches with reasons. | engine-developer | selector |
| 2b.4 | Signal expansion: role, direction, drive type, peripheral, max clock, shareability, resting level at reset. | engine-developer | expander |
| 2b.5 | CSP solver: domains, constraints (exclusive pins, bus grouping per peripheral instance, CS uniqueness, I2C address uniqueness, UART instances, ADC unit vs radio, R1–R8, locked pins), backtracking + forward checking + MRV, branch-and-bound on the lexicographic score, 2 s budget with deterministic tie-breaking. | engine-developer | solver |
| 2b.6 | Unsat path: minimal conflicting subset (QuickXplain-style deletion), ranked relaxations (share bus, change interface, lower clock to allow matrix routing, add MCP23017/PCF8574/ADS1115, change board). | engine-developer | explainer |
| 2b.7 | Explanation traces: each assignment lists rules checked + evidence ids; top 2–3 alternatives with the tier that ranked them lower; warnings in 4 levels. | engine-developer | traces |
| 2b.8 | Property tests (fast-check): random projects on MVP boards → every solution satisfies all hard constraints; "unsat" confirmed by brute force on small instances; locked pins never move; determinism (same input + catalog hash = identical output). | test-automator | property suite |
| 2b.9 | Run all golden fixtures from Phase 2a. **If a fixture fails, fix the engine, never the fixture** — unless `hardware-fact-auditor` confirms the fixture contradicts its cited source. | engine-developer | green fixtures |
| 2b.10 | Mutation testing (Stryker) on `packages/rules` and solver constraints; target ≥ 85 % mutation score on rules. | test-automator | report |
| 2b.11 | Performance: typical MVP project solve ≤ 200 ms on CI runner; record in `docs/validation/phase-2b/perf.md`. | engine-developer | perf report |

## Gate checklist

- [ ] `pnpm -r test` exit 0, including all golden fixtures and property tests (≥ 1,000 runs per property).
- [ ] The DevKitC V4 worked-example fixture passes (its `exact` pins, all `properties`, the five findings, required parts) and the WROVER-E variant fixture passes (`docs/research/worked-example-esp32-devkitc.md`).
- [ ] Removing any single rule (R1–R8) makes at least one test fail (mutation report or scripted rule-disable check).
- [ ] An over-subscribed project returns `unsat` with an *irreducible* conflict set (removing any member makes the project satisfiable — checked by re-solving), equal in size to the brute-force minimum on small fixtures, and ≥ 1 suggested relaxation.
- [ ] `packages/engine` and `packages/rules` have no imports from DOM, React, `fetch`, or Node network modules (dependency-cruiser or grep check).
- [ ] Solve time p95 ≤ 200 ms on the fixture set (CI log evidence).

## Validators (run in parallel)

- `electrical-calc-verifier` — independently recompute every rule threshold and every number in rule test vectors and fixture expectations; compare with engine output.
- `hardware-fact-auditor` — check that every evidence id cited in engine traces for the worked example really supports the claim it is attached to.
- `phase-validator` — gate commands, determinism, import boundaries, perf.
- `code-reviewer` — solver correctness review, especially constraint completeness and tie-breaking.
