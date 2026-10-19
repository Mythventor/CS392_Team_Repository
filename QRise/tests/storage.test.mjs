import { test } from "node:test";
import assert from "node:assert/strict";
import { ALARMS_STORAGE_KEY, readAlarms, writeAlarms } from "../src/storage.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("alarm data is saved and restored from local storage", () => {
  const storage = createStorage();
  const alarms = [{
    id: "morning",
    label: "Morning",
    time: "07:15",
    days: [1, 2, 3, 4, 5],
    enabled: true,
  }];

  writeAlarms(alarms, storage);

  assert.equal(storage.getItem(ALARMS_STORAGE_KEY), JSON.stringify(alarms));
  assert.deepEqual(readAlarms(storage), alarms);
});

test("missing alarm data starts with an empty schedule", () => {
  assert.deepEqual(readAlarms(createStorage()), []);
});

test("invalid saved alarm data raises a descriptive error", () => {
  assert.throws(
    () => readAlarms(createStorage({ [ALARMS_STORAGE_KEY]: "not json" })),
    /invalid JSON/,
  );
  assert.throws(
    () => readAlarms(createStorage({ [ALARMS_STORAGE_KEY]: JSON.stringify([{ time: "25:00" }]) })),
    /expected format/,
  );
});

test("storage access failures are allowed to reach the app error handler", () => {
  const storage = {
    getItem() { throw new Error("Storage blocked"); },
    setItem() { throw new Error("Storage full"); },
  };
  assert.throws(() => readAlarms(storage), /Storage blocked/);
  assert.throws(() => writeAlarms([], storage), /Storage full/);
});
