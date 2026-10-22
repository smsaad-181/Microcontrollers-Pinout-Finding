---
name: pin-allocation-engine
description: Specification of the deterministic pin-allocation engine — variant resolution, signal expansion, domains, constraints, backtracking CSP with forward checking and MRV, branch-and-bound on a lexicographic score, explanation traces, alternatives, and unsat diagnosis with minimal conflicts and relaxations. Use when implementing, testing, reviewing or consuming the engine.
---

# Pin-allocation engine

Allocation is a constraint-satisfaction problem: signals = variables, pins = domains, electrical and
bus rules = constraints. Typical size < 40 signals × < 40 pins ⇒ exact search in milliseconds.

## Pipeline

1. **Resolve variants** — board revision + module variant (WROOM/WROVER, N8/N8R8) + breakout variant.
   Ambiguous ⇒ return `needs_variant` with the candidate list (UI asks the user). Never guess.
2. **Interface candidates** per module instance (skill `interface-selection`). Interface choice is an
   **outer loop**: enumerate interface combinations (module-locked ones fixed), solve the inner pin CSP
   for each, then pick the combination with the procedure in `interface-selection` (rules 3–5 use the
   inner solutions' spare-pin counts). The lexicographic score below compares pin assignments **within**
   one interface combination only.
3. **Expand signals**: `{ instance, role, dir, drive, peripheral: 'SPI.SCK'|'I2C.SDA'|'UART.TX'|'ADC'|
   'GPIO'|'GPIO.IRQ', max_hz, shareable: 'bus'|'exclusive', resting_level_at_reset: 'high'|'low'|
   'float'|'driven-high'|'driven-low', needs_pull?: 'up'|'down' }`.
4. **Domains**: pad ∈ domain(signal) iff exposed on this board revision ∧ not consumed (module/board/
   reserved/locked-by-other) ∧ supports the function (routing class: iomux | matrix | fixed, with
   max_hz) ∧ direction allowed (no outputs on input-only) ∧ not on UART0 when the board uses it for USB.
5. **Constraints** (hard):
   - All-different for exclusive signals; bus lines grouped per peripheral instance (all SPI3 lines
     share one instance; their pads must be that instance's pads when routing is iomux-only).
   - SPI: unique CS per device; per-device clock ≤ min(device max, routing limit).
   - I2C: unique 7-bit address per bus (use address straps, a second bus, or the other interface).
   - UART: one device per instance; TX↔RX crossover recorded.
   - ADC: channel on a unit usable with the radio when the project uses Wi-Fi (ESP32: ADC1 only).
   - Rules R1–R8 (skill `electrical-rules`) — each may forbid, or allow with required parts.
   - Locked pins fixed; never moved unless the project explicitly allows reassignment.
6. **Search**: backtracking + forward checking; variable order = MRV (smallest domain), ties by
   degree; value order = best tier score first. **Branch-and-bound**: the first complete solution sets
   an upper bound; prune partial assignments whose optimistic score is worse. Budget 2 s; return best
   found + `timeout: true` if exceeded (should not happen on MVP).
7. **Score** complete solutions **lexicographically** (lower is better at each tier, compare tier 1
   first; a lower tier can never outweigh a higher one):
   1. Risk: # strap pads used (even when compatible), # JTAG pads, # pads with power-up glitch/errata,
      # `conflict`-status facts relied on, # loads on pads floating at reset without a pull.
      A **load** is a signal with `acts_on_level: true` (relay/transistor driver input, LED, MOSFET gate,
      buzzer) — module logic inputs such as CS, DC, RST are not loads (they are covered by R6 when on
      straps). Each item counts 1; a pad that is both a strap and has `conflict` status counts 2.
   2. Performance: SPI devices whose clock need is met only via matrix (penalty), ADC fit quality.
   3. Convenience: library-default pads, header adjacency / same connector side.
   4. Headroom: scarce capabilities consumed (ADC1, DAC, touch, spare UART, IO_MUX SPI pins).
   Final deterministic tie-break: lexicographic order of (connector, position).
8. **Explain**: per assignment: rule trace + evidence ids; 2–3 alternatives with the tier that ranked
   them lower; required parts (resistor values, level shifter, buffer); warnings (critical/warning/
   caution/info) with codes.
9. **Unsat**: compute a minimal conflicting subset of constraints by deletion (QuickXplain style) and
   return ranked relaxations: share bus → change interface → lower clock to allow matrix routing →
   add expander (MCP23017/PCF8574) or external ADC (ADS1115) → different board.

## Invariants (property tests)

- Every returned solution satisfies every hard constraint.
- No pad consumed by flash/PSRAM/USB/reserved ever appears; no output on input-only pads.
- Locked pins unchanged; determinism (same input + catalog hash ⇒ identical JSON).
- Any fact with status `missing`/`conflict` that influenced a decision produces a warning.
- Removing a module never makes a previously valid project unsat.

## Worked reference

`docs/research/worked-example-esp32-devkitc.md` is the canonical end-to-end expectation.
