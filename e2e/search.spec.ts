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
    await searchInput.fill("IntegrityError");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText(/\d+%\s*match/).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("search results contain score and trace link", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search agent traces/);
    await searchInput.fill("IntegrityError");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    const resultCard = page.locator("[class*='group']").filter({ hasText: /match/ }).first();
    await expect(resultCard).toBeVisible({ timeout: 30_000 });

    await resultCard.hover();
    const traceLink = resultCard.locator("a[href*='/trace/']").first();
    await expect(traceLink).toBeVisible();
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
    await page.getByRole("button", { name: "Search", exact: true }).click();

    const resultCard = page.locator("[class*='group']").filter({ hasText: /match/ }).first();
    await expect(resultCard).toBeVisible({ timeout: 30_000 });

    await resultCard.hover();
    const traceLink = resultCard.locator("a[href*='/trace/']").first();
    await expect(traceLink).toBeVisible();
    await traceLink.click();

    await expect(page).toHaveURL(/\/trace\//);
  });
});
