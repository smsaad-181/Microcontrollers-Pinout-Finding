/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { cspMeta } from './src/cspMeta.ts';

// Resolve workspace packages to their TypeScript sources (see "@pinout/source" in package exports).
const sourceCondition = '@pinout/source';

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/<repository-name>/
  // CI and deploy set PAGES_BASE from the repository name; the default matches the current repo.
  base: process.env.PAGES_BASE ?? '/Microcontrollers-Pinout-Finding/',
  plugins: [react(), cspMeta()],
  resolve: { conditions: [sourceCondition, 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: [sourceCondition, 'module', 'node', 'development|production'] } },
  test: { name: 'web' },
});
