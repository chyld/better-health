import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const DATABASE_PATH = join(tmpdir(), `better-health-e2e-${process.pid}.db`);

// All projects run in Chromium; mobile and tablet emulate the device's viewport and touch.
export default defineConfig({
  testDir: "tests/e2e",
  // One server and database are shared, and each test resets it, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    timezoneId: "America/Chicago",
    locale: "en-US",
  },
  expect: {
    toHaveScreenshot: { maxDiffPixels: 50, animations: "disabled" },
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 14"], browserName: "chromium" } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"], browserName: "chromium" } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `rm -f ${DATABASE_PATH}* && bun run build && bun apps/api/src/server.ts`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    env: { NODE_ENV: "test", PORT: String(PORT), DATABASE_PATH },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
