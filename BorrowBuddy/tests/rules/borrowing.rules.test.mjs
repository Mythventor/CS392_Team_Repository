// Run with `npm run test:rules`, which starts the Firestore emulator around these tests.
// Covers borrow requests, booked-day locks (no double bookings), pickup plans and messages.
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, query, where, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import { addDays, daysBetween } from "../../src/borrowing/model.js";
import { localDateString } from "../../src/items/model.js";

let env;
const today = localDateString();
const D = (n) => addDays(today, n);
const item = {
  title: "Drill", category: "tools", school: "northwestern", status: "available", ownerId: "sam",
  ownerName: "Sam", availableFrom: today, availableTo: D(60), archived: false,
};
const newRequest = (overrides = {}) => ({
  itemId: "drill", itemTitle: "Drill", itemPhotoURL: "", ownerId: "sam", ownerName: "Sam",
  borrowerId: "alex", borrowerName: "Alex", startDate: D(3), endDate: D(5), message: "Thanks!",
  status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
});
// A request as it sits in the database (timestamps already set).
const stored = (overrides = {}) => ({ ...newRequest(), createdAt: new Date(), updatedAt: new Date(), ...overrides });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
const seed = (path, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), path), data));

// What the app does when the owner accepts: status change + one lock per day, atomically.
function acceptBatch(db, id, loan) {
  const batch = writeBatch(db);
  batch.update(doc(db, "requests", id), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  for (const day of daysBetween(loan.startDate, loan.endDate)) batch.set(doc(db, "items", loan.itemId, "bookedDays", day), { requestId: id });
  return batch.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-borrowbuddy",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed("items/drill", item);
});
after(() => env.cleanup());

test("a student can request someone else's item for valid dates", async () => {
  await assertSucceeds(setDoc(doc(as("alex"), "requests/r1"), newRequest()));
});

test("requests are rejected for your own item, for someone else, or with forged fields", async () => {
  await assertFails(setDoc(doc(as("sam"), "requests/a"), newRequest({ borrowerId: "sam" })));
  await assertFails(setDoc(doc(as("alex"), "requests/b"), newRequest({ borrowerId: "jo" })));
  await assertFails(setDoc(doc(as("alex"), "requests/c"), newRequest({ status: "accepted" })));
  await assertFails(setDoc(doc(as("alex"), "requests/d"), newRequest({ ownerId: "alex2" })));
  await assertFails(setDoc(doc(as("alex"), "requests/e"), newRequest({ paid: true })));
  await assertFails(setDoc(doc(anonymous(), "requests/f"), newRequest()));
});

test("request dates must be in order, at most 14 days, not in the past, and inside the listing's dates", async () => {
  const db = as("alex");
  await assertFails(setDoc(doc(db, "requests/a"), newRequest({ startDate: D(5), endDate: D(3) })));
  await assertFails(setDoc(doc(db, "requests/b"), newRequest({ startDate: D(1), endDate: D(15) })));
  await assertSucceeds(setDoc(doc(db, "requests/c"), newRequest({ startDate: D(1), endDate: D(14) })));
  await assertFails(setDoc(doc(db, "requests/d"), newRequest({ startDate: D(-5), endDate: D(-4) })));
  await assertFails(setDoc(doc(db, "requests/e"), newRequest({ startDate: D(59), endDate: D(62) })));
  await assertFails(setDoc(doc(db, "requests/f"), newRequest({ startDate: "soon", endDate: D(3) })));
});

test("archived or unavailable items can't be requested", async () => {
  await seed("items/drill", { ...item, status: "unavailable", archived: true });
  await assertFails(setDoc(doc(as("alex"), "requests/r1"), newRequest()));
});

test("only the owner and borrower can read a request", async () => {
  await seed("requests/r1", stored());
  await assertSucceeds(getDoc(doc(as("alex"), "requests/r1")));
  await assertSucceeds(getDoc(doc(as("sam"), "requests/r1")));
  await assertFails(getDoc(doc(as("jo"), "requests/r1")));
  await assertSucceeds(getDocs(query(collection(as("sam"), "requests"), where("ownerId", "==", "sam"))));
  await assertFails(getDocs(collection(as("jo"), "requests")));
});

test("the owner accepts by locking every day; accepting without locks or as the borrower fails", async () => {
  const loan = stored();
  await seed("requests/r1", loan);
  await assertFails(updateDoc(doc(as("sam"), "requests/r1"), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(acceptBatch(as("alex"), "r1", loan));
  await assertSucceeds(acceptBatch(as("sam"), "r1", loan));
  const lock = await getDoc(doc(anonymous(), "items/drill/bookedDays", loan.startDate));
  if (lock.data()?.requestId !== "r1") throw new Error("lock not written");
});

test("two loans can never hold the same day", async () => {
  await seed("requests/r1", stored());
  await seed("requests/r2", stored({ borrowerId: "jo", borrowerName: "Jo", startDate: D(5), endDate: D(7) }));
  await assertSucceeds(acceptBatch(as("sam"), "r1", stored()));
  // r2 overlaps on D(5): its whole acceptance is rejected, including the free days.
  await assertFails(acceptBatch(as("sam"), "r2", stored({ startDate: D(5), endDate: D(7) })));
  let status;
  await env.withSecurityRulesDisabled(async (c) => { status = (await getDoc(doc(c.firestore(), "requests/r2"))).data().status; });
  if (status !== "pending") throw new Error("r2 should still be pending");
});

test("locks can't be written for other requests, other items, or days outside the loan", async () => {
  await seed("requests/r1", stored({ status: "accepted" }));
  await assertFails(setDoc(doc(as("sam"), "items/drill/bookedDays", D(10)), { requestId: "r1" }));
  await assertFails(setDoc(doc(as("alex"), "items/drill/bookedDays", D(3)), { requestId: "r1" }));
  await assertFails(setDoc(doc(as("sam"), "items/tent/bookedDays", D(3)), { requestId: "r1" }));
});

test("the owner can decline; the borrower can withdraw a pending request", async () => {
  await seed("requests/r1", stored());
  await seed("requests/r2", stored());
  await assertFails(updateDoc(doc(as("alex"), "requests/r1"), { status: "declined", declinedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("sam"), "requests/r1"), { status: "declined", declinedAt: serverTimestamp(), declineReason: "Away that week", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("sam"), "requests/r2"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "sam", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("alex"), "requests/r2"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "alex", updatedAt: serverTimestamp() }));
});

test("cancelling an accepted loan frees its days for someone else", async () => {
  const loan = stored();
  await seed("requests/r1", loan);
  await acceptBatch(as("sam"), "r1", loan);
  const db = as("alex");
  const batch = writeBatch(db);
  batch.update(doc(db, "requests/r1"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "alex", updatedAt: serverTimestamp() });
  for (const day of daysBetween(loan.startDate, loan.endDate)) batch.delete(doc(db, "items/drill/bookedDays", day));
  await assertSucceeds(batch.commit());
  await seed("requests/r2", stored({ borrowerId: "jo" }));
  await assertSucceeds(acceptBatch(as("sam"), "r2", stored()));
});

test("locks for an active loan can't be deleted", async () => {
  const loan = stored();
  await seed("requests/r1", loan);
  await acceptBatch(as("sam"), "r1", loan);
  await assertFails(deleteDoc(doc(as("sam"), "items/drill/bookedDays", loan.startDate)));
  await assertFails(deleteDoc(doc(as("jo"), "items/drill/bookedDays", loan.startDate)));
});

test("either person marks pickup; only the owner confirms the return", async () => {
  await seed("requests/r1", stored({ status: "accepted" }));
  await assertSucceeds(updateDoc(doc(as("alex"), "requests/r1"), { status: "picked_up", pickedUpAt: serverTimestamp(), pickedUpBy: "alex", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("alex"), "requests/r1"), { status: "returned", returnedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("sam"), "requests/r1"), { status: "returned", returnedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  // Finished loans can't be reopened, and nobody can skip steps.
  await assertFails(updateDoc(doc(as("sam"), "requests/r1"), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
});

test("status changes can't sneak in other edits, and requests can't be deleted", async () => {
  await seed("requests/r1", stored({ status: "accepted" }));
  await assertFails(updateDoc(doc(as("alex"), "requests/r1"), { status: "picked_up", pickedUpAt: serverTimestamp(), pickedUpBy: "alex", endDate: D(30), updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("alex"), "requests/r1"), { status: "picked_up", pickedUpAt: serverTimestamp(), pickedUpBy: "sam", updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(as("sam"), "requests/r1")));
});

test("pickup plans: either person proposes, only the other confirms", async () => {
  await seed("requests/r1", stored({ status: "accepted" }));
  const plan = { place: "Main library", time: `${D(3)}T15:00`, note: "", proposedBy: "alex", confirmedBy: null };
  await assertFails(updateDoc(doc(as("alex"), "requests/r1"), { pickup: { ...plan, proposedBy: "sam" }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("alex"), "requests/r1"), { pickup: plan, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("alex"), "requests/r1"), { pickup: { ...plan, confirmedBy: "alex" }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("sam"), "requests/r1"), { pickup: { ...plan, place: "Elsewhere", confirmedBy: "sam" }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("sam"), "requests/r1"), { pickup: { ...plan, confirmedBy: "sam" }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("jo"), "requests/r1"), { pickup: { ...plan, proposedBy: "jo" }, updatedAt: serverTimestamp() }));
});

test("only the two people in a loan can read and send its messages, as themselves", async () => {
  await seed("requests/r1", stored());
  const message = (senderId) => ({ senderId, senderName: "Alex", text: "Meet at 3?", createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(as("alex"), "requests/r1/messages/m1"), message("alex")));
  await assertSucceeds(getDocs(collection(as("sam"), "requests/r1/messages")));
  await assertFails(setDoc(doc(as("alex"), "requests/r1/messages/m2"), message("sam")));
  await assertFails(setDoc(doc(as("jo"), "requests/r1/messages/m3"), message("jo")));
  await assertFails(getDocs(collection(as("jo"), "requests/r1/messages")));
  await assertFails(setDoc(doc(as("alex"), "requests/r1/messages/m4"), { ...message("alex"), text: "" }));
});

test("anyone can see which days are booked", async () => {
  await seed("items/drill/bookedDays/" + D(3), { requestId: "r1" });
  await assertSucceeds(getDoc(doc(anonymous(), "items/drill/bookedDays", D(3))));
});
