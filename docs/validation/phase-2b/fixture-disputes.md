# Fixture disputes (task 2b.9)

Fixtures and catalog were not edited. Each item below is an assertion the engine does not meet, with the catalog evidence and what the fixture
(or catalog) should say. The owner decides; `packages/engine/test/fixtures.test.ts` (`DISPUTES`) fails if a disputed fixture is not named here, or if a
listed deviation stops occurring. Run table: `fixtures-run.md`.

## A. Fixture contradicts the catalog or itself

1. **relay-opto-on-esp32-gpio12-strap-blocked-unsat** - asserts `status: unsat`, tokens `locked:relays.COIL[1]=GPIO12`, `strap:GPIO12`, relaxation `unlock:relays.COIL[1]`.
   Engine: `ok`. The blocked verdict needs the relay input's resting level at reset (VCC via the opto LED path). The catalog has no `resting_level` on
   `srd-05vdc-sl-c` or `relay-board-4ch-opto-jdvcc` (only `push-button` has one), so R6 gives Caution (`FLOATING_AT_RESET_UNKNOWN`) and the lock is honoured.
   Fixture should say: `status: ok` + `FLOATING_AT_RESET_UNKNOWN` caution, **or** the catalog gains a `resting_level: high` (interim) fact on the opto coil signal and the fixture keeps `unsat`.
2. **pico-w-four-pots-no-free-adc-unsat** - (a) token `reserved:GPIO29`: the catalog records GPIO29 as module-`consumed` (CYW43439 WL_CLK), not a user reservation; the engine emits `consumed:GPIO29`
   (`reserved:` is for the project's own `reserved` pads). Fixture should say `consumed:GPIO29`. (b) relaxation `different-board:raspberry-pi-pico-w` names the current board; its own comment says
   "a board with more ADC pads is needed". The engine only lists boards verified to solve the project (none in the catalog). Same for **ads1115-nine-boards-i2c-address-space-unsat**: `different-board:esp32-devkitc-v4` is the current board.
   Fixture should drop both, or the catalog needs a board that satisfies the project.
3. **devkitc-v4-wrover-e-variant-change** - risk 4 holds (engine 4), but the fixture's reason does not: it prices GPIO15 as "strap 1", while the catalog also has `jtag: MTDO` on GPIO15, so strap + JTAG = 2
   (skill `pin-allocation-engine` step 7 counts both). With GPIO15 at 2 the SPI3 IO_MUX plan (18/23/19) scores 5; the engine's optimum 4 puts SCK/MOSI on the HSPI IO_MUX pads GPIO14/13 (JTAG, 1 each) and MISO via the matrix
   on input-only GPIO36, which pushes one switch to GPIO0. Disputed assertions: `bus.SCK/MOSI/MISO` (18/23/19), `switches_on` (34/35/36/39), `risk_pads_subset_of` (GPIO0). Fixture should say either risk 5 with the
   SPI3 plan, or count a strap+JTAG pad once (then the engine must change; say which).
4. **d1-mini-a0-potentiometer-adc-fit** - `adc_ratio_board: 0.3125` and `adc_sensor_max_v_for_full_scale: 3.2`: the A0 divider R12 220 k / R13 100 k and the 3.2 V statement exist only in the board's free-text
   `onboard.effect` and header comment, not as a numeric fact, so the engine cannot check them. Catalog needs a structured ADC divider (or the fixture should drop both keys). The engine does emit `ADC_OVER_RANGE` (warning) and `ADC_RADIO_UNKNOWN`.

## B. Vocabulary / schema gaps

5. **Part kinds `wire`, `attenuation`, `supply`** are not in the schema's required-part kinds. The harness maps `supply` to `regulator` (engine emits `regulator`/`jd-vcc`, fixture 19 passes) and cannot map `wire`
   (`bme280-two-boards-address-strap`, address strap) or `attenuation` (`d1-mini-a0-potentiometer-adc-fit`, `limit-pot-supply`). Either add the kinds to the schema or reword the fixtures (`wire` is already covered by `address_straps_distinct`).
6. **`bus.SCK` / `bus.MOSI` / `bus.MISO` in `exact`** (fixtures 02, 03) are pseudo-instances; real signals are `rfid.SCLK`, `tft.SCLK` ... The harness resolves `bus.<ROLE>` to the SPI bus net (works, fixture 02 passes);
   the vocabulary should name this form or the fixtures should use `rfid.SCLK` etc.
7. **Conditional assertions written as unconditional** (the fixture comment says "only if"): `bme280-three-boards-second-bus-or-spi` expects `MISO_SHARE_UNPROVEN` "only if the SPI resolution shares MISO" (engine resolves the third sensor with a second
   I2C controller, rule 5 order, so no SPI); `d1-mini-boot-pins-gpio0-2-15-avoided` expects `NO_INTERNAL_PULL_UP_ON_GPIO16` "only if sw1 lands on GPIO16" (engine puts it on GPIO5). The engine behaviour exists and is unit-tested
   (`fixture-behaviours.test.ts`, switch locked to GPIO16). Vocabulary needs a conditional form (`warnings_include_if`) or the fixtures should lock the pad.
8. **`port_group_total_mA_limit.pads`** (`uno-r4-minima-opto-relay-pin-current`): the pad list of the 30 mA group exists only in the `port_current_max` note text; the mA value (30) is checked, the pad list is not.

## C. Catalog gap behind the worked-example evidence list

9. Fixture 02 lists 24 evidence ids; 7 are cited by catalog facts and appear in the engine trace (checked by test). **17 are cited by no catalog fact** (they exist only in `catalog/evidence` and the fixture), so no trace can carry them:
   `bme280-ds-1.24#i2c-address`, `esp-idf-spi-master-v6.1#iomux-pins-main`, `esp-idf-spi-master-v6.1#matrix-routing`, `esp32-devkitc-v4-ug#j2-11-13`, `#j2-5-8`, `#j2-8-11`, `#j3-6-10`, `#note-flash-pins`, `#note-gpio16-17-wroom`,
   `esp32-errata-v3.1#gpio-3-11`, `#gpio-3-11-workaround`, `keyestudio-ks0058-wiki#active-high`, `mfrc522-ds-v3.9#spi-pins`, `#supply-current-digital-analog`, `omron-b3f-ds-a070-e1-08#contact-form`,
   `songle-srd-ds-circuitbasics#coil-5v-d-current`, `st7735-ds-v2.1#pin-dcx-resx`. The catalog should cite them on the matching facts (connector pins, errata, IO_MUX pins, relay polarity, button contact form), or the fixture should drop them.

## D. Interpretations the engine made (fixtures pass; please confirm)

10. **Errata and tier-1 risk.** Skill step 7 counts "pads with errata"; fixture 02 needs GPIO36/39 (GPIO-3.11, also 3.6/3.14) at zero risk with a Caution `ERRATUM_GPIO_3_11`, and fixture 06 needs RP2040-E11 on the ADC pads to score 3.
    Engine: ESP32 GPIO-3.6/3.11/3.14 are reported only (3.11 as the Caution); any other non-chip-wide erratum costs 1 per pad.
11. **Relay pull-down direction.** Fixture 02 wants `resistor/pull-down` x4 for relay inputs that float with an undocumented off level. The only polarity statement ("active at HIGH", keyestudio) is free text, so the engine
    adds a pull-down for any floating load whose off level is not a catalog fact (a pull-up when the catalog says `resting_level: high`); the note says GND is assumed for an active-high board. For an active-low opto board a pull-down would energise the relay, which is why a structured active level is needed.
12. **CS lines onto strap pads.** Fixture 02 expects the CS lines on GPIO5. The catalog has no idle level for CS (so R6 cannot pass it); the engine gets the same answer from three scoring rules: a load on a strap pad costs +1 more, a strap pad that
    sets boot mode or flash voltage with an unproven level costs +1 more, and a CS line on an IO_MUX `cs*` pad of an SPI instance does not pay the tier-4 "SPI pin used" cost.
13. **Undocumented strap = strap (+1).** ESP8266 GPIO0/2/15 have no strap fact (fixture 10 treats them as risk pads); the engine counts `status: missing` strap as a risk and warns `STRAP_FACT_MISSING`.
14. **Rule 5 under a user override.** Fixture 12 forces `interface: i2c` on both BME280 and expects `interface_decided_by_rule: 5`. Engine: two selectable-address modules sharing a bus get `decided_by_rule: 5` (address strap) even when rule 7 fixed the interface.
15. **Level-shifter Cautions.** Fixtures 04, 08, 13, 15, 19 expect `LEVEL_SHIFTER_CONFLICT_RELIED` / `LEVEL_SHIFTER_UNKNOWN` although no R1/R2 failure occurs. Engine: when a module's logic levels cannot be verified (R2 Caution) and the breakout's shifter fact is `conflict`
    or not verified (missing/interim), it says so. Fixture 04 (5 V Uno + 5 V relay board) gets it too.
16. **GPIO16 pull table.** "Internal pull-down only" is in free text (claim `esp8266ex-ds-v7.1#pull-config`); `assess.ts` keeps a one-entry table (esp8266ex, GPIO16). A structured pad field would replace it.
17. **Optional IRQ.** A module output named IRQ/INT/ALERT gets no pad unless the user locks one (worked example wires 18 signals, not 19). Say so in the vocabulary if this is intended.
18. **I2C VOL.** R3 sizes Rp,min with VOL = 0.4 V (I2C spec, same status as the 3 mA IOL constant), the larger of that and the MCU's VOL; fixture 15 needs 966.7 ohm.
