import { test, expect } from "@playwright/test";

async function startGuestSession(page) {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page.getByRole("heading", { name: "Guest session" })).toBeVisible();
}

test.describe("guest class workspace", () => {
  test("limits guests to one class and supports class settings", async ({ page }) => {
    await startGuestSession(page);
    await expect(page.getByRole("link", { name: "Feedback" })).toHaveAttribute("href", "https://forms.gle/gu3r7aftXa8bx3eQ9");
    await expect(page.locator(".app-footer")).not.toContainText("QRise");
    await page.getByLabel("New class name").fill("Guest class");
    await page.getByRole("button", { name: "Create class" }).click();
    await expect(page.getByRole("heading", { name: "Guest class" })).toBeVisible();
    await expect(page.getByLabel("New class name")).toHaveCount(0);

    await page.getByRole("button", { name: "Class settings" }).click();
    await expect(page.locator(".meeting-days")).toHaveCount(0);
    await page.getByLabel("This class meets on a recurring weekly schedule").check();
    await expect(page.locator(".meeting-days")).toBeVisible();
    await page.getByLabel("This class meets on a recurring weekly schedule").uncheck();
    await expect(page.locator(".meeting-days")).toHaveCount(0);
    await expect(page.getByLabel("Grace period (minutes)")).toHaveValue("5");
    await page.getByLabel("Discussion prompt").fill("What did you learn?");
    await page.getByLabel("Require students to answer the discussion prompt").check();
    await page.getByLabel("Grace period (minutes)").fill("8");
    await page.getByRole("button", { name: "Save settings" }).click();

    await expect(page.getByRole("button", { name: "Class settings" })).toBeVisible();
    await page.getByRole("button", { name: "View responses" }).click();
    const attendanceFeed = page.getByRole("region", { name: "Guest class responses" });
    await expect(attendanceFeed).toBeVisible();
    await expect(page.getByRole("button", { name: "Close settings" })).toHaveCount(0);
    await page.getByRole("button", { name: "Class settings" }).click();
    await expect(attendanceFeed).toHaveCount(0);
    await expect(page.locator(".class-settings")).toBeVisible();
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.getByRole("button", { name: "View responses" }).click();
    await expect(attendanceFeed).toBeVisible();
    await expect(attendanceFeed).toContainText("No one has checked in yet.");
    await expect(attendanceFeed).toHaveCSS("overflow-y", "auto");
    await page.getByRole("button", { name: "Hide responses" }).click();
    await expect(attendanceFeed).toHaveCount(0);

    await page.getByRole("button", { name: "Class settings" }).click();
    await expect(page.getByLabel("Require students to answer the discussion prompt")).toBeChecked();
    await expect(page.getByLabel("Grace period (minutes)")).toHaveValue("8");
  });

  test("converts a guest session into an account without losing its class", async ({ page }) => {
    await startGuestSession(page);
    await page.getByLabel("New class name").fill("Transferred class");
    await page.getByRole("button", { name: "Create class" }).click();
    await expect(page.getByRole("heading", { name: "Transferred class" })).toBeVisible();

    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByLabel("Display name").fill("Guest Teacher");
    await page.getByLabel("Username").fill(`guest${Date.now()}`);
    await page.getByLabel("Password").fill("test-password-123");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
    await page.locator(".profile-menu summary").click();
    await expect(page.locator(".profile-menu-panel").getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Account settings" }).click();
    await expect(page.getByRole("heading", { name: "Your classes" })).toHaveCount(0);

    await page.locator(".profile-menu summary").click();
    await expect(page.getByRole("button", { name: "Transferred class", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Classes" }).click();
    await expect(page.getByRole("heading", { name: "Transferred class" })).toBeVisible();
  });

  test("ending a guest session warns before removing access", async ({ page }) => {
    await startGuestSession(page);
    await page.getByLabel("New class name").fill("Temporary guest data");
    await page.getByRole("button", { name: "Create class" }).click();
    await expect(page.getByRole("heading", { name: "Temporary guest data" })).toBeVisible();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "End guest session" }).click();
    await expect(page.getByRole("button", { name: "Teacher sign-in" })).toBeVisible();
    await page.getByRole("button", { name: "Continue as guest" }).click();
    await expect(page.getByRole("heading", { name: "Guest session" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Temporary guest data" })).toHaveCount(0);
  });
});
