import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad Pro 11'] },
    },
  ],
});
