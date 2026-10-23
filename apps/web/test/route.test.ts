import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from '../src/csp';
import { hrefFor, parseHashRoute, routeKey } from '../src/route';

describe('parseHashRoute', () => {
  it.each(['', '#', '#/', '#//', '/', '#/?x=1'])('maps %j to home', (hash) => {
    expect(parseHashRoute(hash)).toEqual({ name: 'home' });
  });

  it.each([
    ['#/nope', '/nope'],
    ['#/board/esp32/', '/board/esp32'],
    ['#nope', '/nope'],
    ['#/a?b=c', '/a'],
    ['#/p', '/p'],
  ])('maps %j to not-found %j', (hash, path) => {
    expect(parseHashRoute(hash)).toEqual({ name: 'not-found', path });
  });

  it.each(['board', 'modules', 'constraints', 'results'] as const)('maps #/%s to its step', (s) => {
    expect(parseHashRoute(`#/${s}`)).toEqual({ name: s });
    expect(parseHashRoute(`#/${s}/`)).toEqual({ name: s });
  });

  it('maps #/p/<data> to a shared project', () => {
    expect(parseHashRoute('#/p/abc-123')).toEqual({ name: 'shared', data: 'abc-123' });
  });
});

describe('routeKey', () => {
  it('distinguishes pages', () => {
    expect(routeKey({ name: 'board' })).toBe('board');
    expect(routeKey({ name: 'shared', data: 'x' })).toBe('shared');
    expect(routeKey({ name: 'not-found', path: '/x' })).toBe('not-found:/x');
  });
});

describe('in-page anchors', () => {
  it('does not turn #main (the <main> id) into a not-found page', () => {
    expect(parseHashRoute('#main')).toEqual({ name: 'home' });
  });

  it('still shows not-found for other unknown hashes', () => {
    expect(parseHashRoute('#mainx')).toEqual({ name: 'not-found', path: '/mainx' });
    expect(parseHashRoute('#/main')).toEqual({ name: 'not-found', path: '/main' });
  });
});

describe('styles', () => {
  it('wraps long unbroken text such as a long hash in <code>', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(css).toMatch(/code\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});

describe('hrefFor', () => {
  it('builds hash hrefs', () => {
    expect(hrefFor('/')).toBe('#/');
    expect(hrefFor('board/x')).toBe('#/board/x');
  });
});

describe('CONTENT_SECURITY_POLICY', () => {
  it('allows only same-origin resources and no inline code', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
    expect(CONTENT_SECURITY_POLICY).not.toContain('frame-ancestors');
  });
});
