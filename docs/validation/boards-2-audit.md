# boards-2: second-key audit (hardware-fact-auditor)

Branch `boards-2`, commit 2994565. Audited 2026-10-24.

**Method.** I worked blind. I downloaded every cited PDF myself; the SHA-256 of all 20 PDFs matches the hash in its evidence record. I re-fetched the HTML guides and wikis myself, and the Waveshare pinout and onboard pictures too. I rendered each schematic with PyMuPDF and read the drawing by eye at 3–6x zoom (header connectors, LED and button nets, USB routing, power). I derived each fact from the source first. Only then did I open the catalog YAML for that entity. I did not open `docs/validation/boards-2.md` until every comparison below was finished. I did not edit the catalog.

**Overall result.** No safety-relevant disagreement. I found every strapping pin, flash/PSRAM pad, USB D+/D- pad, input-only pad, ADC2 fact, onboard LED/button pin, header label and header position as recorded. That includes Saola-1 J3-14..17. There are 5 minor disagreements, all in free-text `onboard.effect` notes or file-header comments. In each, the engine-read field (`uses_pad`, `pad`, `position`, `label`, `kind`) is correct. The text needs a fix before the entry is promoted.

---

## 1. Disagreements (exact corrections)

| # | Entity / field | Recorded | Source says | Correction | Severity |
|---|---|---|---|---|---|
| D1 | esp32-s2-saola-1 `onboard[u6 WS2812].effect` | "DIN is driven from GPIO18 through 0 ohm R41 (net RGB_GPIO18); GPIO18 is also on header J3-21 through R40 (EXT_GPIO18)" | Schematic V1.2 sheet 2, RGB block: `GPIO18 -> R41 0(1%) -> EXT_GPIO18` (to J3-21) and `GPIO18 -> R40 0(1%) -> RGB_GPIO18 -> u6 DIN`. Also `R42 10K(1%)` from GPIO18 to VDD33. | "DIN is driven from GPIO18 through 0 ohm **R40** (net RGB_GPIO18); J3-21 connects through 0 ohm **R41** (EXT_GPIO18). GPIO18 has a **10 kohm pull-up R42 to VDD33**, which is the board-level workaround for errata SYSTEM-117." | minor (text only) |
| D2 | esp32-s2-saola-1 `onboard[U4 CP2102N].effect` | "Bridge TXD/RXD connect through 0 ohm R35/R34 to U0TXD (GPIO43) and U0RXD (GPIO44)" | Schematic: CP2102N pin 26 TXD -> **R34** -> U0RXD; pin 25 RXD -> **R35** -> U0TXD | "Bridge TXD -> R34 -> U0RXD (GPIO44); bridge RXD -> R35 -> U0TXD (GPIO43)." The current wording pairs the bridge TXD with U0TXD. | minor (text only) |
| D3 | esp32-c6-devkitc-1 `onboard[D6 WS2812B].effect` | "DIN is driven from GPIO8 through R17 0 ohm (net RGB_CTRL)" | Schematic v1.4 sheet 2, Auto Download/RGB: `GPIO8 -> D11 1N4148W` (cathode at GPIO8) `-> node with R29 10K(1%) to VCC_5V -> R17 0(1%) -> RGB_CTRL -> DIN`. Separately `R6 3.3K(1%)` from GPIO8 to VCC_3V3. | "GPIO8 drives DIN through diode D11 (1N4148W, cathode at GPIO8) and R17 0 ohm. R29 10 kohm pulls DIN up to VCC_5V. GPIO8 itself has a **3.3 kohm pull-up R6 to VCC_3V3**, so any external load on J1-9 works against 3.3 kohm." | minor (text; the 3.3 kohm pull-up is useful load info) |
| D4 | waveshare-esp32-s3-zero `onboard[U1 WS2812B].effect` | "DIN is driven from GPIO21 through R1 1K" | Schematic: U1 pin 4 DIN connects **directly** to net IO21. `R1 1K` runs from 3V3 to the IO21/DIN node, as a pull-up. | "DIN is on GPIO21 (1 kohm pull-up R1 to 3V3); supply 3V3." | minor (text only) |
| D5 | waveshare-esp32-s3-tiny file header comment | "header order agrees with the wiki picture" | Schematic P1 numbers the pads 1 5V, 2 GND, 3 3V3, 4-9 IO1-6, 10 TX, 11 RX, 12-18 IO18..IO12, 19-23 IO7..IO11. The pinout picture runs physically 5V, GND, 3V3, GP1-6 (left), GP7-11 (bottom), GP12-18 (right, bottom to top), RX, TX. | The recorded positions (schematic numbering) are correct. The comment should say: "positions are schematic numbering, NOT the physical sequence; TX/RX (10/11) sit at the top-right corner and IO7-IO11 (19-23) along the bottom edge". The UI must not draw P1 positions as a physical run. | minor (comment / layout risk) |
| D6 | waveshare-esp32-s3-pico connector `TP` | 5 pads (D_N, D_P, GP3, GP21, GP0) | The wiki picture shows TP1-TP6 (GND, D_N, D_P, GP3, GP21, GP0). The schematic TEST POINT block has P8 = GND plus P1-P5. | Optional: add `{kind: ground, label: GND}` as the sixth TP pad. | minor (omission) |

Could not verify (non-safety): esp32-c6-devkitc-1 bridge entry, the clause "R7 (470 ohm from the March 2024 boards)". Schematic v1.4 shows R7 = 470(1%) and R9 = 0(1%), but I found no date statement on the fetched v1.2 guide page. Drop the date clause or keep it `single-source`.

Observation, no disagreement: on esp32-c3-devkitm-1, GPIO8 has `R20 10K(1%)` pull-up to VCC_3V3 (schematic V1.0). The record does not mention it. You could add it to the RGB effect text.

---

## 2. Saola-1 J3 positions 14–17 (flagged by the researcher)

The guide table prints the J3 numbers as 14, 16, 17, 17 (no 15). The schematic V1.2 J3 drawing (CON21X1_2P54, rendered at 4x and read by eye) shows:

| J3 pin | Net (schematic) | Record |
|---|---|---|
| 13 | GPIO36 | IO36 ✓ |
| 14 | GPIO35 | IO35 ✓ |
| 15 | GPIO34 | IO34 ✓ |
| 16 | GPIO33 | IO33 ✓ |
| 17 | GPIO26 | IO26 ✓ |
| 18 | GPIO21 | IO21 ✓ |
| 21 | EXT_GPIO18 (via R41) | IO18 ✓ |

**Agree.** The guide has a typo. The row-order assignment in the record is correct. J3-1 GND, J3-2 CHIP_PU, J3-3..10 GPIO46/45/U0RXD/U0TXD/42/41/40/39, J3-19 GPIO20, J3-20 GPIO19 all agree. J2-1..21 (VDD33, GPIO0..17, +5V, GND) all agree.

---

## 3. Per-fact results: boards

✓ = agree, ✗ = disagree (see section 1), ? = could not verify.

| Board | Fact | Result | Source re-read |
|---|---|---|---|
| **ESP32-S2-Saola-1 V1.2** | J2 1-21 labels/positions | ✓ | guide J2 table + sch J2 |
| | J3 1-21 labels/positions (incl. 14-17) | ✓ | sch J3 (guide misprinted) |
| | Native USB GPIO19/20 not fitted (R32/R33 0R NC, "USB Debug Reserved"); micro-USB -> CP2102N via R39/R38 | ✓ | sch USB block |
| | RGB LED on GPIO18 | ✓ pad / ✗ text (D1) | guide "driven by GPIO18"; sch |
| | Boot SW1 on GPIO0; Reset SW2 on CHIP_PU (R36 10K, C22 1uF) | ✓ | sch |
| | Auto-program Q1/Q2 L8050 -> EN_Auto/IO0_Auto via R28/R29 | ✓ | sch |
| | CP2102N on GPIO43/44 | ✓ pads / ✗ text (D2) | sch |
| | 3V3 = U5 SGM2212-3.3 from +5V; 5V = VBUS via D1 1N5819HW | ✓ | sch power block |
| | Power LED D5 (R7 5.1K) on VDD33 | ✓ | sch |
| | Rail currents missing | ✓ (nothing stated) | guide + sch |
| **ESP32-C3-DevKitM-1 V1.0** | J1 1-15 (GND,3V3,3V3,IO2,IO3,GND,RST,GND,IO0,IO1,IO10,GND,5V,5V,GND) | ✓ | guide J1 + sch |
| | J3 1-15 (GND,TX=21,RX=20,GND,IO9,IO8,GND,IO7,IO6,IO5,IO4,GND,IO18,IO19,GND) | ✓ | guide J3 + sch |
| | RGB SK68XXMINI-HS D6 on GPIO8 via R17 0R (RGB_CTRL), VCC_3V3 | ✓ | guide "driven by GPIO8"; sch |
| | Boot SW1 GPIO9; Reset SW2 CHIP_PU (R5 10K, C6 1uF) | ✓ | sch |
| | Auto-program pulls CHIP_PU and GPIO9 | ✓ | sch Q1/Q2 |
| | CP2102N via R21/R22 0R to U0RXD/U0TXD | ✓ | sch |
| | Native USB R2/R3 0R NC; micro-USB -> bridge | ✓ | sch |
| | 3V3 SGM2212-3.3; 5V via D1 1N5819HW; D5 red LED R11 5.1K on VCC_5V | ✓ | sch |
| **ESP32-C6-DevKitC-1 V1.2 (sch v1.4)** | J1 1-16 (3V3=ESP_3V3, RST, 4,5,6,7,0,1,8,10,11,2,3, 5V, G, NC) | ✓ | guide J1 + sch (pin 16 unconnected) |
| | J3 1-16 (G, TX=16, RX=17, 15,23,22,21,20,19,18,9, G, 13, 12, G, NC) | ✓ | guide J3 + sch |
| | RGB WS2812B on GPIO8, VDD = VCC_5V | ✓ pad / ✗ text (D3) | guide; sch |
| | Boot SW1 GPIO9; Reset SW2 CHIP_PU | ✓ | sch |
| | Auto-download U6 BC847BDW1T1G -> CHIP_PU (R8), GPIO9 (R13) | ✓ | sch |
| | CP2102N -> UART_RXD (R7 470) / UART_TXD (R9 0) = GPIO17/16 | ✓ (date clause ?) | sch |
| | J4 native USB-C -> GPIO12/13; VBUS via D7 | ✓ | guide "ESP32-C6 USB Type-C Port"; sch |
| | J5 jumper VCC_3V3 -> ESP_3V3 | ✓ | guide Current Measurement; sch |
| | 3V3 SGM2212-3.3; 5V via D1/D7 1N5819HW; D5 red R11 5.1K | ✓ | sch |
| **Waveshare ESP32-C3-Zero (Sch-V2)** | Header 1-18 (5V,GND,3V3,IO0..IO10,IO18,IO19,RX=20,TX=21) | ✓ | sch "Header 20" |
| | WS2812B on GPIO10, VDD 5V | ✓ | wiki "GPIO10 ... WS2812"; sch |
| | BOOT on GPIO9; RESET CHIP_EN (R21 10K, C6) | ✓ | wiki; sch |
| | GPIO18/19 = USB D-/D+ direct (UD_N/UD_P) and on header 15/16 | ✓ | sch |
| | GPIO12-17 not exposed (flash) | ✓ | wiki "GPIO12 to GPIO17 pins are not exposed" |
| | 3V3 ME6217C33M5G; 5V input 3.7-6 V | ✓ | sch; wiki "Input 3.7V~6V" |
| | No diode between USB VBUS and 5V (my observation; record makes no claim) | n/a | sch |
| **Waveshare ESP32-C6-Zero** | P8 1-18 (5V,GND,3V3,IO0-5,IO22,21,20,19,18,15,14,RX=17,TX=16 via R7 499R) | ✓ | sch P8; picture silkscreen order consistent |
| | Back pads GP13,12,23,9,8,7,6 | ✓ | picture + sch test points P1-P7 |
| | WS2812B on GPIO8 (R1 10K pull-up) | ✓ | sch; picture "GP8 DIN" |
| | BOOT Key1 GPIO9 (R5 10K); RESET Key2 (R6 10K, C16 1uF) | ✓ | sch |
| | USB D-/D+ on GPIO12/13 | ✓ | sch |
| | 3V3 ME6217C33M5G, 800 mA; 5V via D1 B5819WS | ✓ | sch; onboard picture "800mA (Max)" |
| **Waveshare ESP32-S3-Zero** | P15 1-18 (TX=43 via R6 499R, RX=44, IO13..IO1, 3V3, GND, VBUS/5V) | ✓ | sch P15; picture |
| | 11 extra pads (16,15,14 front; 45,42,41,40,39,38,18,17 back) | ✓ | sch yellow pads; picture |
| | GPIO33-37 not led out (chip pins 38-42 unconnected) | ✓ | sch |
| | WS2812B on GPIO21, VDD 3V3 | ✓ pad / ✗ text (D4) | wiki; sch |
| | BOOT K2 GPIO0 (R3 10K); RESET K1 (R2 10K) | ✓ | sch |
| | USB GPIO19/20 via 22R R7/R8 | ✓ | sch |
| | 3V3 ME6217C33M5G 800 mA; 5V 3.7-6 V | ✓ | wiki text |
| **Waveshare ESP32-S3-Tiny** | P1 1-23 (5V,GND,3V3,IO1-6,TX=43 via R2 499R,RX=44,IO18..IO12,IO7..IO11) | ✓ (comment ✗ D5) | sch P1 |
| | 14 back pads (48,47,45,42,41,40,39 / 21,33,34,35,36,37,38) | ✓ | sch test points P2-P15; picture |
| | WS2812B on GPIO38 (R1 10K) | ✓ | sch; picture "GP38 DIN" |
| | FPC L1: IO0 (R3 10K), RESET (R4 10K), USB_N/P (R6/R7 22R), VBUS | ✓ | sch |
| | 5V = VBUS via D1 B5819WS; 3V3 ME6217C33M5G 800 mA | ✓ | sch; onboard picture |
| **Waveshare ESP32-S3-Pico** | J 1-40 (all labels and positions, 21=GP42, 22=GP41, 30=RUN/CHIP_PU, 36=3V3, 37=3V3_EN, 39=VSYS, 40=VBUS) | ✓ | sch PIN OUT U6; picture; silkscreen sheet 2 |
| | TP pads D_N=19, D_P=20, GP3, GP21, GP0 | ✓ (GND pad missing, D6) | sch TEST POINT; picture |
| | WS2812B on GPIO21 (R19 10K) | ✓ | sch |
| | GPIO3 = USB_ADC (VBUS divider R2/R4 100K) | ✓ | sch |
| | CH343P via R16 0R / R17 499R; CH334F hub with GPIO19/20 via R18/R20 0R | ✓ | sch |
| | W25Q128 on SPICS0/SPIQ/SPIWP/SPICLK/SPID/SPIHD, VCC = VDD_SPI | ✓ | sch Flash block |
| | VSYS = VBUS via D1 MBR230LSFT1G; MP28164 2 A | ✓ | sch; wiki |
| **Waveshare ESP32-S3-DEV-KIT-N8R8** | P1 1-22 (3V3,3V3,EN,4,5,6,7,15,16,17,18,8,3,46,9,10,11,12,13,14,5V,GND) | ✓ | sch P1 |
| | P2 1-22 (GND,TX,RX,1,2,42,41,40,39,38,37,36,35,0,45,48,47,21,20,19,GND,GND) | ✓ | sch P2 |
| | GPIO35/36/37 on header P2-13/12/11 but consumed by the octal PSRAM (module record) | ✓ (safety item correctly represented) | sch + existing module record |
| | WS2812B on GPIO38 via R5 0R, VDD3V3 | ✓ | sch |
| | KEY_FLASH S1 on IO0 (R3 10K); KEY_RST S2 on EN (R2 10K, C5 1uF) | ✓ | sch |
| | CH343P via R7/R8 0R; CH334F hub USB1 = GPIO19/20; auto-program VT1/VT2 S8050 | ✓ | sch |
| | VDDUSB via D1 B5819WS; U2 SGM2212-3.3/AMS1117; LED2 red on VDD3V3 | ✓ | sch |

---

## 4. Per-fact results: chips

| Chip | Fact group | Result | Source re-read |
|---|---|---|---|
| **esp32-s2** | Strapping GPIO0 (WPU, 1), GPIO45 (WPD, 0 = VDD_SPI 3.3 V), GPIO46 (WPD; boot with GPIO0; ROM print) | ✓ | DS v1.9 Tables 3-1, 3-3, 3-4, 3-5 |
| | GPIO46 input-only; all others I/O/T | ✓ | DS Table 2-3 (GPIO46 "I") |
| | GPIO26-32 = SPICS1/SPIHD/SPIWP/SPICS0/SPICLK/SPIQ/SPID (P4); GPIO33-37 octal (P3) | ✓ | DS §2.3.6, Table 2-14 |
| | GPIO19/20 USB_D-/D+; GPIO39-42 JTAG; GPIO43/44 UART0 | ✓ | DS §2.3.5/2.3.6 |
| | reset_state for all 43 pads (At Reset column, incl. GPIO9-14 and DAC_1/2 blank at reset, IE after) | ✓ | DS Table 2-1 (column positions checked by coordinate) |
| | ADC1 GPIO1-10, ADC2 GPIO11-20; ADC2 radio_conflict true | ✓ | DS Table 2-8; ESP-IDF "ADC2 is also used by Wi-Fi" |
| | ADC ranges 0-700/950/1200/2300 mV; 2450 mV note | ✓ | DS Table 5-6, §5.5 |
| | SYSTEM-117 on GPIO18 (v0.0, pin 24 DAC_2 not pulled up) | ✓ | errata v1.2 §3.2 |
| | No power-up glitch table (negative finding) | ✓ (weak basis, as noted) | DS v1.9 has none |
| | cumulative 1800 mA; RPU/RPD 45 k; VIH 0.75 VDD, VIL 0.25, VOH 0.8, VOL 0.1 | ✓ | DS Tables 5-1, 5-4 |
| | SPI2 IO MUX pins 9-14; UART1 17-20 | ✓ | DS Table 2-3 |
| **esp32-c3** | Straps GPIO2 (floating, recommended high), GPIO8 (floating; Joint Download needs 1), GPIO9 (WPU, 1) | ✓ | DS v2.4 Tables 3-1, 3-3 |
| | GPIO11 = VDD_SPI; GPIO12-17 = SPI flash (P4); GPIO18/19 USB; 4-7 JTAG; 20/21 UART0 | ✓ | DS §2.3.4 |
| | reset_state 22 pads (GPIO2/3/8 IE; GPIO9 IE+WPU; 12-17 WPU; rest blank) | ✓ | DS Table 2-1 (rendered) |
| | Power-up glitches MTCK/MTDO/GPIO10/U0RXD low 5 ns; GPIO18 high 50 µs | ✓ | DS Table 2-2 |
| | ADC2 only GPIO5; ADC-183; radio_conflict missing | ✓ | errata v1.3 §3.2; ESP-IDF "ADC2 oneshot mode is no longer supported" |
| | ADC ranges 0-750/1050/1300/2500 mV; cumulative 1000 mA; DC levels; 45 k | ✓ | DS Tables 5-1, 5-4, 5-6 |
| **esp32-c6** | Straps MTMS/MTDI (floating, SDIO edge), GPIO8 (floating), GPIO9 (WPU, 1), GPIO15 (floating, JTAG source) | ✓ | DS v1.5 Tables 3-1, 3-3, 3-4, 3-7 |
| | QFN40 pads 0-13, 15-30; QFN32 pads 0-9, 12-23 (GPIO14 only on QFN32) | ✓ | DS Tables 2-4/2-5 |
| | GPIO24-26, 28-30 flash (P4); GPIO27 VDD_SPI; 12/13 USB; 16/17 UART0 | ✓ | DS §2.3.5, Table 2-16 |
| | reset_state incl. GPIO13 USB_PU, SDIO 18-23 WPU, GPIO14 blank (QFN32) | ✓ | DS Tables 2-1/2-2 (rendered) |
| | ADC1 only (GPIO0-6); ranges 0-1000/1300/1900/3300 mV | ✓ | DS Table 5-6 |
| | No power-up glitch table; errata IDs (10) name no pad | ✓ | DS v1.5; errata v1.3 |
| | cumulative 1000 mA; DC levels; 45 k | ✓ | DS Tables 5-1, 5-4 |

## 5. Per-fact results: modules

| Module | Fact | Result | Source re-read |
|---|---|---|---|
| esp32-s2-wrover | bonded 37 pads (IO0-21, 26, 33-46) | ✓ | WROVER DS v1.4 Table 2 |
| | GPIO26 consumed psram (CS of PSRAM U3) | ✓ | Table 2 footnote 2; module schematic |
| | GPIO27-32 consumed flash (no module pin) | ✓ | module schematic U2/U3 |
| | flash 3.3 V (FLASH-3V3, PSRAM-3V3) | ✓ | module schematic |
| | psram 2 MB SPI | ✓ | DS Table 1 |
| esp32-s2-wroom | bonded 37 pads; GPIO26 free (PSRAM-3V3(NC)); 27-32 flash; 3.3 V | ✓ | WROOM DS v1.5 Table 2 + schematic |
| esp32-c3-mini-1-n4x | bonded 15 pads (IO0-10, 18-21); GPIO11 internal; 12-17 flash; 3.3 V | ✓ | MINI-1 DS v2.2 Table 3-1, Table 1-1; C3 DS Table 1-1 (FH4X: 16 GPIOs, pins 19-24 NC) |
| esp32-c3fh4 | bonded 15; GPIO11 internal; 12-17 flash | ✓ | C3 DS Table 1-1 (FH4 is 22-GPIO, flash pads bonded but reserved); wiki |
| esp32-c6-wroom-1-n8 | bonded 23 (0-13, 15-23); 24-26, 28-30 flash; 27 internal | ✓ | C6-WROOM-1 DS v1.4 Table 3-1 |
| esp32-c6fh4 | bonded 22 QFN32 pads; consumed {} (flash pads not routed out) | ✓ | C6 DS §2.6 "not routed out" |
| esp32-s3fh4r2 | 26 psram, 27-32 flash; 33-37 free (quad PSRAM); 3.3 V; 2 MB Quad PSRAM | ✓ | S3 DS v2.2 Table 1-1, Table 2-14 |
| esp32-s3r2 | 26-28, 30-32 psram; 29 neither (board flash CS); 3.3 V; 2 MB Quad | ✓ | S3 DS Table 1-1 (S3R2 EOL, 3.3 V), Table 2-14 |

---

## 6. Facts promotable to `verified` (two keys now agree)

- **Chips esp32-s2, esp32-c3, esp32-c6:** every `single-source` fact. Facts that are `missing` stay `missing` (abs_max_vin, pin_current_max, matrix_max_hz, C3 GPIO5 radio_conflict). You may promote the `power_up_glitch: none` negative findings for S2 and C6. Neither datasheet has a glitch table, so both keys agree. Keep the weak-basis note.
- **Modules:** all 8 new module records (esp32-s2-wrover, esp32-s2-wroom, esp32-c3-mini-1-n4x, esp32-c3fh4, esp32-c6-wroom-1-n8, esp32-c6fh4, esp32-s3fh4r2, esp32-s3r2), all fields.
- **Boards:** all connector pins (labels, pads, positions, kinds) on all 9 boards, every rail voltage, and every rail current that has a value (800 mA S3-Zero/S3-Tiny/C6-Zero, 2 A S3-Pico). All `onboard` entries, **except** these, which need the text fixed first (`uses_pad` already agrees):
  - Saola-1 RGB LED (D1) and CP2102N (D2)
  - C6-DevKitC-1 RGB LED (D3); also drop or keep the "March 2024" clause in the bridge entry
  - S3-Zero RGB LED (D4)
- **Comment fixes, not fact status:** the S3-Tiny header comment (D5) and the optional S3-Pico GND test pad (D6).

No fact needs `conflict`.

---

## 7. Resolution

Applied to the catalog on branch `boards-2` (not pushed).

- D1 (Saola RGB): text now R40 -> DIN, R41 -> J3-21, R42 10 kohm pull-up on GPIO18 (SYSTEM-117 workaround).
- D2 (Saola bridge): TXD -> R34 -> U0RXD (GPIO44); RXD -> R35 -> U0TXD (GPIO43).
- D3 (C6-DevKitC-1 RGB): D11 diode, R17, R29 pull-up, and R6 3.3 kohm pull-up on GPIO8 recorded.
- D4 (S3-Zero): R1 1 kohm is a pull-up on GPIO21; DIN is direct.
- D5 (S3-Tiny): header comment now states schematic numbering is not the physical sequence.
- D6 (S3-Pico): sixth TP pad `GND` (position 6) added.
- C6-DevKitC-1 "March 2024" clause dropped; the 470 ohm R7 is stated as schematic v1.4 only.
- Saola J3-14..17 comment changed from GAP/CONFLICT to RESOLVED (guide typo, schematic correct).
- Promoted to `verified` with reviewers [hardware-researcher, hardware-fact-auditor]: all `single-source` facts in chips esp32-s2/c3/c6 (including the S2/C6 `power_up_glitch: none` negatives; weak-basis notes kept), the 8 new modules, and the logic_voltage and rail facts of the 9 boards. `missing` facts unchanged. Board `onboard` entries carry no status, so the text fixes complete them. No fact moved to `conflict`.
