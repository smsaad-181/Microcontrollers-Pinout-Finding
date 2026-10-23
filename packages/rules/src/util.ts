import type { Fact, RequiredPart, RuleId, RuleResult, WarningLevel } from './types.js';

const REL_EPS = 1e-9;

/** Inclusive a <= b with a relative float tolerance, so value == limit passes. */
export function le(a: number, b: number): boolean {
  return a <= b + REL_EPS * Math.max(1, Math.abs(b));
}
export function ge(a: number, b: number): boolean {
  return le(b, a);
}

export function fact(
  value: number,
  evidence: readonly string[] = [],
  status: Fact['status'] = 'verified',
): Fact {
  return { value, status, evidence };
}
export function missingFact(evidence: readonly string[] = []): Fact {
  return { value: null, status: 'missing', evidence };
}

/** The numeric value if the fact is usable, else undefined. */
export function known(f: Fact | undefined): number | undefined {
  if (f === undefined) return undefined;
  if (f.status !== 'verified' && f.status !== 'inferred') return undefined;
  return typeof f.value === 'number' && Number.isFinite(f.value) ? f.value : undefined;
}

/** Collects trace, evidence and missing inputs while a rule runs. */
export class Run {
  readonly trace: string[] = [];
  private readonly ev = new Set<string>();
  private readonly gaps: string[] = [];
  readonly values: Record<string, number> = {};
  readonly parts: RequiredPart[] = [];

  constructor(readonly rule: RuleId) {}

  /** Read a fact, recording evidence; records a gap (-> caution) when unusable. */
  need(name: string, f: Fact | undefined): number | undefined {
    if (f !== undefined) for (const e of f.evidence) this.ev.add(e);
    const v = known(f);
    if (v === undefined) {
      this.gaps.push(`${name} (${f?.status ?? 'not provided'})`);
    }
    return v;
  }
  addEvidence(ids: readonly string[]): void {
    for (const e of ids) this.ev.add(e);
  }
  get incomplete(): boolean {
    return this.gaps.length > 0;
  }
  note(s: string): void {
    this.trace.push(s);
  }
  set(key: string, v: number): void {
    this.values[key] = v;
  }

  private build(level: WarningLevel, passed: boolean, extra?: Partial<RuleResult>): RuleResult {
    return {
      rule: this.rule,
      level,
      passed,
      requiredParts: this.parts,
      trace: this.trace,
      evidence: [...this.ev].sort(),
      values: this.values,
      ...extra,
    };
  }

  /** Unknown inputs: Caution, never a pass. */
  caution(extra?: Partial<RuleResult>): RuleResult {
    this.trace.push(`unknown input(s): ${this.gaps.join(', ')} -> cannot verify, caution`);
    return this.build('caution', false, extra);
  }
  pass(extra?: Partial<RuleResult>): RuleResult {
    return this.build('info', true, extra);
  }
  fail(level: WarningLevel, extra?: Partial<RuleResult>): RuleResult {
    return this.build(level, false, extra);
  }
}

export function disabledResult(rule: RuleId): RuleResult {
  return {
    rule,
    level: 'info',
    passed: true,
    requiredParts: [],
    trace: [`${rule} disabled (rule removed)`],
    evidence: [],
    values: {},
  };
}

export function fmt(n: number): string {
  return Number.isFinite(n) ? String(Math.round(n * 1e6) / 1e6) : String(n);
}
