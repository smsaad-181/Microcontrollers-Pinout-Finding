import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from '../src/csp';
import { hrefFor, parseHashRoute } from '../src/route';

describe('parseHashRoute', () => {
  it.each(['', '#', '#/', '#//', '/', '#/?x=1'])('maps %j to home', (hash) => {
    expect(parseHashRoute(hash)).toEqual({ name: 'home' });
  });

  it.each([
    ['#/nope', '/nope'],
    ['#/board/esp32/', '/board/esp32'],
    ['#nope', '/nope'],
    ['#/a?b=c', '/a'],
  ])('maps %j to not-found %j', (hash, path) => {
    expect(parseHashRoute(hash)).toEqual({ name: 'not-found', path });
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
