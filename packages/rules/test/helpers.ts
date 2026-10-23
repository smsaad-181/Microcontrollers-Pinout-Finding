import { evaluateRule, type RuleId } from '../src/index.js';

/**
 * Scripted rule-disable gate: DISABLE_RULE=R3 pnpm --filter rules test must FAIL.
 * Tests call rules only through `ev`, which honours the env var.
 */
const raw = process.env.DISABLE_RULE;
const disabled: RuleId[] = raw ? [raw as RuleId] : [];

export const ev: typeof evaluateRule = (id, ctx) => evaluateRule(id, ctx, { disabled });
