import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  build:
    mode === 'benchmark'
      ? {
          outDir: 'dist-benchmark',
          rollupOptions: {
            input: { main: 'index.html', benchmark: 'benchmark.html' },
          },
        }
      : {},
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
