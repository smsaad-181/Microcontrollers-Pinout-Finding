# Phase 2a - phase-validator report

Worktree: pinout-finder-2a, branch phase-2a, HEAD 3de80c6. Mode: "faster" (automatic gates plus one independent reviewer; only Critical/Major block).

VERDICT: FAIL (0 Critical, 3 Major, 8 Minor). All three Major items are scope or label gaps rather than wrong values; no sampled fact was wrong.

## 1. Gate commands (run fresh)

| Command | Result |
| --- | --- |
| pnpm catalog:validate | exit 0, 0 errors, 0 warnings, 119 files |
| pnpm test | exit 0, 25 files, 1023 passed, 1 skipped |
| pnpm lint | exit 0 |
| pnpm typecheck | exit 0 |
| pnpm format:check | exit 0 |

## 2. Binaries and secrets

- `git ls-files` shows no pdf/png/jpg/jpeg/rar/zip/gif/webp anywhere. sources/cache is git-ignored (checked `git check-ignore`). PASS.
- Token-pattern scan of tracked files (ghp_, github_pat_, sk-, AKIA, private-key headers, api_key=value): no hits. `.mcp.json` only references `${CONTEXT7_API_KEY:-}`. PASS.

## 3. Fact re-check against source documents

Method:
1. Mechanical pass: for all 874 evidence claims, I mapped each evidence record to its cached file by SHA-256 and searched the extracted text for the quote. 740 matched verbatim, ignoring punctuation and whitespace. Of the 134 that did not match, I reviewed the ones from text-bearing PDFs by hand. They are pdftotext layout artifacts (table columns split, "×" and "Ω" glyphs) or schematic and figure text. I confirmed the values in the source for the ones listed below.
2. Page check: 364 of 428 locatable quotes sit on the cited PDF page. The other 64 are off by one page (see Minor 1).
3. Manual value re-check of 31 `verified` facts, all matching the source text:
   - ESP32 straps: GPIO0, GPIO2, GPIO5, GPIO12, GPIO15 (Table 3-1, Table 3-3, §3.2, Register 6.13), GPIO1 none, GPIO4 TRM bit.
   - ESP32 other: GPIO34 input-only and reset "disabled", GPIO4 reset pulldown, GPIO12 reset code 2.
   - ESP32-S3: GPIO0 and GPIO3 straps, GPIO26 none, GPIO35-37 octal PSRAM, GPIO27-31 flash, GPIO1-5 and GPIO17 glitch table.
   - RP2040: Table 625 IOVDD/IOVSS 50 mA, RPU/RPD 50-80 kOhm, VIH 2 V, VOH 2.62 V, Pull-Down reset (Table 615).
   - Uno R4 and RA4M1: Table 2.6 per-pin 4 mA (low drive) and 8 mA (middle drive), total 60 mA, P000-P015 group 30 mA, pull-up 10/20/50 kOhm, Arduino pinout "8mA per pin / 60mA overall".
   - BME280: 3.4 MHz and 10 MHz, 714 uA, 3.6 uA, supply 1.71-3.6 V, abs max 4.25 V supply and VDDIO+0.3 on interface pins.
   - ADS1115: FSR +/-6.144 V, digital abs max 5.5 V, analog abs max VDD+0.3, VDD 2-5.5 V, IDD 150/300 uA, fSCL 3.4 MHz.
   - Pico W: GPIO23/24/25/29 internal, shared WL_CLK/VSYS.
   - ESP32-WROVER-E: GPIO16/17 PSRAM, pins 27/28 NC.
   - ESP8266: SDIO pins 6-11 map to flash.
   - Songle SRD: 130 % overdrive, confirmed by viewing the rendered page image.
4. Honesty sample of 6 conflict facts and 6 missing facts:
   - Conflicts checked: ESP32 GPIO2 strap, ESP32-S3 GPIO18 glitch (second row), RA4M1 pin_current_max (4 vs 8 mA), RP2040 abs_max_vin (IOVDD+0.5 vs 0.3, Table 622 confirmed), SRD overdrive 120 % vs 130 % (older sheet confirmed 120/110 %), ST7735S supply. All are genuine, both readings are recorded, and the restrictive one is active.
   - Missing checked: ESP32 and ESP32-S3 abs_max_vin and pin_current_max (no per-pin rating exists in the datasheets, confirmed), HC-SR04 voh_min and vih_min (datasheet gives no voltage), BME280 and MFRC522 MISO tri-state, ESP8266 reset_state, internal pull and cumulative current (no value in the three cached documents), SSD1306 max_hz, ESP8266 GPIO0/2/15 strap. All but the last two are honest. See Major 3 and Minor 5.

## 4. Fixtures (24)

- Every cited evidence id exists: 263 ids across 24 files, 0 unresolved. Every fixture carries an `evidence` list.
- Arithmetic re-computed, all correct:
  - Pull-up stack: 1/(5/10k) = 2000 Ohm; (3.3-0.4)/3 mA = 966.7 Ohm; 300 ns/(0.8473 x 50 pF) = 7081 Ohm; 1000 ns gives 23604 Ohm; 300 ns at 100 pF gives 3541 Ohm; the 4-in-parallel variant gives 1666.7 Ohm; 4.7k/5 = 940 Ohm.
  - D1 mini A0: 100/320 = 0.3125; 1/0.3125 = 3.2 V; 3.3 x 0.3125 = 1.03125 V (3.125 % over).
  - R4 LED: 5/330 = 15.15 mA; (5-2)/220 = 13.64 mA; (5-2)/470 = 6.38 mA; 4 x 5 mA = 20 mA.
  - Address and ADC slot counts: ESP32 2 buses x 4 addresses = 8 slots vs 9 devices; Pico W 3 usable ADC pads vs 4 pots.
- No value is invented where the catalog says missing. Fixtures 04, 10, 17, 19, 20 and 24 explicitly weaken to Caution and say why.
- Count is 24, at least 20. Required items that are present: DevKitC project, WROVER change, Pico W GPIO23-25/29, D1 A0 3.2 V, BME280 address collision, pull-up stack. Required items that are absent or weakened: Uno R3 vs R4 LED current (R3 not in the catalog) and the HC-SR04 divider (Caution only, because voh_min is missing).

## 5. Report consistency

`pnpm catalog:validate` prints 789 verified, 42 conflict, 212 missing, 8 interim, 1 single-source (1052 facts), which I also recomputed from the YAML. coverage.md and reconcile-*.md match these counts. 13 audit-*.yaml and 13 reconcile-*.md files are present. Fixture counts match fixtures.md. PASS.

Evidence URLs: 53 checked, 49 return 200. Four do not:
- nxp.com MFRC522.pdf: 404.
- circuitbasics SRD PDF: timeout.
- displayfuture ST7735.pdf and ST7735S.pdf: HTTP 999 (bot block).
Each has a cached copy and a SHA-256, but none is flagged `manual: true`. See Minor 6.

## Findings

### Critical
None.

### Major
1. **Scope gap: Arduino UNO R3 and ATmega328P are absent from the catalog.** DS18B20 and DHT22 have no records, and MPU-6050/GY-521, the Keyestudio transistor relay and the push button and potentiometer facts are mostly missing. PHASE-2a.md lists these as in-scope boards, chips and modules, and the gate needs "each MVP board". coverage.md documents the gap and ties it to the manual-PDF prerequisite. Because the Human prerequisite is "file present OR user explicitly accepts interim", the owner must explicitly accept this deferral, or supply the PDFs. The Uno R3 vs R4 LED-current fixture also depends on it.
2. **One `single-source` fact remains: `ics/ads1115.yaml /vio_range` ([2, 5.5] V).** The gate requires 0 single-source on any field the engine reads. The value is correct, because the ADS1115 has no VIO pin and VDD is 2-5.5 V per rec-vdd. It is only labelled wrong. Fix: record it as `verified` with a derivation note and both keys, or as `interim`.
3. **ESP8266EX strap facts for GPIO0, GPIO2 and GPIO15 are `missing` although a document states the level.** The hardware design guidelines v2.8 §1.4.7 say GPIO15 "needs to be at low-voltage level when the chip is powered on". GPIO0, GPIO2 and MTDO are named as the boot-mode and SDIO-timing straps. The catalog withholds the whole fact because the schema also demands `default_pull`, and it records the intent in the note. The effect is Caution only, which is conservative and not unsafe. But D1 mini D8, D3 and D4 can then be assigned with a Caution, not a block or Info, so the "missing must not hide a stated value" criterion is borderline. Either allow `default_pull: unknown` and record `required_at_reset` as `interim` or `conflict`, or have the owner accept the current handling.

### Minor (Later list)
1. 64 evidence locators cite the wrong PDF page, always by one (esp32-s3-ds-v2.2 pin-overview and iomux rows p16 vs p17 and p21 vs p22; esp32-s3-trm rst-gpio42-48 p493 vs p494; esp32-wroom-32e and esp32-wrover-e pin-rxd0-txd0 and gpio6-11-flash; esp32-s3-errata chip-revisions, adc-183, usbotg-4289, touch-100, errata-list-no-gpio-category). A bulk fix is possible.
2. About 20 quotes are condensed or composite, joined with ";" or "..." or reflowed, so they are not verbatim. Examples: mfrc522-ds-v3.9 abs-max-supply, songle-srd-t73-v1 ordering-code, ssd1306 and st7735 dc-logic-levels. The values match the documents; only the quote text is paraphrased.
3. Hand-transcribed schematic and figure quotes (abx00080-sch, lolin-d1-mini-v4-sch, adafruit .sch XML, SunFounder, esp32-devkitc-v4-sch) cannot be string-matched. They need the two-key image read the reconcile files describe. I did not re-read them all.
4. BME280 `supply_current` mixes an average (3.6 uA at 1 Hz) and a peak (714 uA) in one typ/max pair. The note says so. Consider splitting the field.
5. SSD1306 I2C `max_hz` is `missing` although the datasheet gives tcycle min 2.5 us, which is 400 kHz. The value is derived, not stated, so this is defensible. Consider an `interim` fact.
6. Four evidence URLs do not return 200 (see section 5). Mark them `manual: true` with the hash, or point to a working mirror. The ST7735, ST7735S and Songle-circuitbasics sources are secondary.
7. The ST7735S facts remain `interim` or `conflict` because they rest on the ST7735 and an unofficial V1.3 mirror. They are always shown as Caution. This is consistent with the phase doc.
8. The warning codes and `expect.properties` keys used by the fixtures are a proposed vocabulary (fixtures.md "Known gaps"). Phase 2b should fix them, or the schema rejects them.

### Not independently re-done (faster mode)
The auditor's second-pass spot check (>= 10 % of verified facts, minimum 30) and the electrical-calc-verifier run are separate validators. I only spot-checked the 6 derivations above.

## Recommendation
Fix Major 2 (trivial) and decide Major 1 and Major 3 with the owner (accept as documented deferrals, or fix). Then re-run catalog:validate and ask for a fix-round re-check. No wrong pin, limit or arithmetic value was found in the sample.

## Owner decision (2026-10-23)

Major 1 (missing Uno R3 / ATmega328P, DS18B20, DHT22, MPU-6050, KS0058 data) accepted as a deferral: added later when the owner supplies the manual PDFs. Major 2 fixed: ads1115 vio_range relabelled interim. Major 3 (ESP8266 GPIO0/2/15 strap facts missing because default_pull is required) accepted for now; the schema is fixed first in Phase 2b. Verdict after decision: PASS (owner-accepted deferrals). Minor findings are on the Later list above.
