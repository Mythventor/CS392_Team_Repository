// Acceptance test 1
//
// Given that Sam is signed in and moving out at the end of the quarter
// When Sam lists a "Mini fridge" with a photo, a price of $60, and a pick-up-by date of June 15
// Then the fridge appears on the Browse page showing "$60" and "Sold by Sam Rivera"
import { test, expect } from "@playwright/test";
import { deleteItems, findItemsTitled, mockPhotoUpload, SAM, signInOn, testPhoto } from "./helpers.mjs";

// The next June 15 that hasn't passed yet, as YYYY-MM-DD.
function nextJune15() {
  const today = new Date();
  const year = today.getMonth() > 5 || (today.getMonth() === 5 && today.getDate() > 15) ? today.getFullYear() + 1 : today.getFullYear();
  return `${year}-06-15`;
}

test.afterEach(async () => {
  await deleteItems(...(await findItemsTitled("Mini fridge")).map((item) => item.id));
});

test("a graduating student lists a mini fridge and it appears on Browse", async ({ page }) => {
  // Given: Sam is signed in
  await mockPhotoUpload(page);
  await signInOn(page, SAM);

  // When: Sam lists the fridge with a photo, $60, and a June 15 pick-up-by date
  const pickUpBy = nextJune15();
  await page.getByRole("link", { name: "Sell an item" }).first().click();
  await page.getByLabel("Item photo").setInputFiles(testPhoto());
  await page.getByLabel("Title").fill("Mini fridge");
  await page.getByLabel("Description").fill("3.1 cu ft, keeps drinks cold. Moving out in June.");
  await page.getByLabel("Category").selectOption({ label: "Dorm & home" });
  await page.getByLabel("General pickup area").fill("Norris Center");
  await page.getByLabel("Price in dollars").fill("60");
  await page.getByLabel("Pick up by (optional)").fill(pickUpBy);
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByText("Your listing has been saved.")).toBeVisible();

  // Then: the fridge is on Browse with its price and seller
  await page.getByRole("link", { name: "Browse" }).first().click();
  const card = page.locator("article", { hasText: "Mini fridge" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("$60");
  await expect(card).toContainText("Sold by Sam Rivera");

  // And it was saved with the right price and date
  const [saved] = await findItemsTitled("Mini fridge");
  expect(saved).toMatchObject({ price: 60, availableTo: pickUpBy, ownerId: SAM.uid, status: "available" });
});
