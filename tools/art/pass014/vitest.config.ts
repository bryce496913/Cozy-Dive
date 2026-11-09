import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tools/art/pass014/baseline.extract.ts'],
  },
});
