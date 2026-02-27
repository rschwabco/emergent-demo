import { test, expect } from "@playwright/test";

test.describe("Search flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");
    await expect(
      page.getByPlaceholder(/Search agent traces/)
    ).toBeVisible();
  });

  test("perform a search and see results", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search agent traces/);
    await searchInput.fill("debugging a Django migration");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText(/match/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("search results contain score and trace link", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search agent traces/);
    await searchInput.fill("debugging a Django migration");
    await page.getByRole("button", { name: "Search" }).click();

    const firstResult = page.locator("[data-tour='search-results'] > div, main").locator("a[href*='/trace/']").first();
    await expect(firstResult).toBeVisible({ timeout: 30_000 });
  });

  test("clicking a suggested query triggers search", async ({ page }) => {
    const suggestion = page.getByRole("button", { name: /agent realizes/ }).first();

    if (await suggestion.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await suggestion.click();
      await expect(page.getByText(/match/i).first()).toBeVisible({
        timeout: 30_000,
      });
    }
  });

  test("click a result to navigate to trace page", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search agent traces/);
    await searchInput.fill("IntegrityError");
    await page.getByRole("button", { name: "Search" }).click();

    const traceLink = page.locator("a[href*='/trace/']").first();
    await expect(traceLink).toBeVisible({ timeout: 30_000 });
    await traceLink.click();

    await expect(page).toHaveURL(/\/trace\//);
  });
});
