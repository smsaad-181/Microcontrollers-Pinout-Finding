# Universal Pinout Finder

Pick your exact microcontroller board, add the sensors and modules you want to connect (DHT11, I2C
sensors, SPI displays, relays, buttons...), and get a conflict-free pin plan with the reason for every
pin and a link to the datasheet page behind it.

**It is a rule engine, not an AI guess.** A deterministic solver picks the pins. Every fact it uses
(which pins are strapping pins, how much current a pin can drive, what a sensor needs) comes from the
`catalog/` folder, and each fact cites an official document. If a fact is missing, the result says so
instead of guessing.

> **Always check your own board.** Boards with the same name are sometimes built differently. The result
> shows the catalog status of every fact, but you are responsible for the wiring you build. See
> [Disclaimer](#disclaimer).

## Use it

- **Online:** the GitHub Pages site (after the v1.0 release):
  `https://smsaad-181.github.io/Microcontrollers-Pinout-Finding/`
- **Offline, no server:** build the single file (below) and double-click
  `apps/web/dist-single/pinout-finder.html`.

Steps in the app: **1. Board** (pick the brand, then your board) -> **2. Modules** (add parts, one card
per board version) -> **3. Constraints** (optional: lock a pin, reserve pins) -> **4. Results** (pin
table, wiring, warnings, citations, share link, JSON/CSV export, print).

## What it checks

| Rule | Checks |
| --- | --- |
| R1 Absolute max | A driver never puts more voltage on a pin than the receiver can take |
| R2 Logic thresholds | 3.3 V and 5 V signals can be read correctly by the receiver |
| R3 I2C pull-ups | Combined pull-up value and bus capacitance suit the bus speed |
| R4 Pin current | Each load stays under the per-pin and cumulative limits |
| R5 Dividers | 5 V into 3.3 V needs a divider that stays in range |
| R6 Strap pins | A part's resting level on a boot-strapping pin matches what the chip needs at reset |
| R7 Power budget | Total current per rail stays under the regulator and USB limits |
| R8 ADC fit | The sensor range fits the ADC's usable range (and the ADC works with Wi-Fi on) |

Warnings come in four levels: critical, warning, caution, info. When no safe plan exists, the app says
why and offers ranked fixes instead of a wrong answer.

## Boards and parts in v1.0

22 boards: ESP32 family (Espressif DevKits, WROVER-KIT, NodeMCU-32S, LOLIN32, HUZZAH32, TTGO
T-Display, DOIT, six Waveshare boards), Arduino UNO R4 Minima, Raspberry Pi Pico and Pico W, WEMOS D1
mini. Modules: BME280 (three board versions), DHT11 (two), MPU-6050, HC-SR04, MFRC522, SSD1306,
ST7735S, ADS1115, relay boards, potentiometer, push button.

A board marked **Datasheet required** has no pin map yet and the app will not choose pins for it.
Each board shows a status: *fully verified*, *partially verified* or *datasheet required*.
See [docs/provenance.md](docs/provenance.md) for what those mean.

## Build it yourself

Needs Node >= 22.12 and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm catalog:validate           # check every catalog file
pnpm test                       # unit, property and golden-fixture tests
pnpm --filter web build         # site in apps/web/dist
pnpm --filter web build:single  # one self-contained HTML file in apps/web/dist-single
pnpm --filter web exec vite     # dev server on http://localhost:5173/Microcontrollers-Pinout-Finding/
```

## Repository map

```
catalog/        facts as YAML (chips, modules, boards, ics, breakouts) + evidence records + fixtures
packages/       schema (Zod), rules (R1-R8), engine (solver), cli (catalog validate/compile)
apps/web/       the React app (engine runs in a Web Worker)
docs/           PLAN, STATE, schema reference, provenance, validation reports, image credits
tools/          checks and the weekly evidence-link checker
```

## Contributing

Adding a board or module is mostly research, not code. Read [CONTRIBUTING.md](CONTRIBUTING.md): no
guessed hardware facts, and every fact needs two independent checks.

## Disclaimer

This tool gives engineering guidance from published datasheets and schematics. It cannot see your
actual board, solder joints, clone-board differences or firmware. Results are provided as is, with no
warranty, and are no substitute for reading the datasheet of the parts you use and measuring before
you power anything that matters. Photos in the app are shown for recognition only and credited in
[docs/image-credits.md](docs/image-credits.md); product photos belong to their owners.

## Licences

Code: MIT ([LICENSE](LICENSE)). Catalog facts: CC-BY-4.0 ([catalog/LICENSE](catalog/LICENSE)).
