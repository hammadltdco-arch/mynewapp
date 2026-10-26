import { defineConfig } from "@playwright/test";
const browser = {
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  },
};
export default defineConfig({
  testDir: "./tests",
  workers: 2,
  use: browser,
  projects: [
    {
      name: "ui-demo",
      testMatch: "messaging.spec.js",
      use: { baseURL: "http://127.0.0.1:5175" },
    },
    {
      name: "release-ui",
      testMatch: "release.spec.js",
      use: { baseURL: "http://127.0.0.1:5174" },
    },
    {
      name: "unconfigured",
      testMatch: "unconfigured.spec.js",
      use: { baseURL: "http://127.0.0.1:5175" },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 5175 --strictPort",
      url: "http://127.0.0.1:5175",
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: {
        VITE_SUPABASE_URL: "https://loop-test.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_browser_test_only",
        VITE_PUSH_ENABLED: "false",
      },
      reuseExistingServer: false,
    },
  ],
});
