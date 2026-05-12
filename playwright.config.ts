import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.github/e2e',
  outputDir: '.github/e2e/test-results',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  },
});
