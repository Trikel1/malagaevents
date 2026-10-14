import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  // Run CI browser checks serially to isolate resource/focus contention.
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 8080',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 120000,
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
