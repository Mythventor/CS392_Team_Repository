// Run with `npm run test:rules`, which starts the Firestore emulator around these tests.
// Covers offers, reserving an item for one buyer (never two), selling, pickup plans and messages.
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";

let env;
const item = {
  title: "Desk lamp", category: "dorm", school: "northwestern", status: "available", ownerId: "sam",
  ownerName: "Sam", price: 20, archived: false,
};
const newOffer = (overrides = {}) => ({
  itemId: "lamp", itemTitle: "Desk lamp", itemPhotoURL: "", sellerId: "sam", sellerName: "Sam",
  buyerId: "alex", buyerName: "Alex", listPrice: 20, offerPrice: 15, message: "Can I get it Friday?",
  status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
});
// An offer as it sits in the database (timestamps already set).
const stored = (overrides = {}) => ({ ...newOffer(), createdAt: new Date(), updatedAt: new Date(), ...overrides });

const as = (uid) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
const seed = (path, data) => env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), path), data));
async function readAdmin(path) {
  let data;
  await env.withSecurityRulesDisabled(async (c) => { data = (await getDoc(doc(c.firestore(), path))).data(); });
  return data;
}

// What the app does when the seller accepts: the offer and the item's reservation, together.
function acceptBatch(db, id, { reservedFor = id } = {}) {
  const batch = writeBatch(db);
  batch.update(doc(db, "offers", id), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(doc(db, "items/lamp"), { status: "reserved", reservedFor, updatedAt: serverTimestamp() });
  return batch.commit();
}
function cancelBatch(db, id, uid) {
  const batch = writeBatch(db);
  batch.update(doc(db, "offers", id), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: uid, updatedAt: serverTimestamp() });
  batch.update(doc(db, "items/lamp"), { status: "available", reservedFor: null, updatedAt: serverTimestamp() });
  return batch.commit();
}
function sellBatch(db, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, "offers", id), { status: "sold", soldAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(doc(db, "items/lamp"), { status: "sold", updatedAt: serverTimestamp() });
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
  await seed("items/lamp", item);
});
after(() => env.cleanup());

test("listings need a whole-dollar price from free to $10,000", async () => {
  const db = as("sam");
  await assertSucceeds(setDoc(doc(db, "items/free"), { ...item, price: 0 }));
  await assertFails(setDoc(doc(db, "items/a"), { ...item, price: 12.5 }));
  await assertFails(setDoc(doc(db, "items/b"), { ...item, price: -1 }));
  await assertFails(setDoc(doc(db, "items/c"), { ...item, price: 10001 }));
  await assertFails(setDoc(doc(db, "items/d"), { ...item, status: "sold" }));
  await assertFails(setDoc(doc(db, "items/e"), { ...item, reservedFor: "x" }));
});

test("a student can offer the asking price or less on someone else's item", async () => {
  await assertSucceeds(setDoc(doc(as("alex"), "offers/o1"), newOffer()));
  await assertSucceeds(setDoc(doc(as("alex"), "offers/o2"), newOffer({ offerPrice: 20 })));
  await assertFails(setDoc(doc(as("alex"), "offers/o3"), newOffer({ offerPrice: 25 })));
  await assertFails(setDoc(doc(as("alex"), "offers/o4"), newOffer({ listPrice: 5, offerPrice: 5 })));
  await assertFails(setDoc(doc(as("alex"), "offers/o5"), newOffer({ offerPrice: 9.5 })));
});

test("offers are rejected for your own item, as someone else, with forged fields, or on unavailable items", async () => {
  await assertFails(setDoc(doc(as("sam"), "offers/a"), newOffer({ buyerId: "sam" })));
  await assertFails(setDoc(doc(as("alex"), "offers/b"), newOffer({ buyerId: "jo" })));
  await assertFails(setDoc(doc(as("alex"), "offers/c"), newOffer({ status: "accepted" })));
  await assertFails(setDoc(doc(as("alex"), "offers/d"), newOffer({ sellerId: "alex2" })));
  await assertFails(setDoc(doc(as("alex"), "offers/e"), newOffer({ paid: true })));
  await assertFails(setDoc(doc(anonymous(), "offers/f"), newOffer()));
  await seed("items/lamp", { ...item, status: "reserved", reservedFor: "other" });
  await assertFails(setDoc(doc(as("alex"), "offers/g"), newOffer()));
});

test("only the seller and buyer can read an offer", async () => {
  await seed("offers/o1", stored());
  await assertSucceeds(getDoc(doc(as("alex"), "offers/o1")));
  await assertSucceeds(getDoc(doc(as("sam"), "offers/o1")));
  await assertFails(getDoc(doc(as("jo"), "offers/o1")));
  await assertSucceeds(getDocs(query(collection(as("sam"), "offers"), where("sellerId", "==", "sam"))));
  await assertFails(getDocs(collection(as("jo"), "offers")));
});

test("the seller accepts by reserving the item for that offer; other ways fail", async () => {
  await seed("offers/o1", stored());
  await assertFails(updateDoc(doc(as("sam"), "offers/o1"), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(acceptBatch(as("alex"), "o1"));
  await assertFails(acceptBatch(as("sam"), "o1", { reservedFor: "someone-else" }));
  await assertSucceeds(acceptBatch(as("sam"), "o1"));
  const lamp = await readAdmin("items/lamp");
  if (lamp.status !== "reserved" || lamp.reservedFor !== "o1") throw new Error("item not reserved");
});

test("an item can never be promised to two buyers", async () => {
  await seed("offers/o1", stored());
  await seed("offers/o2", stored({ buyerId: "jo", buyerName: "Jo", offerPrice: 20 }));
  await assertSucceeds(acceptBatch(as("sam"), "o1"));
  await assertFails(acceptBatch(as("sam"), "o2"));
  // Nor can the seller quietly move the reservation to another offer.
  await assertFails(updateDoc(doc(as("sam"), "items/lamp"), { reservedFor: "o2" }));
  if ((await readAdmin("offers/o2")).status !== "pending") throw new Error("o2 should still be pending");
});

test("the item's status only changes along with its deal", async () => {
  await assertFails(updateDoc(doc(as("sam"), "items/lamp"), { status: "sold" }));
  await assertFails(updateDoc(doc(as("sam"), "items/lamp"), { status: "reserved", reservedFor: "nope" }));
  await assertSucceeds(updateDoc(doc(as("sam"), "items/lamp"), { status: "unavailable", archived: true }));
});

test("the seller can decline; the buyer can withdraw a pending offer", async () => {
  await seed("offers/o1", stored());
  await seed("offers/o2", stored());
  await assertFails(updateDoc(doc(as("alex"), "offers/o1"), { status: "declined", declinedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("sam"), "offers/o1"), { status: "declined", declinedAt: serverTimestamp(), declineReason: "Already promised", updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("sam"), "offers/o2"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "sam", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("alex"), "offers/o2"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "alex", updatedAt: serverTimestamp() }));
});

test("either person can call off an accepted deal, which puts the item back on sale", async () => {
  await seed("offers/o1", stored());
  await acceptBatch(as("sam"), "o1");
  // Cancelling without releasing the item is refused.
  await assertFails(updateDoc(doc(as("alex"), "offers/o1"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "alex", updatedAt: serverTimestamp() }));
  // A stranger can't release it.
  await assertFails(cancelBatch(as("jo"), "o1", "jo"));
  await assertSucceeds(cancelBatch(as("alex"), "o1", "alex"));
  if ((await readAdmin("items/lamp")).status !== "available") throw new Error("item not released");
  // ...and it can be sold to someone else.
  await seed("offers/o2", stored({ buyerId: "jo" }));
  await assertSucceeds(acceptBatch(as("sam"), "o2"));
});

test("a buyer releasing an item can't change anything else about it", async () => {
  await seed("offers/o1", stored());
  await acceptBatch(as("sam"), "o1");
  const db = as("alex");
  const batch = writeBatch(db);
  batch.update(doc(db, "offers/o1"), { status: "cancelled", cancelledAt: serverTimestamp(), cancelledBy: "alex", updatedAt: serverTimestamp() });
  batch.update(doc(db, "items/lamp"), { status: "available", reservedFor: null, price: 1, updatedAt: serverTimestamp() });
  await assertFails(batch.commit());
});

test("only the seller marks it sold, and only after accepting", async () => {
  await seed("offers/o1", stored());
  await assertFails(sellBatch(as("sam"), "o1"));
  await acceptBatch(as("sam"), "o1");
  await assertFails(sellBatch(as("alex"), "o1"));
  await assertSucceeds(sellBatch(as("sam"), "o1"));
  // A finished sale can't be reopened, and the item can't be put back on sale.
  await assertFails(cancelBatch(as("sam"), "o1", "sam"));
  await assertFails(updateDoc(doc(as("sam"), "items/lamp"), { status: "available", reservedFor: null }));
});

test("status changes can't sneak in other edits, and offers can't be deleted", async () => {
  await seed("offers/o1", stored());
  await assertFails(updateDoc(doc(as("sam"), "offers/o1"), { status: "declined", declinedAt: serverTimestamp(), offerPrice: 1, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(as("sam"), "offers/o1")));
  await acceptBatch(as("sam"), "o1");
  await assertFails(deleteDoc(doc(as("sam"), "items/lamp")));
});

test("pickup plans: either person proposes, only the other confirms", async () => {
  await seed("offers/o1", stored({ status: "accepted" }));
  const plan = { place: "Norris front desk", time: "2099-06-10T15:00", note: "", proposedBy: "alex", confirmedBy: null };
  await assertFails(updateDoc(doc(as("alex"), "offers/o1"), { pickup: { ...plan, proposedBy: "sam" }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("alex"), "offers/o1"), { pickup: plan, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("alex"), "offers/o1"), { pickup: { ...plan, confirmedBy: "alex" }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("sam"), "offers/o1"), { pickup: { ...plan, place: "Elsewhere", confirmedBy: "sam" }, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(as("sam"), "offers/o1"), { pickup: { ...plan, confirmedBy: "sam" }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(as("jo"), "offers/o1"), { pickup: { ...plan, proposedBy: "jo" }, updatedAt: serverTimestamp() }));
});

test("only the buyer and seller can read and send messages, as themselves", async () => {
  await seed("offers/o1", stored());
  const message = (senderId) => ({ senderId, senderName: "Alex", text: "Is it still available?", createdAt: serverTimestamp() });
  await assertSucceeds(setDoc(doc(as("alex"), "offers/o1/messages/m1"), message("alex")));
  await assertSucceeds(getDocs(collection(as("sam"), "offers/o1/messages")));
  await assertFails(setDoc(doc(as("alex"), "offers/o1/messages/m2"), message("sam")));
  await assertFails(setDoc(doc(as("jo"), "offers/o1/messages/m3"), message("jo")));
  await assertFails(getDocs(collection(as("jo"), "offers/o1/messages")));
  await assertFails(setDoc(doc(as("alex"), "offers/o1/messages/m4"), { ...message("alex"), text: "" }));
});
