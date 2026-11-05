// Borrow requests in Firestore.
//
// requests/{requestId}                  one loan, from request to return (see README)
// requests/{requestId}/messages/{id}    pickup coordination between owner and borrower
// items/{itemId}/bookedDays/{YYYY-MM-DD} one lock per day held by an accepted loan
//
// Accepting writes the day locks in the same transaction as the status change.
// Security rules only allow creating a lock that doesn't exist yet, so two loans can
// never hold the same day, even if two people accept at the same moment.
import {
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
  addDoc,
} from "firebase/firestore";
import { localDateString } from "../items/model";
import { db } from "../lib/firebase";
import { conflictingRequests, daysBetween } from "./model";

export class BookingConflictError extends Error {
  constructor(day) {
    super("Some of these days were just booked by someone else.");
    this.code = "booking/conflict";
    this.day = day;
  }
}

function fromSnapshot(snapshot) {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  const millis = (value) => value?.toMillis?.() ?? null;
  return {
    ...data,
    id: snapshot.id,
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    acceptedAt: millis(data.acceptedAt),
    pickedUpAt: millis(data.pickedUpAt),
    returnedAt: millis(data.returnedAt),
    cancelledAt: millis(data.cancelledAt),
    declinedAt: millis(data.declinedAt),
  };
}

const requestRef = (id) => doc(db, "requests", id);
const dayRef = (itemId, day) => doc(db, "items", itemId, "bookedDays", day);

// ----- Reading -----

// Everything the person lends or borrows, live. Two queries because rules only let
// people read requests they're part of.
export function watchMyLoans(uid, next, error) {
  const results = { owner: null, borrower: null };
  const emit = () => {
    if (results.owner && results.borrower) next([...results.owner, ...results.borrower]);
  };
  const watch = (field) =>
    onSnapshot(
      query(collection(db, "requests"), where(field, "==", uid)),
      (snapshot) => {
        results[field === "ownerId" ? "owner" : "borrower"] = snapshot.docs.map(fromSnapshot);
        emit();
      },
      error,
    );
  const stops = [watch("ownerId"), watch("borrowerId")];
  return () => stops.forEach((stop) => stop());
}

export function watchRequest(id, next, error) {
  return onSnapshot(requestRef(id), (snapshot) => next(snapshot.exists() ? fromSnapshot(snapshot) : null), error);
}

// The signed-in person's own requests for one item (to show "you already asked").
export function watchMyRequestsForItem(itemId, uid, next, error) {
  return onSnapshot(
    query(collection(db, "requests"), where("borrowerId", "==", uid), where("itemId", "==", itemId)),
    (snapshot) => next(snapshot.docs.map(fromSnapshot)),
    error,
  );
}

// Days already held by accepted loans. Public, so borrowers can see what's free.
export function watchBookedDays(itemId, next, error) {
  return onSnapshot(
    collection(db, "items", itemId, "bookedDays"),
    (snapshot) => next(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    error,
  );
}

export function watchMessages(requestId, next, error) {
  return onSnapshot(
    query(collection(db, "requests", requestId, "messages"), orderBy("createdAt")),
    (snapshot) => next(snapshot.docs.map((d) => {
      const data = d.data({ serverTimestamps: "estimate" });
      return { ...data, id: d.id, createdAt: data.createdAt?.toMillis?.() ?? Date.now() };
    })),
    error,
  );
}

// ----- Borrower -----

export async function createRequest({ item, values, user, profile }) {
  const ref = doc(collection(db, "requests"));
  await setDoc(ref, {
    itemId: item.id,
    itemTitle: item.title,
    itemPhotoURL: item.photoURL || "",
    ownerId: item.ownerId,
    ownerName: item.ownerName || "Owner",
    borrowerId: user.uid,
    borrowerName: (profile?.displayName || user.displayName || "Student").slice(0, 60),
    startDate: values.startDate,
    endDate: values.endDate,
    message: values.message.trim(),
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ----- Owner -----

// Accepts a request, locks its days, and declines other pending requests that overlap.
export async function acceptRequest(request, uid) {
  const pending = await getDocs(
    query(collection(db, "requests"), where("ownerId", "==", uid), where("itemId", "==", request.itemId), where("status", "==", "pending")),
  );
  const overlapping = conflictingRequests(request, pending.docs.map(fromSnapshot));
  const days = daysBetween(request.startDate, request.endDate);

  await runTransaction(db, async (tx) => {
    const current = await tx.get(requestRef(request.id));
    if (!current.exists() || current.data().status !== "pending") {
      throw Object.assign(new Error("This request has already been answered."), { code: "booking/stale" });
    }
    const locks = await Promise.all(days.map((day) => tx.get(dayRef(request.itemId, day))));
    const taken = locks.find((lock) => lock.exists() && lock.data().requestId !== request.id);
    if (taken) throw new BookingConflictError(taken.id);

    tx.update(requestRef(request.id), { status: "accepted", acceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    days.forEach((day) => tx.set(dayRef(request.itemId, day), { requestId: request.id }));
    overlapping.forEach((other) => tx.update(requestRef(other.id), {
      status: "declined",
      declinedAt: serverTimestamp(),
      declineReason: "These dates were booked by someone else.",
      updatedAt: serverTimestamp(),
    }));
  });
  return overlapping.length;
}

export function declineRequest(request, reason = "") {
  const update = { status: "declined", declinedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (reason.trim()) update.declineReason = reason.trim().slice(0, 200);
  return updateDoc(requestRef(request.id), update);
}

// Owner confirms they got the item back. Frees the days that haven't happened yet.
export async function markReturned(request) {
  const batch = writeBatch(db);
  batch.update(requestRef(request.id), { status: "returned", returnedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  releaseDays(batch, request, localDateString());
  await batch.commit();
}

// ----- Either person -----

export async function cancelRequest(request, uid) {
  const batch = writeBatch(db);
  batch.update(requestRef(request.id), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy: uid,
    updatedAt: serverTimestamp(),
  });
  if (request.status === "accepted") releaseDays(batch, request);
  await batch.commit();
}

export function markPickedUp(request, uid) {
  return updateDoc(requestRef(request.id), {
    status: "picked_up",
    pickedUpAt: serverTimestamp(),
    pickedUpBy: uid,
    updatedAt: serverTimestamp(),
  });
}

// Either person proposes where and when to meet; the other confirms it.
export function proposePickup(request, uid, { place, time, note = "" }) {
  return updateDoc(requestRef(request.id), {
    pickup: { place: place.trim(), time, note: note.trim().slice(0, 200), proposedBy: uid, confirmedBy: null },
    updatedAt: serverTimestamp(),
  });
}

export function confirmPickup(request, uid) {
  return updateDoc(requestRef(request.id), {
    pickup: { ...request.pickup, confirmedBy: uid },
    updatedAt: serverTimestamp(),
  });
}

export function sendMessage(requestId, { uid, name, text }) {
  return addDoc(collection(db, "requests", requestId, "messages"), {
    senderId: uid,
    senderName: (name || "Student").slice(0, 60),
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
}

function releaseDays(batch, request, fromDay = request.startDate) {
  daysBetween(request.startDate, request.endDate)
    .filter((day) => day >= fromDay)
    .forEach((day) => batch.delete(dayRef(request.itemId, day)));
}
