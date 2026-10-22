import { defineConfig } from 'vitest/config';

// Root runner: `pnpm test` runs every workspace project; each project uses its own config.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web'],
  },
});
