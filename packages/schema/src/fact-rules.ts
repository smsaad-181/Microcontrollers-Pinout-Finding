// Cross-field fact rules, kept OUT of the Zod shapes so they keep distinct error codes
// (fixtures README, decision 2). Pure functions over already-parsed data (plain objects/arrays).
import { normalizeReviewer } from './primitives.js';

export type FactRuleCode = 'E_EVIDENCE_MISSING' | 'E_FACT_STATUS' | 'E_VERIFIED_REVIEWERS';

export interface FactRuleIssue {
  code: FactRuleCode;
  /** Dot path relative to the entity root (array indices as numbers, record keys as-is). */
  path: string;
  message: string;
}

export interface FoundFact {
  path: string;
  fact: Record<string, unknown>;
}

export interface ClaimRef {
  path: string;
  claim: string;
}

type Obj = Record<string, unknown>;

function isObject(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** A fact is any mapping with both a `status` and an `evidence` key (README decision 3). */
export function isFact(x: unknown): x is Obj {
  return isObject(x) && 'status' in x && 'evidence' in x;
}

function join(path: string, key: string | number): string {
  return path === '' ? String(key) : `${path}.${String(key)}`;
}

/** Every fact in document order. Facts are not searched inside (a fact value is not a fact). */
export function collectFacts(root: unknown): FoundFact[] {
  const out: FoundFact[] = [];
  const walk = (node: unknown, path: string): void => {
    if (isFact(node)) {
      out.push({ path, fact: node });
    } else if (Array.isArray(node)) {
      node.forEach((child, i) => {
        walk(child, join(path, i));
      });
    } else if (isObject(node)) {
      for (const [k, v] of Object.entries(node)) walk(v, join(path, k));
    }
  };
  walk(root, '');
  return out;
}

/**
 * Every claim id cited anywhere: any `evidence` key holding an array (facts, conflict readings,
 * onboard[], os_overlays[], select_strap, Fixture.evidence). Non-string items are skipped (shape
 * errors are Zod's job).
 */
export function collectClaimRefs(root: unknown): ClaimRef[] {
  const out: ClaimRef[] = [];
  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => {
        walk(child, join(path, i));
      });
    } else if (isObject(node)) {
      for (const [k, v] of Object.entries(node)) {
        const p = join(path, k);
        if (k === 'evidence' && Array.isArray(v)) {
          v.forEach((claim, i) => {
            if (typeof claim === 'string') out.push({ path: join(p, i), claim });
          });
        } else {
          walk(v, p);
        }
      }
    }
  };
  walk(root, '');
  return out;
}

function checkOne(path: string, f: Obj): FactRuleIssue[] {
  const issues: FactRuleIssue[] = [];
  const status = f.status;
  const evidence = Array.isArray(f.evidence) ? f.evidence : [];
  const hasValue = f.value !== null && f.value !== undefined;

  if (status !== 'missing' && evidence.length === 0) {
    issues.push({
      code: 'E_EVIDENCE_MISSING',
      path: join(path, 'evidence'),
      message: `fact has status "${String(status)}" but no evidence; cite a claim or mark it missing`,
    });
  }
  if (status === 'missing' && hasValue) {
    issues.push({
      code: 'E_FACT_STATUS',
      path: join(path, 'value'),
      message: 'fact has status "missing" but a value; a missing fact must have value: null',
    });
  }
  if (status !== 'missing' && !hasValue) {
    issues.push({
      code: 'E_FACT_STATUS',
      path: join(path, 'value'),
      message: `fact has status "${String(status)}" but value is null; only missing facts may be null`,
    });
  }
  if (status === 'conflict' && (f.readings === undefined || f.active === undefined)) {
    issues.push({
      code: 'E_FACT_STATUS',
      path: join(path, f.readings === undefined ? 'readings' : 'active'),
      message:
        'fact has status "conflict" but lacks readings and/or active (most restrictive reading)',
    });
  }
  if (status === 'verified') {
    const reviewers = Array.isArray(f.reviewers) ? f.reviewers : [];
    // Identity = trim + lower-case; blank keys never count.
    const distinct = new Set(
      reviewers
        .filter((r): r is string => typeof r === 'string')
        .map(normalizeReviewer)
        .filter((r) => r !== ''),
    );
    if (distinct.size < 2) {
      issues.push({
        code: 'E_VERIFIED_REVIEWERS',
        path: join(path, 'reviewers'),
        message: `verified fact needs at least 2 distinct reviewers, has ${String(distinct.size)}`,
      });
    }
  }
  return issues;
}

/**
 * Applies the cross-field fact rules to every fact in an entity: evidence present, value/status
 * agreement, conflict readings, and two distinct reviewers (trim + lower-case) for `verified`.
 * Returns issues in document order; an empty array means the entity passes.
 */
export function checkFactRules(root: unknown): FactRuleIssue[] {
  return collectFacts(root).flatMap(({ path, fact }) => checkOne(path, fact));
}
