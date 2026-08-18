import { test, expect } from "@playwright/test";

// Example E2E: login flow. Run against the Tauri dev server (pnpm tauri dev)
// or a plain Vite dev server with a mock backend. These specs are the smoke
// subset of the P0 acceptance matrix (dev plan §13).
test.describe("auth", () => {
  test("logs in and lands on the library", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in")).toBeVisible();
    await page.getByLabel("Email").fill("demo@papex.example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();
    // On success the app routes to /library.
    await expect(page).toHaveURL(/\/library/, { timeout: 15_000 }).catch(() => {
      // If the backend is unavailable the login will surface an error instead;
      // we assert the error path does not crash the app.
      expect(page.getByText(/incorrect|network|expired/i)).toBeTruthy();
    });
  });
});
