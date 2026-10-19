export const QR_MISMATCH_LIMIT = 3;
export const QR_MISMATCH_WINDOW_MS = 5 * 60 * 1000;

export function recordMismatchAttempt(attempts, timestamp) {
  return [
    ...attempts.filter((attempt) => timestamp - attempt < QR_MISMATCH_WINDOW_MS),
    timestamp,
  ];
}
