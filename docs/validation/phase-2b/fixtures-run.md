# Golden-fixture run (task 2b.9)

Harness: `packages/engine/test/fixtures.test.ts` (prints this table with `vitest run --silent=false`). Result: **15 pass, 9 disputed, 0 fail, 0 unchecked keys** of 24.
Disputed = every deviation is listed in `fixture-disputes.md` (owner decides); the suite fails if a fixture fails, has an unchecked key, or a dispute is undocumented or stale.

| Fixture | State | Disputed assertion (see fixture-disputes.md item) |
| --- | --- | --- |
| ads1115-nine-boards-i2c-address-space-unsat | disputed | `different-board:` names the current board (2) |
| bme280-three-boards-second-bus-or-spi | disputed | `MISO_SHARE_UNPROVEN` is conditional on SPI (7) |
| bme280-two-4pin-modules-unknown-address | pass | |
| bme280-two-boards-address-strap | disputed | part kind `wire` (5) |
| d1-mini-a0-potentiometer-adc-fit | disputed | `adc_ratio_board`, `adc_sensor_max_v_for_full_scale`, kind `attenuation` (4, 5) |
| d1-mini-boot-pins-gpio0-2-15-avoided | disputed | `NO_INTERNAL_PULL_UP_ON_GPIO16` is conditional on sw1 on GPIO16 (7) |
| d1-mini-ssd1306-i2c-pad-ambiguity | pass | |
| devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches | pass | |
| devkitc-v4-wrover-e-variant-change | disputed | bus pads, `switches_on`, risk subset: GPIO15 costs 2 (3) |
| devkitc-wroom32e-bme280-ssd1306-i2c | pass | |
| esp32-button-on-input-only-gpio34 | pass | |
| esp32-pot-adc2-no-wifi-ok | pass | |
| esp32-pot-adc2-wifi-unsat | pass | |
| esp32-s3-n8-gpio36-ok | pass | |
| esp32-s3-n8r8-gpio36-psram-unsat | pass | |
| hc-sr04-echo-into-esp32-level-unknown | pass | |
| i2c-pullup-stack-ten-kohm-five-boards | pass | |
| pico-i2c-bme280-ssd1306 | pass | |
| pico-w-four-pots-no-free-adc-unsat | disputed | `reserved:GPIO29` vs consumed; `different-board:` names itself (2) |
| pico-w-reserved-gpio23-24-25-29 | pass | |
| relay-opto-on-esp32-clean-pads-split-supply | pass | kind `supply` mapped to `regulator` by the harness (5) |
| relay-opto-on-esp32-gpio12-strap-blocked-unsat | disputed | status, tokens, relaxation: resting level not a catalog fact (1) |
| uno-r4-minima-d13-onboard-led-load | pass | |
| uno-r4-minima-opto-relay-pin-current | disputed | port-group pad list only in note text (8); mA checked |

## Engine changes

- **Search**: exact lower bound by minimum-cost assignment (`assignment.ts`, Hungarian method over the folded 4-tier cost). The worked example exhausted the 200 000-node budget before (risk 17); it now solves in one dive with no backtracking. Candidate order and tie-breaks are unchanged.
- **Optional IRQ**, **USB-UART detection** (one onboard part must tie both UART pads; ESP8266 UART1 was wrongly "USB"), **SDO-default address** (free-text "pulled up" -> 0x77 first), **rule 5 under override**.
- **Scoring**: ESP32 GPIO errata reported not scored (`ERRATUM_GPIO_3_11` Caution); undocumented strap = +1; load on a strap pad +1; unproven boot-mode/flash-voltage strap level +1; floating load = pull resistor part, no risk; onboard circuitry = tier 3; CS on an IO_MUX `cs*` pad spares the tier-4 SPI cost.
- **Warnings**: `FACT_CONFLICT_RELIED` and `ONBOARD_LOAD_ON_PAD` are Caution; `FLOATING_AT_RESET_UNKNOWN` when a load's off level is undocumented; `LEVEL_SHIFTER_CONFLICT_RELIED` / `LEVEL_SHIFTER_UNKNOWN` when levels cannot be verified; `MISO_SHARE_UNPROVEN` Info (one reader) or Caution (several); `I2C_ADDRESS_SDA_STRAP_TIMING`; `NO_INTERNAL_PULL_UP_ON_GPIO16`; R3 uses VOL 0.4 V (I2C spec).
- **Parts**: `resistor/pull-down|pull-up` for floating loads, `regulator/jd-vcc` (separate coil supply) while the rail budget is unproven on a breakout with a second supply pin.
- **API**: `solveDetailed(...).details` (`SolveDetails`: I2C placement, module rule values, per-instance clock ceiling, current limits) for tests and UI; the Recommendation schema is unchanged. No change to `fixture-vocabulary.ts` was needed.
- **Evidence**: assignments carry the claims behind excluded pads (consumed, USB bridge, PSRAM), routing limits, device supply range and passed-over onboard circuitry. Test: every fixture-02 evidence id that a catalog fact cites appears in the engine trace; the 17 that no catalog fact cites are a pinned list (dispute 9).
