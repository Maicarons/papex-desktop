import { test, expect } from "@playwright/test";

// Example E2E: three-pane library loads categories and a paper list.
test.describe("library", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/library");
  });

  test("renders the category tree and search box", async ({ page }) => {
    await expect(page.getByText("Categories")).toBeVisible();
    await expect(page.getByPlaceholder("Search")).toBeVisible();
  });

  test("global search shortcut opens the overlay", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder("Search")).toBeVisible();
  });
});
