# Arduino UNO R4 Minima board + core module reconcile (task 2a.4)

Files edited: `catalog/boards/arduino-uno-r4-minima@V1.2.yaml`, `catalog/modules/renesas-ra4m1-uno-r4-core.yaml`, evidence `abx00080-sch-v1.2` (+8 claims, 3 corrected), `abx00080-um-rev6` (+6 claims); `abx00080-pinout-20231127` unchanged (its claims already hold the auditor's locators). Inputs: researcher draft vs blind audit `docs/validation/phase-2a/audit-arduino-uno-r4-minima.yaml` (71 facts). Comparison: the 31 header-pin facts were matched by script (connector, position, label, kind, pad; JDIGITAL position mapped 19 - n, see below); the rest by hand per entity. Each disputed point was re-opened in the PDFs (manual pp. 6, 10, 13, 14, 16 as text; schematic sheet rendered with PyMuPDF and cropped at MD/R5/R6, JDIGITAL, JANALOG, J1, J2, reset, LED, VBUS, crystal blocks). The YAML writer re-emitted all five files byte for byte before any change (sorted keys for board/module, original key order for evidence); each file was re-read immediately before it was written.

## Counts (Facts)

| entity | status | before | after |
| --- | --- | --- | --- |
| board (7 facts) | verified | 0 | 3 (`logic_voltage`, rail 3V3 voltage, rail 5V voltage) |
| | conflict | 0 | 0 |
| | missing | 4 | 4 (3V3, 5V, VIN `max_current`; VIN `voltage`) |
| | single-source | 3 | 0 |
| module (3 facts) | verified | 0 | 2 (`consumed.P914`, `consumed.P915`) |
| | conflict | 0 | 0 |
| | missing | 0 | 1 (`flash_voltage`) |
| | single-source | 3 | 0 |

No `single-source` fact is left in the files. `pnpm catalog:validate` (whole catalog): `catalog validate: 0 errors, 0 warnings in 51 files`; `arduino-uno-r4-minima@V1.2  partially-verified`.

## Match / mismatch by fact

| fact | researcher | auditor | result |
| --- | --- | --- | --- |
| board `logic_voltage` | 5 V | 5 V found (manual s9.2, s5; schematic VCC on +5V) | verified (same sentence as the researcher's claim; note records the schematic read) |
| rail 5V `voltage` | 5 V | 5 V found (s10.1 "+5V Power Rail", s5) | verified; claim `um#analog-5v-rail` added |
| rail 3V3 `voltage` | 3.3 V | 3.3 V found (s9.2 + schematic note "providing 3V3"; VCC_USB, no discrete regulator) | verified; claim `um#analog-3v3-rail` added |
| rail 3V3 / 5V / VIN `max_current` | missing | could-not-verify | missing; notes extended with what both keys searched (the schematic prints "2.3A" next to inductor L3: an inductor rating, not a board limit) |
| rail VIN `voltage` | missing (range) | range 6 / 7.0 / 24 V found | stays missing, range in the note (precedent Pico VSYS) |
| module `consumed.P914`, `P915` = usb | single-source | found (schematic U1 pins 19/18 transcribed; pinout) | verified, `transcribed: true` (figure reads), claim `sch#usb-dp-dm` added |
| module `flash_voltage` | 5 V | inferred "same as VCC (5 V / ~4.7 V)", no quote | missing (see judgement calls) |
| per-pin / total current (8 mA / 60 mA) | not a board fact | found in manual (8 mA) and pinout (8 mA, 60 mA total); schematic none | not stored on the board; the chip file `electrical.pin_current_max` conflict (8 vs 4 mA, active 4) and verified `cumulative_current_max` 60 stay the only competing facts |

No true value mismatch occurred between the two keys on any Fact, so no `conflict` was created. There was one transcription error by the researcher in a plain field (below).

## Plain-field differences (connectors, onboard parts)

1. **MD pull-up resistor (researcher error, fixed).** The researcher wrote that the MD net is tied to +5V through R5 and R6. The auditor says R6 only and that R5 pulls P200 (NMI, INPUT ONLY). The schematic crop settles it: R5 hangs on pin 27 (P200), R6 on pin 26 (MD). Fixed in the `onboard` MD entry, claim `sch#md-net` (quote and supports), new onboard entry and claim `sch#nmi-pullup` for P200 (a pad the researcher had missed; it is bonded, not on a header, not in the module `consumed`).
2. **JDIGITAL numbering reversed between documents.** The schematic symbol numbers D0 = 1 ... D13 = 14, GND 15, AREF 16, SDA 17, SCL 18; the manual table (s10.2) numbers SCL = 1 ... D0 = 18. Manual position = 19 - schematic pin. The manual numbering the researcher used is kept (it also leaves JANALOG, ICSP and SWD identical across both documents); the reversal is in the board header comment and claim `sch#jdigital-numbering`. Every label, kind and pad of the 31 header pins read by the auditor matches the researcher after the mapping (the only text difference is the auditor's longer rail wording for VIN).
3. **JSWD pin 10:** the manual (s10.4) prints NC for SWD pin 10; the schematic (J2 pin 10 on net RESET) and the pinout say RESET. Followed schematic and pinout (`reset`); manual error recorded (`um#swd-pin10-nc`, `sch#swd-reset`, header comment). Pin 6 is NC in all three.
4. **JANALOG pin 1:** manual and pinout "BOOT"; schematic symbol text "NC" but the net is MD (U1 pin 26, P201). Kept label BOOT, kind `reset` (the enum has no boot/strap kind; never assignable). Claim `sch#janalog-pin1-nc`.
5. **Arduino-document errors, recorded in the header comment, not modelled:** D0 and D1 both printed "TX0" and D0 described as receiver (labels here are D0/D1); D5/CANRX0 described as CAN transmitter and D4/CANTX0 as receiver (schematic: D5 = CAN0_RX on P102, D4 = CAN0_TX on P103); manual s12.1 names DL1 as the power LED (DL1 = TX LED, DL3 = power LED); manual s9 says the VUSB pin goes to the buck converter, the second read of the netlist has the USB Schottky D3 on the +5V net and only the VIN/jack Schottky D2 into U2 (claim `um#vusb-buck`; no value depends on it and the netlist was not re-checked on the image).
6. **Details added from the second read (plain fields):** DL4 anode on the P111 net with R17 330 ohm to ground (image checked); reset net R3 5.1 kohm to +5V and C2 not populated (image checked, claim `sch#reset-pullup`); USB connector J3 CX90B-16P with D4 PRTR5V0U2X (claim `sch#usb-connector-parts`); P407 is the junction of R7 (to +5V) and R8 + R9 (to ground), about +5V/3 (image checked); P214/P215 no-connect, P212/P213 reach only the unfitted Y1 (image checked); unconnected pads listed by the auditor (P003, P004, P011, P015, P113, P204, P205, P206, P400-P402, P408-P411) put in the board header (marked as second read, not every pin re-checked on the image); no level shifter, no USB-UART bridge, no auto-reset circuit (auditor, inferred from the absence of parts, header comment only).
7. Researcher onboard entries that the auditor also lists with the same pads: TX/RX LEDs P012/P013, power LED DL3, PB1, USB P914/P915, MD P201, AREF P010 (VREFH0 via ferrite L1 and R4 5.1 kohm to +5V), P500 divider R10/R26, P407, crystal P212/P213, DAC on A0, buck U2. No difference in pad sets.

## Inference decisions (rule 4)

- `logic_voltage` 5 V: the auditor rated it `found`, not inferred; verified.
- `consumed` P914/P915 = usb: both keys read the pads from figures (schematic image, pinout figure); verified with `transcribed: true`.
- `flash_voltage`: missing. The RA4M1 code/data flash is on chip and runs from the MCU VCC, so there is no separate flash supply and no document states a flash voltage. The researcher wrote 5 V (board supply, manual s5), the auditor only inferred "same as VCC (5 V / ~4.7 V)" from the chip datasheet range without a quoted source and with a different condition (4.7 V on USB power). Not an agreed value from the same kind of source, so not verified; the supply is recorded as rail 5V. Owner may instead accept 5 V (nominal supply, VIN powered) if the engine needs a number: the field is required by the module schema but allows `missing`.
- 3V3: the pin is the RA4M1 internal USB LDO output (VCC_USB, U1 pin 20), not the buck converter; both keys read manual s9.2 and the schematic note; verified at 3.3 V; no current limit in any Arduino document.
- 5V: verified at 5 V nominal (about 4.7 V on USB-only power, noted).
- Per-pin current: no board-level fact; consistency with the chip file kept (no second competing fact).

## Alias positions added (decision 24)

| connector:position | label | pad | alias_of (primary) |
| --- | --- | --- | --- |
| JDIGITAL:1 | SCL | P100 | JANALOG:14 (A5) |
| JDIGITAL:2 | SDA | P101 | JANALOG:13 (A4) |
| JICSP:1 | ICSP-CIPO | P110 | JDIGITAL:6 (D12) |
| JICSP:3 | ICSP-SCK | P111 | JDIGITAL:5 (D13) |
| JICSP:4 | ICSP-COPI | P109 | JDIGITAL:7 (D11) |

Plain reset pins on the RESET net (no pad): JANALOG:3, JICSP:5, JSWD:10. JICSP:2 is `power` 5V, JICSP:6 `ground`. New connector `JICSP` (schematic J1) and the existing `SWD` connector renamed `JSWD` (schematic J2) for consistency with JANALOG/JDIGITAL; nothing else referenced `SWD`. Neither gives a `side`. The workaround text (KNOWN MODELLING GAP, the two `onboard` entries for SCL/SDA and ICSP) was removed; the I2C pull-up fact (R1/R2 not mounted) stays as an `onboard` entry.

## Connector comparison summary

JANALOG 14 pins, JDIGITAL 18 (incl. the two aliases), JICSP 6, JSWD 10: all labels, kinds and pads agree with the auditor and the pinout after the numbering mapping above. SWD pins 7/8 labels `SWD_RX` P502 / `SWD_TX` P501 agree with schematic SCI1 RXD/TXD and the pinout. SWDIO P108 and SWCLK P300 are chip pads of the chip file.

## Claims I could not add (chip documents)

- RA4M1 datasheet Table 2.2 (p. 29): "VCC = AVCC0 = VCC_USB = VCC_USB_LDO = 1.6 to 5.5 V" and VCC_USB_LDO minimum 3.8 V when the USB regulator is enabled (auditor `mcu_supply_range_check`). The 5 V / 4.7 V board supply is inside it. If it is not already a claim in `ra4m1-ds-rev1.10`, add it there (board facts here do not depend on it; `flash_voltage` stays missing).
- RA4M1 datasheet p. 32-33 Tables 2.6 per-pin 4 mA / 8 mA (auditor note on the schematic current question): already in the chip file conflict.
- The auditor's RA4M1 note that P200 is "INPUT ONLY NMI" and P214/P215 "INPUT ONLY": already covered by the chip `input_only` facts.
