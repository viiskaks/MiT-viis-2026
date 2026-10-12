import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      command:
        './scripts/npm.sh exec vite build -- --config vite.server.config.ts && node tests/start-api.mjs',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
    },
    {
      command: './scripts/npm.sh run dev',
      url: 'http://localhost:5174',
      reuseExistingServer: true,
    },
  ],
});
