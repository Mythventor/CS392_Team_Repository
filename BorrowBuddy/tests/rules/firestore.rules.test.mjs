// Run with `npm run test:rules`, which starts the Firestore emulator around these tests.
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";

let env;
const profile = { displayName: "Sam", photoURL: null, school: "northwestern", bio: "", createdAt: 1, updatedAt: 1 };
const item = { title: "Drill", category: "tools", school: "northwestern", status: "available", ownerId: "sam" };

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

async function seed(path, data) {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-borrowbuddy",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());

test("people can create only their own profile", async () => {
  await assertSucceeds(setDoc(doc(as("sam"), "users/sam"), profile));
  await assertFails(setDoc(doc(as("sam"), "users/alex"), profile));
  await assertFails(setDoc(doc(anonymous(), "users/sam"), profile));
});

test("profiles reject invalid fields", async () => {
  const ref = doc(as("sam"), "users/sam");
  await assertFails(setDoc(ref, { ...profile, displayName: "x".repeat(61) }));
  await assertFails(setDoc(ref, { ...profile, bio: "x".repeat(281) }));
  await assertFails(setDoc(ref, { ...profile, isAdmin: true }));
});

test("only signed-in students can read profiles", async () => {
  await seed("users/sam", profile);
  await assertSucceeds(getDoc(doc(as("alex"), "users/sam")));
  await assertFails(getDoc(doc(anonymous(), "users/sam")));
});

test("only the owner can edit a profile, and never its creation time", async () => {
  await seed("users/sam", profile);
  await assertSucceeds(updateDoc(doc(as("sam"), "users/sam"), { bio: "Hi" }));
  await assertFails(updateDoc(doc(as("alex"), "users/sam"), { bio: "Hacked" }));
  await assertFails(updateDoc(doc(as("sam"), "users/sam"), { createdAt: 2 }));
});

test("profiles can't be deleted from the app", async () => {
  await seed("users/sam", profile);
  await assertFails(deleteDoc(doc(as("sam"), "users/sam")));
});

test("anyone can browse items", async () => {
  await seed("items/drill", item);
  await assertSucceeds(getDoc(doc(anonymous(), "items/drill")));
});

test("items must be created by a signed-in owner with valid fields", async () => {
  await assertSucceeds(setDoc(doc(as("sam"), "items/a"), item));
  await assertFails(setDoc(doc(anonymous(), "items/b"), item));
  await assertFails(setDoc(doc(as("alex"), "items/c"), item));
  await assertFails(setDoc(doc(as("sam"), "items/d"), { ...item, title: "" }));
  await assertFails(setDoc(doc(as("sam"), "items/e"), { ...item, status: "stolen" }));
});

test("only the owner can edit or delete an item, and can't hand it to someone else", async () => {
  await seed("items/drill", item);
  await assertFails(updateDoc(doc(as("alex"), "items/drill"), { title: "Mine now" }));
  await assertFails(updateDoc(doc(as("sam"), "items/drill"), { ownerId: "alex" }));
  await assertFails(deleteDoc(doc(as("alex"), "items/drill")));
  await assertSucceeds(updateDoc(doc(as("sam"), "items/drill"), { title: "Big drill" }));
  await assertSucceeds(deleteDoc(doc(as("sam"), "items/drill")));
});

test("other collections stay closed by default", async () => {
  await assertFails(setDoc(doc(as("sam"), "secrets/x"), { a: 1 }));
  await assertFails(getDoc(doc(as("sam"), "secrets/x")));
});
