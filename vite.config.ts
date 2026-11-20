import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/** v0.8 Pass 060: the version, stamped into the build (shown in Settings, on asset URLs). */
const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf8'));
// COZY_VERSION overrides it for a staging build (e.g. 0.8.0-beta.1+staging.2).
const version =
  process.env.COZY_VERSION ||
  (typeof pkg === 'object' &&
  pkg !== null &&
  'version' in pkg &&
  typeof pkg.version === 'string'
    ? pkg.version
    : '0.0.0');

export default defineConfig(({ mode }) => ({
  define: { __COZY_VERSION__: JSON.stringify(version) },
  build:
    mode === 'benchmark'
      ? {
          outDir: 'dist-benchmark',
          rollupOptions: {
            input: {
              main: 'index.html',
              benchmark: 'benchmark.html',
              style: 'style-benchmark.html',
            },
          },
        }
      : {},
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
