import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Keep the production throttle defaults intact while letting this suite sign in
// repeatedly with the same seeded account. The throttle test reads this value.
process.env.FINALFOLIO_LOGIN_IDENTIFIER_LIMIT ??= '200';
process.env.FINALFOLIO_LOGIN_IP_LIMIT ??= '400';
const dataRoot = '/tmp/finalfolio-playwright-data';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '/tmp/finalfolio-playwright-results',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    launchOptions: {
      // Use the browser managed by Playwright by default; allow CI images that ship a
      // system Chromium to point at it explicitly instead of hardcoding a path.
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: ['--no-sandbox'],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'bash tests/e2e/run-web-server.sh',
    url: 'http://127.0.0.1:4173',
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      PORT: '4173',
      FINALFOLIO_DATA_ROOT: dataRoot,
      // The suite signs in repeatedly with the same seeded account; keep the
      // production throttle defaults intact but lift them for this test server.
      FINALFOLIO_LOGIN_IDENTIFIER_LIMIT: '200',
      FINALFOLIO_LOGIN_IP_LIMIT: '400',
    },
  },
});
