# Reconcile report: Raspberry Pi Pico and Pico W (task 2a.4)

Reconciler: catalog-author. Researcher draft vs the blind audit `audit-raspberry-pi-pico-boards.yaml` (165 audit rows). Rows for items that are not `Fact<T>` objects (connector pins, onboard text, numbering, test points, rail behaviour notes) have no status field; they are listed for completeness and were left untouched. Where the auditor gave a free-text value for a catalogue structural field I compared it with the catalogue prose/structure only at the level the audit supports (the recorded onboard parts, pads and notes agree with the audit; no contradiction found).

| board | path | researcher | auditor | result | action | status before -> after |
|---|---|---|---|---|---|---|
| raspberry-pi-pico | revision | recorded in board onboard[]/notes/comments (not a Fact) | Rev3 | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | connectors.0.id | left/right (2 connectors, ids differ) | J0 (40-pin main header, castellated/through-hole) | n/a | Not a Fact; no status. Auditor names the header J0, catalog splits into left/right. | n/a |
| raspberry-pi-pico | connectors.0.pins.0 | pin map entry | {'position': 1, 'label': 'GP0', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.1 | pin map entry | {'position': 2, 'label': 'GP1', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.2 | pin map entry | {'position': 3, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.3 | pin map entry | {'position': 4, 'label': 'GP2', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.4 | pin map entry | {'position': 5, 'label': 'GP3', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.5 | pin map entry | {'position': 6, 'label': 'GP4', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.6 | pin map entry | {'position': 7, 'label': 'GP5', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.7 | pin map entry | {'position': 8, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.8 | pin map entry | {'position': 9, 'label': 'GP6', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.9 | pin map entry | {'position': 10, 'label': 'GP7', 'kind': 'gpio', 'pad': '... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.10 | pin map entry | {'position': 11, 'label': 'GP8', 'kind': 'gpio', 'pad': '... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.11 | pin map entry | {'position': 12, 'label': 'GP9', 'kind': 'gpio', 'pad': '... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.12 | pin map entry | {'position': 13, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.13 | pin map entry | {'position': 14, 'label': 'GP10', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.14 | pin map entry | {'position': 15, 'label': 'GP11', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.15 | pin map entry | {'position': 16, 'label': 'GP12', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.16 | pin map entry | {'position': 17, 'label': 'GP13', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.17 | pin map entry | {'position': 18, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.18 | pin map entry | {'position': 19, 'label': 'GP14', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.19 | pin map entry | {'position': 20, 'label': 'GP15', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.20 | pin map entry | {'position': 21, 'label': 'GP16', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.21 | pin map entry | {'position': 22, 'label': 'GP17', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.22 | pin map entry | {'position': 23, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.23 | pin map entry | {'position': 24, 'label': 'GP18', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.24 | pin map entry | {'position': 25, 'label': 'GP19', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.25 | pin map entry | {'position': 26, 'label': 'GP20', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.26 | pin map entry | {'position': 27, 'label': 'GP21', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.27 | pin map entry | {'position': 28, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.28 | pin map entry | {'position': 29, 'label': 'GP22', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.29 | pin 30 RUN, no pad | {'position': 30, 'label': 'RUN', 'kind': 'reset', 'pad': ... | match | Not a Fact; auditor gives pad RUN (not a GPIO pad); catalog keeps kind reset, no pad. | n/a |
| raspberry-pi-pico | connectors.0.pins.30 | pin map entry | {'position': 31, 'label': 'GP26', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.31 | pin map entry | {'position': 32, 'label': 'GP27', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.32 | pin 33 label AGND | {'position': 33, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; auditor label GND, figure/text differ (both docs); catalog keeps AGND, kind ground. | n/a |
| raspberry-pi-pico | connectors.0.pins.33 | pin map entry | {'position': 34, 'label': 'GP28', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.34 | pin map entry | {'position': 35, 'label': 'ADC_VREF', 'kind': 'analog-ref... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.35 | pin map entry | {'position': 36, 'label': '3V3(OUT)', 'kind': 'power', 'r... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.36 | pin map entry | {'position': 37, 'label': '3V3_EN', 'kind': 'reset', 'rai... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.37 | pin map entry | {'position': 38, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.38 | pin map entry | {'position': 39, 'label': 'VSYS', 'kind': 'power', 'rail'... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | connectors.0.pins.39 | pin map entry | {'position': 40, 'label': 'VBUS', 'kind': 'power', 'rail'... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico | numbering | label | {'primary': 'gpio', 'systems': ['GPIO number (figure labe... | inferred | Auditor only inferred; no Fact in catalog, nothing changed. numbering.primary=label kept (design choice, not a Fact) | n/a |
| raspberry-pi-pico | logic_voltage (Section 1 pdf p.4) | 3.3 | 3.3 | match | verified; second locator added as claim pico-ds-rel21#io-voltage-note | single-source -> verified |
| raspberry-pi-pico | logic_voltage (Section 4.2 pdf p.) | 3.3 | 3.3 | match | verified (same claim already cited) | single-source -> verified |
| raspberry-pi-pico | logic_voltage_chip_range | recorded in board onboard[]/notes/comments (not a Fact) | 1.8-3.3 | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | rails.3V3.voltage | 3.3 | 3.3 | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico | rails.3V3.max_current | 300 | 300 | match | verified; reviewers [hardware-researcher, hardware-fact-auditor]; note keeps 'recommended, not absolute' | single-source -> verified |
| raspberry-pi-pico | rails.3V3.source | recorded in board onboard[]/notes/comments (not a Fact) | RT6150 buck-boost SMPS (U2) | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | rails.VSYS.voltage | null (missing) | range 1.8-5.5 V | match (substance); not representable | stays missing: Fact<number> cannot hold a range; both found the range | missing -> missing |
| raspberry-pi-pico | rails.VSYS.max_current | null (missing) | null | could-not-verify | stays missing, value null, evidence []; note says no number in document | missing -> missing |
| raspberry-pi-pico | rails.VBUS.voltage | 5 | 5 V +/-10% | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico | rails.VBUS.max_current | null (missing) | null | could-not-verify | stays missing, value null, evidence []; note says no number in document | missing -> missing |
| raspberry-pi-pico | rails.3V3_EN.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | Pulled up to VSYS via 100 kohm; shorting pin 37 low disab... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | rails.RUN.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | RP2040 enable; internal pull-up ~50 kohm to 3.3 V; short ... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | rails.ADC_VREF.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | ADC supply/reference generated by filtering 3.3 V (201 oh... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | rails.AGND.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | Analogue ground reference for GPIO26-29, separate plane e... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | operating_conditions.temp_max | recorded in board onboard[]/notes/comments (not a Fact) | 85 | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | power.second_source_via_schottky | recorded in board onboard[]/notes/comments (not a Fact) | ~2.3 V to 5.5 V (ORed through a Schottky diode) | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.led | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'User LED D2 (green) via R3 470R', 'uses_pad': [... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.smps_ps | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'RT6150 PS pin', 'uses_pad': ['GPIO23'], 'effect... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.vbus_sense | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'VBUS pull-down R10/R1', 'uses_pad': ['GPIO24'],... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.vsys_sense | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'R5 200K / R6 100K divider (schematic), Q1 DMG10... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.bootsel | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'BOOTSEL button SW1 (TP6)', 'uses_pad': ['QSPI_S... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.flash | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'Winbond W25Q16JV, 2 MB QSPI', 'uses_pad': ['QSP... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.crystal | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'Abracon ABM8-272-T3 (12 MHz per schematic)', 'u... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | onboard.wireless | n/a | none | inferred | Auditor only inferred; no Fact in catalog, nothing changed. no catalog Fact corresponds | n/a |
| raspberry-pi-pico | internal_gpio_not_on_header | recorded in board onboard[]/notes/comments (not a Fact) | ['GPIO23', 'GPIO24', 'GPIO25', 'GPIO29'] | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | header_gpio_exposed | recorded in board onboard[]/notes/comments (not a Fact) | GPIO0-GPIO22 and GPIO26-GPIO28 (26 GPIO); GPIO26-28 are A... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | restrictions.adc_pads_input_max | recorded in board onboard[]/notes/comments (not a Fact) | IOVDD + ~0.3 V; if RP2040 unpowered a voltage on the pad ... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | restrictions.digital_pads_unpowered | recorded in board onboard[]/notes/comments (not a Fact) | voltage can safely be applied to GPIO0-25 when RP2040 unp... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | restrictions.test_points | recorded in board onboard[]/notes/comments (not a Fact) | TP4 (SMPS PS) not to be used externally; TP5 (LED) not re... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | restrictions.header_gpio_shared_with_sense | n/a | [] | inferred | Auditor only inferred; no Fact in catalog, nothing changed. no catalog Fact corresponds | n/a |
| raspberry-pi-pico | module flash_voltage | 3.3 | 3.3 | match | verified; both read the schematic image (transcribed: true kept) | single-source -> verified |
| raspberry-pi-pico | module consumed.GPIO23 | absent (consumed: {}) | SMPS PS control | match in substance; structural difference | No change. Not a Fact in the Pico record; usage recorded in board onboard[]. See doubts. | n/a |
| raspberry-pi-pico | module consumed.GPIO24 | absent (consumed: {}) | VBUS sense input | match in substance; structural difference | No change. Not a Fact in the Pico record; usage recorded in board onboard[]. See doubts. | n/a |
| raspberry-pi-pico | module consumed.GPIO25 | absent (consumed: {}) | user LED | match in substance; structural difference | No change. Not a Fact in the Pico record; usage recorded in board onboard[]. See doubts. | n/a |
| raspberry-pi-pico | module consumed.GPIO29 | absent (consumed: {}) | ADC3 VSYS/3 sense | match in substance; structural difference | No change. Not a Fact in the Pico record; usage recorded in board onboard[]. See doubts. | n/a |
| raspberry-pi-pico | module consumed.QSPI | recorded in board onboard[]/notes/comments (not a Fact) | QSPI_SS, QSPI_SCLK, QSPI_SD0-3 used by the on-board flash... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | module consumed.XIN_XOUT_USB_SWD | recorded in board onboard[]/notes/comments (not a Fact) | XIN/XOUT crystal; USB_DP/USB_DM micro-USB; SWCLK/SWDIO de... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico | module header_pad_limited_by_board | n/a | No header GPIO limited by sense circuits; GPIO26-28 carry... | inferred | Auditor only inferred; no Fact in catalog, nothing changed. no catalog Fact corresponds | n/a |
| raspberry-pi-pico | module flash_part | recorded in board onboard[]/notes/comments (not a Fact) | Winbond W25Q16JV 2 MB | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | revision | recorded in board onboard[]/notes/comments (not a Fact) | Rev3 | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | connectors.0.id | left/right (2 connectors, ids differ) | J0 (40-pin main header, castellated/through-hole) | n/a | Not a Fact; no status. Auditor names the header J0, catalog splits into left/right. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.0 | pin map entry | {'position': 1, 'label': 'GP0', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.1 | pin map entry | {'position': 2, 'label': 'GP1', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.2 | pin map entry | {'position': 3, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.3 | pin map entry | {'position': 4, 'label': 'GP2', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.4 | pin map entry | {'position': 5, 'label': 'GP3', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.5 | pin map entry | {'position': 6, 'label': 'GP4', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.6 | pin map entry | {'position': 7, 'label': 'GP5', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.7 | pin map entry | {'position': 8, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.8 | pin map entry | {'position': 9, 'label': 'GP6', 'kind': 'gpio', 'pad': 'G... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.9 | pin map entry | {'position': 10, 'label': 'GP7', 'kind': 'gpio', 'pad': '... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.10 | pin map entry | {'position': 11, 'label': 'GP8', 'kind': 'gpio', 'pad': '... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.11 | pin map entry | {'position': 12, 'label': 'GP9', 'kind': 'gpio', 'pad': '... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.12 | pin map entry | {'position': 13, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.13 | pin map entry | {'position': 14, 'label': 'GP10', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.14 | pin map entry | {'position': 15, 'label': 'GP11', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.15 | pin map entry | {'position': 16, 'label': 'GP12', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.16 | pin map entry | {'position': 17, 'label': 'GP13', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.17 | pin map entry | {'position': 18, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.18 | pin map entry | {'position': 19, 'label': 'GP14', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.19 | pin map entry | {'position': 20, 'label': 'GP15', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.20 | pin map entry | {'position': 21, 'label': 'GP16', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.21 | pin map entry | {'position': 22, 'label': 'GP17', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.22 | pin map entry | {'position': 23, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.23 | pin map entry | {'position': 24, 'label': 'GP18', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.24 | pin map entry | {'position': 25, 'label': 'GP19', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.25 | pin map entry | {'position': 26, 'label': 'GP20', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.26 | pin map entry | {'position': 27, 'label': 'GP21', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.27 | pin map entry | {'position': 28, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.28 | pin map entry | {'position': 29, 'label': 'GP22', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.29 | pin 30 RUN, no pad | {'position': 30, 'label': 'RUN', 'kind': 'reset', 'pad': ... | match | Not a Fact; auditor gives pad RUN (not a GPIO pad); catalog keeps kind reset, no pad. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.30 | pin map entry | {'position': 31, 'label': 'GP26', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.31 | pin map entry | {'position': 32, 'label': 'GP27', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.32 | pin 33 label AGND | {'position': 33, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; auditor label GND, figure/text differ (both docs); catalog keeps AGND, kind ground. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.33 | pin map entry | {'position': 34, 'label': 'GP28', 'kind': 'gpio', 'pad': ... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.34 | pin map entry | {'position': 35, 'label': 'ADC_VREF', 'kind': 'analog-ref... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.35 | pin map entry | {'position': 36, 'label': '3V3(OUT)', 'kind': 'power', 'r... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.36 | pin map entry | {'position': 37, 'label': '3V3_EN', 'kind': 'reset', 'rai... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.37 | pin map entry | {'position': 38, 'label': 'GND', 'kind': 'ground'} | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.38 | pin map entry | {'position': 39, 'label': 'VSYS', 'kind': 'power', 'rail'... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | connectors.0.pins.39 | pin map entry | {'position': 40, 'label': 'VBUS', 'kind': 'power', 'rail'... | match | Not a Fact; no status. | n/a |
| raspberry-pi-pico-w | numbering | label | {'primary': 'gpio', 'systems': ['GPIO number (figure labe... | inferred | Auditor only inferred; no Fact in catalog, nothing changed. numbering.primary=label kept (design choice, not a Fact) | n/a |
| raspberry-pi-pico-w | logic_voltage (Section 1 Note pdf) | 3.3 | 3.3 | match | verified; second locator added as claim pico-w-ds-rel7#io-voltage-note | single-source -> verified |
| raspberry-pi-pico-w | logic_voltage (Section 3.2 pdf p.) | 3.3 | 3.3 | match | verified (same claim already cited) | single-source -> verified |
| raspberry-pi-pico-w | logic_voltage_chip_range | recorded in board onboard[]/notes/comments (not a Fact) | 1.8-3.3 | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | rails.3V3.voltage | 3.3 | 3.3 | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico-w | rails.3V3.max_current | 300 | 300 | match | verified; reviewers [hardware-researcher, hardware-fact-auditor]; note keeps 'recommended, not absolute' | single-source -> verified |
| raspberry-pi-pico-w | rails.3V3.source | recorded in board onboard[]/notes/comments (not a Fact) | RT6154 buck-boost SMPS (U2) | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | rails.VSYS.voltage | null (missing) | range 1.8-5.5 V | match (substance); not representable | stays missing: Fact<number> cannot hold a range; both found the range | missing -> missing |
| raspberry-pi-pico-w | rails.VSYS.max_current | null (missing) | null | could-not-verify | stays missing, value null, evidence []; note says no number in document | missing -> missing |
| raspberry-pi-pico-w | rails.VBUS.voltage | 5 | 5 V +/-10% | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico-w | rails.VBUS.max_current | null (missing) | null | could-not-verify | stays missing, value null, evidence []; note says no number in document | missing -> missing |
| raspberry-pi-pico-w | rails.3V3_EN.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | Pulled up to VSYS via 100 kohm; shorting pin 37 low disab... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | rails.RUN.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | RP2040 enable; internal pull-up ~50 kohm to 3.3 V; short ... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | rails.ADC_VREF.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | ADC supply/reference generated by filtering 3.3 V (201 oh... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | rails.AGND.behaviour | recorded in board onboard[]/notes/comments (not a Fact) | Analogue ground reference for GPIO26-29, separate plane e... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | operating_conditions.temp_max | recorded in board onboard[]/notes/comments (not a Fact) | 70 | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | power.second_source_via_schottky | recorded in board onboard[]/notes/comments (not a Fact) | ~2.3 V to 5.5 V (ORed through a Schottky diode) | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.led | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'User LED D2 (green) via R3 470R', 'uses_pad': [... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.smps_ps | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'RT6154 PS/SYNC pin', 'uses_pad': [], 'effect': ... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.vbus_sense | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'R10/R1 pull-down', 'uses_pad': [], 'effect': 'C... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.vsys_sense | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'R5/R6 divider, Q1 DMG1012T', 'uses_pad': ['GPIO... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.vsys_sense_enable | recorded in board onboard[]/notes/comments (not a Fact) | {'uses_pad': ['GPIO25'], 'effect': 'GPIO25 (wireless CS) ... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.wireless | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'Infineon CYW43439 (2.4 GHz WiFi 4, Bluetooth 5.... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.bootsel | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'BOOTSEL button SW1 (TP6)', 'uses_pad': ['QSPI_S... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.flash | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'Winbond W25Q16JV, 2 MB QSPI', 'uses_pad': ['QSP... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | onboard.crystal | recorded in board onboard[]/notes/comments (not a Fact) | {'part': 'Abracon ABM8-272-T3', 'uses_pad': ['XIN', 'XOUT... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | internal_gpio_not_on_header | recorded in board onboard[]/notes/comments (not a Fact) | ['GPIO23', 'GPIO24', 'GPIO25', 'GPIO29'] | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | header_gpio_exposed | recorded in board onboard[]/notes/comments (not a Fact) | GPIO0-GPIO22 and GPIO26-GPIO28 (26 GPIO); GPIO26-28 are A... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | restrictions.adc_pads_input_max | recorded in board onboard[]/notes/comments (not a Fact) | IOVDD + ~0.3 V; if RP2040 unpowered a voltage on the pad ... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | restrictions.digital_pads_unpowered | recorded in board onboard[]/notes/comments (not a Fact) | voltage can safely be applied to GPIO0-25 when RP2040 unp... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | restrictions.test_points | recorded in board onboard[]/notes/comments (not a Fact) | TP4 (SMPS PS) not to be used externally; TP5 (LED) not re... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | restrictions.header_gpio_shared_with_sense | n/a | [] | inferred | Auditor only inferred; no Fact in catalog, nothing changed. no catalog Fact corresponds | n/a |
| raspberry-pi-pico-w | module flash_voltage | 3.3 | 3.3 | match | verified; both read the schematic image (transcribed: true kept) | single-source -> verified |
| raspberry-pi-pico-w | module consumed.GPIO23 | internal | CYW43439 WL_ON power on | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico-w | module consumed.GPIO24 | internal | CYW43439 SPI data and IRQ (shared) | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico-w | module consumed.GPIO25 | internal | CYW43439 SPI CS; high also enables VSYS read | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico-w | module consumed.GPIO29 | internal | CYW43439 SPI CLK, shared with ADC3 VSYS/3 sense | match | verified; reviewers [hardware-researcher, hardware-fact-auditor] | single-source -> verified |
| raspberry-pi-pico-w | module consumed.QSPI | recorded in board onboard[]/notes/comments (not a Fact) | QSPI_SS, QSPI_SCLK, QSPI_SD0-3 used by the on-board flash... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | module consumed.XIN_XOUT_USB_SWD | recorded in board onboard[]/notes/comments (not a Fact) | XIN/XOUT crystal; USB_DP/USB_DM micro-USB; SWCLK/SWDIO de... | match (not a Fact) | Not a Fact; no status; untouched | n/a |
| raspberry-pi-pico-w | module header_pad_limited_by_board | n/a | No header GPIO limited by sense circuits; GPIO26-28 carry... | inferred | Auditor only inferred; no Fact in catalog, nothing changed. no catalog Fact corresponds | n/a |
| raspberry-pi-pico-w | module flash_part | recorded in board onboard[]/notes/comments (not a Fact) | Winbond W25Q16JV 2 MB | match (not a Fact) | Not a Fact; no status; untouched | n/a |

## Summary

Engine-read facts (Fact objects) before -> after, status counts:

| entity | verified | single-source | conflict | missing |
|---|---|---|---|---|
| raspberry-pi-pico (board) | 0 -> 4 | 4 -> 0 | 0 -> 0 | 3 -> 3 |
| raspberry-pi-pico-w (board) | 0 -> 4 | 4 -> 0 | 0 -> 0 | 3 -> 3 |
| raspberry-pi-pico-core (module) | 0 -> 1 | 1 -> 0 | 0 | 0 |
| raspberry-pi-pico-w-core (module) | 0 -> 5 | 5 -> 0 | 0 | 0 |

Audit rows: 165 = 16 Fact matches (all verified), 4 could-not-verify (VBUS/VSYS max_current, both boards, stay missing), 2 VSYS voltage (both parties found a 1.8-5.5 V range; Fact<number> cannot hold it, stays missing), 4 consumed.GPIO23/24/25/29 on the Pico (structural difference, see doubts), 7 inferred (no Fact touched), 130 non-Fact rows (connector pins, onboard text, notes) with no status.

Conflicts: none. No value mismatch between researcher and auditor on any Fact. No transcription errors found; the RP2040 evidence file and chip file were not touched and no extra RP2040 claim is needed.

Board status: both boards remain `partially-verified` (validator agrees; missing VBUS/VSYS current and VSYS voltage).

## Judgement calls and doubts

1. 3V3 max_current 300 mA: both found it as a recommendation ("keep the load less than 300 mA"), not an absolute maximum. Verified as recorded; note retains this.
2. logic_voltage: auditor found a second locator (§1 note). Added claims `pico-ds-rel21#io-voltage-note` and `pico-w-ds-rel7#io-voltage-note` and cited them.
3. flash_voltage (both): both parties read the schematic image (net-label inference, transcribed: true). Verified because the auditor `found` it independently, but it is the weakest verified fact; no text states the flash supply.
4. VSYS voltage: left missing (range not representable), not a mismatch.
5. Pico `consumed: {}`: auditor lists GPIO23/24/25/29 as consumed (board circuitry). Researcher deliberately left them out (still firmware-usable, not on the header, recorded in board onboard[]). Not a Fact there; left unchanged. Decide whether the engine should treat them as reserved on the Pico.
6. numbering.primary (`label`): auditor says `gpio` and calls it a design choice (inferred). Not a Fact; left alone, needs an owner decision.
7. onboard.wireless "none" and header_gpio_shared_with_sense / header_pad_limited_by_board are auditor inferences; no corresponding Fact, nothing changed.
8. Connector labels: pin 33 auditor GND vs catalog AGND (both documents' text/schematic say AGND, figure says GND); pin 30 auditor pad "RUN" vs catalog no pad; connector id J0 vs left/right split. Structural, not changed.
9. Temp max differs (Pico 85 C, Pico W 70 C): not in catalog schema, not recorded.
