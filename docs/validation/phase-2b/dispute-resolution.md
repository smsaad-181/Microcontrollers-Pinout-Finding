# Dispute resolution (owner rulings on `fixture-disputes.md`)

Every fixture edit carries a changelog line "2b ruling N" inside the fixture. No evidence id cited by a fixture was invalidated; no value was invented.
Result: harness 24 pass, 0 disputed.

| # | Ruling | What changed |
| --- | --- | --- |
| 1 | relay GPIO12: status ok + caution | `relay-opto-on-esp32-gpio12-strap-blocked-unsat`: `status: ok`, `warnings_include FLOATING_AT_RESET_UNKNOWN (caution)`, conflict/relaxation expectations removed; id and intent text kept, derivation says it returns to `unsat` if the catalog gets a `resting_level` |
| 2 | pico-w pots | token `consumed:GPIO29`; `different-board:` dropped from `pico-w-four-pots-no-free-adc-unsat` and `ads1115-nine-boards-i2c-address-space-unsat`; the prefix `different-board:` left the vocabulary (no fixture uses it; the engine still emits it when a board fits) |
| 3 | WROVER variant | see below |
| 4 | d1-mini A0 | `adc_ratio_board`, `adc_sensor_max_v_for_full_scale`, `attenuation` part dropped (also removed from `PROPERTY_KEYS`); Later: structured ADC divider fact |
| 5 | part kinds | `wire`, `attenuation` dropped from fixtures; `supply` added to the Recommendation `required_parts.kind` enum (schema, reference, test, docs/schema.md); the engine emits `supply` for `jd-vcc` and `separate-supply`; the harness alias to `regulator` is gone |
| 6 | `bus.<ROLE>` | `BUS_PSEUDO_INSTANCE`, `BUS_PSEUDO_ROLES`, `isSignalId` in `fixture-vocabulary.ts`; `FixtureSchema` now checks every `expect.exact` key (`<module instance>.<role>` or `bus.SCK/MOSI/MISO`); tests in `schema/test/round4.test.ts` |
| 7 | conditionals | `bme280-three-boards-second-bus-or-spi`: `env2`, `env3` forced to `interface: spi`; `d1-mini-boot-pins-gpio0-2-15-avoided`: `sw1.SW` locked on GPIO16 (+ `locked_pad_unchanged`). Both assertions are unconditional |
| 8 | port group | `pads` key dropped from `port_group_total_mA_limit` (30 mA kept) in `uno-r4-minima-opto-relay-pin-current`; the harness only reports an unchecked key if a fixture supplies `pads` |
| 9 | evidence list | 17 uncited ids removed from fixture 02; the test now requires every remaining id to be cited by a catalog fact (the pinned `UNCITED_BY_CATALOG` list is gone) |
| 10, 12-18 | interpretations | `interpretations.md` |
| 11 | pull direction | see below |

## Ruling 3: WROVER-E variant fixture (independent derivation)

Pad cost from the catalog (esp32 chip pads, esp32-wrover-e `consumed`, DevKitC V4 connectors; skill step 7, strap 1, JTAG 1, strap + JTAG = 2, strap fact in `conflict` = 2):
0 = GPIO18/19/21/22/23/25/26/27/32/33 and input-only GPIO34/35/36/39; 1 = GPIO0, GPIO5 (strap), GPIO13, GPIO14 (JTAG); 2 = GPIO15 (strap + MTDO), GPIO12 (strap + MTDI), GPIO2, GPIO4 (strap in conflict).
18 signals, 14 zero-cost pads, so at least 4 signals sit on pads of cost >= 1; only four pads cost exactly 1, so the optimum is 4 and uses exactly {GPIO0, 5, 13, 14}. GPIO0 takes a switch, which forces MISO onto an input-only pad
(matrix route, tier 2 = 1). With the SPI3 IO_MUX plan 18/23/19 the CS lines need GPIO15 (cost 2), so that plan scores 5: this is why the old assertion was wrong.
Engine optimum: score `[4,1,1,25]`, risk pads {0,5,13,14}: **it agrees with the hand derivation; no engine bug.** I also forced SPI3 18/23 with MISO on the matrix: same score `[4,1,1,25]`, so SCK/MOSI on 14/13 or on 18/23 is a pure
final tie-break, not a catalog fact. Hence `exact bus.SCK/MOSI/MISO` was removed (not guessed) and `switches_on` became `signal_pad_set_equals {sw1..sw4, bus.MISO} = {GPIO0, 34, 35, 36, 39}`;
`risk_pads_subset_of` is `[GPIO0, GPIO5, GPIO13, GPIO14]`; `risk_tier1_equals: 4` stays; `no_pad_in` gains GPIO2/12/15.

## Ruling 11: pull direction (engine never guesses)

- Schema: optional `active_level: Fact<'high' | 'low'>` on breakouts (`schema/src/ic.ts`, `docs/schema.md` regenerated with `pnpm docs:schema`, schema tests in `round4.test.ts`).
- Catalog, populated only where both keys stated it (2a reconcile): `relay-board-4ch-transistor` = high (`keyestudio-ks0058-wiki#active-high`), `relay-board-4ch-opto-jdvcc` = low (TS0011 p2/p7 pinout and sketch, SainSmart page, schematic). Both are `verified` with reviewers `hardware-researcher`, `hardware-fact-auditor`: the reconcile documents record both keys agreeing on polarity, but the auditor must confirm (below).
- Engine: a floating load pad takes its direction from a documented `resting_level` first, else `active_level` (high: pull-down, low: pull-up); neither: a `resistor/pull` part with direction unknown, a Caution `FLOATING_AT_RESET_UNKNOWN`, no pull-up or pull-down. Tests in `fixture-behaviours.test.ts` (high, low, unknown with the fact removed).
- `active_level` is not wired into R6: whether a floating input rests at its off level is still not a catalog fact (ruling 1).
- Fixture 02: expected parts unchanged (pull-down x4, now derived from the active-high fact); note and changelog updated.

## Side effect to confirm

`bme280-three-boards-second-bus-or-spi`: with two BME280 forced onto SPI the engine reports `MISO_SHARE_UNPROVEN` as Caution (two MISO drivers; Info is for one reader beside write-only devices, as in fixture 02). The fixture's level was changed from info to caution.
