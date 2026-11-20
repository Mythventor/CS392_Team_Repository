import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.mjs",
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: 'firebase emulators:exec --only auth,firestore --project demo-passdown "node scripts/seed-emulator.mjs && vite --mode emulator --host 127.0.0.1 --strictPort"',
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    timeout: 120_000,
    // Explicit overrides prevent .env.local from selecting a production project.
    env: {
      VITE_USE_EMULATORS: "true",
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-passdown.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-passdown",
      VITE_FIREBASE_APP_ID: "demo-app",
    },
  },
});
