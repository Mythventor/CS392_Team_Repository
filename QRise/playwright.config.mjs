import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.mjs",
  use: { viewport: { width: 1440, height: 1000 } },
  webServer: {
    command: "node ./tests/start-emulators.mjs",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-qrise.firebaseapp.com",
      VITE_FIREBASE_DATABASE_URL: "https://demo-qrise-default-rtdb.firebaseio.com",
      VITE_FIREBASE_PROJECT_ID: "demo-qrise",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-qrise.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
      VITE_FIREBASE_APP_ID: "1:1234567890:web:demo",
      VITE_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      VITE_FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9000",
    },
  },
});
