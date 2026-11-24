// Acceptance test 2
//
// Given that a calculator is listed on the site
// When a user searches for "calculator" on the Browse page
// Then the calculator shows as a search result
import { test, expect } from "@playwright/test";
import { deleteItems, seedItem } from "./helpers.mjs";

test.afterEach(async () => {
  await deleteItems("e2e-search-calculator");
});

test("searching for calculator finds the calculator and hides other items", async ({ page }) => {
  // Given: a calculator is listed, along with the ten sample listings
  await seedItem("e2e-search-calculator", {
    title: "Graphing calculator",
    description: "TI-84 Plus for math and science classes.",
    category: "electronics",
    price: 45,
  });
  await page.goto("/browse");
  await expect(page.getByRole("status")).toHaveText("11 items available");

  // When: a visitor searches for "calculator"
  await page.getByRole("searchbox", { name: "Search items" }).fill("calculator");

  // Then: only the calculator is shown
  await expect(page.getByRole("status")).toHaveText("1 item available");
  const card = page.locator("article", { hasText: "Graphing calculator" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("$45");
  await expect(page.getByText("Cordless power drill")).toHaveCount(0);

  // And the result opens the calculator's page
  await page.getByRole("link", { name: /Graphing calculator/ }).click();
  await expect(page.getByRole("heading", { name: "Graphing calculator", exact: true })).toBeVisible();
});
