export const ALARMS_STORAGE_KEY = "qrise.alarms";

function isAlarm(value) {
  return value !== null
    && typeof value === "object"
    && typeof value.id === "string"
    && typeof value.label === "string"
    && typeof value.time === "string"
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    && Array.isArray(value.days)
    && value.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && typeof value.enabled === "boolean";
}

export function readAlarms(storage = window.localStorage) {
  const serialized = storage.getItem(ALARMS_STORAGE_KEY);
  if (serialized === null) return [];

  let value;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    throw new Error("Saved alarms contain invalid JSON.", { cause: error });
  }
  if (!Array.isArray(value) || !value.every(isAlarm)) {
    throw new Error("Saved alarms do not match the expected format.");
  }
  return value;
}

export function writeAlarms(alarms, storage = window.localStorage) {
  storage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(alarms));
}
