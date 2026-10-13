import { defineConfig, devices } from '@playwright/test';

// WPE headless can stop delivering animation frames on Linux, stalling normal
// actionability checks. CI opts into headed WebKit under Xvfb instead of forcing
// clicks or removing stability checks: microsoft/playwright#33057.
const headedWebKit = process.env.PLAYWRIGHT_WEBKIT_HEADED === '1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

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
      use: { ...devices['iPhone 15'], headless: !headedWebKit },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad Pro 11'], headless: !headedWebKit },
    },
  ],
});
