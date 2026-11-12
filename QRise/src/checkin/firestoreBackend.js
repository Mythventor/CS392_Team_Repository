// Check-in data stored in Cloud Firestore. Each device signs in anonymously, so people
// only type a name, while security rules (firestore.rules) still know who owns an event.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { randomId } from "./model";

async function loadConfig() {
  const env = import.meta.env;
  if (env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
  }
  // Firebase Hosting serves the project's web config at this reserved URL.
  const response = await fetch("/__/firebase/init.json");
  if (!response.ok) throw new Error("Firebase is not configured for this site.");
  return response.json();
}

function toDate(value) {
  if (!value) return new Date();
  return typeof value.toDate === "function" ? value.toDate() : new Date(value);
}

function eventFromSnapshot(snapshot) {
  if (!snapshot.exists()) return null;
  const data = snapshot.data({ serverTimestamps: "estimate" });
  return { id: snapshot.id, ...data, createdAt: toDate(data.createdAt) };
}

const EVENT_FIELDS = ["title", "location", "date", "time", "durationMinutes", "repeatDays", "opensMinutesBefore", "lateAfterMinutes", "roster"];

function pickEventFields(data) {
  return Object.fromEntries(EVENT_FIELDS.filter((key) => key in data).map((key) => [key, data[key]]));
}

export async function createFirestoreBackend() {
  const app = initializeApp(await loadConfig(), "qrise-checkin");
  const auth = getAuth(app);
  const db = getFirestore(app);
  // Reuse the device's saved anonymous account so organizers keep their events.
  await auth.authStateReady();
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
  const uid = user.uid;

  const eventRef = (id) => doc(db, "events", id);
  const secretRef = (id) => doc(db, "events", id, "secrets", "checkin");

  return {
    kind: "firestore",
    uid,

    async createEvent(data, ownerName) {
      const id = randomId(10);
      await setDoc(eventRef(id), { ...pickEventFields(data), ownerId: uid, ownerName, createdAt: serverTimestamp() });
      await setDoc(secretRef(id), { codeId: randomId(16) });
      return id;
    },

    async updateEvent(id, data) {
      await updateDoc(eventRef(id), pickEventFields(data));
    },

    async deleteEvent(id) {
      const batch = writeBatch(db);
      for (const name of ["checkins", "members"]) {
        const docs = await getDocs(collection(db, "events", id, name));
        docs.forEach((d) => batch.delete(d.ref));
      }
      batch.delete(secretRef(id));
      await batch.commit();
      await deleteDoc(eventRef(id));
    },

    async replaceCode(id) {
      await setDoc(secretRef(id), { codeId: randomId(16) });
    },

    subscribeEvent(id, onChange, onError) {
      return onSnapshot(eventRef(id), (snapshot) => onChange(eventFromSnapshot(snapshot)), onError);
    },

    subscribeOwnedEvents(onChange, onError) {
      return onSnapshot(query(collection(db, "events"), where("ownerId", "==", uid)),
        (snapshot) => onChange(snapshot.docs.map(eventFromSnapshot)), onError);
    },

    subscribeCode(id, onChange, onError) {
      return onSnapshot(secretRef(id), (snapshot) => onChange(snapshot.data()?.codeId ?? null), onError);
    },

    subscribeMembers(id, onChange, onError) {
      return onSnapshot(collection(db, "events", id, "members"),
        (snapshot) => onChange(snapshot.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return { ...data, joinedAt: toDate(data.joinedAt) };
        })), onError);
    },

    subscribeCheckins(id, occurrenceKey, onChange, onError) {
      return onSnapshot(query(collection(db, "events", id, "checkins"), where("occurrence", "==", occurrenceKey)),
        (snapshot) => onChange(snapshot.docs.map((d) => {
          const data = d.data({ serverTimestamps: "estimate" });
          return { id: d.id, ...data, checkedInAt: toDate(data.checkedInAt) };
        })), onError);
    },

    async joinEvent(id, name) {
      await setDoc(doc(db, "events", id, "members", uid), { uid, name, source: "invite", joinedAt: serverTimestamp() });
    },

    async checkIn(id, code, occurrenceKey, name, alreadyMember) {
      await setDoc(doc(db, "events", id, "checkins", `${occurrenceKey}_${uid}`), {
        uid, name, occurrence: occurrenceKey, code, checkedInAt: serverTimestamp(),
      });
      if (!alreadyMember) {
        await setDoc(doc(db, "events", id, "members", uid), { uid, name, source: "checkin", joinedAt: serverTimestamp() });
      }
    },

    async markPresent(id, occurrenceKey, name) {
      await setDoc(doc(db, "events", id, "checkins", `${occurrenceKey}_manual_${randomId(6)}`), {
        uid: null, name, occurrence: occurrenceKey, manual: true, checkedInAt: serverTimestamp(),
      });
    },

    async undoCheckIn(id, checkinId) {
      await deleteDoc(doc(db, "events", id, "checkins", checkinId));
    },
  };
}
