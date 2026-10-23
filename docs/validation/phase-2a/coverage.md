# Phase 2a coverage

Source: `pnpm catalog:validate` at the end of Phase 2a (119 files, 0 errors, 0 warnings).

| status | facts |
| --- | --- |
| verified (two keys) | 789 |
| single-source | 1 |
| conflict (stricter reading active) | 42 |
| interim | 8 |
| missing | 212 |
| **total** | **1052** |

## Boards (all `partially-verified`)

raspberry-pi-pico@Rev3, raspberry-pi-pico-w@Rev3, esp32-devkitc-v4@V4, esp32-s3-devkitc-1@V1.1,
lolin-d1-mini@V4.0.0, arduino-uno-r4-minima@V1.2.

## Two-key done

Chips (RP2040, ESP32, ESP32-S3, ESP8266EX, RA4M1), modules, the six boards, BME280 + Adafruit breakout,
SSD1306, MFRC522, HC-SR04, ADS1115 + Adafruit breakout, SRD-05VDC-SL-C relay.

## Not verifiable yet (waiting on manual PDFs, see `sources/manual/README.md`)

- Arduino UNO R3 / ATmega328P (row 1): board not in the catalog.
- MPU-6050 and GY-521 (row 4): every fact missing.
- DS18B20, DHT22 (rows 5, 6): no records yet.
- ST7735S: official PDF not obtained; V1.3 copy is an unofficial mirror, facts stay `interim`/`conflict`.
- Keyestudio KS0058 transistor relay board (row 7): every fact missing.
- Push button and potentiometer: datasheet ratings do not match the schema fields, so facts are missing.
- Generic breakouts (GY-BME280, GY-521, SSD1306, RC522, ST7735S modules): no vendor document, facts missing.

## Golden fixtures

24 fixtures in `catalog/fixtures/` (target 20); list and weakened cases in `fixtures.md`.
Fixtures have not been run through an engine (Phase 2b).
