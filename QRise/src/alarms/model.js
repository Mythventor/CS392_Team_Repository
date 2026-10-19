export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function repeatLabel(days) {
  if (!days.length) return "Once";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day)))
    return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6))
    return "Weekends";
  return DAY_ORDER.filter((day) => days.includes(day))
    .map((day) => DAYS[day])
    .join(", ");
}

export function displayTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  return {
    clock: `${hour % 12 || 12}:${String(minute).padStart(2, "0")}`,
    period: hour < 12 ? "AM" : "PM",
  };
}

