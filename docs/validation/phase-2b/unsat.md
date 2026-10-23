# Phase 2b unsat path (task 2b.6)

Code: `packages/engine/src/unsat.ts` (analysis), `solver.ts` (`solveOnce` raw solve, `solveDetailed` wraps it); tests `packages/engine/test/{unsat.test.ts,bruteforce.ts}`.

## Minimal conflicting subset

- Removable members: each module instance, each forced `interface`, each locked pin, each reserved pad, the Wi-Fi flag. Catalog/board facts (strap, consumed, input-only, ADC2 radio) are not removable; they appear as cause tokens.
- QuickXplain over the members with the solver as oracle (sub-project `ok` = satisfiable), then a deletion pass that re-solves without each member and drops any whose removal leaves it unsat. Result: irreducible by construction.
- Tokens = member tokens (`locked:inst.ROLE=PAD`, `reserved:PAD`, `interface:inst:kind`) + cause tokens from the solve of the minimal sub-project (`strap:`, `consumed:`, `input-only:`, `adc2-wifi:`, `adc:N-analog-signals-vs-M-adc-pads`, `pads:`, `i2c-address:<breakout>:<n>-devices-vs-<m>-addresses`, `i2c-controllers:<chip>:<n>`). ADC pads the board hides from the header (Pico W GPIO29) are reported as `consumed:`.
- Not run when the search budget ran out (the raw `budget:exhausted` result is kept).

## Relaxations

Each candidate edit is applied to the full project and listed only when re-solving returns `ok`. Ranking (lower first, ties by token): 1 `unlock:`, `unreserve:`, `share-bus:<inst>` (drop a forced address strap); 2 `change-interface:<inst>=<kind|auto>`; 3 `add-i2c-multiplexer` (8 channels, modelled by `SolveOptions.i2cMux`), `add-external-adc:<breakout>` / `add-io-expander:<breakout>` (the part is added and up to 4 / 8 offloadable modules leave the MCU pins); 4 `different-variant:`; 5 `wifi:false`; 6 `different-board:<id>` (another board id, any variant); 7 `remove-module:<breakout>` (one instance). Rationale: keep hardware and features first, add parts before giving up a feature, change board or delete a function last.
"Lower the clock to allow matrix routing" is not offered: a matrix route only lowers the clock (tier-2 cost) and never makes a project unsat in this model.

## Verification

Per unsat case (4 pots Pico W, same plus unrelated modules/reserved pads, ADC2 lock with Wi-Fi, nine ADS1115, button on PSRAM pad, output on input-only GPIO34): expected tokens and relaxations, irreducibility by re-solving, equal to the brute-force minimum (`bruteForceMinimum` enumerates subsets by size), determinism. Sizes found = brute force: 4, 4, 3, 9, 2, 2.

## Open points

- Fixture `relay-opto-on-esp32-gpio12-strap-blocked-unsat` solves `ok` (resting level of the opto relay is not a catalog fact, R6 gives Caution), so no GPIO12 unsat exists to analyse yet.
- Pico W fixture expects `reserved:GPIO29`; the catalog calls it consumed, the engine emits `consumed:GPIO29` (fixture left alone).
- Fixture `different-board:<current board id>` tokens name the current board; the engine only lists boards verified to be satisfiable (none for the 4-pot and nine-ADS fixtures).
- New relaxation tokens outside `fixture-vocabulary.ts`: `unreserve:`, `share-bus:`, `change-interface:`, `add-io-expander:` (no expander breakout in the catalog yet, so untested).
