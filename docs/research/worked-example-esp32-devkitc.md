# Golden worked example — ESP32-DevKitC V4 project

Source: `docs/PLAN.md` → "Worked validation". This is the canonical end-to-end expectation for the
engine (Phase 2b gate) and the UI (Phase 3 gate). `fixture-author` converts it to
`catalog/fixtures/devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches.yaml` after re-verifying each
cited fact in Phase 2a.

## Inputs

- Board: ESP32-DevKitC V4, module ESP32-WROOM-32E (not WROVER). Wi-Fi in use.
- Modules: GY-BME280 6-pin (I2C chosen), blue RFID-RC522 (SPI hardwired), ST7735S 1.8" SPI TFT
  (write-only, 4-line SPI), 4-channel 5 V relay board with transistor inputs, 4 push buttons to GND.

Removed before solving: GPIO6–11 (flash), GPIO1/3 (UART0 ↔ USB bridge). Straps 0, 2, 4, 12, 15 are
last-resort only.

## Expected allocation (preferred answer; see the note below the table for which parts are exact)

| Device | Signal | GPIO | Header | Reset state (TRM 6.10-1) | Reason |
| --- | --- | --- | --- | --- | --- |
| BME280 | SDA | 21 | J3-6 | input | free, non-strap, library default |
| BME280 | SCL | 22 | J3-3 | input | same |
| SPI bus | SCLK | 18 | J3-9 | input | SPI3 IO_MUX |
| SPI bus | MOSI | 23 | J3-2 | input | SPI3 IO_MUX |
| SPI bus | MISO | 19 | J3-8 | input | SPI3 IO_MUX; RC522 only (TFT write-only) |
| ST7735S | CS | 5 | J3-10 | pull-up | SPI3 CS0; strap default high = CS idle high → R6 pass (risk +1) |
| ST7735S | DC | 16 | J3-12 | input | valid only on WROOM |
| ST7735S | RST | 17 | J3-11 | input | valid only on WROOM |
| RC522 | SDA/CS | 14 | J2-12 | pull-up | deselected during boot; JTAG MTMS (caution if JTAG used) |
| RC522 | RST | 33 | J2-8 | input disabled, floating | last clean pad; logic input, not a load |
| Relays 1–4 | IN1–IN4 | 25, 26, 27, 32 | J2-9, J2-10, J2-11, J2-7 | input disabled, floating | output-capable, non-strap; need pull-down |
| Switches 1–4 | SW1–SW4 | 34, 35, 36, 39 | J2-5, J2-6, J2-3, J2-4 | input-only, no pulls | external pull-ups required |

Spare: GPIO13 (JTAG); GPIO4, 2, 15, 0, 12 (straps).
18 signal pins used. 14 signals need output-capable pads but only 12 clean pads exist
(16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33), so tier-1 risk = 2 is the optimum. The risk pads
here are GPIO5 (strap, compatible as idle-high CS; also the Arduino-ESP32 default SS — verify in
Phase 2a) and GPIO14 (JTAG). Other tier-equal pairs from {5, 13, 14, 2, 15} are valid, so the fixture
uses `properties` for these two pads and `exact` only for the IO_MUX SPI pins.

## Expected findings

1. **Warning I2C_RISE_TIME** — if the module has 10 kΩ pull-ups: 400 kHz fails (Rp,max 7.08 kΩ at
   50 pF). Fix: 100 kHz, or add 4.7 kΩ (3.20 kΩ effective).
2. **Warning FLOATING_AT_RESET_LOAD** — relays on 25/26/27/32 float at reset. Fix: 10 kΩ to GND per
   input unless the module record shows a pull-down.
3. **Warning RAIL_5V_BUDGET** — 4 × 89.3 mA = 357 mA worst case (286 mA for 0.36 W relays) on USB 5 V.
   Fix: separate 5 V supply, common ground.
4. **Warning RAIL_3V3_BUDGET** — MFRC522 up to 119 mA (100 + 9 + 10 mA max) plus ESP32 radio peaks and
   TFT. Fix: 10 µF at RC522; separate 3.3 V regulator if over the board regulator rating
   (rating from DevKitC V4 schematic — to be recorded in Phase 2a).
5. **Caution ERRATUM_GPIO_3_11** — SW3/SW4 on GPIO36/39 can see ~80 ns low pulses when SAR ADC/AMP
   power on. Fix: 10 ms software debounce or polling.

Required parts: 4 × 10 kΩ pull-ups on switches (GPIO34–39 have no internal pulls); optional 100 nF per
switch.

## Variant behaviour

Module changed to **WROVER-E** → GPIO16/17 unavailable (PSRAM). Expected: tier-1 risk rises to 4;
DC/RST move to GPIO13 (JTAG) and GPIO2 (strap; TFT RST is an input that does not drive the line, and
GPIO2's reset pull-down simply holds the display in reset → R6 pass). GPIO4 is avoided: strap +
`conflict` status counts 2.

## Interface choice

BME280: I2C chosen by rule 4 (spare pins ≥ 3 so rule 3's 1-pin saving is ignored); SPI listed as valid
alternative saving one pin.
