import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]],
  timeout: 240_000,
  use: {
    baseURL: process.env.LIVE_BASE_URL ?? 'http://127.0.0.1:8088',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-live', use: { ...devices['Desktop Chrome'] } }],
})
