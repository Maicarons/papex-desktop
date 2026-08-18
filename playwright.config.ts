import { defineConfig } from "@playwright/test";

// Playwright drives the Tauri WebView in dev mode.
// `pnpm tauri dev` must be running (or use the @playwright/test webserver hook).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:1420",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-webview",
      // The Tauri dev server serves the web frontend on this port.
      use: { baseURL: "http://localhost:1420" },
    },
  ],
});
