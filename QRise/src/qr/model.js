export const QR_PAYLOAD_PREFIX = "qrise:alarm:v1:";

const QR_ID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function createQrPayload(id) {
  return `${QR_PAYLOAD_PREFIX}${id}`;
}

export function findMatchingQrCode(payload, qrCodes, alarmId) {
  if (typeof payload !== "string" || !payload.startsWith(QR_PAYLOAD_PREFIX)) return null;
  const id = payload.slice(QR_PAYLOAD_PREFIX.length);
  if (!QR_ID_PATTERN.test(id)) return null;
  return qrCodes.find((qrCode) => qrCode.id === id && qrCode.alarmId === alarmId) ?? null;
}
