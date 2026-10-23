# Phase 2b solve performance (task 2b.11)

Test: `packages/engine/test/perf.test.ts` (warm-up solve of every fixture, then 15 timed `solveDetailed` runs per fixture, 360 samples; `PERF_RUNS=15 PERF_VERBOSE=1 pnpm --filter @pinout/engine test perf`).
Machine: Intel Core i3-8130U 2.2 GHz (2 cores / 4 threads), 4 GB RAM, Windows 11, Node 22.17.0. A low-end laptop, so a CI runner should be at least as fast.

| Metric (24 golden fixtures, all samples) | ms |
|---|---|
| p50 | 3.6 |
| p95 | 57.9 |
| max | 878.5 |

Target p95 <= 200 ms: met (58 ms). CI bound in the test is deliberately generous (p95 <= 1000 ms, max <= 5000 ms; override with `PERF_P95_MS` / `PERF_MAX_MS`).

## Slowest fixtures (median / max)

| Fixture | median | max |
|---|---|---|
| ads1115-nine-boards-i2c-address-space-unsat | 627 ms | 879 ms |
| pico-w-four-pots-no-free-adc-unsat | 44 ms | 58 ms |
| esp32-pot-adc2-wifi-unsat | 34 ms | 69 ms |
| esp32-s3-n8r8-gpio36-psram-unsat | 27 ms | 71 ms |
| devkitc-v4-wroom-bme280-rc522-st7735s-relays-switches | 17 ms | 34 ms |

All other fixtures solve in under 20 ms (most under 5 ms).

## Hotspot

The only case above 200 ms is an unsat project with nine ADS1115 modules. The time is the unsat analysis (`analyzeUnsat`: QuickXplain, deletion pass and relaxation candidates, each re-solving a sub-project, up to 7+ members and several boards), not the search itself. Typical (satisfiable) projects take a few ms. Not optimised: it needs a caching or smarter-candidate change, not a trivial one, and the fixture is far from a typical project.
