// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Optional override for environments with a pre-installed Chromium
// (e.g. PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium). Leave unset
// to use the browser downloaded by `npx playwright install chromium`.
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
  : {};

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    launchOptions,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Serve the static index.html so tests hit a real URL instead of file://.
  webServer: {
    command: 'npx serve -l 4173 .',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
