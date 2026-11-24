// Shared helpers for the Playwright tests. They only talk to the local emulators that
// playwright.config.mjs starts (127.0.0.1 and the local "demo-passdown" project).
import { expect } from "@playwright/test";

export const PROJECT = "demo-passdown";
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
// "Bearer owner" is how the emulators accept admin requests that skip security rules.
const ADMIN = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const PASSWORD = "e2e-password";

// Test students. Fixed uids let seeded items belong to them before they sign in.
export const SAM = { uid: "e2e-sam", name: "Sam Rivera", email: "sam.e2e@example.com" };
export const ALEX = { uid: "e2e-alex", name: "Alex Kim", email: "alex.e2e@example.com" };
export const JO = { uid: "e2e-jo", name: "Jo Park", email: "jo.e2e@example.com" };
export const KIM = { uid: "e2e-kim", name: "Kim Lee", email: "kim.e2e@example.com" };

// ----- Signing in -----

// Creates the person's account in the Auth emulator, if it isn't there yet.
async function createAccount(person) {
  const response = await fetch(`${AUTH}/accounts`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({ localId: person.uid, displayName: person.name, email: person.email, password: PASSWORD }),
  });
  if (!response.ok && !(await response.text()).includes("DUPLICATE")) {
    throw new Error(`Could not create a test account for ${person.name}: ${response.status}`);
  }
}

// Signs the person in on this page without Google's pop-up, which is unreliable in
// automated browsers (see window.__e2eSignIn in src/lib/firebase.js).
export async function signInOn(page, person, path = "/browse") {
  await createAccount(person);
  await page.goto(path);
  await page.waitForFunction(() => typeof window.__e2eSignIn === "function");
  await page.evaluate((login) => window.__e2eSignIn(login), { email: person.email, password: PASSWORD });
  await expect(page.getByRole("link", { name: `Your profile, ${person.name}` })).toBeVisible();
}

// A new signed-in browser (its own context) for each person in a multi-person test.
export async function signIn(browser, person) {
  const page = await (await browser.newContext()).newPage();
  await signInOn(page, person);
  return page;
}

// ----- Test data -----

// Adds a listing that shows on Browse. Override any field, e.g. { title: "Calculator", price: 50 }.
export async function seedItem(id, fields = {}) {
  const item = {
    title: "Mini fridge",
    description: "Used for two years, works great. Selling before graduation.",
    category: "dorm",
    school: "northwestern",
    condition: "Good",
    pickupArea: "Norris Center",
    status: "available",
    archived: false,
    price: 60,
    ownerId: SAM.uid,
    ownerName: SAM.name,
    createdAt: new Date(),
    ...fields,
  };
  const response = await fetch(`${FIRESTORE}/items/${id}`, {
    method: "PATCH",
    headers: ADMIN,
    body: JSON.stringify({ fields: toFields(item) }),
  });
  if (!response.ok) throw new Error(`Could not add item ${id}: ${response.status}`);
}

export async function readItem(id) {
  const response = await fetch(`${FIRESTORE}/items/${id}`, { headers: ADMIN });
  if (response.status === 404) return null;
  return fromFields((await response.json()).fields ?? {});
}

// Every item whose title is one of these, as { id, ...fields }.
export async function findItemsTitled(...titles) {
  const response = await fetch(`${FIRESTORE}/items?pageSize=300`, { headers: ADMIN });
  const { documents = [] } = await response.json();
  return documents
    .map((d) => ({ id: d.name.split("/").pop(), ...fromFields(d.fields ?? {}) }))
    .filter((item) => titles.includes(item.title));
}

// Other tests count the ten sample listings, so tests remove the items they add,
// along with any offers made on them (so a retry starts clean).
export async function deleteItems(...ids) {
  const response = await fetch(`${FIRESTORE}/offers?pageSize=300`, { headers: ADMIN });
  const { documents: offers = [] } = await response.json();
  const offerPaths = offers
    .filter((offer) => ids.includes(offer.fields?.itemId?.stringValue))
    .map((offer) => offer.name.split("/documents/")[1]);
  const paths = [...ids.map((id) => `items/${id}`), ...offerPaths];
  await Promise.all(paths.map((path) => fetch(`${FIRESTORE}/${path}`, { method: "DELETE", headers: ADMIN })));
}

// ----- Photos -----

// Listing photos normally upload to Cloudinary. This answers those requests inside the
// browser instead, so tests upload nothing and don't need the internet.
export async function mockPhotoUpload(page) {
  await page.route("https://api.cloudinary.com/v1_1/*/image/upload", (route) => {
    const cloud = new URL(route.request().url()).pathname.split("/")[2];
    route.fulfill({ json: { secure_url: `https://res.cloudinary.com/${cloud}/image/upload/v1/e2e/photo.png`, public_id: "e2e/photo" } });
  });
  await page.route("https://res.cloudinary.com/**", (route) => route.fulfill({ contentType: "image/png", body: TINY_PNG }));
}

// A 1×1 PNG for file inputs: page.getByLabel("Item photo").setInputFiles(testPhoto())
export function testPhoto() {
  return { name: "photo.png", mimeType: "image/png", buffer: TINY_PNG };
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// ----- Firestore REST values -----

function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: toFields(value) } };
}

function toFields(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, toValue(value)]));
}

function fromValue(value) {
  if ("integerValue" in value) return Number(value.integerValue);
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return new Date(value.timestampValue);
  if ("mapValue" in value) return fromFields(value.mapValue.fields ?? {});
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromValue);
  return null;
}

function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromValue(value)]));
}
