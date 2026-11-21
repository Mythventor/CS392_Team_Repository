// Acceptance test 3 (Yuqi)
//
// Given that Jo offered $30 for a calculator and Alex offered $40
// When the owner accepts Alex's offer
// Then the calculator is marked as Reserved for every other student
//
// Runs against the local Auth and Firestore emulators started by playwright.config.mjs.
// Students sign in with emulator test accounts instead of Google's pop-up, which is
// slow and unreliable on GitHub's CI machines.
import { test, expect } from "@playwright/test";

const PROJECT = "demo-passdown";
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
// "Bearer owner" is how the emulators accept admin requests that skip security rules.
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const ITEM_ID = "e2e-reserved-calculator";

const PASSWORD = "e2e-password";
// Fixed uids, so the calculator can belong to Sam before Sam opens the app.
const SAM = { uid: "e2e-sam", name: "Sam Rivera", email: "sam.reserved@example.com" };
const ALEX = { uid: "e2e-alex", name: "Alex Kim", email: "alex.reserved@example.com" };
const JO = { uid: "e2e-jo", name: "Jo Park", email: "jo.reserved@example.com" };
const KIM = { uid: "e2e-kim", name: "Kim Lee", email: "kim.reserved@example.com" };

// Creates the person's account in the Auth emulator (if it isn't there yet).
async function createAccount(person) {
  const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ localId: person.uid, displayName: person.name, email: person.email, password: PASSWORD }),
  });
  if (!response.ok && !(await response.text()).includes("DUPLICATE")) {
    throw new Error(`Could not create a test account for ${person.name}: ${response.status}`);
  }
}

// Signs the person in without Google's pop-up (see window.__e2eSignIn in src/lib/firebase.js).
// Each person gets their own browser context, like using a separate browser.
async function signIn(browser, person) {
  await createAccount(person);
  const page = await (await browser.newContext()).newPage();
  await page.goto("/browse");
  await page.waitForFunction(() => typeof window.__e2eSignIn === "function");
  await page.evaluate((login) => window.__e2eSignIn(login), { email: person.email, password: PASSWORD });
  await expect(page.getByRole("link", { name: `Your profile, ${person.name}` })).toBeVisible();
  return page;
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
  await seedCalculator(SAM.uid);
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
