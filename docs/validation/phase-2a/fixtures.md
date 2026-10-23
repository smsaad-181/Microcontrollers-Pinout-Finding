# Phase 2a golden fixtures (24)

All in `catalog/fixtures/`; `pnpm catalog:validate` passes (0 errors, 0 warnings). Written from catalog facts only; a missing fact gives a Caution/unknown, never an invented number.

## Existing (01-16)
- devkitc-wroom32e-bme280-ssd1306-i2c (01): DevKitC V4 WROOM-32E, BME280 + SSD1306 on one I2C bus.
- devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches (02): canonical worked example.
- devkitc-v4-wrover-e-variant-change (03): same project on WROVER-E, GPIO16/17 PSRAM.
- uno-r4-minima-opto-relay-pin-current (04): opto relay on R4, 4 vs 8 mA pin-current conflict.
- uno-r4-minima-d13-onboard-led-load: R4 D13 onboard LED load.
- pico-w-reserved-gpio23-24-25-29: Pico W never assigns GP23-25, 29.
- pico-w-four-pots-no-free-adc-unsat (07): 4 pots, 3 ADC pads, unsat.
- d1-mini-a0-potentiometer-adc-fit (09): pot on A0, 3.2 V full scale.
- d1-mini-boot-pins-gpio0-2-15-avoided (10): loads avoid GPIO0/2/15.
- d1-mini-ssd1306-i2c-pad-ambiguity (11): two documented I2C pad sets.
- bme280-two-boards-address-strap (12): same address, SDO strap.
- bme280-three-boards-second-bus-or-spi (13): third BME280 needs bus 2 or SPI.
- bme280-two-4pin-modules-unknown-address (14): no SDO exposed, address unprovable.
- i2c-pullup-stack-ten-kohm-five-boards: stacked onboard pull-ups, Rp,min.
- pico-i2c-bme280-ssd1306: Pico I2C pair.
- ads1115-nine-boards-i2c-address-space-unsat (16): 9 > 8 addresses, unsat.

## New (17-24)
- hc-sr04-echo-into-esp32-level-unknown (17): ok + LOGIC_LEVEL_UNKNOWN caution, no divider part.
- relay-opto-on-esp32-gpio12-strap-blocked-unsat (18): relay locked on MTDI GPIO12, unsat.
- relay-opto-on-esp32-clean-pads-split-supply (19): 4 opto relays on clean pads, JD-VCC separate supply.
- esp32-button-on-input-only-gpio34 (20): external pull-up required.
- esp32-pot-adc2-wifi-unsat (21) / esp32-pot-adc2-no-wifi-ok (22): ADC2 vs Wi-Fi pair.
- esp32-s3-n8r8-gpio36-psram-unsat (23) / esp32-s3-n8-gpio36-ok (24): octal PSRAM pair.

## Weakened because a fact is missing
- 17: echo_voh and TRIG vih missing -> Caution instead of divider accept/reject.
- 19: LED Vf, coil current, 5 V rail current missing -> Cautions only; relay resting level inferred.
- 18: relay resting level inferred (interim); conflict relies on it plus the strap fact.
- 04, 10 (earlier): LED current uncomputable; GPIO0/2/15 strap facts missing.
- 20, 24: no pull-up value (push-button pullups missing); S3 internal pull not asserted.

## Known gaps
- No registry of warning codes or `expect.properties` keys; fixtures 17-24 add proposed ones (`required_parts_exclude`, `no_warning_code`, `supply_split`, `required_parts` kind `supply`, conflict tokens `locked:`/`strap:`/`consumed:`/`adc2-wifi:`). The schema rejects unknown top-level `expect` keys, so these live under `properties`.
- Repeated roles need `COIL[1]`-style ids; the `locked` role form `"COIL[1]"` is assumed.
- No library-default pad fact (e.g. default I2C/SPI pads per framework).
- GPIO2 strap conflict (`required_at_reset` any vs low) affects the WROVER DC/RST claim.
- ADS1115 has no address-strap list.
- Adafruit BME280 sensor-side pull-up is not modelled.
- Uno R3 is absent, so Uno R3 vs R4, Uno R3 SPI, 20-relay unsat and ESP32 -> Uno logic-link fixtures cannot be written.
