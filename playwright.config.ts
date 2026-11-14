import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
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
      executablePath: '/usr/bin/chromium-browser',
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
    },
  },
});
