# Phase 5 validator report (v1.0 launch), branch phase-5 (5cde562)

Verdict: PASS (0 Critical, 0 Major, 6 Minor). Part B: 12 facts, 12 confirmed (2 with a caveat, see below).

## Part A: docs and CI

I ran `node tools/check-links.mjs` once. Result: 128 links, 126 ok, 0 unverified, 2 dead, exit 1.
The two dead links are `wiki.wemos.cc` (evidence `lolin32-sch-v1.0.0` and `lolin32-wiki`, DNS ENOTFOUND).
RELEASE.md already lists both. The first scheduled `links.yml` run will therefore go red and open an issue.
That is the intended behaviour.

tools/check-links.mjs: correct.
- The regex `^(?:url|url_original):` matches the top-level keys.
- All 97 records have both keys at top level. `null` values are skipped because the pattern requires `https?://`.
- Only DNS failure, 404 and 410 count as dead. HEAD falls back to GET. Exit 1 only for dead links.
- Concurrency of 6 and the 20 s timeout are fine.

links.yml: valid.
- Actions are pinned to 40-character SHAs, with a version comment.
- Top-level permissions are `contents: read`. The job adds `issues: write`. That is minimal.
- The block-scalar indentation is consistent. The embedded backticks are escaped. The `$(grep ...)` substitution sits inside double quotes. The `||` fallback covers a missing label.
- `PIPESTATUS[0]` works under `set +e`.

README, provenance, CONTRIBUTING, RELEASE and CHANGELOG, checked against the repo:
- Board count (22), Waveshare count (6) and evidence count (97) are true.
- 15 breakouts on 11 ICs is true.
- Rules R1 to R8 exist in `packages/rules/src/rules.ts`.
- The status enum matches `packages/schema`.
- The seven catalog kind directories match.
- `pnpm check:links` exists and `build:single` exists.
- `docs/templates/evidence.yaml`, CODEOWNERS and the photos directory exist.
- The `sources/cache` and `sources/manual` ignore rules match the docs.
- The DOIT 30-pin and 36-pin boards are the only `datasheet-required` boards.

bench-procedure.md: physically sound.
- Test 1: GPIO12 (MTDI) high at reset selects 1.8 V flash. On a 3.3 V flash module that gives a boot failure. A 10 kΩ pull-up beats the internal pull-down of about 45 kΩ.
- Nothing in the procedure can damage hardware. It says so and the claim is true. It also covers the eFuse-burned case.
- Test 2 and Test 3 use 3V3 supply and the pins the app picks. The expected results are sensible.
- `FLOATING_AT_RESET_LOAD` exists in `packages/engine/src/assess.ts`.

Minor findings:
1. RELEASE.md "Known gaps" names "ESP32-S3-Mini" as a board with no pin map. No such board is in `catalog/boards`. The entry is stale. Remove it or name the real board.
2. The first `links.yml` run is guaranteed to fail on the 2 dead wemos links, until the URLs are replaced or archived. Document this or add an allow-list, so the owner is not alarmed.
3. The issue step runs `body="$(grep -E '^(DEAD)' links.txt)"` under the GitHub default `bash -e`. If the checker crashes (exit 1 with no DEAD lines), grep returns 1 and the step fails before an issue is made. The "Fail on dead links" step still runs, so the run stays red anyway. Adding `|| true` fixes it.
4. README says every board shows "fully verified", "partially verified" or "datasheet required". Currently 20 boards are partially verified, 2 are datasheet required and 0 are fully verified. That is accurate, but a user may expect some "fully verified" boards.
5. I could not check the action SHAs against upstream tags offline. They match the SHAs used in the other workflows.
6. One verified fact leans on inference. `waveshare-esp32-s3-pico` VBUS `voltage = 5` cites `waveshare-esp32-s3-pico-wiki#pinout-image`. The quote text is in the image, but the image does not say 5 V. The fact's own note admits "nominal". Consider `interim`, or cite the schematic.

## Part B: blind two-key spot check, 12 verified facts

I sampled with a seeded random pick across boards, chips and modules. I fetched each cited URL, converted PDFs with pdftotext, and matched the quote after whitespace normalisation. Raw mode was used for the figure and table text where layout mode broke the quote.

| # | Fact | Evidence claim | Result |
|---|---|---|---|
| 1 | chips/esp32 GPIO11 input_only=false | esp32-trm-v5.8#iomux-gpio11 | confirmed |
| 2 | boards/waveshare-esp32-s3-tiny LDO voltage 3.3 | waveshare-esp32-s3-tiny-sch#ldo-part (ME6217C33M5G) | confirmed |
| 3 | boards/esp32-s2-saola-1 LDO 3.3 | esp32-s2-saola-1-sch-v1.2#ldo-part (SGM2212-3.3) | confirmed |
| 4 | modules/esp32-s3-wroom-1-n8 GPIO27=flash | esp32-s3-wroom-1-ds-v1.8#block-diagram-flash-bus | confirmed (figure labels found; GPIO27=SPIHD matches the S3 mapping) |
| 5 | boards/esp32-devkitc-v4 J2 3V3 rail | esp32-devkitc-v4-ug#j2-1-4 | confirmed |
| 6 | boards/esp32-s3-devkitc-1 J1 5V | esp32-s3-devkitc-1-ug-v1.1#j1-5v-gnd | confirmed |
| 7 | chips/esp32-c3 GPIO21 reset_state=disabled | esp32-c3-ds-v2.4#pin-overview-gpio21 | confirmed. Layout text shows U0TXD "WPU" in the After Reset column and blank At Reset, as the note claims. |
| 8 | boards/waveshare-esp32-s3-pico VBUS 5 V | waveshare-esp32-s3-pico-wiki#pinout-image | confirmed with caveat. I read the image and the labels VBUS, VSYS, GND, 3V3_EN, 3V3(OUT) are present. The 5 V value is inferred, not printed (Minor 6). |
| 9 | boards/waveshare-esp32-c3-zero logic 3.3 | waveshare-esp32-c3-zero-sch-v2#ldo-part | confirmed |
| 10 | boards/waveshare-esp32-s3-zero VIN 3.7 to 6 V | waveshare-esp32-s3-zero-wiki#vin-range | confirmed, verbatim |
| 11 | chips/esp8266ex GPIO10 input_only=false | esp8266ex-ds-v7.1#pin-gpio10 | confirmed. The Ω glyph does not extract, but the rest of the quote matches. |
| 12 | modules/esp32-c6fh4 flash_voltage 3.3 | esp32-c6-ds-v1.5#flash-3v3 | confirmed, verbatim |

Tally: 12 confirmed, 0 quote not found, 0 source unreachable. Caveats are on #4, #7, #8 and #11. Only #8 is a substantive weakness.
