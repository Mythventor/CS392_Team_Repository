// A browser-only stand-in for the Firestore backend, used by automated tests.
// Data is shared between tabs through localStorage and enforces the same permission
// rules as firestore.rules, so tests exercise realistic organizer/attendee behavior.
import { randomId } from "./model";

const STORE_KEY = "qrise.checkinTestDb";
const UID_KEY = "qrise.checkinTestUid";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? { events: {}, secrets: {}, members: {}, checkins: {} };
  } catch {
    return { events: {}, secrets: {}, members: {}, checkins: {} };
  }
}

function denied() {
  const error = new Error("Missing or insufficient permissions.");
  error.code = "permission-denied";
  return error;
}

function revive(event) {
  return event && { ...event, createdAt: new Date(event.createdAt) };
}

export function createMemoryBackend() {
  let uid = sessionStorage.getItem(UID_KEY);
  if (!uid) { uid = `test-${randomId(6)}`; sessionStorage.setItem(UID_KEY, uid); }
  const listeners = new Set();

  function save(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    listeners.forEach((listener) => listener());
  }
  window.addEventListener("storage", (event) => {
    if (event.key === STORE_KEY) listeners.forEach((listener) => listener());
  });
  function subscribe(read, onChange) {
    const run = () => onChange(read(load()));
    listeners.add(run);
    queueMicrotask(run);
    return () => listeners.delete(run);
  }
  const isOwner = (store, id) => store.events[id]?.ownerId === uid;
  const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

  return {
    kind: "memory",
    uid,

    async createEvent(data, ownerName) {
      await pause();
      const store = load();
      const id = randomId(10);
      store.events[id] = { ...data, id, ownerId: uid, ownerName, createdAt: new Date().toISOString() };
      store.secrets[id] = randomId(16);
      save(store);
      return id;
    },

    async updateEvent(id, data) {
      await pause();
      const store = load();
      if (!isOwner(store, id)) throw denied();
      store.events[id] = { ...store.events[id], ...data };
      save(store);
    },

    async deleteEvent(id) {
      await pause();
      const store = load();
      if (!isOwner(store, id)) throw denied();
      delete store.events[id];
      delete store.secrets[id];
      delete store.members[id];
      delete store.checkins[id];
      save(store);
    },

    async replaceCode(id) {
      await pause();
      const store = load();
      if (!isOwner(store, id)) throw denied();
      store.secrets[id] = randomId(16);
      save(store);
    },

    subscribeEvent(id, onChange) {
      return subscribe((store) => revive(store.events[id]) ?? null, onChange);
    },

    subscribeOwnedEvents(onChange) {
      return subscribe((store) => Object.values(store.events).filter((e) => e.ownerId === uid).map(revive), onChange);
    },

    subscribeCode(id, onChange, onError) {
      return subscribe((store) => store, (store) => {
        if (!isOwner(store, id)) onError?.(denied());
        else onChange(store.secrets[id] ?? null);
      });
    },

    subscribeMembers(id, onChange) {
      return subscribe((store) => Object.values(store.members[id] ?? {}).map((m) => ({ ...m, joinedAt: new Date(m.joinedAt) })), onChange);
    },

    subscribeCheckins(id, occurrenceKey, onChange) {
      return subscribe((store) => Object.values(store.checkins[id] ?? {})
        .filter((c) => c.occurrence === occurrenceKey)
        .map((c) => ({ ...c, checkedInAt: new Date(c.checkedInAt) })), onChange);
    },

    async joinEvent(id, name) {
      await pause();
      const store = load();
      if (!store.events[id]) throw denied();
      store.members[id] = { ...store.members[id], [uid]: { uid, name, source: "invite", joinedAt: new Date().toISOString() } };
      save(store);
    },

    async checkIn(id, code, occurrenceKey, name, alreadyMember) {
      await pause();
      const store = load();
      const checkinId = `${occurrenceKey}_${uid}`;
      if (!store.events[id] || store.secrets[id] !== code || store.checkins[id]?.[checkinId]) throw denied();
      store.checkins[id] = { ...store.checkins[id], [checkinId]: { id: checkinId, uid, name, occurrence: occurrenceKey, code, checkedInAt: new Date().toISOString() } };
      if (!alreadyMember) {
        store.members[id] = { ...store.members[id], [uid]: { uid, name, source: "checkin", joinedAt: new Date().toISOString() } };
      }
      save(store);
    },

    async markPresent(id, occurrenceKey, name) {
      await pause();
      const store = load();
      if (!isOwner(store, id)) throw denied();
      const checkinId = `${occurrenceKey}_manual_${randomId(6)}`;
      store.checkins[id] = { ...store.checkins[id], [checkinId]: { id: checkinId, uid: null, name, occurrence: occurrenceKey, manual: true, checkedInAt: new Date().toISOString() } };
      save(store);
    },

    async undoCheckIn(id, checkinId) {
      await pause();
      const store = load();
      if (!isOwner(store, id)) throw denied();
      delete store.checkins[id]?.[checkinId];
      save(store);
    },
  };
}
