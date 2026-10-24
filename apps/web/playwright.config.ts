import { defineConfig } from '@playwright/test';

// Production build served by `vite preview` under the production base path.
export const BASE = '/Microcontrollers-Pinout-Finding/';
export const ORIGIN = 'http://localhost:4173';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `${ORIGIN}${BASE}`,
    // Microsoft Edge is installed on Windows runners and dev machines; CI installs Chromium.
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: `${ORIGIN}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
