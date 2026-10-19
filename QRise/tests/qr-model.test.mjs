import { test } from "node:test";
import assert from "node:assert/strict";
import { createQrPayload, findMatchingQrCode, QR_PAYLOAD_PREFIX } from "../src/qr/model.js";

const qrCode = {
  id: "3c6ef372-fe94-4a6f-8b1e-4e2f4cdd8ea1",
  alarmId: "morning",
};

test("QR payloads identify only the registered code paired with the requested alarm", () => {
  const payload = createQrPayload(qrCode.id);
  assert.equal(payload, `${QR_PAYLOAD_PREFIX}${qrCode.id}`);
  assert.equal(findMatchingQrCode(payload, [qrCode], "morning"), qrCode);
  assert.equal(findMatchingQrCode(payload, [qrCode], "other"), null);
  assert.equal(findMatchingQrCode(`${QR_PAYLOAD_PREFIX}unknown`, [qrCode], "morning"), null);
  assert.equal(findMatchingQrCode("unregistered content", [qrCode], "morning"), null);
});
