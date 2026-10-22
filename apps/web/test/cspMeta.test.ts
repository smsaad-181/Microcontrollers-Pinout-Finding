import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY } from '../src/csp';
import { cspMeta, injectCsp } from '../src/cspMeta';

const page = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <title>x</title>',
  '    <script type="module" src="/src/main.tsx"></script>',
  '  </head>',
  '  <body></body>',
  '</html>',
].join('\n');

describe('injectCsp (Vite plugin transform, W7)', () => {
  it('inserts the CSP meta tag right after <meta charset>, before any script', () => {
    const out = injectCsp(page);
    const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
    expect(out).toContain(meta);
    expect(out.indexOf('<meta charset')).toBeLessThan(out.indexOf(meta));
    expect(out.indexOf(meta)).toBeLessThan(out.indexOf('<script'));
    expect(out.split('Content-Security-Policy').length).toBe(2); // exactly once
  });

  it('leaves the rest of the document untouched', () => {
    const out = injectCsp(page);
    expect(out.replace(/\n {4}<meta http-equiv=[^\n]*/, '')).toBe(page);
  });

  it('accepts a non-self-closing charset tag in any case', () => {
    expect(injectCsp('<meta charset="utf-8"><title>x</title>')).toContain(
      'http-equiv="Content-Security-Policy"',
    );
  });

  it('fails loudly when there is no <meta charset="UTF-8"> to anchor on', () => {
    expect(() => injectCsp('<html><head></head></html>')).toThrow(/charset/);
  });
});

describe('cspMeta plugin', () => {
  it('applies to production builds only and runs injectCsp as the html transform', () => {
    const plugin = cspMeta();
    expect(plugin.name).toBe('pinout-csp-meta');
    expect(plugin.apply).toBe('build');
    const transform = plugin.transformIndexHtml as (html: string) => string;
    expect(transform(page)).toBe(injectCsp(page));
  });

  it('the real index.html has a charset tag to anchor on', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(injectCsp(html)).toContain('Content-Security-Policy');
  });
});
