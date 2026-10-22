# Reconcile report: ESP32-S3-WROOM-1-N8, ESP32-S3-WROOM-1-N8R8 modules and ESP32-S3-DevKitC-1 V1.1 board (task 2a.4)

Reconciler: catalog-author. Researcher draft vs blind audit `audit-esp32-s3-modules-board.yaml` (47 audit facts, D1-D6). Files edited: `catalog/modules/esp32-s3-wroom-1-n8.yaml`, `catalog/modules/esp32-s3-wroom-1-n8r8.yaml`, `catalog/boards/esp32-s3-devkitc-1@V1.1.yaml`, evidence `esp32-s3-wroom-1-ds-v1.8`, `esp32-s3-devkitc-1-ug-v1.0`, `esp32-s3-devkitc-1-sch-v1.1` (new claims only; `ug-v1.1` and `sch-v1.1-20220413` unchanged). No chip file or chip evidence file was touched. Comparison was mechanical (`apply.py` in the session scratchpad: parses both sides, matches by entity/path, asserts the auditor value and confidence before any fact is set to verified; YAML re-emitted with sorted keys, a no-change re-emit reproduced all 8 files byte for byte first).

## Counts (Fact<T> objects)

| entity | facts | before | after |
|---|---|---|---|
| esp32-s3-wroom-1-n8 (module) | 7 (6 consumed, flash_voltage) | 7 single-source | 7 verified |
| esp32-s3-wroom-1-n8r8 (module) | 11 (9 consumed, flash_voltage, psram) | 11 single-source | 11 verified |
| esp32-s3-devkitc-1@V1.1 (board) | 5 (logic_voltage, 2 rail voltages, 2 rail max_current) | 3 single-source, 2 missing | 3 verified, 2 missing |
| total | 23 | 21 single-source, 2 missing | 21 verified, 0 conflict, 2 missing, 0 single-source |

Mismatches (conflict facts): 0. Board `status`: `partially-verified` (before and after; validator-computed, the two missing rail currents keep it there). Validator: `catalog validate: 0 errors, 0 warnings in 51 files` (exit 0, whole catalog).

## Reconciled facts and fields

| entity | path | researcher | auditor | result | action |
|---|---|---|---|---|---|
| n8 | bonded_pads | 36 pads | 36 pads (GPIO0-21, GPIO35-48) | match (plain field, compared as sets) | none |
| n8 | consumed.GPIO27..32 | flash | flash (SPIHD/SPIWP/SPICS0/SPICLK/SPIQ/SPID), inferred | match; inferred, same basis both sides | verified, `transcribed: true`, note (rule 4) |
| n8 | flash_voltage | 3.3 V (inferred) | 3.3 V (inferred; also vdd_spi_voltage 3.3) | match; inferred, same kind of source | verified, `transcribed: true`, note + 3 new claims (rule 4) |
| n8 | psram | none (no field) | none (found) | match | no Fact in file; nothing to do |
| n8 | unavailable_bonded_pads | no field | [] (found) | consistent (N8 has no PSRAM; GPIO35-37 are ordinary pads, absent from `consumed`) | none |
| n8 | strap_gpio45_warning | in flash_voltage note | found (p39) | match | note kept, claim `#sch-other-modules-gpio45` already cited |
| n8r8 | bonded_pads | 36 pads | 36 pads | match | none |
| n8r8 | consumed.GPIO27..32 | flash | flash(+psram sharing), inferred | match (auditor also notes PSRAM shares the lines; unusable either way) | verified, `transcribed: true` |
| n8r8 | consumed.GPIO35/36/37 | psram | psram (footnote b, found, `unavailable_bonded_pads`) | match | verified |
| n8r8 | consumed.GPIO26/33/34 | absent (no module pin) | psram, inferred (chip Table 2-14) | difference, inference only | not added; see judgement call 4 |
| n8r8 | flash_voltage | 3.3 V (inferred) | 3.3 V (inferred) + vdd_spi_voltage 3.3 V found in guide v1.0 | match | verified; added v1.0 guide claim (no `transcribed`: text sources only) |
| n8r8 | psram | 8 MB Octal SPI | 8 MB Octal SPI, in-package (found) | match | verified |
| board | logic_voltage | 3.3 V | 3.3 V (schematic figure, inferred) | match; inferred, same basis | verified, `transcribed: true`, claim `#esp-3v3-r24-link` added |
| board | rails.3V3.voltage | 3.3 V | 3.3 V (U2 SGM2212-3.3, found via rails.3V3.source) | match | verified |
| board | rails.5V.voltage | 5 V | "5 V from either micro-USB ... or J1-21 5V" (found; no numeric tolerance stated) | match on nominal | verified; note says only the nominal value is verified |
| board | rails.3V3.max_current | missing | could-not-verify | consistent | stays `missing`, notes say both keys searched |
| board | rails.5V.max_current | missing | not stated | consistent | stays `missing` (same) |

## Inference decisions (rule 4)

1. **GPIO27-32 flash on both modules.** The module datasheet shows signal names only (Figure 2-1 block diagram, Figure 8-1 flash U2); GPIO numbers come from the chip datasheet pin map. Both keys read the same figure and chip table and reached the same value, so verified with `transcribed: true` and a note saying the numbers are derived. Existing citations of chip claims `esp32-s3-ds-v2.2#pin-map-*` were kept (they exist today); see "Dependencies on chip evidence".
2. **N8 `flash_voltage` = 3.3 V.** The module datasheet never states it. Researcher: footnote 7 by exclusion (1.8 V only for N16R16VA) + Table 6-8 + section 8 GPIO45 warning. Auditor: Table 4-4 default (FORCE = 0, GPIO45 = 0 selects VDD3P3_RTC 3.3 V) + same warning. Same value from the same document, so verified with note; caveat recorded: on the N8 VDD_SPI is strap-selected, 3.3 V only while GPIO45 is low at power-up. Added claims `#vdd-spi-control-table`, `#efuse-defaults-zero`, `#strap-defaults-table` (verbatim from the PDF text layer; the bold default marking of Table 4-4 is not visible there, hence `transcribed`).
3. **N8R8 `flash_voltage` = 3.3 V.** Both keys inferred from section 8 note + footnote 7; supported by chip datasheet ESP32-S3R8 row (already cited, chip file) and, found by the auditor, the v1.0 guide ordering table "SPI Voltage 3.3 V" for N8R8 (new claim `esp32-s3-devkitc-1-ug-v1.0#ordering-n8r8-spi-voltage`, quote checked against the cached HTML). Verified with note.
4. **`consumed` GPIO35/36/37 = psram on N8R8.** Footnote b (found by both, module datasheet p.12). Verified.
5. **`bonded_pads` (36).** Both keys agree (GPIO0-21, GPIO35-48); plain field, no status. **`psram` N8R8**: both found Table 1-1 (+ footnote 4). Verified.
6. **GPIO45 caveat on the N8** (must not be pulled high at power-up): both found p.39; kept in the N8 `flash_voltage` note (no separate Fact field exists).
7. **Revision (v1.0 vs v1.1).** Catalog holds V1.1 only (`revision: "V1.1"`, RGB LED GPIO38). The auditor additionally compared the V1.0 schematic (20210312): J1/J3 identical, only RGB_CTRL differs (GPIO48 on V1.0). Not modelled; the header comment already says a v1.0 board needs its own record. No change.

## Judgement calls

- 5V rail voltage: the auditor's text says the 5 V rail is fed from USB VBUS or the 5V pin but that the "voltage value is not stated numerically". The guide J1 table (researcher claim `#j1-5v-gnd`) says "5 V power supply". Verified for the nominal 5 V only; no tolerance or current claimed.
- The N8R8 `consumed` has no GPIO26 (PSRAM CS#), GPIO33/GPIO34 (DQ4/DQ5): they have no module pin, the module datasheet does not name them, and the auditor itself rates the list `inferred` from the chip datasheet. Adding them would put non-bonded pads into a map the validator ties to bonded pads; not added, reported here.
- `transcribed: true` on N8 flash_voltage and board logic_voltage reflects figure-based evidence (Table 4-4 bold default; schematic net R24/ESP_3V3).

## Connector comparison (J1 22 + J3 22 positions: position, label, kind, pad/rail)

Mechanical compare of all 44 positions against the auditor tables: **0 differences** (position, label, kind, pad, rail identical). J1: 3V3, 3V3, RST (reset, no pad; auditor net CHIP_PU), GPIO4,5,6,7,15,16,17,18,8,3,46,9,10,11,12,13,14, 5V, G. J3: G, TX (GPIO43), RX (GPIO44), GPIO1, 2, 42, 41, 40, 39, 38, 37, 36, 35, 0, 45, 48, 47, 21, 20, 19, G, G. Auditor extra: schematic net names only (CHIP_PU, U0TXD, U0RXD). The auditor also checked J1/J3 identical in V1.0 and in the 20220413 V1.1 issue, and 36 distinct GPIOs on headers (17 + 19) = all bonded module GPIOs.

Onboard parts (plain fields): RGB LED D6 on GPIO38 (v1.1), CP2102N U3 on GPIO43/44, auto-program Q1/Q2 (GPIO0; EN not a pad), BOOT SW1 on GPIO0, RESET SW2 (EN, no pad), native USB J4 on GPIO19/GPIO20, power LED D5 (no pad): all match the auditor. Auditor-only items not modelled (no pad effect): zero-ohm links R24/R17/R7/R9/R8/R13, NC parts C13/C14/C15/R14, `board_pin_strap_exposure`, `guide_revision_pages`. `numbering.primary: gpio` and `variants` (N8, N8R8) match; N8 board marked EOL in guide v1.1 is not modelled (schema has no variant EOL flag).

## Disagreements D1-D6

- **D1** (RGB LED GPIO per revision): not an error; catalog v1.1 = GPIO38, matches. v1.0 (GPIO48) stays out of the record (header comment).
- **D2** (names CHIP_PU/RST/EN, U0TXD/TX/GPIO43, U0RXD/RX/GPIO44): same nets; catalog uses the guide labels and models RST as `reset` without a pad. No change.
- **D3** (v1.0 guide lists N8R8 only with SPI voltage; v1.1 adds N8 (EOL), N8R2, drops the voltage column): N8 variant kept; the v1.0 column used for the N8R8 flash_voltage claim.
- **D4** (guide says all GPIOs except flash SPI are broken out, yet GPIO35-37 are consumed on N8R8): consistent via the guide note; `consumed.GPIO35-37 = psram` on the N8R8 module (verified); header J3-11/12/13 kept in the single connector map.
- **D5** (N8 flash voltage never stated): handled as inference decision 2.
- **D6** (schematic file 20221130 has sheet 1 dated 2022-04-13): cosmetic; evidence `sch-v1.1` already describes sheet 2 dated 2022-11-30.

## Claims added (own evidence files)

`esp32-s3-wroom-1-ds-v1.8#vdd-spi-control-table`, `#efuse-defaults-zero`, `#strap-defaults-table`; `esp32-s3-devkitc-1-ug-v1.0#ordering-n8r8-spi-voltage`; `esp32-s3-devkitc-1-sch-v1.1#esp-3v3-r24-link`.

## Dependencies on chip evidence / claims I could not add

I did not add chip-document claims. Existing citations of `esp32-s3-ds-v2.2#pin-map-spihd/-spiwp/-spics0/-spiclk/-spiq/-spid/-gpio35/-gpio36/-gpio37`, `#table-1-1-s3r8-3v3`, `#table-1-1-s3-3v3-or-1v8` were left in place; they exist at the time of this run. If the chip reconciler renames or removes any, the module facts must drop that id (validator will flag it). No extra chip claim is required for any verified fact.
