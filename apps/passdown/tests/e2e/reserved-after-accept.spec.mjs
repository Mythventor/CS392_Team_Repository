// Acceptance test 3 (Yuqi)
//
// Given that Jo offered $30 for a calculator and Alex offered $40
// When the owner accepts Alex's offer
// Then the calculator is marked as Reserved for every other student
//
// Runs against the local Auth and Firestore emulators started by playwright.config.mjs.
// Students sign in with emulator test accounts (see helpers.mjs) instead of Google's
// pop-up, which is unreliable in automated browsers.
import { test, expect } from "@playwright/test";
import { ALEX, deleteItems, JO, KIM, readItem, SAM, seedItem, signIn } from "./helpers.mjs";

const ITEM_ID = "e2e-reserved-calculator";

// Opens the item and makes an offer below the $50 asking price. Returns the deal page URL.
async function makeOffer(page, amount) {
  await page.goto(`/items/${ITEM_ID}`);
  await page.getByLabel("Make an offer").check();
  await page.getByLabel("Your offer").fill(String(amount));
  await page.getByRole("button", { name: "Send offer" }).click();
  await expect(page.getByText("Offer sent!")).toBeVisible();
  return new URL(page.url()).pathname;
}

// Other Playwright tests count the sample listings, so remove the calculator afterwards.
test.afterEach(async () => {
  await deleteItems(ITEM_ID);
});

test("accepting Alex's offer reserves the calculator for Alex only", async ({ browser }) => {
  // Given: Sam is selling a calculator, Jo offered $30 and Alex offered $40
  await seedItem(ITEM_ID, {
    title: "Graphing calculator",
    description: "TI-84 Plus, works perfectly. Selling before graduation.",
    category: "electronics",
    price: 50,
  });
  const sam = await signIn(browser, SAM);
  const jo = await signIn(browser, JO);
  const alex = await signIn(browser, ALEX);
  const joDeal = await makeOffer(jo, 30);
  const alexDeal = await makeOffer(alex, 40);

  // When: Sam accepts Alex's offer
  await sam.goto(alexDeal);
  await expect(sam.getByText("$40 offered · asking $50")).toBeVisible();
  await sam.getByRole("button", { name: "Accept offer" }).click();
  await expect(sam.getByText("Accepted. The item is now reserved for this buyer.")).toBeVisible();
  await expect.poll(async () => (await readItem(ITEM_ID)).status).toBe("reserved");

  // Then: Jo, who also offered, sees it's reserved for someone else
  await jo.goto(`/items/${ITEM_ID}`);
  await expect(jo.getByText("Reserved for another buyer.", { exact: false })).toBeVisible();
  await expect(jo.getByRole("button", { name: "Send offer" })).toHaveCount(0);

  // And a student who never offered sees the same, and can't find it on Browse
  const kim = await signIn(browser, KIM);
  await kim.goto(`/items/${ITEM_ID}`);
  await expect(kim.getByText("Reserved for another buyer.", { exact: false })).toBeVisible();
  await kim.goto("/browse?q=graphing+calculator");
  await expect(kim.getByRole("heading", { name: "No items match" })).toBeVisible();

  // And Sam can't accept Jo's offer while the calculator is reserved
  await sam.goto(joDeal);
  await expect(sam.getByText(/reserved for another buyer/i)).toBeVisible();
  await expect(sam.getByRole("button", { name: "Accept offer" })).toBeDisabled();

  // But Alex, the buyer, still sees his accepted offer instead of the reserved notice
  await alex.goto(`/items/${ITEM_ID}`);
  await expect(alex.getByRole("heading", { name: "Your offer" })).toBeVisible();
  await expect(alex.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(alex.getByText("Reserved for another buyer.", { exact: false })).toHaveCount(0);
});
