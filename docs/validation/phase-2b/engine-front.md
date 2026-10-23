# Phase 2b engine front half (tasks 2b.2-2b.4)

Code: `packages/engine/src/{catalog,compose,wiring,interfaces,signals}.ts`; tests in `packages/engine/test` (47, real catalog, loaded through the CLI validator in tests only). No change to `packages/schema`.

## Public API

- `Catalog` (in-memory `{chips, modules, boards, ics, breakouts}`), `indexCatalog`, `Prov<T>` (`value`, `status`, `evidence`; a `conflict` fact reads `active`).
- `composePinView(index, boardRef, variantId)` returns `ok | needs_variant | error`. `ComposedPin` carries functions, `carries` (IO_MUX / matrix / fixed per peripheral role with max Hz), strap, reset state, power-up glitch, input-only, ADC unit and radio conflict, DAC/touch, JTAG, per-pin current, onboard uses, `consumed`, `flags`, sorted evidence ids. `unavailablePads` lists every module-consumed and unbonded pad (also those with no connector pin, e.g. Pico W GPIO23-25/29).
- `selectInterfaces(index, project)` gives per module the ordered candidates (kind, feasible, pin cost, new bus, second bus, spare pins, reasons, warning codes), `chosen`, `decidedByRule`, plus the project-wide I2C address and bus placement (`i2c.addresses`, `i2c.conflicts`). `enumerateBranches(selection, limit)` lists feasible combinations, best first.
- `expandSignals(index, project, interfaces?)` gives `ExpandedSignal[]` (MCU-side `dir`, `drive`, `peripheral`, `maxHz` + fact, `shareable`, `actsOnLevel`, `restingLevelAtReset`/`restingKnown`, `needsPull`, `lockedPad`) and diagnostics.

## Decisions made where the spec was silent

- A connector pin whose pad is consumed by the selected variant is `usable: false`; `consumed` is read only from the module, never inferred from `bonded_pads`.
- Interface order: fixed decisions (override, single exposed interface) first, then free choices; pin cost counts bus lines only when no earlier module already uses that bus. Rule 3 decides at a cost gap >= 2, or 1 when fewer than 3 pins stay spare. A lone BME280 therefore picks I2C by rule 3 (2 vs 4 pins); next to an SPI bus rule 4 decides (1 vs 2, spare >= 3).
- Rule 4 "display / fast stream" is derived from the data: the IC has a DC line on its SPI interface. No catalog field exists for it.
- I2C addresses: project strap, then breakout hardwired value, then single-address IC, then a strap pin exposed on the breakout (selectable), else `unknown`. An unknown address is never assumed distinct, so it forces its own controller (fixture 14). Nine ADS1115 fail on 2 x 4 slots.

## Ambiguities found

1. SPI `MISO` is `shareable: false` for MFRC522 but the worked example shares it. The expander marks SCK/MOSI/MISO and SDA/SCL as `bus` by role and adds `miso.shareProven` (null while the tri-state fact is missing); the solver should emit `MISO_SHARE_UNPROVEN`.
2. Pad function names are not uniform: RP2040 `I2C0.SDA`, ESP8266 `I2C.SCL`, RA4M1 `SDA0`. The composer reads `iomux_pins`, `PERIPHERAL.ROLE` names and matrix-routable peripherals only. RA4M1 roles and the ESP8266 D1 mini pad sets (fixture 11: GPIO4/5 vs the chip's `I2C0.iomux_pins` GPIO2/14) need catalog data before the solver can place I2C there.
3. `Project.modules[].address_strap` is matched against `IC.addresses[].strap` text (`SDO=GND`); Adafruit BME280 `hardwired` is free text and is not parsed (the address stays selectable).
4. UART instance availability treats a UART whose tx and rx pads are both used by an onboard part (USB bridge) as taken; the catalog has no explicit "UART0 is USB" flag.
5. `ADC2_WIFI_CONFLICT` can only come from `radio_conflict === true`; a `missing` radio fact (RP2040, RA4M1) is not treated as a conflict by the feasibility check.

## For the solver agent

Domains: start from `ComposedPin.usable`, filter by `carries` (peripheral + role/`*`, routing, `maxHz`), input-only and `adc.radioConflict` (use `project.wifi`). Use `ExpandedSignal.maxHz` against `carries.maxHz`; strap/glitch/`resetState`/`flags` feed the tier-1 risk score and rules R1-R8 (`@pinout/rules`). Run `selectInterfaces` once, then iterate `enumerateBranches` as the outer loop and pass each `choice` to `expandSignals`. Still open: peripheral instance grouping per bus, CS uniqueness, ADC unit-vs-pad assignment, required parts, scoring, explanations.
