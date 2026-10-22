// W9: focus moves to the page heading on a route change, and only then. No DOM library: the pure
// decision is tested directly, and the hook is run against a tiny fake of useRef/useEffect.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveFocusOnRouteChange, shouldFocusHeading } from '../src/focus';

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  deps: [] as (readonly unknown[] | undefined)[],
  effects: [] as (() => void)[],
  lastEffect: undefined as (() => void) | undefined,
  index: 0,
}));

vi.mock('react', () => ({
  useRef: (initial: unknown) => {
    const i = hooks.index++;
    hooks.refs[i] ??= { current: initial };
    return hooks.refs[i];
  },
  useEffect: (fn: () => void, deps?: readonly unknown[]) => {
    const i = hooks.index++;
    const before = hooks.deps[i];
    const changed =
      before === undefined || deps === undefined || deps.some((d, j) => !Object.is(d, before[j]));
    hooks.deps[i] = deps;
    if (changed) hooks.effects.push(fn);
  },
}));

const { useFocusOnRouteChange } = await import('../src/useFocusOnRouteChange');

describe('shouldFocusHeading (W9)', () => {
  it('never on the first render', () => {
    expect(shouldFocusHeading(null, 'home')).toBe(false);
    expect(shouldFocusHeading(null, 'not-found:/x')).toBe(false);
  });
  it('not when the route is unchanged', () => {
    expect(shouldFocusHeading('home', 'home')).toBe(false);
    expect(shouldFocusHeading('not-found:/x', 'not-found:/x')).toBe(false);
  });
  it('when the route changed, including between two not-found paths', () => {
    expect(shouldFocusHeading('home', 'not-found:/x')).toBe(true);
    expect(shouldFocusHeading('not-found:/x', 'home')).toBe(true);
    expect(shouldFocusHeading('not-found:/x', 'not-found:/y')).toBe(true);
  });
});

describe('moveFocusOnRouteChange', () => {
  it('focuses the heading exactly once when the route changed', () => {
    const heading = { focus: vi.fn() };
    expect(moveFocusOnRouteChange('home', 'not-found:/x', heading)).toBe(true);
    expect(heading.focus).toHaveBeenCalledTimes(1);
  });
  it('does not focus on first render or an unchanged route', () => {
    const heading = { focus: vi.fn() };
    expect(moveFocusOnRouteChange(null, 'home', heading)).toBe(false);
    expect(moveFocusOnRouteChange('home', 'home', heading)).toBe(false);
    expect(heading.focus).not.toHaveBeenCalled();
  });
  it('skips a heading that is not rendered', () => {
    expect(moveFocusOnRouteChange('home', 'not-found:/x', null)).toBe(false);
  });
});

describe('useFocusOnRouteChange', () => {
  const heading = { focus: vi.fn() };

  /** One "render + commit": run the hook, attach the element, then run the pending effects. */
  function render(key: string) {
    hooks.index = 0;
    const ref = useFocusOnRouteChange(key);
    ref.current = heading as unknown as HTMLHeadingElement;
    const pending = hooks.effects.splice(0);
    hooks.lastEffect = pending.at(-1) ?? hooks.lastEffect;
    for (const effect of pending) effect();
  }

  beforeEach(() => {
    hooks.refs.length = 0;
    hooks.deps.length = 0;
    hooks.effects.length = 0;
    hooks.lastEffect = undefined;
    heading.focus.mockClear();
  });

  it('does not focus on the first render', () => {
    render('home');
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('does not focus when the effect runs a second time for the same route (StrictMode)', () => {
    render('home');
    hooks.lastEffect?.();
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('does not focus on a re-render with the same route', () => {
    render('home');
    render('home');
    expect(heading.focus).not.toHaveBeenCalled();
  });

  it('focuses the heading once per route change', () => {
    render('home');
    render('not-found:/x');
    expect(heading.focus).toHaveBeenCalledTimes(1);
    render('not-found:/x');
    expect(heading.focus).toHaveBeenCalledTimes(1);
    render('home');
    expect(heading.focus).toHaveBeenCalledTimes(2);
  });
});
