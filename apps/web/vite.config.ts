/// <reference types="vitest/config" />
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { cspMeta } from './src/cspMeta.ts';

// Resolve workspace packages to their TypeScript sources (see "@pinout/source" in package exports).
const sourceCondition = '@pinout/source';

const MANIFEST = fileURLToPath(new URL('./public/catalog/catalog-manifest.json', import.meta.url));
const SAFE_FILE = /^[0-9a-z][0-9a-z._-]*\.json$/;

/**
 * Precache entries for the catalog manifest and the current catalog only (older catalogs kept in
 * `public/catalog/` for share links are cached on first use instead). The revision is the catalog
 * hash, so a new catalog changes the service worker and triggers the "update available" prompt.
 */
export function catalogPrecache(file = MANIFEST): { url: string; revision: string }[] {
  if (!existsSync(file)) return [];
  const m = JSON.parse(readFileSync(file, 'utf8')) as {
    version?: unknown;
    sha256?: unknown;
    file?: unknown;
  };
  if (typeof m.version !== 'string' || typeof m.sha256 !== 'string') return [];
  const name = typeof m.file === 'string' ? m.file : `${m.version}.json`;
  if (!SAFE_FILE.test(name)) return [];
  return [
    { url: 'catalog/catalog-manifest.json', revision: m.sha256 },
    { url: `catalog/${name}`, revision: m.sha256 },
  ];
}

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/<repository-name>/
  // CI and deploy set PAGES_BASE from the repository name; the default matches the current repo.
  base: process.env.PAGES_BASE ?? '/Microcontrollers-Pinout-Finding/',
  plugins: [
    react(),
    cspMeta(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // icon.svg is already matched by globPatterns below.
      includeManifestIcons: false,
      manifest: {
        name: 'Pinout Finder',
        short_name: 'Pinout Finder',
        description: 'Choose microcontroller pins with every fact traced to its datasheet.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // The plugin adds manifest.webmanifest itself.
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['catalog/**'],
        additionalManifestEntries: catalogPrecache(),
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Versioned catalogs are content-addressed: once fetched they never change.
            urlPattern: /\/catalog\/(?!catalog-manifest\.json)[0-9a-z][0-9a-z._-]*\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'pinout-catalogs', expiration: { maxEntries: 8 } },
          },
        ],
      },
    }),
  ],
  resolve: { conditions: [sourceCondition, 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: [sourceCondition, 'module', 'node', 'development|production'] } },
  // Several test files compile the real catalog; allow for that under parallel load.
  test: { name: 'web', testTimeout: 30_000 },
});
