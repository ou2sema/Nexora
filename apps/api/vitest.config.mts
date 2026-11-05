import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2023',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup-env.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Each API test file brings its own PGlite or embedded PostgreSQL, and since ADR-0019 the
    // document files add a Chromium each. At the default `cpus - 1` workers an 8-core box
    // oversubscribes: renders miss the engine's own deadlines and the logo probe 503s.
    maxWorkers: 3,
  },
});
