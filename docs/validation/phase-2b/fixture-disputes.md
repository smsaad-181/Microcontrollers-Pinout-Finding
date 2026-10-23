# Fixture disputes (task 2b.9)

All 18 disputes were ruled on by the owner; see `dispute-resolution.md` for each ruling and the edit it caused, and `interpretations.md` for the
accepted engine interpretations (10, 12-18). No fixture is disputed any more: the harness (`packages/engine/test/fixtures.test.ts`, `DISPUTES = {}`) reports
24 pass. The `DISPUTES` mechanism stays: a disputed fixture must be named in this file.

## Resolved (ruling in `dispute-resolution.md`)

1-9 and 11 are resolved by fixture, schema or engine edits. 10 and 12-18 are accepted interpretations.

## Deferred

- **Structured ADC divider fact** (ruling 4): the A0 divider of the D1 mini (R12 220 k / R13 100 k, 3.2 V full scale) is free text in the board record; once the catalog has a
  structured fact, `adc_ratio_board` and `adc_sensor_max_v_for_full_scale` return to fixture `d1-mini-a0-potentiometer-adc-fit`.
- **Relay resting level** (ruling 1): if the catalog later states `resting_level: high` for the opto coil input, fixture
  `relay-opto-on-esp32-gpio12-strap-blocked-unsat` returns to `unsat` (its changelog and derivation say how).
