/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { CONTENT_SECURITY_POLICY } from './src/csp.ts';

// Resolve workspace packages to their TypeScript sources (see "@pinout/source" in package exports).
const sourceCondition = '@pinout/source';

// The CSP meta tag is injected only into the production build: the dev server relies on an inline
// React Refresh preamble script and JS-injected <style> tags, which this policy (correctly) blocks.
function cspMeta(): Plugin {
  return {
    name: 'pinout-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      // Place the policy right after <meta charset>, before any script or stylesheet it governs.
      const charset = /<meta charset="UTF-8"\s*\/?>/i;
      if (!charset.test(html)) throw new Error('index.html: <meta charset="UTF-8"> not found');
      const meta = `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
      return html.replace(charset, (m) => `${m}\n    ${meta}`);
    },
  };
}

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/pinout-finder/
  base: process.env.PAGES_BASE ?? '/pinout-finder/',
  plugins: [react(), cspMeta()],
  resolve: { conditions: [sourceCondition, 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: [sourceCondition, 'module', 'node', 'development|production'] } },
  test: { name: 'web' },
});
