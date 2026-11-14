import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const hasEnvLocal = fs.existsSync(path.join(__dirname, ".env.local"));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    ...(hasEnvLocal
      ? {}
      : {
          env: {
            NEXT_PUBLIC_SUPABASE_URL:
              process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
            NEXT_PUBLIC_SUPABASE_ANON_KEY:
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder",
          },
        }),
  },
});
