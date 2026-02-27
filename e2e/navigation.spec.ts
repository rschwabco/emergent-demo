import { test, expect } from "@playwright/test";

test.describe("Navigation and page loading", () => {
  test("root redirects to default index page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/index\/agent-traces-semantic/);
  });

  test("main page shows heading and search bar", async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");

    await expect(
      page.getByRole("heading", { name: "Trace Explorer" })
    ).toBeVisible();

    await expect(
      page.getByPlaceholder(/Search agent traces/)
    ).toBeVisible();
  });

  test("main page loads dashboard stats", async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");

    await expect(page.getByText("Chunks Indexed")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Behavior Patterns")).toBeVisible();
  });

  test("navigate to compare page and back", async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");

    await page.getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/compare/);
    await expect(
      page.getByRole("heading", { name: /Vector Search vs.*Keyword Search/ })
    ).toBeVisible();

    await page.getByRole("link", { name: /Back/ }).click();
    await expect(page).toHaveURL(/\/index\//);
  });

  test("navigate to upload page", async ({ page }) => {
    await page.goto("/index/agent-traces-semantic");

    await page.getByRole("link", { name: "Upload" }).click();
    await expect(page).toHaveURL(/\/upload/);
  });
});
