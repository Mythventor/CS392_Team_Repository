import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QR_MISMATCH_LIMIT,
  QR_MISMATCH_WINDOW_MS,
  recordMismatchAttempt,
} from "../src/alarm-system/verification.js";

test("the mismatch failsafe counts three incorrect scans in a rolling five-minute window", () => {
  const first = recordMismatchAttempt([], 0);
  const second = recordMismatchAttempt(first, QR_MISMATCH_WINDOW_MS - 1);
  const third = recordMismatchAttempt(second, QR_MISMATCH_WINDOW_MS);
  const fourth = recordMismatchAttempt(third, QR_MISMATCH_WINDOW_MS + 1);

  assert.equal(second.length, 2);
  assert.equal(third.length, 2);
  assert.equal(fourth.length, QR_MISMATCH_LIMIT);
});
