// Playwright configuration for the project's one real end-to-end suite: a browser
// actually driving the built React app against the real Express server and a real
// Postgres database, the "does this work as a whole, in a real browser" layer the
// Vitest/RTL and Supertest suites deliberately don't cover (they mock or hit the API
// directly, never a rendered page).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // A single browser click already exercises client, network, server, and database, more
  // browsers would mostly be re-testing Chromium's own compliance rather than this app.
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Reseeds the database (fast, wipes/reinserts 30 known jokes, see server/src/db/seed.ts)
  // then boots both the API and the Vite dev server via the existing "start" script.
  // reuseExistingServer lets a developer run `npm run start` in one terminal and
  // `npx playwright test` in another without Playwright trying to bind the ports twice.
  webServer: {
    command: "npm run db:seed && npm run start",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
