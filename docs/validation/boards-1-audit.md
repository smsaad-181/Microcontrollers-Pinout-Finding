# boards-1: blind second-key audit (hardware-fact-auditor)

Branch `boards-1` @ 388b6bb, audited 2026-10-24. Method: every cited source was downloaded fresh, and its sha256 checked against the evidence record. Facts were derived **before** opening the catalog YAML or `boards-1.md`. Schematics and images were rendered at high resolution (Windows.Data.Pdf → PNG, then cropped) and read visually. The HUZZAH32 EAGLE `.sch` was parsed as XML into a netlist. Catalog values were compared only after that.

Sources re-read (sha256 matches the evidence record unless noted):

| Evidence id | What was read | Hash |
| --- | --- | --- |
| esp-wrover-kit-v4.1-ug | Espressif guide HTML: JP1 table, legend, RGB/SD/LCD/JTAG/camera/osc tables, LDO, notes | HTML (null) |
| *(new)* ESP-WROVER-KIT_V4_1.pdf | Official schematic, `https://dl.espressif.com/dl/schematics/ESP-WROVER-KIT_V4_1.pdf` (linked from the guide) | fd2c3428…f0a6c37 |
| adafruit-huzzah32-sch | EAGLE XML → netlist (JP1/JP3/X2/D3/R1/R3/Q1/Q2/IC1/U2/U3) | c94cbaf6… ✓ |
| adafruit-huzzah32-learn-pinouts / -power | Learn pages (text) + official pinout PNG 000/133/601 | HTML |
| nodemcu-32s-ds-v1 | Table 2, Fig. 1 (p.5), schematic image (p.10, rendered 6000 px) | f2aa1d3f… ✓ |
| lolin32-sch-v1.0.0 | Schematic (archive copy; wemos.cc does not resolve via DNS) rendered at 8000 px | d18db4cb… ✓ |
| lolin32-wiki | Archived wiki text | HTML |
| lilygo-ttgo-t-display-readme / -pinmap / -sch | README table; pinmap.jpg read from the image; schematic rendered at 9000 px | 29fd27a0… / a705ea06… / aea09366… ✓ |
| esp32-wroom-32-ds-v3.8 | Table 2 pin definitions, footnote 2, Table 3 straps, §3.2, Table 15 | fe7dced2… ✓ |

Legend: **A** = agree, **D** = disagree (correction below), **CNV** = could not verify.

---

## 1. ESP-WROVER-KIT v4.1

Independent sources: the guide, plus the official v4.1 schematic (not used by the researcher). The schematic gives JP1 real pin numbers: left column = odd pins 1..27, right column = even pins 2..28.

| Fact | Auditor reading | YAML | Result |
| --- | --- | --- | --- |
| JP1-left rows 1-14 | 3.3V, IO32, IO12, IO14, IO26, IO35, IO39, EN, IO22, IO19, IO5, IO16, IO0, IO15 (guide). Schematic JP1 odd pins 1..27: VDD33, JP_IO32, IO12, IO14, IO26, IO35, SENSOR_VN, EN, IO22, IO19, IO5, IO16, IO0, IO15 | same | A |
| JP1-right rows 1-14 | GND, IO33, IO13, IO27, IO25, IO34, IO36, IO23, IO21, IO18, IO17, IO4, IO2, 5V (schematic even pins: GND … SW_+5V) | same | A |
| IO32/IO33 at JP1 3/4 not connected by default | Guide note (R11/R23 → R12/R24) | nc | A |
| IO16/IO17 at JP1 23/22 | Guide note: "By default, the two GPIOs are not broken out to the board's pin headers". **Schematic:** module IO16/IO17 → R147/R146 0R → R108/R106 0R → JP1, with no "(NC)" mark | nc | A on the conservative modelling. **Conflict between sources** (see D-1) |
| 5V pin | Schematic: JP1-28 = SW_+5V (after the power switch) | power 5V | A |
| RGB LED | Guide: GPIO0 red, GPIO2 green, GPIO4 blue. Schematic: R_IO2→Q6, R_IO0→Q7, R_IO4→Q8 (LBSS138 low-side N-MOSFET gates; LED on when the pad is high) | GPIO0/2/4 | A (effect wording, see D-3) |
| BOOT button | **Schematic:** SW3 → Q10 **and** Q11 pull **IO0 and IO2** low (R172/R173 0R). The guide legend calls it SW2 | GPIO0 only | **D-2** |
| Strap loads from the SD circuit | Schematic: 10 k pull-ups R153 (D0/GPIO2), R152 (D1/GPIO4), R156 (D3/GPIO13), R155 (CMD/GPIO15), R154 (CLK/GPIO14). R157 on DATA2/GPIO12 is **(NC)**. R168 10 k pull-up on GPIO21 (CD) | not recorded | **D-2** (missing safety fact) |
| Camera pads | 27, 26, 25, 23, 22, 21, 35, 34, 39, 36, 19, 18, 5, 4, 0 | same 15 | A |
| LCD pads | RESET 18, SCL 19, D/C 21, CS 22, SDA 23, SDO 25, backlight 5 | same | A. Schematic: backlight goes through Q5/Q4 (two inverting NPN stages), so GPIO5 high turns the backlight **off** (informational) |
| microSD pads | D2 12, D3 13, CMD 15, CLK 14, D0 2, D1 4, CD 21 | same | A |
| JTAG | TMS 14, TDO 15, TDI 12, TCK 13; EN is TRST_N; jumpers open by default | same | A |
| UART0 on GPIO1/3 via JP2 | Guide: UART row; module TXD0/RXD0 | same | A |
| Flash GPIO6-11 / PSRAM 16/17 | Guide: SPI flash pins are not usable externally; PSRAM uses 16/17 (module record esp32-wrover-e, reused) | not on JP1 | A |
| 3V3 rail | NCP1117, 1 A max (guide); schematic U4 NCP1117 | 3.3 V / 1000 mA | A |
| 5V rail | USB or 5.5×2.1 mm jack, centre positive, JP7 selects | 5 V, current missing | A |

## 2. Adafruit HUZZAH32 Feather

Netlist from the EAGLE XML: JP1 1..16 = IO21, IO17, IO16, IO19(MISO), IO18(MOSI), IO5(SCK), IO4(A5), IO36(A4), IO39(A3), IO34(A2), IO25(A1), IO26(A0), GND, *(no net)*, 3.3V, RESET(EN). JP3 1..12 = VBAT, EN(regulator), VBUS, IO13, IO12, IO27, IO33, IO15, IO32, IO14, SCL(IO22), SDA(IO23).

| Fact | Auditor reading | YAML | Result |
| --- | --- | --- | --- |
| JP1 pins 1-13, 15, 16 | as above | same | A |
| JP1-14 | No net. The official pinout PNG labels it "N/C" | omitted | A (optional: add `kind: nc`, label "NC") |
| JP3 1-12 | as above | same | A |
| GPIO16/17 = RX/TX | Official pinout PNG: "16 D16 … U2RXD" and "17 D17 … U2TXD"; the board silkscreen in the PNG reads RX/TX next to them | labels IO16/IO17 | A on the pads. The researcher's open question is resolved: the Adafruit pinout diagram ties RX=16, TX=17 (optional label change) |
| LED GPIO13 | D3 red, R10 1 K to GND (anode via R10 from IO13); active high | same | A |
| UART0 to CP2104 | X2.RXD0↔IC1.TXD, X2.TXD0↔IC1.RXD | GPIO1/3 | A |
| Auto-reset | Q1 → EN (RESET), Q2 → GPIO0; there is **no BOOT button** (SW2 is reset only) | same | A |
| GPIO35 VBAT/2 | R1/R3 100 K/100 K, not on the header | same | A |
| GPIO2 / GPIO0 | Not on the headers (X2 pads only) | noted | A |
| 3V3 rail | U2 AP2112-3.3; guide "500mA peak", budget 250 mA for the module | 500 mA peak | A |
| USB 5 V; BAT | VBUS; BAT on the JST connector (MCP73831-2, PROG 4.7 K) | 5 V / missing | A |

## 3. NodeMCU-32S V1.2 (Ai-Thinker)

| Fact | Auditor reading (p.10 schematic GPIO block; p.5 Fig. 1; Table 2) | YAML | Result |
| --- | --- | --- | --- |
| J1 1-19 | VDD3V3, #EN, SVP, SVN, IO34, IO35, IO32, IO33, IO25, IO26, IO27, IO14, IO12, GND, IO13, SD2, SD3, CMD, VDD5V | same | A |
| J2 1-19 | GND, IO23, IO22, U0TX, U0RX, IO21, GND, IO19, IO18, IO5, IO17, IO16, IO4, IO0, IO2, IO15, SD1, SD0, CLK | same | A |
| Table 2 numbers the right side 20=CLK … 38=GND (opposite order to J2) | confirmed | comment | A |
| SD2/SD3/CMD/SD0/SD1/CLK = GPIO9/10/11/7/8/6 | Table 2 / Fig. 1 "FLASH D2 …" | nc + module consumed | A (Fig. 1 labels them FLASH D0-D3/CMD/SCK, which supports "flash") |
| LED1 | Blue, IO2 → R9 470 Ω → LED → GND (active high) | same | A |
| BOOT key | S2: IO0 → R12 470 Ω → GND; R14 12 K pull-up to VDD3V3 | same | A |
| EN key | S1 with R13 12 K pull-up, R11 470 Ω | (not listed; reset) | A |
| Auto-program | VT1/VT2 S8050 driven by DTR/RTS → #EN, IO0 | same | A |
| Bridge | CP2102, U0RX/U0TX | same | A |
| Regulator | U4 AMS1117-3.3, VDD5V in; D1 1N5819/SS14 from VDDUSB | 3.3 V, current missing | A |
| Power LED | LED2 red from VDD5V via R10 1 K (not a GPIO) | — | A |

## 4. LOLIN32 V1.0.0

| Fact | Auditor reading | YAML | Result |
| --- | --- | --- | --- |
| P2 1-16 | +3V3, EN, VP, VN, IO32, IO33, IO34, IO35, IO25, IO26, IO27, IO14, IO12, IO13, +5V, GND | same | A |
| P3 1-20 | GND, TXD0, RXD0, +3V3, IO22, IO21, GND, GND, IO19, IO23, IO18, IO5, +3V3, IO17, IO16, IO4, IO0, GND, IO2, IO15 | same | A |
| LED2 on GPIO5 | IO5 = LED cathode; anode → R9 2 k → +3V3. Active low; also biases strap GPIO5 high, which is its default | same | A |
| Bridge | U6 CP2104, TXD0/RXD0 (R8 470 Ω on RXD0 side) | same | A |
| Auto-program | U4 UMH3N, RTS/DTR → EN, IO0 | same | A |
| Buttons | K1 RESET on EN only (R1 10 k, C4 1 µF); **no BOOT button** | none listed | A |
| Regulator / charger | U3 ME6211; U5 TP4054 with R7 2 k PROG; wiki "500mA Max charging current" | 3V3 current missing | A |
| Module | U1 ESP-WROOM-32 | esp32-wroom-32 | A |

## 5. LilyGO TTGO T-Display V1.1

The schematic is fully readable when rendered: the "label soup" is only the text layer. Header P4/P5 in the schematic **match** the pinmap order (P4: 1 +5V, 2 GND, 3 IO27, 4 IO26, 5 IO25, 6 IO33, 7 IO32, 8 IO39, 9 IO38, 10 IO37, 11 IO36, 12 VDD3V3; P5: 1 VDD3V3, 2 GND, 3 GND, 4 IO12, 5 IO13, 6 IO15, 7 IO2, 8 IO17, 9 IO22, 10 IO21, 11 GND, 12 GND).

| Fact | Auditor reading | YAML | Result |
| --- | --- | --- | --- |
| Left header top→bottom | GND, GND, 21, 22, 17, 2, 15, 13, 12, GND, GND, 3V3 (pinmap; = P5 12→1) | same | A |
| Right header top→bottom | 3V3, SVP/36, 37, 38, SVN/39, 32, 33, 25, 26, 27, GND, 5V (pinmap; = P4 12→1) | same | A |
| Display | ST7789: SDA/MOSI IO19, SCL IO18, RS/DC IO16, RESET IO23, CS IO5. Backlight: IO4 → R52 1 K → Q0 S8050 (R53 100 K pull-down), active high. 10 K pull-ups R8-R12 on the five SPI lines to the switched "V3V" rail | 4, 5, 16, 18, 19, 23 | A |
| Buttons | S1 on IO0 to GND (C3 100 nF; no external pull-up). S2 = KEY1 = **IO35** to GND with **R1 100 K pull-up** to VDD3V3 (C11 100 nF). S3 = CHIP_PU (reset) | GPIO0, GPIO35 | A on the pads. Effect text is incomplete (D-5) |
| GPIO34 battery ADC | BAT_ADC = chip pin 10 (VDET_1/IO34); R6/R7 100 K/100 K from BAT → reads BAT/2; C22 10 nF | GPIO34 | A (could add ratio 1/2) |
| GPIO14 "ADC Power" | Schematic net PWR_EN = chip pin 17 (MTMS/IO14). PWR_EN (OR'd with VBUS via D6/D1) → R25 → Q3 PMBT3904 → gates of P-FETs Q4 (BAT path) and Q6 (VDD3V3 → V3V). The R6/R7 battery divider sits **directly on BAT**, not on a switched rail | "enables the battery-measurement path; circuit not read" | **D-4** |
| GPIO37/38 on the header | Chip pins 6/7 SENSOR_CAPP/CAPN. **C49 270 pF between IO36 and IO37; C32 270 pF between IO38 and IO39** | plain gpio | **D-6** (missing load) |
| UART bridge | U4 CP2104; U0TXD/U0RXD through series resistors; Q1/Q2 PMBT3904 auto-program to CHIP_PU/IO0 | "not stated, no onboard entry" | **D-7** (now evidenced) |
| Regulator | U7 AP2112K-3.3V (RT9013), EN tied to the input via R33 100 K; charger U6 TP4054, red LED1 CHRG | "part not read" | D-7 (part identifiable; current still needs the regulator datasheet) |
| Flash | U2 W25Q32: CS=SCS/CMD, DO=SDO/SD0, WP=SWP/SD3, HOLD=SHD/SD2, CLK=SCK/CLK, DI=SDI/SD1, VCC=VDD_SDIO | GPIO6-11 consumed | A |

## 6. DOIT ESP32 DevKit V1 (30-pin, 36-pin)

| Fact | Result |
| --- | --- |
| `status: datasheet-required`, `connectors: []`, no onboard, logic voltage missing | A. These are the correct, safe stubs. The auditor did not independently search for a DOIT primary document (CNV on "no official source exists"). The placeholder `esp32-wroom-32` variant is flagged in the YAML comment; make sure the engine never offers these boards for allocation. |

## 7. Modules

| Module / fact | Auditor reading | YAML | Result |
| --- | --- | --- | --- |
| esp32-wroom-32 bonded_pads | Table 2: GPIO0-19, 21-23, 25-27, 32-36, 39 (pin 32 NC). 32 pads | same 32 | A |
| esp32-wroom-32 consumed GPIO6-11 | Footnote 2: "GPIO6 to GPIO11 … connected to the SPI flash integrated on the module and are not recommended for other uses" (pins 17-22) | flash | A |
| esp32-wroom-32 straps | Table 3: GPIO0 PU/1, GPIO2 PD/0, MTDI PD/0, MTDO PU/1, GPIO5 PU/1 (chip record; not re-stored in the module) | — | A (consistent with chip) |
| esp32-wroom-32 psram none | Table 1 single 4 MB part, no PSRAM | none | A (inferred, as noted) |
| esp32-wroom-32 flash_voltage | Table 15 lists both 1.8 V and 3.3 V grades; §3.2 MTDI=0 gives VDD_SDIO ≈ 3.3 V. The datasheet text does not state which grade is fitted | missing | A (missing is correct from this text; Ch. 7 module schematic not read: CNV) |
| esp32-wroom-32s bonded_pads | NodeMCU-32S schematic M1 "ESP-32S_Module": WROOM-32 pin order, 27=GPIO16, 28=GPIO17, 32=NC | same 32 | A. Note: the schematic also has an alternate footprint M2 "ESP32-SP" with pins 27/28 = **NC** (WROVER-style). If a board is built with M2, header J2-11/12 (IO17/IO16) are dead/PSRAM. CNV which one is fitted on retail boards |
| esp32-wroom-32s consumed 6-11 | Fig. 1 labels FLASH D0-D3/CMD/SCK | interim flash | A (can cite Fig. 1 as direct support) |
| esp32-wroom-32s psram | not present in the record | — | CNV (no psram field; Table 1 lists flash only) |
| ttgo-t-display-core bonded_pads | All QFN48 GPIOs incl. 37/38 (pins 6/7) | same 34 | A |
| ttgo-t-display-core consumed 6-11 | W25Q32 wiring read from the rendered schematic (above) | flash, transcribed | A (connectivity now confirmed; the "label soup" caveat can be dropped) |
| ttgo-t-display-core psram none | README "Disable PSRAM"; schematic has no PSRAM IC | none | A |
| ttgo-t-display-core flash_voltage | W25Q32 VCC = VDD_SDIO (no number printed) | missing | A |

---

## Disagreements and corrections

- **D-1 (WROVER-KIT GPIO16/17, conflict, keep `nc`).** Two official sources disagree. The guide's note says GPIO16/17 are not broken out by default, but its JP1 table and the v4.1 schematic (R147/R146 → R108/R106, all "0R(1%)", no NC mark) show them wired to JP1-23/JP1-22. Keep `kind: nc` (conservative: they are PSRAM CS/CLK either way). Record `status: conflict` in the comment, citing guide §"Overview" Note and schematic "Connector" block R106/R108.
- **D-2 (WROVER-KIT BOOT button + strap pull-ups, major).** The BOOT switch (schematic SW3, guide "SW2") drives Q10 **and Q11**, pulling **GPIO0 and GPIO2** low. Correct `uses_pad` to `[GPIO0, GPIO2]`. Add as onboard facts: 10 k pull-ups to 3V3 on GPIO2, GPIO4, GPIO13, GPIO14, GPIO15 (R153, R152, R156, R154, R155), 10 k on GPIO21 (R168), and GPIO12 pull-up R157 **not fitted (NC)**. Source: ESP-WROVER-KIT_V4_1.pdf, "Switch" and "SD Card" blocks. Safety relevance: GPIO2 is a strap held high by 10 k; external circuits must not fight it.
- **D-3 (WROVER-KIT RGB wording, minor).** GPIO0/2/4 drive MOSFET gates (Q7/Q6/Q8), not LED current. Change the effect to "drives RGB LED via N-MOSFET; LED lights when the pad is high".
- **D-4 (T-Display GPIO14, major wording).** Replace "enables the battery-measurement path" with: "PWR_EN: via Q3 switches P-FET Q6 (VDD3V3 → V3V rail feeding the LCD-line pull-ups) and Q4 (battery path); the BAT/2 divider on GPIO34 is not switched." Source: lilygo-ttgo-t-display-sch, power block (Q3/Q4/Q6, D6, R25-R28). Keep the README's "ADC Power" naming as a quote only.
- **D-5 (T-Display buttons, minor).** Add: GPIO35 has an external R1 100 K pull-up to VDD3V3; both buttons have 100 nF to GND (C3 on GPIO0, C11 on GPIO35).
- **D-6 (T-Display GPIO37/38, major safety note).** Header pins 37 and 38 are SENSOR_CAPP/CAPN with 270 pF coupling capacitors to GPIO36 (C49) and GPIO39 (C32). Add an onboard entry using `[GPIO36, GPIO37, GPIO38, GPIO39]`: "input-only; 270 pF couples 36↔37 and 38↔39, so signals cross-couple and fast edges are loaded." Source: lilygo-ttgo-t-display-sch, U3 pins 5-8.
- **D-7 (T-Display gaps that are now evidenced).** Add onboard: U4 CP2104 on GPIO1/GPIO3; Q1/Q2 auto-program on CHIP_PU/GPIO0. Set 3V3 `source: U7 AP2112K-3.3 (RT9013)`. The current rating stays `missing` until the regulator datasheet is cited.
- **Note on secondary sources (not a value disagreement).** NodeMCU-32S uses an Ai-Thinker PDF hosted by a retailer (zbotic.in). docs.ai-thinker.com returned **403** to the auditor, which did not circumvent it. LOLIN32 uses Internet Archive copies; wiki.wemos.cc does not resolve, so the site is dead, not blocking. Recommend a `sources/manual/README.md` request for the Ai-Thinker NodeMCU-32S spec.

## Promotable to `verified` (both keys agree)

- **esp-wrover-kit**: all JP1 positions/pads/kinds (IO16/IO17 stay `nc` with conflict note D-1); IO32/33 nc; camera, LCD, SD, JTAG, UART0, 32 kHz osc onboard entries; RGB pads (after the D-3 wording fix); 3V3 3.3 V/1000 mA; 5V voltage; logic 3.3 V. **Not** the BOOT entry until D-2 is applied.
- **adafruit-huzzah32-feather**: all JP1/JP3 pins; onboard D3/GPIO13, CP2104 GPIO1/3, Q1/Q2 GPIO0, VBAT divider GPIO35; 3V3 3.3 V/500 mA peak; USB 5 V; logic 3.3 V.
- **nodemcu-32s**: all J1/J2 pins and onboard entries (LED GPIO2, BOOT GPIO0, auto-program, CP2102), 3V3/5V voltages. These are verified *against a secondary-hosted copy*: promote only if the project rule allows `verified` with `secondary: true`. Otherwise hold until the manual primary arrives.
- **lolin32**: all P2/P3 pins, LED2 GPIO5 active-low, CP2104, UMH3N, rail voltages, logic 3.3 V. Same secondary-source caveat as NodeMCU-32S.
- **ttgo-t-display**: all 24 header pins, display pad set, button pads (GPIO0/35), GPIO34 battery ADC, rail voltages. **Not** the GPIO14 entry (D-4).
- **esp32-wroom-32**: bonded_pads, consumed GPIO6-11 (flash), psram none.
- **esp32-wroom-32s**: bonded_pads (M1 footprint). Consumed GPIO6-11 can move from `interim` to `verified` citing Fig. 1 "FLASH …" labels, but the secondary-source caveat applies.
- **ttgo-t-display-core**: bonded_pads, consumed GPIO6-11 (drop the "transcribed/label soup" caveat), psram none.
- **doit-esp32-devkit-v1-30pin/36pin**: no facts to promote; the stub status is agreed.

Remain `missing`: all rail current ratings not printed in board docs (WROVER 5V, NodeMCU, LOLIN32, T-Display, HUZZAH USB/BAT) and the flash_voltage of all three modules.

## Resolution

Applied on branch `boards-1`. D-1 to D-7 are fixed as the auditor corrected them.

- **WROVER-KIT:** BOOT now pulls GPIO0 and GPIO2. A new onboard entry records the SD pull-ups (GPIO2, 4, 13, 14, 15, 21) and notes that the GPIO12 pull-up is not fitted. The RGB wording is corrected. GPIO16/17 stay `nc`, with the conflict recorded in the file comment. New evidence record `esp-wrover-kit-v4.1-sch` (sha256 matches the audit).
- **T-Display:** GPIO14 PWR_EN wording corrected. Added the GPIO35 100K pull-up, the GPIO34 divider note, and the 36/37/38/39 coupling entry. Added the CP2104 and Q1/Q2 entry and the U7 AP2112K-3.3 regulator source. The rail current stays missing. Evidence claims were added to the existing schematic record.
- **Promoted to `verified`** (reviewers hardware-researcher, hardware-fact-auditor):
  - WROVER-KIT logic voltage, 3V3 voltage and 1000 mA, 5V voltage.
  - HUZZAH32 logic voltage, 3V3 voltage and 500 mA peak, USB voltage.
  - T-Display 3V3 and 5V rail voltages. The logic voltage stays single-source because it is inferred, not stated.
  - esp32-wroom-32: consumed GPIO6-11 and psram.
  - ttgo-t-display-core: consumed GPIO6-11 and psram. The `transcribed` caveat is dropped.
- **Held at single-source or interim:**
  - NodeMCU-32S and LOLIN32 (secondary-hosted copies).
  - esp32-wroom-32s consumed GPIO6-11 (interim).
  - All rail currents and flash_voltage values that no board document states.
  - DOIT stubs unchanged.
- Board status stays `partially-verified`. Checks run: `catalog:validate` (0 errors), `format:check`, and the engine fixtures tests (30 passed).
