---
name: datasheet-evidence
description: How to find, open, cite and record authoritative hardware evidence (datasheets, TRMs, board guides, schematics, errata, library docs) for the pinout catalog — source priority, evidence record format, hashing, quoting, conflicts, and what to do when a source is blocked. Use whenever a hardware or library fact is researched, recorded, or verified.
---

# Datasheet evidence

Every fact the engine uses must be traceable to a document a human can open and check.

## Source priority (highest first)

1. Official development-board documentation (user guide, pinout, product page, board schematic).
2. Official chip or module datasheet (correct series and **revision**).
3. Official technical reference manual (TRM).
4. Official hardware design guidelines, reference schematics.
5. Official errata (always check — they override datasheets for affected revisions).
6. Official SDK/API docs (ESP-IDF, Pico SDK, Arduino core docs, Raspberry Pi docs).
7. Sensor/IC manufacturer datasheet; breakout vendor docs/schematic for module-level facts.
8. Reputable secondary sources (vendor app notes from another company, well-maintained OSS like
   ESPHome) — only to locate a primary source or flagged `secondary: true` when no primary exists.

Never: forum posts, blogs, AI answers, search snippets, marketplace listings as evidence.

## How to open a document

- PDF: `curl -L --fail -o sources/cache/<doc-id>.pdf "<url>"`, then `sha256sum`, then use the `Read`
  tool with `pages: "N-M"` to read the exact table. Quote what you read.
- HTML: `fetch` MCP for verbatim markdown; WebFetch when fetch is unavailable (it summarizes — confirm
  numbers verbatim by asking it to quote the exact line).
- Redirects are normal (Espressif and Raspberry Pi moved document hosts in 2026). Record the final URL
  and keep the original as `url_original`.
- `sources/cache/` is git-ignored. Never commit PDFs or vendor images.

## Blocked sources

If a site returns robots-disallowed, 403, CAPTCHA or needs login: **stop**. Do not use mirrors,
caches, archive.org or alternate hosts to bypass it. Add an entry to `sources/manual/README.md`:
title, publisher, document number, revision wanted, the official URL, and which facts depend on it.
Mark those facts `missing`. When the human drops the file in `sources/manual/`, hash it and proceed.

## Evidence record (catalog/evidence/<doc-id>.yaml)

```yaml
id: esp32-ds-v5.3
title: ESP32 Series Datasheet
publisher: Espressif Systems
doc_number: null
revision: "5.3"
revision_date: null          # fill only if printed in the document
url: https://documentation.espressif.com/esp32_datasheet_en.pdf
url_original: https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf
accessed: 2026-10-11
sha256: "<hex of the file you read>"    # null for HTML pages
kind: datasheet               # board-guide | datasheet | trm | errata | schematic | design-guide | api-doc | library | app-note | standard
secondary: false
manual: false                 # true when supplied by the human in sources/manual/
claims:
  - id: esp32-ds-v5.3#strap-mtdi
    locator: "§3.2, Table 3-1"
    quote: "MTDI ... 0: VDD_SDIO from VDD3P3_RTC; 1: internal 1.8 V LDO"   # ≤ 25 words, verbatim
    supports: "GPIO12/MTDI is a strap selecting VDD_SDIO voltage at reset; default pull-down"
```

Claim ids (`<doc-id>#<slug>`) are what catalog facts reference in `evidence:`.

## Fact discipline

- One fact = one value + units + conditions + evidence ids + status.
- Conditions matter: VDD, temperature, drive strength setting, attenuation, revision.
- When two sources disagree, record both and set `status: conflict` (see `catalog-schema`).
- Derived numbers (e.g. 66 ns → 15.15 MHz) are computed by the engine, not stored as facts; store the
  source parameter.
- Library facts (Phase 4): maintainer repo URL, tag/version, file + line or README section for the
  init API; record as `kind: library`.

## Known traps found during planning (re-verify, do not copy)

- ESP32 GPIO4: strap per TRM Register 6.13, not in the datasheet strap table → conflict.
- ESP32 GPIO16/17: free on WROOM, reserved for PSRAM on WROVER boards.
- ESP32-S3 octal (8-line) flash/PSRAM variants consume pads from GPIO33–37 (datasheet Table 2-14);
  confirm the exact pads for the specific module (WROOM-1 N8R8 etc.) and which appear on DevKitC-1 headers.
- ESP32 ADC usable range depends on attenuation (≈150–2450 mV at max), not 0–3.3 V.
- Uno R4 Minima GPIO limit is 8 mA (Arduino manual §9.3), very different from Uno R3.
- LOLIN D1 mini pin map is image-only → transcribe and mark `transcribed: true`.
- ST7735 vs ST7735S are different documents; do not cite one for the other without a note.
- SRD-05VDC relay has 0.36 W and 0.45 W variants (71.4 mA vs 89.3 mA coil).
