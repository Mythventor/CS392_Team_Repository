import { test, expect } from "@playwright/test";

test.describe("account entry", () => {
  test("offers teacher sign-in, account creation, and guest access", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173");
    await expect(page.getByRole("heading", { name: "Here!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Teacher sign-in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create teacher account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue as guest" })).toBeVisible();
  });

  test("account form communicates username and password requirements", async ({ page }) => {
    await page.goto("http://127.0.0.1:5173");
    const createAccount = page.getByRole("button", { name: "Create teacher account" });
    await expect(createAccount).toBeVisible();
    if (!(await createAccount.isEnabled())) test.skip(true, "Firebase client config is not available.");
    await createAccount.click();

    await expect(page.getByRole("heading", { name: "Create teacher account" })).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveAttribute("pattern", "[A-Za-z0-9_-]{3,24}");
    await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "8");
    await expect(page.getByText(/Usernames are unique regardless of capitalization/)).toBeVisible();
  });
});
