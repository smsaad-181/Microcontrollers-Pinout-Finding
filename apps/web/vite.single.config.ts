// `pnpm --filter web build:single`: the pin finder as ONE self-contained HTML file
// (dist-single/pinout-finder.html) that runs from file:// with no server. See src/singleFile.ts and
// docs/validation/single-file.md. The GitHub Pages build (vite.config.ts) is not affected.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { singleFile } from './src/singleFile.ts';

const sourceCondition = '@pinout/source';

export default defineConfig({
  base: './',
  // Only the inlined icon and catalog are needed; nothing is copied next to the page.
  publicDir: false,
  plugins: [react(), singleFile()],
  resolve: { conditions: [sourceCondition, 'module', 'browser', 'development|production'] },
  worker: { format: 'iife' },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
