# Reconcile report: ESP32-WROOM-32E, ESP32-WROVER-E modules and ESP32-DevKitC V4 board (task 2a.4)

Reconciler: catalog-author. Researcher draft vs blind audit `audit-esp32-modules-board.yaml` (110 audit facts, DIS-1..DIS-5). Files edited: `catalog/modules/esp32-wroom-32e.yaml`, `catalog/modules/esp32-wrover-e.yaml`, `catalog/boards/esp32-devkitc-v4@V4.yaml`, evidence `esp32-wroom-32e-ds-v2.1`, `esp32-wrover-e-ds-v2.4` (new claims only). No chip file or chip evidence file was touched. Comparison was mechanical (`apply.py`/`mkreport.py` in the session scratchpad: parses both sides, matches by entity/path, asserts the auditor value and confidence before any fact is set to verified).

## Counts (Fact<T> objects)

| entity | facts | before | after |
|---|---|---|---|
| esp32-wroom-32e (module) | 8 (6 consumed, flash_voltage, psram) | 8 single-source | 8 verified |
| esp32-wrover-e (module) | 10 (8 consumed, flash_voltage, psram) | 10 single-source | 10 verified |
| esp32-devkitc-v4@V4 (board) | 5 (logic_voltage, 2 rail voltages, 2 rail max_current) | 3 single-source, 2 missing | 3 verified, 2 missing |
| total | 23 | 21 single-source, 2 missing | 21 verified, 0 conflict, 2 missing |

Mismatches (conflict facts): 0. Board `status`: `partially-verified` (before and after; the validator computes it, the two missing rail currents keep it there). Validator: `catalog validate: 0 errors, 0 warnings in 21 files`.

## Reconciled facts and fields (researcher vs auditor)

| entity | path | researcher | auditor | result | action | status before -> after |
|---|---|---|---|---|---|---|
| esp32-wroom-32e | bonded_pads | 26 pads | 26 pads | match | plain field, no status; sets compared mechanically | n/a |
| esp32-wroom-32e | consumed.GPIO6 | flash | flash | match | verified; same claim (Table 3 note 2); auditor also read Figure 7 flash U3 | single-source -> verified |
| esp32-wroom-32e | consumed.GPIO7 | flash | flash | match | verified; same claim (Table 3 note 2); auditor also read Figure 7 flash U3 | single-source -> verified |
| esp32-wroom-32e | consumed.GPIO8 | flash | flash | match | verified; same claim (Table 3 note 2); auditor also read Figure 7 flash U3 | single-source -> verified |
| esp32-wroom-32e | consumed.GPIO9 | flash | flash | match | verified; same claim (Table 3 note 2); auditor also read Figure 7 flash U3 | single-source -> verified |
| esp32-wroom-32e | consumed.GPIO10 | flash | flash | match | verified; same claim (Table 3 note 2); auditor also read Figure 7 flash U3 | single-source -> verified |
| esp32-wroom-32e | consumed.GPIO11 | flash | flash | match | verified; same claim (Table 3 note 2); auditor also read Figure 7 flash U3 | single-source -> verified |
| esp32-wroom-32e | consumed.GPIO16 | absent (record covers parts without PSRAM; psram note says R2 consumes GPIO16) | psram on N4R2/N8R2/N16R2 only (found, note 3) | match in substance; no catalog Fact | No change. Not a Fact in this record (non-R2 parts keep GPIO16 free). R2 parts need their own module record. See judgement calls. | n/a |
| esp32-wroom-32e | consumed.GPIO17 | absent | none / not stated consumed (inferred) | inferred; no catalog Fact | No change; nothing to verify. | n/a |
| esp32-wroom-32e | flash_voltage | 3.3 V (derived from VDD_SDIO net + MTDI=0) | 3.3 V (inferred, same basis) | inferred (same value, same basis both sides) | verified with inference note, transcribed: true (Pico precedent, rule 4); added claim #block-diagram-flash-vdd-sdio | single-source -> verified |
| esp32-wroom-32e | psram | none (N4/N8/N16/H4/H8) | none on N4/N8/N16/H4/H8; 2 MB on R2 | match | verified; added claim #features-psram-r2 | single-source -> verified |
| esp32-wrover-e | bonded_pads | 26 pads (incl. GPIO16/GPIO17) | 24 pads | MISMATCH (documented schema gap) | plain field, no status. Auditor correct (datasheet: up to 24 GPIOs; pins 27/28 NC). Researcher list kept: validator requires every gpio header pad (J3-11/12) in bonded_pads of every variant module; diff ['GPIO16', 'GPIO17']. Header comment updated. | n/a |
| esp32-wrover-e | consumed.GPIO6 | flash | flash | match | verified | single-source -> verified |
| esp32-wrover-e | consumed.GPIO7 | flash | flash (+psram data line) | match (auditor adds shared PSRAM data line) | verified; note records PSRAM sharing (auditor Figure 9 reading, no separate quotable claim) | single-source -> verified |
| esp32-wrover-e | consumed.GPIO8 | flash | flash (+psram data line) | match (auditor adds shared PSRAM data line) | verified; note records PSRAM sharing (auditor Figure 9 reading, no separate quotable claim) | single-source -> verified |
| esp32-wrover-e | consumed.GPIO9 | flash | flash (+psram data line) | match (auditor adds shared PSRAM data line) | verified; note records PSRAM sharing (auditor Figure 9 reading, no separate quotable claim) | single-source -> verified |
| esp32-wrover-e | consumed.GPIO10 | flash | flash (+psram data line) | match (auditor adds shared PSRAM data line) | verified; note records PSRAM sharing (auditor Figure 9 reading, no separate quotable claim) | single-source -> verified |
| esp32-wrover-e | consumed.GPIO11 | flash | flash | match | verified | single-source -> verified |
| esp32-wrover-e | consumed.GPIO16 | psram | psram (Figure 9 image; transcribed) | match | verified, transcribed: true; added claim #pin-table-27-28-nc; dropped chip-doc evidence esp32-ds-v5.3#psram-gpio16-ce (not owned, reported) | single-source -> verified |
| esp32-wrover-e | consumed.GPIO17 | psram | psram (Figure 9 image; transcribed) | match | verified, transcribed: true; added claim #pin-table-27-28-nc; dropped chip-doc evidence esp32-ds-v5.3#psram-gpio17-sclk (not owned, reported) | single-source -> verified |
| esp32-wrover-e | flash_voltage | 3.3 V | 3.3 V (Table 1 VDD_SDIO Voltage) | match | verified | single-source -> verified |
| esp32-wrover-e | psram | 8 MB Quad SPI (N4R8/N8R8/N16R8) | 8 MB Quad SPI on N*R8; 2 MB EOL R2 | match | verified | single-source -> verified |
| esp32-devkitc-v4 | logic_voltage | 3.3 V | 3.3 V (schematic figure) | match | verified; both claims already cited (UG row + schematic LDO block) | single-source -> verified |
| esp32-devkitc-v4 | rails.3V3.voltage | 3.3 V | 3.3 V (AMS1117-3.3 -> VDD33) | match | verified | single-source -> verified |
| esp32-devkitc-v4 | rails.5V.voltage | 5 V | 5.0 V (EXT_5V via D3) | match | verified | single-source -> verified |
| esp32-devkitc-v4 | rails.3V3.max_current | missing (null) | could-not-verify (null) | could-not-verify | stays missing; note updated | missing -> missing |
| esp32-devkitc-v4 | rails.5V.max_current | missing (null) | could-not-verify (null) | could-not-verify | stays missing; note updated | missing -> missing |

## Judgement calls

1. **WROOM-32E `flash_voltage` (auditor: inferred).** The WROOM-32E datasheet has no module flash-voltage statement (WROVER-E Table 1 has one). Both sides derived 3.3 V independently from the same kind of source (the in-module flash is on VDD_SDIO; default MTDI = 0 gives VDD_SDIO = VDD3P3_RTC, typically 3.3 V; IO12 must be low at power-on so the 1.8 V mode is not the default), and the researcher draft already said so in its note. Per rule 4 / Pico precedent: `verified`, `transcribed: true`, note states it is an inference. I added claim `esp32-wroom-32e-ds-v2.1#block-diagram-flash-vdd-sdio` (Figure 1 text-layer labels, p.9) for the figure basis the auditor used. Caveat for the lead: the figure quote is a label list, so the VDD_SDIO tie is read from the drawing, not from a sentence.
2. **WROOM-32E `consumed.GPIO16` / `GPIO17`.** The record deliberately covers part numbers without PSRAM, where GPIO16 and GPIO17 are free (Table 3 note 3: IO16 is consumed only on the ...R2 parts, ESP32-D0WDR2-V3). The auditor agrees (GPIO16 psram on R2 only: found; GPIO17: not stated consumed anywhere, inferred). Not Facts in the draft, nothing to verify, no entry added: adding `GPIO16: psram` here would wrongly block GPIO16 on the PSRAM-less DevKitC-32E. R2 parts need their own module record if ever modelled. The module header comment says so.
3. **WROVER-E `bonded_pads` (researcher 26, auditor 24) - schema gap, researcher modelling kept.** The auditor is right: datasheet "Up to 24 GPIOs", Table 3 pins 27/28 NC, so GPIO16/GPIO17 are not led out. The validator (`packages/cli/src/validate.ts`, E_PIN_NUMBERING "pad ... is not bonded out by module") requires every `gpio` header pad to be in `bonded_pads` of the module of EVERY board variant, and the board has one connector map (J3-11 IO17 / J3-12 IO16 are usable on the WROOM-32E variant). Removing GPIO16/17 from the WROVER-E list fails validation; making J3-11/12 `nc` would wrongly disable them on the DevKitC-32E. So the only validator-clean modelling is the researcher one, which is a falsification of "bonded". Kept, and documented precisely in the module file header and here. Safety: `consumed.GPIO16/17 = psram` (verified) is what removes the pads for the VE variant. Recommended fix (schema): per-variant bonded pads or per-variant connector overrides; until then the engine must read `consumed`, not `bonded_pads`, for GPIO16/17.
4. **WROVER-E `consumed.GPIO7..GPIO10`.** Auditor: flash, and in the N*R8 parts also the shared PSRAM U4 data lines (Figure 9 image). `Fact<T>` takes one value; both agree on `flash`, the pads are unusable either way. Verified; the note records the PSRAM sharing (auditor-only reading, no separate quotable claim added).
5. **WROVER-E `consumed.GPIO16/GPIO17` evidence.** Verified (both read Figure 9: GPIO16 -> PSRAM CS#, GPIO17 -> R13 -> SRAM_CLK; `transcribed: true`). The researcher also cited chip-datasheet claims `esp32-ds-v5.3#psram-gpio16-ce` and `#psram-gpio17-sclk`; I removed those two ids from the facts because I may only cite evidence I own (the chip evidence file belongs to the other agent). Added own claim `esp32-wrover-e-ds-v2.4#pin-table-27-28-nc` (Table 3, pins 27/28 NC) as extra support. See "Claims I could not add".
6. **`psram` facts** (module level): conditions state the part numbers (`N4/N8/N16/H4/H8` none; `N4R8/N8R8/N16R8` 8 MB Quad SPI); both values match the auditor. WROOM: added claim `#features-psram-r2` (auditor Features quote).
7. **Board facts** matched; the auditor read the schematic figure (transcribed), the researcher cites user-guide text plus schematic text-layer quotes. I did not set `transcribed` on them (researcher basis is text). `max_current` 3V3/5V: auditor `could-not-verify`, researcher missing: stay `missing`, notes now say both keys searched.
8. Researcher module `flash` density, `supply_voltage`, strapping, `not_recommended`, psram_voltage, xtal etc. are auditor-only (no `Fact` field in the Module schema): listed below, nothing changed.

## Connector comparison (J2 19 pins + J3 19 pins: position, label, kind, pad/rail)

All 38 positions and all labels are identical (researcher label = user-guide Name column = auditor label; auditor also lists the schematic net name). 31 of 38 pins match fully. Differences (7), all in kind/pad:

- J2-2: pad None/CHIP_PU (researcher/auditor)
- J2-16: kind nc/gpio, pad None/GPIO9 (researcher/auditor) - DIS-1
- J2-17: kind nc/gpio, pad None/GPIO10 (researcher/auditor) - DIS-1
- J2-18: kind nc/gpio, pad None/GPIO11 (researcher/auditor) - DIS-1
- J3-17: kind nc/gpio, pad None/GPIO8 (researcher/auditor) - DIS-1
- J3-18: kind nc/gpio, pad None/GPIO7 (researcher/auditor) - DIS-1
- J3-19: kind nc/gpio, pad None/GPIO6 (researcher/auditor) - DIS-1

Full table:

| conn | pos | researcher label | kind | pad/rail | auditor label | kind | pad/rail | schematic net | module pin | result | DIS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| J2 | 1 | 3V3 | power | 3V3 | 3V3 | power | 3V3 | VDD33 | None | match |  |
| J2 | 2 | EN | reset | - | EN | reset | CHIP_PU | EN | 3 | pad None/CHIP_PU |  |
| J2 | 3 | VP | gpio | GPIO36 | VP | gpio | GPIO36 | SENSOR_VP | 4 | match |  |
| J2 | 4 | VN | gpio | GPIO39 | VN | gpio | GPIO39 | SENSOR_VN | 5 | match |  |
| J2 | 5 | IO34 | gpio | GPIO34 | IO34 | gpio | GPIO34 | IO34 | 6 | match |  |
| J2 | 6 | IO35 | gpio | GPIO35 | IO35 | gpio | GPIO35 | IO35 | 7 | match |  |
| J2 | 7 | IO32 | gpio | GPIO32 | IO32 | gpio | GPIO32 | IO32 | 8 | match |  |
| J2 | 8 | IO33 | gpio | GPIO33 | IO33 | gpio | GPIO33 | IO33 | 9 | match |  |
| J2 | 9 | IO25 | gpio | GPIO25 | IO25 | gpio | GPIO25 | IO25 | 10 | match |  |
| J2 | 10 | IO26 | gpio | GPIO26 | IO26 | gpio | GPIO26 | IO26 | 11 | match |  |
| J2 | 11 | IO27 | gpio | GPIO27 | IO27 | gpio | GPIO27 | IO27 | 12 | match |  |
| J2 | 12 | IO14 | gpio | GPIO14 | IO14 | gpio | GPIO14 | IO14 | 13 | match |  |
| J2 | 13 | IO12 | gpio | GPIO12 | IO12 | gpio | GPIO12 | IO12 | 14 | match |  |
| J2 | 14 | GND | ground | - | GND | ground | - | GND | None | match |  |
| J2 | 15 | IO13 | gpio | GPIO13 | IO13 | gpio | GPIO13 | IO13 | 16 | match |  |
| J2 | 16 | D2 | nc | - | D2 | gpio | GPIO9 | SD2 | 17 | kind nc/gpio; pad None/GPIO9 | DIS-1 |
| J2 | 17 | D3 | nc | - | D3 | gpio | GPIO10 | SD3 | 18 | kind nc/gpio; pad None/GPIO10 | DIS-1 |
| J2 | 18 | CMD | nc | - | CMD | gpio | GPIO11 | CMD | 19 | kind nc/gpio; pad None/GPIO11 | DIS-1 |
| J2 | 19 | 5V | power | 5V | 5V | power | 5V | EXT_5V | None | match |  |
| J3 | 1 | GND | ground | - | GND | ground | - | GND | None | match |  |
| J3 | 2 | IO23 | gpio | GPIO23 | IO23 | gpio | GPIO23 | IO23 | 37 | match |  |
| J3 | 3 | IO22 | gpio | GPIO22 | IO22 | gpio | GPIO22 | IO22 | 36 | match |  |
| J3 | 4 | TX | gpio | GPIO1 | TX | gpio | GPIO1 | TXD0 | 35 | match |  |
| J3 | 5 | RX | gpio | GPIO3 | RX | gpio | GPIO3 | RXD0 | 34 | match |  |
| J3 | 6 | IO21 | gpio | GPIO21 | IO21 | gpio | GPIO21 | IO21 | 33 | match |  |
| J3 | 7 | GND | ground | - | GND | ground | - | (unlabelled, wired to GND) | None | match |  |
| J3 | 8 | IO19 | gpio | GPIO19 | IO19 | gpio | GPIO19 | IO19 | 31 | match |  |
| J3 | 9 | IO18 | gpio | GPIO18 | IO18 | gpio | GPIO18 | IO18 | 30 | match |  |
| J3 | 10 | IO5 | gpio | GPIO5 | IO5 | gpio | GPIO5 | IO5 | 29 | match |  |
| J3 | 11 | IO17 | gpio | GPIO17 | IO17 | gpio | GPIO17 | IO17 | 28 | match | DIS-2 |
| J3 | 12 | IO16 | gpio | GPIO16 | IO16 | gpio | GPIO16 | IO16 | 27 | match | DIS-2 |
| J3 | 13 | IO4 | gpio | GPIO4 | IO4 | gpio | GPIO4 | IO4 | 26 | match |  |
| J3 | 14 | IO0 | gpio | GPIO0 | IO0 | gpio | GPIO0 | IO0 | 25 | match |  |
| J3 | 15 | IO2 | gpio | GPIO2 | IO2 | gpio | GPIO2 | IO2 | 24 | match |  |
| J3 | 16 | IO15 | gpio | GPIO15 | IO15 | gpio | GPIO15 | IO15 | 23 | match |  |
| J3 | 17 | D1 | nc | - | D1 | gpio | GPIO8 | SD1 | 22 | kind nc/gpio; pad None/GPIO8 | DIS-1 |
| J3 | 18 | D0 | nc | - | D0 | gpio | GPIO7 | SD0 | 21 | kind nc/gpio; pad None/GPIO7 | DIS-1 |
| J3 | 19 | CLK | nc | - | CLK | gpio | GPIO6 | CLK | 20 | kind nc/gpio; pad None/GPIO6 | DIS-1 |

Connector pins, onboard parts and labels are plain fields (no status), so nothing changed except the explanatory header comment. J2-2 EN: auditor gives pad `CHIP_PU`; catalog models `kind: reset` with no pad (CHIP_PU is not a GPIO pad of the chip), left as is.

Other board fields: `revision` V4 match; `numbering.primary` gpio match (auditor: inferred); `variants`: researcher 2 (ESP32-DevKitC-32E -> WROOM-32E, ESP32-DevKitC-VE -> WROVER-E), auditor 4 (adds -32UE and -VIE: antenna-connector variants, same pinout, not modelled) - difference reported, not changed. Schematic symbol says ESP-WROOM-32 (DIS-4), same pin map.

Onboard parts: match for U1 CP2102N (GPIO1/GPIO3), Q1/Q2 auto-program (GPIO0; EN is not a pad), SW1 Boot (GPIO0), C15 (NC in V4 schematic, GPIO0). Auditor lists three parts the researcher did not model, none uses a GPIO pad: SW2 EN button (EN/CHIP_PU, evidence claim exists in `esp32-devkitc-v4-sch-v4#switch-sw2-en` / `-ug#en-button`), D1 red 5V power LED via R2 (no GPIO), micro-USB J1 + D3/ESD diodes. Reported, not added (no pad effect; avoid gold-plating).

## Disagreements DIS-1..DIS-5

- **DIS-1** (J2-16..18, J3-17..19: D2/D3/CMD/D1/D0/CLK): user guide says GPIO9/10/11/8/7/6, "used internally for flash, avoid using"; schematic wires them to module pins 17-22; module datasheets say those pins are NC and GPIO6-11 are not led out. Kept the researcher modelling `kind: nc`, no pad (label retained): no safer faithful representation exists in the schema (a `gpio`+pad pin would be assignable and would also need bonded pads, which the modules rightly do not list; `power`/`ground` would be false). Recorded in the board header comment.
- **DIS-2** (GPIO16/17, J3-12/11): consistent for sold variants; WROOM-32E R2 parts not sold on this board. Handled by the `consumed` facts plus the bonded_pads gap above; recorded in the board and WROVER-E headers.
- **DIS-3** names only, **DIS-4** schematic symbol ESP-WROOM-32 vs user guide WROOM-32E: no electrical disagreement, noted in the board header.
- **DIS-5** flash voltage statement: explicit on WROVER-E only; WROOM-32E is an inference, handled in judgement call 1.

## Claims I could not add (belong to chip documents; for the lead)

Two claims already exist in `catalog/evidence/esp32-ds-v5.3.yaml` (read-only for me) and were cited by my WROVER-E `consumed.GPIO16/17` facts before I removed the ids. If you want the chip-datasheet corroboration back on those facts, add them to the fact `evidence` lists afterwards (or tell me to):

- `esp32-ds-v5.3#psram-gpio16-ce` - §2.6, notes under Table 2-6, note 2, PDF p.21: "If GPIO16 is used to connect to PSRAM's CE# signal, please add a pull-up resistor at the GPIO16 pin."
- `esp32-ds-v5.3#psram-gpio17-sclk` - §2.6, notes under Table 2-6, note 3, PDF p.21: "Or GPIO17 pin is used to connect to the SCLK signal. This connection has passed relevant certification, see certificates for ESP32-WROVER-E."

Auditor extra chip-level support, not needed for any module fact: ESP32 datasheet Table 1-1 (VDD_SDIO column: D0WD-V3 "1.8 V/3.3 V", D0WDR2-V3 "3.3 V") and Table 2-5 note 2 (GPIO16 as in-package PSRAM CE#); also the auditor notes the chip datasheet marks ESP32-D0WDR2-V3 EOL (upgraded to ESP32-D0WDRH2-V3, PCN20251001) while WROOM-32E v2.1 still lists R2 parts.

## Auditor facts with no catalog counterpart (no Fact field in the schema; nothing changed)

| entity | path | auditor value | confidence |
|---|---|---|---|
| esp32-wroom-32e | module.pin_map | ['1:GND', '2:3V3', '3:EN', '4:SENSOR_VP=GPIO36', '5:SENSOR_VN=GPIO39', '6:IO34=GPIO34', '7 | found |
| esp32-wroom-32e | module.nc_pins | [17, 18, 19, 20, 21, 22] | found |
| esp32-wroom-32e | module.nc_pins.32 | NC (reason not stated) | found |
| esp32-wroom-32e | module.consumed.xtal | 40 MHz crystal on dedicated XTAL pads, not a GPIO | found |
| esp32-wroom-32e | module.flash | 4/8/16 MB Quad SPI (N4, N8, N16; H4, H8 are 105 C parts) | found |
| esp32-wroom-32e | module.psram_voltage | 3.3 | inferred |
| esp32-wroom-32e | module.supply_voltage | [3.0, 3.6] | found |
| esp32-wroom-32e | module.strapping | {'GPIO0': 'pull-up(1)', 'GPIO2': 'pull-down(0)', 'MTDI/GPIO12': 'pull-down(0)', 'MTDO/GPIO | found |
| esp32-wroom-32e | module.not_recommended.GPIO16 | do not use for other functions on R2 (PSRAM) variants; datasheet says it should be pulled  | found |
| esp32-wroom-32e | module.not_recommended.GPIO12 | IO12 should be kept low when the module is powered on | found |
| esp32-wroom-32e | module.not_recommended.EN | Do not leave EN floating | found |
| esp32-wroom-32e | module.not_recommended.GPIO6-11 | not available (internal flash) | found |
| esp32-wrover-e | module.pin_map | ['1:GND', '2:3V3', '3:EN', '4:SENSOR_VP=GPIO36', '5:SENSOR_VN=GPIO39', '6:IO34=GPIO34', '7 | found |
| esp32-wrover-e | module.nc_pins | [17, 18, 19, 20, 21, 22, 27, 28, 32] | found |
| esp32-wrover-e | module.consumed.GPIO17.chip_note | GPIO17 or SD_CLK can drive external PSRAM SCLK; WROVER-E uses GPIO17 | found |
| esp32-wrover-e | module.flash | 4/8/16 MB Quad SPI | found |
| esp32-wrover-e | module.psram_voltage | 3.3 | inferred |
| esp32-wrover-e | module.supply_voltage | [3.0, 3.6] | found |
| esp32-wrover-e | module.strapping | {'GPIO0': 'pull-up(1)', 'GPIO2': 'pull-down(0)', 'MTDI/GPIO12': 'pull-down(0)', 'MTDO/GPIO | found |
| esp32-wrover-e | module.not_recommended.GPIO12 | IO12 should be kept low when the module is powered on | found |
| esp32-wrover-e | module.not_recommended.GPIO16_GPIO17 | not available: pins 27/28 NC; PSRAM uses them | inferred |
| esp32-wrover-e | module.not_recommended.EN | EN is active high (the WROVER-E table does not repeat the 'do not leave floating' note) | found |
| esp32-devkitc-v4 | board.variants.schematic_modules | D2 ESP-WROOM-32 (populated); U3 ESP32_WROVER (NC - not fitted in this schematic) | found |
| esp32-devkitc-v4 | board.rails.5V.description | 5 V power supply | found |
| esp32-devkitc-v4 | board.power_supply_options | three mutually exclusive: Micro USB (default); 5V + GND header pins; 3V3 + GND header pins | found |
| esp32-devkitc-v4 | board.connectors.J2.pin_count | 19 | found |
| esp32-devkitc-v4 | board.connectors.J3.pin_count | 19 | found |
| esp32-devkitc-v4 | board.connectors.silkscreen | 3V3 EN VP VN 34 35 32 33 25 26 27 14 12 GND 13 D2 D3 CMD 5V / GND 23 22 TX RX 21 GND 19 18 | found |
| esp32-devkitc-v4 | board.connectors.GPIO6-11.user_guide_reading | Header names D0-D3/CMD/CLK = GPIO6-11; 'used internally for communication between ESP32 an | found |
| esp32-devkitc-v4 | board.connectors.GPIO6-11.user_guide_avoid | Avoid using these pins, as it may disrupt access to the SPI flash memory/SPI RAM. | found |
| esp32-devkitc-v4 | board.connectors.GPIO16-17.user_guide_reading | available only on boards with ESP32-WROOM and ESP32-SOLO-1; reserved for internal use on E | found |
| esp32-devkitc-v4 | board.connectors.GPIO16-17.user_guide_scope | GPIO16 and GPIO17 are available for use only on the boards with the modules ESP32-WROOM an | found |
| esp32-devkitc-v4 | board.onboard.usb_uart_bridge | {'part': 'CP2102N-A02-GQFN28 (U1)', 'uses_pad': ['GPIO1', 'GPIO3'], 'effect': 'TXD (pin 26 | found |
| esp32-devkitc-v4 | board.onboard.usb_uart_bridge.guide | Single USB-to-UART bridge chip, up to 3 Mbps | found |
| esp32-devkitc-v4 | board.onboard.button_boot | {'part': 'SW1 (user guide: Boot Button)', 'uses_pad': ['GPIO0'], 'effect': 'pulls IO0 to G | found |
| esp32-devkitc-v4 | board.onboard.button_boot.guide | Download button: hold Boot, press EN -> Firmware Download mode | found |
| esp32-devkitc-v4 | board.onboard.button_en | {'part': 'SW2 (user guide: EN Button, Reset)', 'uses_pad': ['EN (CHIP_PU)'], 'effect': 'pu | found |
| esp32-devkitc-v4 | board.onboard.led | {'part': 'D1 RED LED + R2 2K from EXT_5V', 'uses_pad': [], 'effect': '5V power-on indicato | found |
| esp32-devkitc-v4 | board.onboard.led.guide | 5V Power On LED turns on when USB or an external 5V supply is connected | found |
| esp32-devkitc-v4 | board.onboard.auto_reset | {'part': 'Q1, Q2 SS8050-G with R21, R22 10K (DTR/RTS from CP2102N)', 'uses_pad': ['GPIO0', | found |
| esp32-devkitc-v4 | board.onboard.usb_connector | Micro-USB (J1 USB_CON8) - power and USB-UART; D3 BAT760-7 VBUS->EXT_5V; ESD diodes D4-D6 L | found |
| esp32-devkitc-v4 | board.onboard.c15 | C15 0.1uF NC (not fitted) | found |

(The 38 connector pin rows are in the connector table above. Mapped to the tables above: 30 audit paths.)
