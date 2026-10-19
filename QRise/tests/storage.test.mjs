import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALARMS_STORAGE_KEY,
  QR_CODES_STORAGE_KEY,
  readAlarms,
  readQrCodes,
  writeAlarms,
  writeQrCodes,
} from "../src/storage.js";

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

test("QR pairings are saved and restored separately from alarms", () => {
  const storage = createStorage();
  const qrCodes = [{
    id: "3c6ef372-fe94-4a6f-8b1e-4e2f4cdd8ea1",
    alarmId: "morning",
  }];

  writeQrCodes(qrCodes, storage);

  assert.equal(storage.getItem(QR_CODES_STORAGE_KEY), JSON.stringify(qrCodes));
  assert.deepEqual(readQrCodes(storage), qrCodes);
  assert.equal(storage.getItem(ALARMS_STORAGE_KEY), null);
});

test("invalid, duplicate, and unreadable QR pairings are rejected", () => {
  const code = { id: "3c6ef372-fe94-4a6f-8b1e-4e2f4cdd8ea1", alarmId: "morning" };
  assert.throws(
    () => readQrCodes(createStorage({ [QR_CODES_STORAGE_KEY]: "not json" })),
    /invalid JSON/,
  );
  assert.throws(
    () => readQrCodes(createStorage({ [QR_CODES_STORAGE_KEY]: JSON.stringify([{ id: "bad", alarmId: "morning" }]) })),
    /expected format/,
  );
  assert.throws(
    () => readQrCodes(createStorage({ [QR_CODES_STORAGE_KEY]: JSON.stringify([code, code]) })),
    /expected format/,
  );
  assert.throws(
    () => readQrCodes({ getItem() { throw new Error("Storage blocked"); } }),
    /Storage blocked/,
  );
});
