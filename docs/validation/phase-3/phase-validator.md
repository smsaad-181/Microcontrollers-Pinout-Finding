# Phase 3 — phase-validator (independent gate review)

Branch `phase-3` at `7fd6e19`, worktree `pinout-finder-3`. Reviewed on 2026-10-24. Source was not
edited.

**Verdict: PASS.** 0 Critical, 0 Major, 9 Minor (see "Later").

## 1. Gate commands (re-run in this review)

| Command | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm format:check` | exit 0 |
| `pnpm test` | exit 0: 47 files, 1402 passed, 1 skipped |
| `PW_CHANNEL=msedge pnpm --filter web e2e` | exit 0: 10 of 10 passed (31 s), production build, `vite preview` |
| `pnpm check:size` | exit 0: app JS 169.2 kB gzip (limit 250), catalog 131.7 kB gzip (limit 300) |

Gate checklist items covered by the e2e suite: the worked example matches the engine fixture;
every citation href is in `catalog/evidence/*.yaml`; real-browser axe finds 0 serious or critical
issues (colour contrast included) on the 5 screens and the variant dialog; the request log shows
only the app origin; offline reload works; refreshing every hash route works; there is a
keyboard-only path through board, modules and results. The post-merge live-site checks are out of
scope until the deploy.

## 2. Safety

- **The UI never chooses pins.** All pin decisions come from `solveDetailed` inside the worker
  (`engineHost.ts`). `draft.ts`, `boardView.ts` and `explain.ts` only map or display data. Lock,
  reserve and connection pickers list every header pad and leave the judgement to the engine. A
  stale result is never shown: it must match `solveKey`, which is the catalog SHA plus the project.
- **Honest states.** Each outcome has its own view: "No safe assignment" (smallest conflict set plus
  ranked fixes), "Variant needed", the budget-exhausted notice ("no safe assignment may be wrong"),
  timeout, cancel and error. A missing evidence record shows as "Source record not found". A rail
  limit that is not documented shows as "unknown (not documented)".
- **Required parts.** The engine attaches parts to pads, so wiring rows say "Needs part: pull-down
  resistor" on GPIO25/26/27/33 and "pull-up" on GPIO34–39. They are not shown as "Direct wire"
  (checked against the worked-example output).
- **Not colour alone.** Warning levels and board status show an icon and text. Header pins have a
  distinct shape for each state plus a text legend.
- **Every result screen.** The disclaimer and "How to verify" are rendered unconditionally on
  Results. The catalog version, SHA and rule-set version appear in the summary.

## 3. Code review (apps/web)

- **Worker boundary.** The main thread imports `@pinout/engine` and `@pinout/schema` as types only
  (grep confirmed). Cancel and the hard stop terminate the worker and start a fresh one.
- **Storage.** `SafeStore` wraps every get and set. On the first failure it falls back to memory,
  and the header shows whether the project is saved. Stored data is validated field by field.
- **Share links.**
  - The payload is capped at 16,000 characters. Decompress and parse sit in try/catch, and the
    result is checked by `fromObject` and `draftFromUnknown`.
  - Nothing loads until the user clicks "Open".
  - The catalog version must match `^[0-9a-z][0-9a-z._-]{0,63}$` with no `..`. The SHA must be 64
    hex characters, and the pinned file is checked against it.
  - All text is rendered through React (no `dangerouslySetInnerHTML`). Citation links are limited
    to http(s), with `rel="noopener noreferrer"`. CSV export blocks formula injection.
- **CSP** (meta tag, build only): `default-src 'self'`, `script-src 'self'`, `style-src 'self'`,
  `connect-src 'self'`, `object-src 'none'`, `form-action 'none'`. There are no third-party URLs
  in the source and no secrets.

## 4. Citation spot-check (8 claims, worked-example result)

Each claim was resolved from the compiled catalog `21f71471a3f0.json` and checked against the
records in `catalog/evidence/`.

| Displayed claim | Cited claim | Supports? |
| --- | --- | --- |
| Switches on GPIO34–39: input-only | `esp32-trm-v5.8#input-only-34-39` (TRM §6.1, p.115: "GPIO pins 34-39 are input-only.") | Yes |
| External pull-up required on 34–39 | `esp32-ds-v5.3#input-only-note` (DS App. A.1 note 2: "...do not feature an output driver or internal pull-up/pull-down circuitry") | Yes |
| SCLK on GPIO18 via SPI3 IO_MUX | `esp32-trm-v5.8#iomux-gpio18` (Table 6.10-1: "18 GPIO18 GPIO18 VSPICLK ...") | Yes |
| Routing limit 80 MHz (IO_MUX) | `esp-idf-spi-master-v6.1#matrix-40mhz-iomux-80mhz` | Yes |
| RC522 SPI capped at 10 MHz | `mfrc522-ds-v3.9#spi-speed-section` (§8.1.2: "up to 10 Mbit/s") | Yes |
| GPIO6–11 not offered | `esp32-wroom-32e-ds-v2.1#gpio6-11-flash` (§3.2 Table 3 note 2) | Yes |
| IO17 = J3:11, IO16 = J3:12 | `esp32-devkitc-v4-ug#j3-11-14` (table J3: "11 IO17 ... 12 IO16 ...") | Yes |
| Relay pads float at reset (pull-down) | `esp32-trm-v5.8#iomux-gpio33` + `#reset-column` + `#reset-legend-0-1` (Reset column "0" = IE=0, no pull) | Yes |
| ERRATUM_GPIO_3_11 (80 ns low pulse on GPIO36/39) | only `esp32-errata-v3.1#gpio-errata-summary`, whose quote is the **GPIO-3.6** row | Partly (minor L1) |

URLs match the evidence records in all 9 rows.

## 5. Keyboard and contrast

- **Focus:** `:focus-visible` gives a 3 px ring. The heading takes focus on route change, and there
  is a skip link.
- **Header view:** one tab stop with arrow keys, Home and End.
- **Dialog:** the variant dialog traps focus and closes on Escape.
- **Contrast:** real-browser axe (light scheme) finds 0 contrast violations. The dark-scheme
  tokens look AA-plausible but are not tested.

## Later (minor, non-blocking)

1. **L1, citation precision.** Warning `ERRATUM_GPIO_3_11` cites only
   `esp32-errata-v3.1#gpio-errata-summary`, whose quote is the GPIO-3.6 row. The precise claims
   `#gpio-3-11` and `#gpio-3-11-workaround` exist but are not cited, because the chip `errata:` list
   carries no evidence. Fix in the engine or catalog: map erratum ids to their claim ids.
2. **L2, citation noise.** Each assignment cites 30–45 claims. Many are unrelated, for example
   `env.SCL` cites the BME280 SPI output-low row, the ADC-oneshot GPIO0 note and the boot button.
   This makes "follow at least one source" harder. It is an engine-side evidence aggregation
   issue.
3. **L3, decompression size.** A share link is capped at 16,000 characters before
   decompression, but the decompressed size is not capped. In Node, a 12.7k-character link
   expands to 20 M characters in about 0.1 s and parses as valid JSON with a 20 MB instance name,
   which the Shared screen would render. This is self-DoS of a tab, not XSS. Cap the decompressed
   length (for example at `MAX_FILE_LENGTH`) and validate instance and role strings with
   `INSTANCE_PATTERN` or a length bound.
4. **L4, import size.** Importing a project file reads the whole file (`file.text()`) before the
   200k length check. Check `file.size` first.
5. **L5, board status.** The Results summary does not show the board status badge. Every MVP
   board is "Partially verified", so show it next to the board on the result.
6. **L6, keyboard e2e coverage.** The keyboard-only e2e skips the Constraints screen (locks,
   reserves, connections, wire length).
7. **L7, dark-scheme contrast.** Dark-scheme contrast is not covered by axe. Add a
   `colorScheme: 'dark'` pass.
8. **L8, header-pin buttons.** Header pins are `role="button"` with `aria-pressed` but do not
   respond to Enter or Space. Selection follows focus, so nothing is lost, but the role promises
   activation.
9. **L9, warning wording.** `MISO_SHARE_UNPROVEN` reads "used by rfid on a bus shared with rfid,
   tft", which names the owner twice. The wording comes from the engine.
