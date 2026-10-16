import { defineConfig, devices } from '@playwright/test';

/**
 * Catavor E2E — fokus back-button trap (Audit §8.2) + resilient UI.
 * Prasyarat: server LIVE di http://localhost:8000
 * Jalankan : npx playwright test
 *
 * Diuji di 2 device: Pixel 5 (mobile) & Desktop Chrome.
 * (Test panel admin dihapus: login UI berulang kena AuthRateLimiter -> flaky.
 *  Temuan sesi-from-token dicatat di security-audit/catatan-penyelesaian-fase1.md.)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
