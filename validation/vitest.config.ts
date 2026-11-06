import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['validation/ecosystem.test.ts'],
    testTimeout: 120000,
    disableConsoleIntercept: true,
  },
});
