# boards-1: classic ESP32 dev boards (researcher + author key)

Branch `boards-1`, read 2026-10-24. Single key only (hardware-researcher + catalog-author). Every fact is `single-source`/`interim`/`missing`; nothing is `verified` until a blind `hardware-fact-auditor` re-reads. `pnpm catalog:validate` 0 errors; `format:check` clean; engine `fixtures` 30/30 pass.

Method notes for the auditor: schematic images (NodeMCU-32S, LOLIN32, T-Display pinmap) were read from rendered pictures and are marked `transcribed`; re-read them blind. HTML quotes flatten table rows to one line.

## Board status

| Board | Status | Pins mapped | Key facts (single-source / missing) |
| --- | --- | --- | --- |
| esp-wrover-kit@v4.1 | partially-verified | JP1 14x2 | 4 / 1 (5V current) |
| adafruit-huzzah32-feather@unversioned | partially-verified | JP1 15 + JP3 12 | 4 / 3 (USB, BAT current; BAT voltage) |
| nodemcu-32s@V1.2 | partially-verified | J1 19 + J2 19 | 3 / 2 (3V3, 5V current) |
| lolin32@V1.0.0 | partially-verified | P2 16 + P3 20 | 3 / 2 (3V3, 5V current) |
| ttgo-t-display@V1.1 | partially-verified | 12 + 12 | 3 / 2 (rail currents) |
| doit-esp32-devkit-v1-30pin@V1 | datasheet-required | none | 0 / 1 |
| doit-esp32-devkit-v1-36pin@V1 | datasheet-required | none | 0 / 1 |

New modules: `esp32-wroom-32` (datasheet v3.8; flash voltage missing), `esp32-wroom-32s` (flash-pin use interim; flash voltage missing), `ttgo-t-display-core` (bare chip + external flash; flash voltage missing). Reused: `esp32-wrover-e`. No chip changes.

## Per board

### ESP-WROVER-KIT v4.1
- Sources: Espressif ESP-WROVER-KIT v4.1 Getting Started Guide (esp-dev-kits, HTML, no hash); existing `esp32-wrover-e-ds-v2.4` for UART0 pads.
- Gaps: positions are table-row numbers (guide does not number JP1; PCB orientation not stated). IO32/IO33 and IO16/IO17 modelled `nc` (guide: not connected to JP1 by default). 5V current missing. The v4.1 schematic PDF was downloaded but not used as evidence.

### Adafruit HUZZAH32 Feather
- Sources: Adafruit Learn Pinouts and Power Management pages; Adafruit EAGLE schematic (repo commit e23514c, sha256 recorded). Pad map comes from schematic nets.
- Gaps: JP1 pin 14 has no net/label (omitted, not guessed). Header "RX/TX" are labelled by net name IO16/IO17 because no document states RX = GPIO16. No revision string exists ("unversioned"). USB/BAT current and BAT voltage missing. Module is ESP32_WROOM32 symbol (non-E).

### NodeMCU-32S (Ai-Thinker)
- Sources: Ai-Thinker Nodemcu-32s Datasheet V1 (secondary: retailer-hosted copy; docs.ai-thinker.com yielded no PDF). Header map and onboard parts from the embedded schematic image (title block V1.2, 2018/8/9).
- Gaps: PDF table 2 numbers the right side in reverse order to schematic J2; schematic numbering used. SD2/SD3/CMD/SD0/SD1/CLK are `nc`; their flash use is `interim` (cites WROOM-32 datasheet, which the Ai-Thinker note defers to). Module flash voltage, regulator current (AMS1117 datasheet not used) missing.

### LOLIN32 V1.0.0
- Sources: WEMOS LOLIN32 V1.0.0 schematic and wiki page, both through the Internet Archive (wemos wiki offline; archive copies marked secondary). Schematic has no text layer: transcribed from image.
- Gaps: ME6211 / charger current ratings missing. Only rev 1.0.0 covered.

### LilyGO TTGO T-Display V1.1
- Sources: maker repo README (commit 6f89cdd), `pinmap.jpg` (transcribed), schematic PDF (label soup, used for flash and display net labels only; its header order was not used, may be another revision).
- Gaps: USB-UART bridge pads, regulator and charger not stated in text sources (no onboard entry). Flash voltage and rail currents missing. GPIO14 "ADC Power" circuit not read.

### DOIT ESP32 DevKit V1 (30-pin and 36-pin)
- Sources: none authoritative. Searched the DOIT GitHub wiki (no ESP32 DevKit page); doit.am page not located; only forum/third-party pinouts exist (not used).
- Status `datasheet-required`: empty connectors by design. The variant module `esp32-wroom-32` is a placeholder not evidenced for these boards. Needs DOIT's own pinout/schematic.

## Cross-board cautions for the auditor
- Labels differ from DevKitC (P34/SVP, VP/VN, A0-A5, plain GPIO numbers). Pin positions use each source's own numbering, not the DevKitC J2/J3 scheme.
- `esp32-wroom-32` leads GPIO6-11 out on module pins 17-22 (unlike WROOM-32E); modelled consumed by flash.
