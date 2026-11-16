// Offers to buy items, in Firestore.
//
// offers/{offerId}                one deal, from offer to sale (see README)
// offers/{offerId}/messages/{id}  questions and pickup coordination between buyer and seller
//
// Accepting an offer reserves the item for that buyer in the same transaction
// (items/{itemId}.status = "reserved", reservedFor = offerId). Security rules only let
// an available item become reserved, so an item can never be promised to two buyers.
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { otherPendingOffers } from "./model";

const offerRef = (id) => doc(db, "offers", id);
const itemRef = (id) => doc(db, "items", id);

function fromSnapshot(snapshot) {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  const millis = (value) => value?.toMillis?.() ?? null;
  return {
    ...data,
    id: snapshot.id,
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    acceptedAt: millis(data.acceptedAt),
    soldAt: millis(data.soldAt),
    cancelledAt: millis(data.cancelledAt),
    declinedAt: millis(data.declinedAt),
  };
}

function stale(message) {
  return Object.assign(new Error(message), { code: "deal/stale" });
}

// ----- Reading -----

// Everything the person is buying or selling, live. Two queries because rules only let
// people read offers they're part of.
export function watchMyDeals(uid, next, error) {
  const results = { seller: null, buyer: null };
  const emit = () => {
    if (results.seller && results.buyer) next([...results.seller, ...results.buyer]);
  };
  const watch = (field, key) =>
    onSnapshot(
      query(collection(db, "offers"), where(field, "==", uid)),
      (snapshot) => {
        results[key] = snapshot.docs.map(fromSnapshot);
        emit();
      },
      error,
    );
  const stops = [watch("sellerId", "seller"), watch("buyerId", "buyer")];
  return () => stops.forEach((stop) => stop());
}

export function watchOffer(id, next, error) {
  return onSnapshot(offerRef(id), (snapshot) => next(snapshot.exists() ? fromSnapshot(snapshot) : null), error);
}

// The signed-in person's own offers on one item (to show "you already made an offer").
export function watchMyOffersForItem(itemId, uid, next, error) {
  return onSnapshot(
    query(collection(db, "offers"), where("buyerId", "==", uid), where("itemId", "==", itemId)),
    (snapshot) => next(snapshot.docs.map(fromSnapshot)),
    error,
  );
}

export function watchMessages(offerId, next, error) {
  return onSnapshot(
    query(collection(db, "offers", offerId, "messages"), orderBy("createdAt")),
    (snapshot) => next(snapshot.docs.map((d) => {
      const data = d.data({ serverTimestamps: "estimate" });
      return { ...data, id: d.id, createdAt: data.createdAt?.toMillis?.() ?? Date.now() };
    })),
    error,
  );
}

// ----- Buyer -----

export async function createOffer({ item, values, user, profile }) {
  const ref = doc(collection(db, "offers"));
  await setDoc(ref, {
    itemId: item.id,
    itemTitle: item.title,
    itemPhotoURL: item.photoURL || "",
    sellerId: item.ownerId,
    sellerName: item.ownerName || "Seller",
    buyerId: user.uid,
    buyerName: (profile?.displayName || user.displayName || "Student").slice(0, 60),
    listPrice: item.price,
    offerPrice: values.offerPrice,
    message: values.message.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ----- Seller -----

// Accepts an offer and reserves the item for that buyer, together.
export async function acceptOffer(offer) {
  await runTransaction(db, async (tx) => {
    const [current, item] = await Promise.all([tx.get(offerRef(offer.id)), tx.get(itemRef(offer.itemId))]);
    if (!current.exists() || current.data().status !== "pending") throw stale("This offer has already been answered.");
    if (!item.exists() || item.data().archived || item.data().status !== "available") {
      throw stale("This item is no longer available, so the offer can't be accepted.");
    }
    tx.update(offerRef(offer.id), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(itemRef(offer.itemId), { status: "reserved", reservedFor: offer.id, updatedAt: serverTimestamp() });
  });
}

export function declineOffer(offer, reason = "") {
  const update = { status: "declined", declinedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (reason.trim()) update.declineReason = reason.trim().slice(0, 200);
  return updateDoc(offerRef(offer.id), update);
}

// The seller confirms the item was handed over and paid for. Other pending offers are declined.
export async function markSold(offer, uid) {
  const pending = await getDocs(
    query(collection(db, "offers"), where("sellerId", "==", uid), where("itemId", "==", offer.itemId), where("status", "==", "pending")),
  );
  const others = otherPendingOffers(offer, pending.docs.map(fromSnapshot));
  const batch = writeBatch(db);
  batch.update(offerRef(offer.id), { status: "sold", soldAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.update(itemRef(offer.itemId), { status: "sold", updatedAt: serverTimestamp() });
  others.forEach((other) => batch.update(offerRef(other.id), {
    status: "declined",
    declinedAt: serverTimestamp(),
    declineReason: "This item was sold to someone else.",
    updatedAt: serverTimestamp(),
  }));
  await batch.commit();
  return others.length;
}

// ----- Either person -----

// Cancelling an accepted deal puts the item back on sale.
export async function cancelOffer(offer, uid) {
  const batch = writeBatch(db);
  batch.update(offerRef(offer.id), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy: uid,
    updatedAt: serverTimestamp(),
  });
  if (offer.status === "accepted") {
    batch.update(itemRef(offer.itemId), { status: "available", reservedFor: null, updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

// Either person proposes where and when to meet; the other confirms it.
export function proposePickup(offer, uid, { place, time, note = "" }) {
  return updateDoc(offerRef(offer.id), {
    pickup: { place: place.trim(), time, note: note.trim().slice(0, 200), proposedBy: uid, confirmedBy: null },
    updatedAt: serverTimestamp(),
  });
}

export function confirmPickup(offer, uid) {
  return updateDoc(offerRef(offer.id), {
    pickup: { ...offer.pickup, confirmedBy: uid },
    updatedAt: serverTimestamp(),
  });
}

export function sendMessage(offerId, { uid, name, text }) {
  return addDoc(collection(db, "offers", offerId, "messages"), {
    senderId: uid,
    senderName: (name || "Student").slice(0, 60),
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}
