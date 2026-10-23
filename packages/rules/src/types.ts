/** Warning levels shared with the engine (skill pin-allocation-engine step 8). */
export const WARNING_LEVELS = ['critical', 'warning', 'caution', 'info'] as const;
export type WarningLevel = (typeof WARNING_LEVELS)[number];

export const RULE_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'] as const;
export type RuleId = (typeof RULE_IDS)[number];

/** Status of a catalog fact. Only verified/inferred facts with a finite value are usable. */
export type FactStatus = 'verified' | 'inferred' | 'missing' | 'conflict';

/** A numeric input with provenance. `value` is in the unit named by the context field. */
export interface Fact {
  readonly value: number | null | undefined;
  readonly status: FactStatus;
  readonly evidence: readonly string[];
}

export type RequiredPartKind =
  | 'level-shifter'
  | 'divider'
  | 'buffer'
  | 'pull-up'
  | 'remove-pull-up'
  | 'lower-speed'
  | 'series-resistor'
  | 'driver-transistor'
  | 'separate-supply'
  | 'move-pin';

export interface RequiredPart {
  readonly kind: RequiredPartKind;
  readonly note: string;
  readonly valueOhms?: number;
  readonly minOhms?: number;
  readonly maxOhms?: number;
  readonly hz?: number;
}

export interface RuleResult {
  readonly rule: RuleId;
  readonly level: WarningLevel;
  /** True only when level is 'info' and every input was known. Caution (unknown input) is never a pass. */
  readonly passed: boolean;
  readonly requiredParts: readonly RequiredPart[];
  readonly trace: readonly string[];
  /** Sorted, de-duplicated evidence ids of every fact consulted. */
  readonly evidence: readonly string[];
  /** Computed numbers (SI-ish units as named by key suffix). Only ever derived from known facts. */
  readonly values: Readonly<Record<string, number>>;
  /** R6 only: the net would change boot mode or flash voltage. */
  readonly blocked?: boolean;
  /** R6 only: risk-tier increment for the scorer (strap pad used, even when compatible). */
  readonly riskTierDelta?: number;
}

export interface RuleOptions {
  /** Rules treated as removed: they never fail (used by the mutation / rule-disable gate). */
  readonly disabled?: ReadonlySet<RuleId> | readonly RuleId[];
}
