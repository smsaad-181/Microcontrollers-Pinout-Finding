// Hand-copied, VERBATIM, from the "TypeScript reference (normative)" block in
// .claude/skills/catalog-schema/SKILL.md. The only edits: `export` added to every declaration and
// this header. Do not "fix" anything here: if the skill changes, re-copy it. The type-level test
// `reference-types.test.ts` proves the Zod-inferred types in `src/` equal these, field for field.

// ---------- primitives ----------
export type Status = 'verified' | 'single-source' | 'conflict' | 'interim' | 'community' | 'missing';
//  interim  = value from a cited related/secondary source (e.g. ST7735 for ST7735S); evidence required;
//             always surfaced as Caution; scheduled for replacement.
export type Unit = 'V' | 'mV' | 'A' | 'mA' | 'ohm' | 'kohm' | 's' | 'ns' | 'us' | 'Hz' | 'kHz' | 'MHz' | 'pF' | 'W';
export type ClaimId = string;                       // '<doc-id>#<slug>'
export type PadId = string;                         // chip pad name, e.g. 'GPIO21'
export type Expr = number | `VDD*${number}` | `VDDIO+${number}` | `VDDIO*${number}`;

export interface Fact<T> {
  value: T | null;                           // null only when status === 'missing'
  unit?: Unit;
  conditions?: Record<string, string | number>;
  evidence: ClaimId[];                       // >= 1 unless status === 'missing'
  status: Status;
  reviewers?: string[];                      // >= 2 distinct when status === 'verified'
  readings?: { value: T; evidence: ClaimId[] }[];   // required when status === 'conflict'
  active?: T;                                // required when 'conflict': most restrictive reading
  transcribed?: boolean;
  note?: string;
}

// ---------- evidence ----------
export interface Evidence {
  id: string; title: string; publisher: string; doc_number: string | null;
  revision: string | null; revision_date: string | null;
  url: string; url_original: string | null; accessed: string /* YYYY-MM-DD */;
  sha256: string | null;
  kind: 'board-guide'|'datasheet'|'trm'|'errata'|'schematic'|'design-guide'|'api-doc'|'library'|'app-note'|'standard';
  secondary: boolean; manual: boolean;
  claims: { id: ClaimId; locator: string; quote: string; supports: string }[];
}

// ---------- chip ----------
export type Routing = 'iomux' | 'matrix' | 'fixed';
export type ResetState = 'input' | 'pullup' | 'pulldown' | 'disabled' | 'output-high' | 'output-low';
export interface PadFunction { fn: string /* 'GPIO'|'SPI3.SCK'|'I2C.SDA'|'ADC1_CH4'|'UART0.TX'|'JTAG.TMS'… */;
  routing: Routing; max_hz?: Fact<number>; }
export interface Pad {
  gpio?: number;
  functions: PadFunction[];
  input_only: Fact<boolean>;
  reset_state: Fact<ResetState>;
  strap: Fact<{ role: string; required_at_reset: 'low' | 'high' | 'any'; default_pull?: 'up'|'down'|'none' } | 'none'>;
  adc?: { unit: string; channel: number; radio_conflict: Fact<boolean> };
  dac?: { channel: number }; touch?: { channel: number };
  jtag?: string;                              // e.g. 'MTMS'
  power_up_glitch: Fact<{ level: 'high' | 'low'; duration_s: number } | 'none'>;
  errata: string[];                           // errata ids affecting this pad
}
export interface Chip {
  id: string; vendor: string; family: string; series: string; revisions: string[];
  vdd_io: Fact<number>;
  electrical: {
    vih_min: Fact<Expr>; vil_max: Fact<Expr>; voh_min: Fact<Expr>; vol_max: Fact<Expr>;
    abs_max_vin: Fact<Expr>; pin_current_max: Fact<number>;   // mA
    port_current_max?: Fact<number>; vcc_pin_current_max?: Fact<number>; cumulative_current_max: Fact<number>;
    internal_pull_ohm?: Fact<{ min?: number; typ?: number; max?: number }>;
  };
  pads: Record<PadId, Pad>;
  peripherals: Record<string /* 'SPI2'|'SPI3'|'I2C0'|'UART1'|'ADC1'… */, {
    kind: 'spi'|'i2c'|'uart'|'adc'|'pwm'|'onewire-capable';
    iomux_pins?: Record<string /* role */, PadId>;
    matrix_routable: boolean;
    limits?: { matrix_max_hz?: Fact<number>; iomux_max_hz?: Fact<number> };
    adc_effective_range_mv?: Fact<Record<string /* atten */, [number, number]>>;
  }>;
}

// ---------- module (e.g. ESP32-WROOM-32E) ----------
export interface Module { id: string; chip: string; bonded_pads: PadId[];
  consumed: Record<PadId, Fact<'flash'|'psram'|'usb'|'crystal'|'internal'>>;
  flash_voltage: Fact<number>; psram?: Fact<string>; }

// ---------- board ----------
export type BoardStatus = 'fully-verified' | 'partially-verified' | 'datasheet-required' | 'unsupported';
export interface ConnectorPin { position: number; label: string; kind: 'power'|'ground'|'gpio'|'reset'|'nc'|'analog-ref'|'enable'|'boot'|'analog'; pad?: PadId; rail?: string;
  alias_of?: string;  // '<connector-id>:<position>' of the primary pin that shares this pad (Arduino SDA/SCL = A4/A5, ICSP)
}
export interface Board {
  id: string; vendor: string; name: string; revision: string;
  variants: { id: string; module: string }[];
  logic_voltage: Fact<number>;
  rails: { name: string; voltage: Fact<number | { min: number; max: number }>; max_current: Fact<number>; source: string }[];
  connectors: { id: string; side?: 'left'|'right'|'top'|'bottom'; pins: ConnectorPin[] }[];
  onboard: { part: string; uses_pad: PadId[]; effect: string; evidence: ClaimId[] }[];
  numbering: { primary: 'gpio' | 'label' | 'physical' };
  os_overlays?: { name: string; pads: Record<string, PadId>; evidence: ClaimId[] }[];   // Raspberry Pi
  status: BoardStatus;                        // computed by the CLI; validate rejects a mismatch
}

// ---------- sensor IC + breakout ----------
export interface Signal { role: string; dir: 'in' | 'out' | 'io'; drive: 'push-pull' | 'open-drain' | 'open-collector';
  shareable: boolean; acts_on_level?: boolean;  // true for relay/LED/MOSFET-gate/buzzer inputs (a "load")
  resting_level?: 'high' | 'low' | 'float'; }
export interface Interface { kind: 'i2c'|'spi'|'uart'|'onewire'|'analog'|'digital';
  signals: Signal[];
  limits: { max_hz?: Fact<number>; spi_modes?: number[]; i2c_modes?: ('sm'|'fm'|'fmp'|'hs')[];
            addresses?: { value: number; strap: string }[]; miso_tristate_when_deselected?: Fact<boolean>;
            tscyc_min_s?: Fact<number>; analog_range_v?: Fact<[number, number]>; }; }
export interface IC { id: string; vendor: string; part: string;
  interfaces: Interface[];
  select_strap?: { pins: string[]; table: { value: Record<string, 0 | 1>; selects: Interface['kind'] }[]; evidence: ClaimId[] };
  vdd_range: Fact<[number, number]>; vio_range: Fact<[number, number]>; input_abs_max: Fact<Expr>;
  logic_levels?: { vih_min: Fact<Expr>; vil_max: Fact<Expr>; voh_min?: Fact<Expr>; vol_max?: Fact<Expr> };
  supply_current: Fact<{ typ?: number; max?: number }>; }
export interface Breakout { id: string; ic: string; vendor: string; variant_names: string[];
  pins: { label: string; maps_to: string /* role | 'VCC' | 'GND' | 'NC' */ }[];
  regulator: Fact<{ present: boolean; vin_range?: [number, number] }>;
  level_shifter: Fact<boolean>;
  pullups: { line: string; value_ohm: Fact<number> }[];
  hardwired: { strap: string; value: string | number }[];
  interfaces_exposed: Interface['kind'][];
  supply_current: Fact<{ typ?: number; max?: number }>; notes?: string; }

// ---------- project, fixture, recommendation ----------
export interface Project { board: string; variant: string; wifi?: boolean;
  modules: { breakout: string; instance: string; interface?: Interface['kind']; address_strap?: string }[];
  locked: { instance: string; role: string; pad: PadId }[]; reserved: PadId[];
  rails?: Record<string, number>; framework?: 'arduino'|'micropython'|'esp-idf'|'pico-sdk'|'rpi-python';
  wiring_length_m?: number; allow_reassign?: boolean; }
export interface Fixture { id: string; board: string; variant: string; project: Project;
  expect: { status: 'ok' | 'unsat' | 'needs_variant'; exact?: Record<string, PadId>; properties?: unknown[];
            warnings_include?: { code: string; level: Warning['level'] }[];
            required_parts_include?: unknown[]; minimal_conflict_includes?: string[]; relaxations_include?: string[] };
  evidence: ClaimId[]; derivations: string[]; changelog?: string[]; }
export interface Warning { level: 'critical' | 'warning' | 'caution' | 'info'; code: string; message: string; pads: PadId[]; evidence: ClaimId[]; }
export interface Recommendation {
  catalog_version: string; catalog_sha256: string; ruleset_version: string;
  status: 'ok' | 'unsat' | 'needs_variant';
  interfaces: Record<string /* instance */, { kind: Interface['kind']; decided_by_rule: number; alternatives: Interface['kind'][] }>;
  assignments: { instance: string; role: string; pad: PadId; gpio: number; label: string; connector: string; position: number;
    peripheral_instance?: string; routing: Routing; trace: string[]; evidence: ClaimId[];
    alternatives: { pad: PadId; lower_tier: 1 | 2 | 3 | 4; reason: string }[] }[];
  required_parts: { kind: 'resistor'|'capacitor'|'level-shifter'|'buffer'|'transistor'|'diode'|'regulator'|'divider'; value?: string; role: string; count: number; pads?: PadId[] }[];
  warnings: Warning[];
  budgets: { rail: string; demand_ma: number; limit_ma: number | null }[];
  score: [number, number, number, number];
  unsat?: { minimal_conflict: string[]; relaxations: string[] };
  variant_candidates?: string[];
}
