import type {
  R1Context,
  R2Context,
  R3Context,
  R4Context,
  R5Context,
  R6Context,
  R7Context,
  R8Context,
} from './contexts.js';
import { evalR1, evalR2, evalR3, evalR4, evalR5, evalR6, evalR7, evalR8 } from './rules.js';
import { RULE_IDS, type RuleId, type RuleOptions, type RuleResult } from './types.js';
import { disabledResult } from './util.js';

export const PACKAGE_NAME = '@pinout/rules';

export * from './types.js';
export * from './contexts.js';
export { fact, missingFact, known } from './util.js';
export {
  DIVIDER_VIN_TOLERANCE,
  I2C_RISE_TIME_FACTOR,
  I2C_TR_MAX_BY_SPEED,
  evalR1,
  evalR2,
  evalR3,
  evalR4,
  evalR5,
  evalR6,
  evalR7,
  evalR8,
  parallelOhm,
  ratioToVolts,
  rpMaxOhm,
  rpMinOhm,
} from './rules.js';

export interface RuleContextMap {
  R1: R1Context;
  R2: R2Context;
  R3: R3Context;
  R4: R4Context;
  R5: R5Context;
  R6: R6Context;
  R7: R7Context;
  R8: R8Context;
}

const EVALUATORS: { [K in RuleId]: (c: RuleContextMap[K]) => RuleResult } = {
  R1: evalR1,
  R2: evalR2,
  R3: evalR3,
  R4: evalR4,
  R5: evalR5,
  R6: evalR6,
  R7: evalR7,
  R8: evalR8,
};

function isDisabled(id: RuleId, opts?: RuleOptions): boolean {
  const d = opts?.disabled;
  if (d === undefined) return false;
  return Array.isArray(d) ? d.includes(id) : (d as ReadonlySet<RuleId>).has(id);
}

/** Evaluate one rule. A disabled rule never fails (mutation / rule-disable gate). */
export function evaluateRule<K extends RuleId>(
  id: K,
  ctx: RuleContextMap[K],
  opts?: RuleOptions,
): RuleResult {
  if (isDisabled(id, opts)) return disabledResult(id);
  return EVALUATORS[id](ctx);
}

/** Evaluate every supplied context, in rule-id order. */
export function runRules(
  contexts: Partial<RuleContextMap>,
  opts?: RuleOptions,
): readonly RuleResult[] {
  const out: RuleResult[] = [];
  for (const id of RULE_IDS) {
    const ctx = contexts[id];
    if (ctx !== undefined) out.push(evaluateRule(id, ctx as never, opts));
  }
  return out;
}
