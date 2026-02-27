import { test, expect } from "@playwright/test";

test.describe("Trace viewer", () => {
  test("trace page loads conversation turns", async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");

    const searchInput = page.getByPlaceholder(/Search agent traces/);
    await searchInput.fill("debugging");
    await page.getByRole("button", { name: "Search" }).click();

    const traceLink = page.locator("a[href*='/trace/']").first();
    await expect(traceLink).toBeVisible({ timeout: 30_000 });
    await traceLink.click();

    await expect(page).toHaveURL(/\/trace\//);

    await expect(page.getByText(/turns in conversation/i)).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.locator("[id^='turn-']").first()).toBeVisible();
  });

  test("trace page has back link to explorer", async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");

    const searchInput = page.getByPlaceholder(/Search agent traces/);
    await searchInput.fill("debugging");
    await page.getByRole("button", { name: "Search" }).click();

    const traceLink = page.locator("a[href*='/trace/']").first();
    await expect(traceLink).toBeVisible({ timeout: 30_000 });
    await traceLink.click();
    await expect(page).toHaveURL(/\/trace\//);

    const backLink = page.getByRole("link", { name: /Explore Topics/ });
    await expect(backLink).toBeVisible({ timeout: 15_000 });
    await backLink.click();

    await expect(page).toHaveURL(/\/index\//);
  });
});
