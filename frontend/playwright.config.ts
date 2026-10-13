import { defineConfig, devices } from '@playwright/test';

const port = process.env.SANDAR_E2E_PORT ?? '8766';

/**
 * Tes end-to-end syarat rilis (PRD 14). Butuh `npm run build` lebih dulu karena server
 * melayani PWA dari frontend/dist. Memakai Google Chrome yang terpasang di komputer.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 760 },
    baseURL: `http://localhost:${port}`,
    channel: 'chrome',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/server.mjs',
    url: `http://localhost:${port}/api/sehat`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
