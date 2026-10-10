import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        DEMO_MODE: "true",
        NEXT_PUBLIC_DEMO_MODE: "true",
        PORT: "3000",
        SESSION_SECRET: "test_jwt_session_secret_min_32_characters_2026",
        ADMIN_PHONES: "+919999999999",
      },
    },
    {
      command: "npx next start -p 3001",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        PORT: "3001",
        DEMO_MODE: "",
        NEXT_PUBLIC_DEMO_MODE: "",
        SESSION_SECRET: "test_jwt_session_secret_min_32_characters_2026",
        ADMIN_PHONES: "+919999999999",
      },
    },
  ],
});
