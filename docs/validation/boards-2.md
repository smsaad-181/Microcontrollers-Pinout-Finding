# boards-2: ESP32-C3/C6/S2 chips and Espressif + Waveshare boards

Branch `boards-2`, read 2026-10-24, ONE KEY (hardware-researcher). Every new fact is `single-source` (or `missing`); nothing is marked verified. A later blind auditor must re-read every claim. Quotes in text-based sources were extracted programmatically from the downloaded document text (verbatim by construction); claims about drawings and pictures are marked `[drawing/image, transcribed]` and need a human re-read. `pnpm catalog:validate` 0 errors, format:check clean, engine fixtures 30/30.

## New chips (status counts, per chip file)
| Chip | Source | single-source | missing | Notes |
| --- | --- | --- | --- | --- |
| esp32-c3 (22 pads) | Datasheet v2.4, errata v1.3, ESP-IDF stable ADC page | 103 | 4 | missing: abs_max_vin, pin_current_max, SPI2 matrix_max_hz, GPIO5 ADC2 radio_conflict |
| esp32-c6 (31 pads, QFN40+QFN32 union) | Datasheet v1.5, errata v1.3 | 140 | 3 | no power-up glitch table in the datasheet: all pads `none` (weak negative finding) |
| esp32-s2 (43 pads) | Datasheet v1.9, errata v1.2, ESP-IDF stable ADC page | 202 | 3 | GPIO46 input-only; errata SYSTEM-117 on GPIO18 (rev v0.0); no glitch table: `none` |

## New modules
esp32-c3-mini-1-n4x, esp32-c6-wroom-1-n8, esp32-s2-wrover, esp32-s2-wroom (module datasheets C3-MINI-1 v2.2, C6-WROOM-1 v1.4, S2-WROOM v1.5, S2-WROVER v1.4) and four bare-chip packages modelled as modules: esp32-s3fh4r2, esp32-s3r2, esp32-c3fh4, esp32-c6fh4. The ESP32-S3 datasheet evidence record gained 4 claims (Table 1-1 rows).

## Boards (each: board facts single-source / missing)
| Board | Sources | Status counts (board) | Gaps |
| --- | --- | --- | --- |
| Espressif ESP32-C3-DevKitM-1 V1.0 | user guide (HTML), schematic V1.0 | 3 / 2 | rail current ratings missing; guide has no revision; native USB pads on header only (R2/R3 NC) |
| Espressif ESP32-C6-DevKitC-1 V1.2 | user guide v1.2, schematic v1.4 | 3 / 2 | rail current missing; v1.2/v1.3 resistor differences not modelled |
| Espressif ESP32-S2-Saola-1 V1.2 | user guide v1.2, schematic (file V1.1, title V1.2) | 3 / 2 | guide J3 numbering misprinted (14,16,17,17): positions 14-17 assigned by row order, needs second-key check; rail current missing; USB pad routing "Reserved" |
| Waveshare ESP32-S3-Zero | wiki + pinout picture, schematic | 4 / 1 | extra pads' positions are picture order (transcribed); wiki "GPIO33-37 reserved for Octal PSRAM" contradicts the Quad-PSRAM FH4R2 |
| Waveshare ESP32-S3-Pico | wiki + picture, schematic | 4 / 3 | VSYS voltage and rail currents missing; TP pad order transcribed; 2 A is the MP28164 rating |
| Waveshare ESP32-S3-DEV-KIT-N8R8 | wiki + picture, schematic | 3 / 2 | regulator printed as two alternative parts, no rating; only the N8R8 variant (N16R8, N32R16V not catalogued) |
| Waveshare ESP32-C3-Zero V2 | wiki, schematic Sch-V2 | 3 / 2 | no LDO rating for this board; no pinout picture in page text, physical pad side not transcribed |
| Waveshare ESP32-C6-Zero | wiki + pictures, schematic | 4 / 1 | 800 mA rating from picture text only |
| Waveshare ESP32-S3-Tiny | wiki + pictures, schematic | 4 / 1 | adapter board schematic (Tiny-Adapter.pdf) not read; wiki note about an N8R8 variant (GPIO33-37 PSRAM) has no record |
| Waveshare ESP32-S3-Mini | NONE | n/a | No official page found (Waveshare wiki URLs ESP32-S3-Mini, -MINI, -Mini-1 return 404). No record created; every fact is "datasheet required". |

Board `status` is `partially-verified` for all (computed by the CLI).

## Schema gaps (reported, not invented)
- A board with no authoritative pinout (S3-Mini) cannot be stored: `variants` needs at least one real module and a `datasheet-required` board needs a module to point at.
- No field for a connector pad without a printed number (Waveshare back/test pads): positions are picture-order conventions, flagged in each file header.
- `Module` has no notion of a board-level memory part: S3-Pico's external flash is only in `onboard`.
- Reset states "At Reset blank" map to `disabled`; `USB_PU` maps to `pullup`; no enum for output-enabled pull-up (C3 U0TXD, C6 U0TXD use After Reset note).
- `strap.required_at_reset` is one level; multi-mode straps (GPIO8, GPIO2 on C3) use `any`/recommended level with the detail in the note.
