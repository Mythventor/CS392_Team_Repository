// Acceptance test 3 (Yuqi)
//
// Given that Jo offered $30 for a calculator and Alex offered $40
// When the owner accepts Alex's offer
// Then the calculator is marked as Reserved for every other student
//
// Runs against the local Auth and Firestore emulators started by playwright.config.mjs.
import { test, expect } from "@playwright/test";

const PROJECT = "demo-passdown";
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
// "Bearer owner" is how the emulators accept admin requests that skip security rules.
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const ITEM_ID = "e2e-reserved-calculator";

const SAM = { name: "Sam Rivera", email: "sam.reserved@example.com" };
const ALEX = { name: "Alex Kim", email: "alex.reserved@example.com" };
const JO = { name: "Jo Park", email: "jo.reserved@example.com" };
const KIM = { name: "Kim Lee", email: "kim.reserved@example.com" };

// Every person gets their own browser context, like using a separate browser.
async function signIn(browser, person) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/signin?next=%2Fbrowse");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.getByRole("button", { name: "Add new account" }).click();
  await popup.getByLabel("Email", { exact: true }).fill(person.email);
  await popup.getByLabel("Display name", { exact: true }).fill(person.name);
  await popup.getByRole("button", { name: /^Sign in with Google/ }).click();
  await expect(page.getByRole("link", { name: `Your profile, ${person.name}` })).toBeVisible();
  return page;
}

// The Auth emulator picks each account's uid; look it up by email.
async function uidOf(person) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ returnUserInfo: true }),
  });
  const { userInfo = [] } = await response.json();
  const account = userInfo.find((user) => user.email === person.email);
  if (!account) throw new Error(`No emulator account for ${person.email}`);
  return account.localId;
}

async function seedCalculator(ownerId) {
  const text = (value) => ({ stringValue: value });
  const response = await fetch(`${FIRESTORE}/items/${ITEM_ID}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({
      fields: {
        title: text("Graphing calculator"),
        description: text("TI-84 Plus, works perfectly. Selling before graduation."),
        category: text("electronics"),
        school: text("northwestern"),
        condition: text("Good"),
        pickupArea: text("Norris Center"),
        status: text("available"),
        archived: { booleanValue: false },
        price: { integerValue: "50" },
        ownerId: text(ownerId),
        ownerName: text(SAM.name),
        createdAt: { timestampValue: new Date().toISOString() },
      },
    }),
  });
  if (!response.ok) throw new Error(`Could not add the calculator: ${response.status}`);
}

async function itemStatus() {
  const response = await fetch(`${FIRESTORE}/items/${ITEM_ID}`, { headers: ADMIN });
  return (await response.json()).fields?.status?.stringValue;
}

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
  await fetch(`${FIRESTORE}/items/${ITEM_ID}`, { method: "DELETE", headers: ADMIN });
});

test("accepting Alex's offer reserves the calculator for Alex only", async ({ browser }) => {
  // Given: Sam is selling a calculator, Jo offered $30 and Alex offered $40
  const sam = await signIn(browser, SAM);
  await seedCalculator(await uidOf(SAM));
  const jo = await signIn(browser, JO);
  const alex = await signIn(browser, ALEX);
  const joDeal = await makeOffer(jo, 30);
  const alexDeal = await makeOffer(alex, 40);

  // When: Sam accepts Alex's offer
  await sam.goto(alexDeal);
  await expect(sam.getByText("$40 offered · asking $50")).toBeVisible();
  await sam.getByRole("button", { name: "Accept offer" }).click();
  await expect(sam.getByText("Accepted. The item is now reserved for this buyer.")).toBeVisible();
  await expect.poll(itemStatus).toBe("reserved");

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
