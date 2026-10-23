// Registry of the vocabulary golden fixtures (catalog/fixtures/) may use. Derived from the 24
// hand-written fixtures of Phase 2a: nothing here is invented. Adding an entry means the engine
// test runner must understand it. Pure: no fs, no network.

/** Warning codes a fixture may expect (`warnings_include[].code`, `no_warning_code`). */
export const WARNING_CODES = [
  'ADC2_WIFI_CONFLICT',
  'ADC_OVER_RANGE',
  'ADC_RADIO_UNKNOWN',
  'ADC_RANGE_UNKNOWN',
  'ERRATUM_GPIO_3_11',
  'FACT_CONFLICT_RELIED',
  'FLOATING_AT_RESET_LOAD',
  'FLOATING_AT_RESET_UNKNOWN',
  'I2C_ADDRESS_SDA_STRAP_TIMING',
  'I2C_ADDRESS_UNKNOWN',
  'I2C_PULLUP_UNKNOWN',
  'LEVEL_SHIFTER_CONFLICT_RELIED',
  'LEVEL_SHIFTER_UNKNOWN',
  'LOGIC_LEVEL_UNKNOWN',
  'MISO_SHARE_UNPROVEN',
  'MODULE_REGULATOR_UNKNOWN',
  'NO_INTERNAL_PULL_UP_ON_GPIO16',
  'ONBOARD_LOAD_ON_PAD',
  'PIN_CURRENT_UNVERIFIED',
  'RAIL_BUDGET_UNKNOWN',
  'STRAP_FACT_MISSING',
] as const;

/** Keys of one `expect.properties` entry (each entry is an object with exactly one of these keys). */
export const PROPERTY_KEYS = [
  'adc_ratio_board',
  'adc_sensor_max_v_for_full_scale',
  'address_set_on_one_bus_distinct',
  'address_straps_distinct',
  'all_used',
  'bus_shared',
  'cumulative_mA_limit',
  'header_label_of_pad',
  'i2c_addresses_resolved',
  'i2c_collision',
  'i2c_known_address',
  'i2c_max_hz',
  'i2c_pair_in',
  'if_used',
  'interface_decided_by_rule',
  'interface_of',
  'locked_pad_unchanged',
  'max_hz',
  'max_per_i2c_bus',
  'no_pad_in',
  'no_warning_at_level',
  'no_warning_code',
  'one_of',
  'outputs_not_in',
  'pin_current_limit_used_mA',
  'port_group_total_mA_limit',
  'pullup_rp_eff_ohm',
  'r3_result',
  'required_parts_exclude',
  'risk_pads_subset_of',
  'risk_tier1_equals',
  'rp_max_ohm',
  'rp_min_ohm_at_3v3',
  'separate_i2c_instances',
  'signal_pad_in',
  'signal_pad_set_equals',
  'supply_split',
  'switches_on',
] as const;

/**
 * Prefixes of `expect.minimal_conflict_includes` tokens (`<prefix><detail>`, e.g.
 * `locked:pot.WIPER=GPIO25`, `strap:GPIO12`, `consumed:GPIO16`, `adc2-wifi:GPIO25`).
 */
export const CONFLICT_TOKEN_PREFIXES = [
  'adc2-wifi:',
  'adc:',
  'consumed:',
  'i2c-address:',
  'i2c-controllers:',
  'locked:',
  'reserved:',
  'strap:',
] as const;

/** Prefixes of `expect.relaxations_include` tokens (e.g. `unlock:pot.WIPER`, `wifi:false`). */
export const RELAXATION_TOKEN_PREFIXES = [
  'add-external-adc:',
  'different-board:',
  'different-variant:',
  'remove-module:',
  'unlock:',
  'wifi:',
] as const;

/** Relaxation tokens that stand alone, without a `:<detail>` part. */
export const RELAXATION_BARE_TOKENS = ['add-i2c-multiplexer'] as const;

/**
 * Role of a locked pin: an identifier, optionally indexed (`WIPER`, `SW`, `COIL[1]`). The index is a
 * 1-based channel number written in brackets.
 */
export const LOCKED_ROLE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(?:\[[1-9][0-9]*\])?$/;

const startsWithAny = (s: string, prefixes: readonly string[]) =>
  prefixes.some((p) => s.startsWith(p) && s.length > p.length);

export const isWarningCode = (s: string): boolean =>
  (WARNING_CODES as readonly string[]).includes(s);
export const isPropertyKey = (s: string): boolean =>
  (PROPERTY_KEYS as readonly string[]).includes(s);
export const isConflictToken = (s: string): boolean => startsWithAny(s, CONFLICT_TOKEN_PREFIXES);
export const isRelaxationToken = (s: string): boolean =>
  (RELAXATION_BARE_TOKENS as readonly string[]).includes(s) ||
  startsWithAny(s, RELAXATION_TOKEN_PREFIXES);
