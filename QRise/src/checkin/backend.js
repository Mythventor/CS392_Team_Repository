// Picks the check-in data backend once per page load.
// Automated tests set window.__QRISE_CHECKIN_BACKEND__ = "memory" before the app loads.
let backendPromise = null;

export function getCheckinBackend() {
  if (!backendPromise) {
    backendPromise = globalThis.window?.__QRISE_CHECKIN_BACKEND__ === "memory"
      ? import("./memoryBackend").then((m) => m.createMemoryBackend())
      : import("./firestoreBackend").then((m) => m.createFirestoreBackend());
    backendPromise.catch(() => { backendPromise = null; });
  }
  return backendPromise;
}
