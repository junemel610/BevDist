const { defineConfig, devices } = require('@playwright/test');
const { apiURL, webURL } = require('./tests/e2e/settings.cjs');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.cjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: 'dist/playwright-results',
  reporter: [['list'], ['html', { outputFolder: 'dist/playwright-report', open: 'never' }]],
  use: { baseURL: webURL, actionTimeout: 10000, navigationTimeout: 30000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/e2e/server.cjs', url: `${apiURL}/health`,
      reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    },
    {
      command: 'node tests/e2e/web.cjs',
      url: webURL, reuseExistingServer: false, timeout: 120000,
      env: { EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: apiURL, CI: '1' },
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10000 },
    },
  ],
});
