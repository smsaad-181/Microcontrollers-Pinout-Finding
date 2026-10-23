# Phase 2b schema round

All changes are backwards compatible; the 24 fixtures and the whole catalog still validate.

1. **Strap `default_pull` optional** (`chip.ts`). No catalog values or fact statuses changed; the ESP8266 GPIO0/2/15 strap facts stay `missing` until a source gives the level.
2. **Pad without a GPIO number**: `pads.<key>.gpio` is optional. The record key is the pad's stable name (no extra `id` field). `E_PAD_KEY` skips uniqueness for pads without `gpio`; a GPIO-style key (`GPIO4`, `GP4`, ...) must still carry the matching number. Migrated: ESP8266EX `TOUT` (invented `gpio: 17` removed) and all 52 RA4M1 pads (invented `port*100+pin` removed).
3. **Per-variant bonded pads**: `module.consumed` already existed; no new field. The validator (`E_PIN_NUMBERING`) now accepts a connector pad that is not in `bonded_pads` when the module lists it in `consumed`. WROVER-E no longer lists GPIO16/17 as bonded. **Engine rule:** a pad in `consumed` of the selected variant's module is unusable (read `consumed`, never infer from `bonded_pads`).
4. **Connector pin kinds** `enable`, `boot`, `analog` added (no catalog pin migrated: Pico `3V3_EN` stays `reset`, D1 mini `A0` stays `gpio` with pad `TOUT`; engine behaviour keys off `gpio`).
5. **Rail voltage** `rails[].voltage` accepts a number or `{min, max}` (`VoltageSchema`). `logic_voltage`, `vdd_io` and `flash_voltage` stay single numbers. No rail was changed to a range (VSYS 1.8-5.5 V is not yet recorded; do it when the board is revisited).
6. **Fixture vocabulary** `packages/schema/src/fixture-vocabulary.ts`: 21 warning codes, 38 `expect.properties` keys (each entry an object with exactly one key), 8 conflict-token prefixes, 7 relaxation prefixes plus the bare token `add-i2c-multiplexer`, locked-role form `WIPER` / `COIL[1]`. `FixtureSchema` enforces them; a CLI test checks that every registry entry is used by a fixture and none is stale. `ADC2_WIFI_CONFLICT` is in the list because a fixture uses it in `no_warning_code`.

Not done: `iomux_pins` alternatives per role (RP2040 SPI0.RX), `radio` consumed kind, `VDD+0.3` expression forms (not in this task's list).
Follow-up for the orchestrator: the normative copy in skill `catalog-schema` should get the same field changes as `packages/schema/test/reference.ts`.
