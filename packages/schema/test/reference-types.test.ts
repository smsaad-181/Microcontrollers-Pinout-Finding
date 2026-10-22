// Field-for-field proof that the Zod schemas match the normative TypeScript reference
// (skill `catalog-schema`, copied verbatim into ./reference.ts).
//
// `expectTypeOf(...).toEqualTypeOf<...>()` is checked by the TypeScript compiler, not at runtime:
// `pnpm --filter @pinout/schema typecheck` (tsc over src + test) fails on any difference in a field
// name, optionality (exactOptionalPropertyTypes is on, so `a?: T` and `a?: T | undefined` differ),
// nullability, enum member, union arm or tuple length. The runtime `it` only keeps Vitest happy.
import { describe, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import type { fact } from '../src/index.js';
import type * as S from '../src/index.js';
import type * as Ref from './reference.js';

describe('Zod-inferred types equal the catalog-schema reference', () => {
  it('primitives', () => {
    expectTypeOf<S.Status>().toEqualTypeOf<Ref.Status>();
    expectTypeOf<S.Unit>().toEqualTypeOf<Ref.Unit>();
    expectTypeOf<S.ClaimId>().toEqualTypeOf<Ref.ClaimId>();
    expectTypeOf<S.PadId>().toEqualTypeOf<Ref.PadId>();
    expectTypeOf<S.Expr>().toEqualTypeOf<Ref.Expr>();
  });

  it('Fact<T> for every value type the reference uses', () => {
    expectTypeOf<S.Fact<number>>().toEqualTypeOf<Ref.Fact<number>>();
    expectTypeOf<S.Fact<boolean>>().toEqualTypeOf<Ref.Fact<boolean>>();
    expectTypeOf<S.Fact<string>>().toEqualTypeOf<Ref.Fact<string>>();
    expectTypeOf<S.Fact<Ref.Expr>>().toEqualTypeOf<Ref.Fact<Ref.Expr>>();
    expectTypeOf<S.Fact<[number, number]>>().toEqualTypeOf<Ref.Fact<[number, number]>>();
    // The generic factory itself: fact(z.number()) infers exactly Fact<number>.
    expectTypeOf<z.infer<ReturnType<typeof fact<z.ZodNumber>>>>().toEqualTypeOf<Ref.Fact<number>>();
  });

  it('evidence', () => {
    expectTypeOf<S.Evidence>().toEqualTypeOf<Ref.Evidence>();
  });

  it('chip', () => {
    expectTypeOf<S.Routing>().toEqualTypeOf<Ref.Routing>();
    expectTypeOf<S.ResetState>().toEqualTypeOf<Ref.ResetState>();
    expectTypeOf<S.PadFunction>().toEqualTypeOf<Ref.PadFunction>();
    expectTypeOf<S.Pad>().toEqualTypeOf<Ref.Pad>();
    expectTypeOf<S.Chip>().toEqualTypeOf<Ref.Chip>();
  });

  it('module', () => {
    expectTypeOf<S.Module>().toEqualTypeOf<Ref.Module>();
  });

  it('board', () => {
    expectTypeOf<S.BoardStatus>().toEqualTypeOf<Ref.BoardStatus>();
    expectTypeOf<S.ConnectorPin>().toEqualTypeOf<Ref.ConnectorPin>();
    expectTypeOf<S.Board>().toEqualTypeOf<Ref.Board>();
  });

  it('IC and breakout', () => {
    expectTypeOf<S.Signal>().toEqualTypeOf<Ref.Signal>();
    expectTypeOf<S.Interface>().toEqualTypeOf<Ref.Interface>();
    expectTypeOf<S.IC>().toEqualTypeOf<Ref.IC>();
    expectTypeOf<S.Breakout>().toEqualTypeOf<Ref.Breakout>();
  });

  it('project, fixture, warning, recommendation', () => {
    expectTypeOf<S.Project>().toEqualTypeOf<Ref.Project>();
    expectTypeOf<S.Fixture>().toEqualTypeOf<Ref.Fixture>();
    expectTypeOf<S.Warning>().toEqualTypeOf<Ref.Warning>();
    expectTypeOf<S.Recommendation>().toEqualTypeOf<Ref.Recommendation>();
  });
});
