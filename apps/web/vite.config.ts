/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { cspMeta } from './src/cspMeta.ts';

// Resolve workspace packages to their TypeScript sources (see "@pinout/source" in package exports).
const sourceCondition = '@pinout/source';

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/pinout-finder/
  base: process.env.PAGES_BASE ?? '/pinout-finder/',
  plugins: [react(), cspMeta()],
  resolve: { conditions: [sourceCondition, 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: [sourceCondition, 'module', 'node', 'development|production'] } },
  test: { name: 'web' },
});
