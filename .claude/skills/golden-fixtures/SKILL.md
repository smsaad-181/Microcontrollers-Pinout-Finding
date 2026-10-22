---
name: golden-fixtures
description: Format and rules for golden test fixtures — hand-written expected allocations, warnings, required parts and numbers for known projects, derived from datasheets independently of the engine, including negative and unsat cases. Use when writing or reviewing catalog/fixtures or engine regression tests.
---

# Golden fixtures

Fixtures are the engine's ground truth. They are written from documents, **before** and
**independently of** the engine code.

## File format (catalog/fixtures/<id>.yaml)

```yaml
id: devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches
board: esp32-devkitc-v4@v4
variant: wroom-32e
project:
  modules:
    - { breakout: gy-bme280-6pin, instance: env }
    - { breakout: rfid-rc522-blue, instance: rfid }
    - { breakout: st7735s-1in8-spi, instance: tft }
    - { breakout: relay-4ch-5v-transistor, instance: relays }
    - { breakout: push-button, instance: sw1 }   # … sw2–sw4
  wifi: true
expect:
  status: ok
  exact:            # only where the plan's scoring fixes the answer
    bus.SCK: GPIO18
    bus.MOSI: GPIO23
    bus.MISO: GPIO19
  properties:       # must hold for ANY valid answer
    - no_pad_in: [GPIO6, GPIO7, GPIO8, GPIO9, GPIO10, GPIO11, GPIO1, GPIO3]
    - outputs_not_in: [GPIO34, GPIO35, GPIO36, GPIO39]
    - switches_on: [GPIO34, GPIO35, GPIO36, GPIO39]
    - all_used: [GPIO16, GPIO17, GPIO18, GPIO19, GPIO21, GPIO22, GPIO23, GPIO25, GPIO26, GPIO27, GPIO32, GPIO33]
    - risk_tier1_equals: 2            # 14 output-capable signals, 12 clean pads
    - risk_pads_subset_of: [GPIO5, GPIO13, GPIO14, GPIO2, GPIO15]
    - if_used: { pad: GPIO5, role_in: [tft.CS, rfid.CS] }
  warnings_include:
    - { code: I2C_RISE_TIME, level: warning }
    - { code: FLOATING_AT_RESET_LOAD, level: warning }
    - { code: RAIL_5V_BUDGET, level: warning }
    - { code: RAIL_3V3_BUDGET, level: warning }
    - { code: ERRATUM_GPIO_3_11, level: caution }
  required_parts_include:
    - { kind: resistor, value_ohm: 10000, role: pull-up, count: 4 }
evidence: [esp32-devkitc-v4-ug#j2-j3, esp32-trm-v5.8#tbl-6.10-1, esp-idf-spi-master#iomux, ...]
derivations:
  - "Rp,max(400 kHz, 50 pF) = 300e-9/(0.8473*50e-12) = 7081 Ω < 10 kΩ → I2C_RISE_TIME"
```

## Rules

- Prefer `properties` for anything the plan allows several answers for; use `exact` only where the
  plan's deterministic scoring fixes the answer — and explain why in `derivations`.
- Every number has a derivation line computed in Python; every expectation cites evidence ids.
- Negative fixtures: `expect.status: unsat` with `minimal_conflict_includes:` and
  `relaxations_include:`; unsafe-wiring fixtures expect a `critical` warning or a blocked assignment.
- A failing fixture is fixed in the engine. A fixture changes only if `hardware-fact-auditor` shows
  it contradicts its cited source; record that in the fixture's `changelog:`.

## Minimum MVP set (≥ 20)

DevKitC worked example · same with WROVER-E (DC/RST move to GPIO13/GPIO2; GPIO4 avoided — strap + conflict) · ESP32 relay on
GPIO12 with pull-up (blocked) · ESP32 analog sensor with Wi-Fi (ADC1 only) · ESP32 0–5 V sensor (R8
divider + dead zone) · HC-SR04 on ESP32 (R5 divider accept/reject) · S3 N8R8 (pads consumed by octal flash/PSRAM unavailable — exact pins from the module datasheet) ·
S3 USB pins 19/20 reserved by default · Uno R3 SPI defaults (D10–D13) · Uno R4 LED 220 Ω (critical) vs
R3 (pass) · ESP32 → Uno logic link (R2 buffer; model the Uno input as IC record `mcu-input-atmega328p-5v` with
logic levels from the ATmega328P facts) · Pico W (GP23–25, 29 never assigned) · Pico analog
(GP26–28 only) · D1 mini A0 3.2 V full scale · D1 mini boot pins (GPIO0/2/15) avoided for loads ·
BME280 ×2 same address → address strap · two BME280 + SSD1306 + MPU-6050 on one bus (addresses
0x76/0x77/0x3C/0x68) · three BME280 → second bus or SPI (only two addresses exist) · five 4.7 kΩ pull-up boards (R3 Rp,min fail) · RC522 forced to I2C (rejected:
hardwired SPI) · 20 relay outputs on Uno R3 (18 usable GPIO without D0/D1 → unsat → MCP23017
suggestion) · DS18B20 1-Wire pull-up.
