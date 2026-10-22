// W10: vite.config.ts must register the CSP plugin; CI only greps the built page, so a config that
// silently dropped `cspMeta()` would ship without a Content-Security-Policy.
import { describe, expect, it } from 'vitest';
import config from '../vite.config';

interface PluginLike {
  name?: unknown;
  apply?: unknown;
}

/** Plugins may be nested arrays, falsy, or promises; keep the plain plugin objects. */
function flatten(value: unknown): PluginLike[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (typeof value === 'object' && value !== null && 'name' in value) return [value];
  return [];
}

describe('vite.config.ts (W10)', () => {
  const plugins = flatten(config.plugins);

  it('registers the CSP meta plugin, for production builds only', () => {
    const csp = plugins.filter((p) => p.name === 'pinout-csp-meta');
    expect(csp).toHaveLength(1);
    expect(csp[0]?.apply).toBe('build');
  });

  it('still registers the React plugin (the helper really sees nested plugin arrays)', () => {
    expect(plugins.some((p) => typeof p.name === 'string' && p.name.includes('react'))).toBe(true);
  });

  it('serves under the GitHub Pages base path', () => {
    expect(config.base).toMatch(/^\/.+\/$/);
  });
});
