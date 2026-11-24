import { test, expect } from "@playwright/test";
import { signInOn } from "./helpers.mjs";

const STUDENT = { uid: "e2e-student", name: "Playwright Student", email: "playwright@example.com" };

test("browse seeded Firestore listings, filter, and open an item", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.getByRole("status")).toHaveText("10 items available");
  await page.getByRole("searchbox", { name: "Search items" }).fill("drill");
  await expect(page.getByRole("status")).toHaveText("1 item available");
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("drill");
  await page.getByRole("link", { name: /Cordless power drill/ }).click();
  await expect(page).toHaveURL(/\/items\/drill$/);
  await expect(page.getByRole("heading", { name: "Cordless power drill", exact: true })).toBeVisible();
});

test("unmatched searches can be cleared", async ({ page }) => {
  await page.goto("/browse?q=no-such-sample-item");
  await expect(page.getByRole("heading", { name: "No items match" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status")).toHaveText("10 items available");
});

test("protected profile redirects to sign-in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/signin\?next=%2Fprofile$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
});

// Signs in with an emulator test account instead of the Google pop-up, whose
// "Add new account" form never shows its Email field in Playwright.
test("emulated sign-in saves a profile in Firestore", async ({ page }) => {
  await signInOn(page, STUDENT, "/signin?next=%2Fprofile");
  await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
  await page.getByLabel("Bio").fill("Testing with local Firebase emulators.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your profile is saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Bio")).toHaveValue("Testing with local Firebase emulators.");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/signin/);
});
