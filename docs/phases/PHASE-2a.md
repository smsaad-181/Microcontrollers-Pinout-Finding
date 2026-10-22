# Phase 2a — MVP catalog (two-key verified)

**Goal:** the six MVP boards and twelve MVP modules entered as catalog YAML, every fact backed by an
evidence record and independently re-verified. This is the most important phase: a wrong fact here
becomes a wrong pin for every user.

Skills to load: `datasheet-evidence`, `catalog-schema`, `catalog-onboarding`, `esp32-gpio-reference`.
Start from the leads in `docs/research/evidence-seed.yaml` — they were verified during planning but
**must be re-opened and re-recorded**; treat them as pointers, not facts.

## Human prerequisites

- [ ] Every file listed in `sources/manual/README.md` is present in `sources/manual/` (or the user
      explicitly accepts `interim` status — cited related/secondary value, always shown as Caution —
      for that part).

## Scope

Boards (with revision/variant):
1. Espressif ESP32-DevKitC V4 — variants WROOM-32E and WROVER-E
2. Espressif ESP32-S3-DevKitC-1 — variants N8 and N8R8
3. Arduino UNO R3
4. Arduino UNO R4 Minima
5. Raspberry Pi Pico and Pico W
6. WEMOS/LOLIN D1 mini V4.0.0

Chips/modules behind them: ESP32 (+WROOM-32E, WROVER-E), ESP32-S3 (+WROOM-1 N8/N8R8), ATmega328P,
Renesas RA4M1 (via Arduino docs), RP2040 (+ CYW43439 pin usage on Pico W), ESP8266EX.

Modules (IC + breakout records): BME280 (GY-BME280 4-pin, GY-BME280 6-pin, Adafruit BME280),
MPU-6050 (GY-521), SSD1306 128×64 I2C OLED, ST7735S 1.8" SPI TFT, MFRC522 "RFID-RC522" blue board,
DS18B20 (TO-92 + 4.7 kΩ), DHT22/AM2302, HC-SR04, ADS1115 breakout, 5 V relay board (transistor
variant and opto/JD-VCC variant, SRD-05VDC relays), momentary push button, potentiometer.

## Tasks

| # | Task | Owner | Output |
| --- | --- | --- | --- |
| 2a.1 | For each chip/module/board: locate every authoritative document (priority order in skill), download where allowed to `sources/cache/`, compute SHA-256, write `catalog/evidence/<id>.yaml`. | hardware-researcher | evidence records |
| 2a.2 | Create `catalog/.drafting` (pauses the on-edit validation hook). Extract facts into draft YAML (`status: single-source`), one file per entity, quoting the exact table/section for each fact. Images-only sources (e.g. D1 mini pin map) are transcribed by hand and marked `transcribed: true`. | hardware-researcher | draft catalog |
| 2a.3 | **Blind re-derivation:** the orchestrator gives the auditor only the entity id, the list of required fact *paths* (from the `catalog-schema` checklist) and each document's id/URL/SHA-256 — **not** the evidence `claims` (quotes/supports) or the entity YAML. The auditor finds the locations itself and writes `docs/validation/phase-2a/audit-<entity>.yaml`. | hardware-fact-auditor | audit files |
| 2a.4 | Reconcile: match → `verified` with `reviewers: [hardware-researcher, hardware-fact-auditor]`; mismatch → `conflict` with both readings and the restrictive one active; unreachable → `missing`. | catalog-author | reconciled catalog |
| 2a.5 | Module records: regulator presence and input range, level shifting, onboard pull-up values, hardwired interface straps, pin labels, current draw. Unknown → `missing` + Caution in output (never assume). | hardware-researcher → catalog-author | breakout YAML |
| 2a.6 | Known conflict to record explicitly: ESP32 GPIO4 strap (TRM Register 6.13 vs datasheet §3). | catalog-author | `conflict` fact |
| 2a.7 | Golden fixtures (hand-written from documents, before Phase 2b): at least 20, including the DevKitC V4 project in `docs/research/worked-example-esp32-devkitc.md`, WROVER variant change, Uno R3 vs R4 LED current, Pico W reserved GPIO23–25/29, D1 mini A0 3.2 V, HC-SR04 divider, BME280 address collision, I2C pull-up stack 940 Ω. Each fixture cites the evidence ids its expected answer depends on. | fixture-author | `catalog/fixtures/*.yaml` |
| 2a.8 | Delete `catalog/.drafting`. `pnpm catalog:validate` clean; coverage report committed to `docs/validation/phase-2a/coverage.md`. | catalog-author | report |

## Gate checklist

- [ ] `pnpm catalog:validate` exits 0.
- [ ] Every exposed pin on each MVP board has a fact for: functions (with routing class), direction limits, reset state, strap role (or explicit `none`), reserved/consumed status, electrical limits.
- [ ] 0 facts with status `single-source` remain on any field the engine reads (they are `verified`, `conflict`, or `missing` with a visible label).
- [ ] Auditor's random spot-check: ≥ 10 % of verified facts (min 30) re-opened again by the auditor in a second pass, 100 % match.
- [ ] Every evidence URL resolves (HTTP 200 after redirects) or is a `manual` source with a hash.
- [ ] ≥ 20 golden fixtures, each citing evidence ids, none referencing engine output.
- [ ] No PDF or vendor image is committed (`git ls-files | grep -Ei '\.(pdf|png|jpe?g)$'` only allows our own generated assets).

## Validators (run in parallel)

- `hardware-fact-auditor` — second pass sampling + all `conflict` items + every module record.
- `electrical-calc-verifier` — recompute every derived number stored in fixtures and the `electrical-rules` test vectors (dividers, currents, pull-ups, ADC ranges). No engine exists yet in 2a.
- `phase-validator` — gate commands, coverage, licensing checks.
