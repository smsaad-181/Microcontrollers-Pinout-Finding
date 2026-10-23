# Golden-fixture run (task 2b.9)

Harness: `packages/engine/test/fixtures.test.ts`. Result after the owner rulings (`dispute-resolution.md`): **24 pass, 0 disputed, 0 fail, 0 unchecked keys** of 24.

| Fixture | State |
| --- | --- |
| ads1115-nine-boards-i2c-address-space-unsat | pass |
| bme280-three-boards-second-bus-or-spi | pass |
| bme280-two-4pin-modules-unknown-address | pass |
| bme280-two-boards-address-strap | pass |
| d1-mini-a0-potentiometer-adc-fit | pass |
| d1-mini-boot-pins-gpio0-2-15-avoided | pass |
| d1-mini-ssd1306-i2c-pad-ambiguity | pass |
| devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches | pass |
| devkitc-v4-wrover-e-variant-change | pass |
| devkitc-wroom32e-bme280-ssd1306-i2c | pass |
| esp32-button-on-input-only-gpio34 | pass |
| esp32-pot-adc2-no-wifi-ok | pass |
| esp32-pot-adc2-wifi-unsat | pass |
| esp32-s3-n8-gpio36-ok | pass |
| esp32-s3-n8r8-gpio36-psram-unsat | pass |
| hc-sr04-echo-into-esp32-level-unknown | pass |
| i2c-pullup-stack-ten-kohm-five-boards | pass |
| pico-i2c-bme280-ssd1306 | pass |
| pico-w-four-pots-no-free-adc-unsat | pass |
| pico-w-reserved-gpio23-24-25-29 | pass |
| relay-opto-on-esp32-clean-pads-split-supply | pass |
| relay-opto-on-esp32-gpio12-strap-blocked-unsat | pass |
| uno-r4-minima-d13-onboard-led-load | pass |
| uno-r4-minima-opto-relay-pin-current | pass |

## Engine changes

- **Search**: exact lower bound by minimum-cost assignment (`assignment.ts`, Hungarian method over the folded 4-tier cost). The worked example exhausted the 200 000-node budget before (risk 17); it now solves in one dive with no backtracking. Candidate order and tie-breaks are unchanged.
- **Optional IRQ**, **USB-UART detection** (one onboard part must tie both UART pads; ESP8266 UART1 was wrongly "USB"), **SDO-default address** (free-text "pulled up" -> 0x77 first), **rule 5 under override**.
- **Scoring**: ESP32 GPIO errata reported not scored (`ERRATUM_GPIO_3_11` Caution); undocumented strap = +1; load on a strap pad +1; unproven boot-mode/flash-voltage strap level +1; floating load = pull resistor part, no risk; onboard circuitry = tier 3; CS on an IO_MUX `cs*` pad spares the tier-4 SPI cost.
- **Warnings**: `FACT_CONFLICT_RELIED` and `ONBOARD_LOAD_ON_PAD` are Caution; `FLOATING_AT_RESET_UNKNOWN` when a load's off level is undocumented; `LEVEL_SHIFTER_CONFLICT_RELIED` / `LEVEL_SHIFTER_UNKNOWN` when levels cannot be verified; `MISO_SHARE_UNPROVEN` Info (one reader) or Caution (several); `I2C_ADDRESS_SDA_STRAP_TIMING`; `NO_INTERNAL_PULL_UP_ON_GPIO16`; R3 uses VOL 0.4 V (I2C spec).
- **Parts**: `resistor/pull-down|pull-up` for floating loads, `regulator/jd-vcc` (separate coil supply) while the rail budget is unproven on a breakout with a second supply pin.
- **API**: `solveDetailed(...).details` (`SolveDetails`: I2C placement, module rule values, per-instance clock ceiling, current limits) for tests and UI; the Recommendation schema is unchanged. Ruling changes: `supply` part kind, `active_level` breakout fact (pull direction), `bus.<ROLE>` signal ids; see `dispute-resolution.md`.
- **Evidence**: assignments carry the claims behind excluded pads (consumed, USB bridge, PSRAM), routing limits, device supply range and passed-over onboard circuitry. Test: every fixture-02 evidence id that a catalog fact cites appears in the engine trace; ruling 9 removed the 17 ids no catalog fact cites from the fixture, so every id is now checked.
