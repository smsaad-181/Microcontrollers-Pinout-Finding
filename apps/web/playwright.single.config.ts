import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from '@playwright/test';

// The single-file build opened straight from disk (file://): no web server.
// Run `vite build --config vite.single.config.ts` first (the `e2e:single` script does).
export const SINGLE_FILE = pathToFileURL(
  resolve(import.meta.dirname, 'dist-single/pinout-finder.html'),
).href;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.single.ts',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
});
