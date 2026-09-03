/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    // Vitest 4's default exclude is only node_modules/.git, so e2e/*.spec.ts
    // WOULD be collected and would try to run Playwright under Vitest.
    include: ['src/**/*.test.ts', 'experiments/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    environment: 'node',
  },
});
