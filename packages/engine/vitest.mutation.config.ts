import { defineProject } from 'vitest/config';

// Used only by Stryker (`pnpm mutation`). The Stryker sandbox is a copy of this package, so only the tests
// that do not reach outside the package (no catalog / CLI imports) can run in it.
const conditions = ['@pinout/source', 'module', 'node', 'development|production'];

export default defineProject({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    name: 'engine-mutation',
    include: ['test/assignment.test.ts'],
  },
});
