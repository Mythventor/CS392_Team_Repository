// Acceptance test 4
//
// Given that the mini fridge is listed at $60
// When Alex offers $70
// Then the app tells Alex the asking price is $60 and to offer that or less
// And when Alex offers $45 instead, the offer is sent and Sam sees it under "Needs your answer"
import { test, expect } from "@playwright/test";
import { ALEX, deleteItems, SAM, seedItem, signIn } from "./helpers.mjs";

const ITEM_ID = "e2e-offer-fridge";

test.afterEach(async () => {
  await deleteItems(ITEM_ID);
});

test("an offer above the asking price is refused, and a lower one reaches the seller", async ({ browser }) => {
  // Given: Sam's mini fridge is listed at $60
  await seedItem(ITEM_ID, { title: "Mini fridge", price: 60 });
  const alex = await signIn(browser, ALEX);
  await alex.goto(`/items/${ITEM_ID}`);
  await expect(alex.getByText("$60").first()).toBeVisible();

  // When: Alex offers $70
  await alex.getByLabel("Make an offer").check();
  await alex.getByLabel("Your offer").fill("70");
  await alex.getByRole("button", { name: "Send offer" }).click();

  // Then: the app says to offer $60 or less, and nothing is sent
  await expect(alex.getByText("The asking price is $60; offer that or less.")).toBeVisible();
  await expect(alex).toHaveURL(new RegExp(`/items/${ITEM_ID}$`));

  // And when Alex offers $45 instead, it is sent
  await alex.getByLabel("Your offer").fill("45");
  await alex.getByRole("button", { name: "Send offer" }).click();
  await expect(alex.getByText("Offer sent!")).toBeVisible();

  // And Sam sees it under "Needs your answer"
  const sam = await signIn(browser, SAM);
  await sam.goto("/deals?tab=selling");
  const needsAnswer = sam.locator("section", { has: sam.getByRole("heading", { name: /Needs your answer/ }) });
  await expect(needsAnswer).toContainText("Mini fridge");
  await expect(needsAnswer).toContainText(ALEX.name);
  await expect(needsAnswer).toContainText("$45");
});
