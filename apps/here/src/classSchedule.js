function localDateParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(timestamp);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
    weekday: weekdays[value.weekday],
  };
}

function dateKey({ year, month, day }) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateFromParts({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day));
}

function partsFromDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function weekdayForDate(parts) {
  return dateFromParts(parts).getUTCDay();
}

function zonedDateTimeTimestamp(date, time, timeZone) {
  const [hours, minutes] = time.split(":").map(Number);
  const target = Date.UTC(date.year, date.month - 1, date.day, hours, minutes);
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = localDateParts(timestamp, timeZone);
    const localTimeAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      Number(new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(timestamp)),
      Number(new Intl.DateTimeFormat("en-US", {
        timeZone,
        minute: "2-digit",
      }).format(timestamp)),
    );
    timestamp += target - localTimeAsUtc;
  }
  return timestamp;
}

function sessionIdForDate(classId, date) {
  const input = `${classId}:${dateKey(date)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `s${(hash >>> 0).toString(36)}`;
}

export function selectedMeetingDays(value) {
  if (Array.isArray(value)) return value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (typeof value !== "string" || !value) return [];
  return value.split(",").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function meetingDaysLabel(value) {
  const days = selectedMeetingDays(value);
  if (days.length === 5 && [1, 2, 3, 4, 5].every((day) => days.includes(day))) return "Weekdays";
  return days.map((day) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]).join(", ");
}

export function formatMeetingTime(value) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours < 12 ? "a.m." : "p.m.";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function attendanceSessionForClass(classInfo, now = Date.now()) {
  if (!classInfo?.recurring) return { sessionId: "single", nextMeetingAt: null, clearsAt: null };
  const meetingDays = selectedMeetingDays(classInfo.meetingDays);
  const timeZone = classInfo.timeZone || "UTC";
  if (!meetingDays.length || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(classInfo.meetingTime || "")) {
    return { sessionId: "", nextMeetingAt: null, clearsAt: null };
  }

  const today = localDateParts(now, timeZone);
  let nextMeeting = null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = partsFromDate(new Date(Date.UTC(today.year, today.month - 1, today.day + offset)));
    if (!meetingDays.includes(weekdayForDate(date))) continue;
    const timestamp = zonedDateTimeTimestamp(date, classInfo.meetingTime, timeZone);
    if (timestamp >= now) {
      nextMeeting = { date, timestamp };
      break;
    }
  }
  if (!nextMeeting) return { sessionId: "", nextMeetingAt: null, clearsAt: null };

  const clearsAt = nextMeeting.timestamp - 30 * 60 * 1000;
  if (now >= clearsAt) {
    return {
      sessionId: sessionIdForDate(classInfo.id, nextMeeting.date),
      nextMeetingAt: nextMeeting.timestamp,
      clearsAt,
    };
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const previousDate = partsFromDate(new Date(Date.UTC(
      nextMeeting.date.year,
      nextMeeting.date.month - 1,
      nextMeeting.date.day - offset,
    )));
    if (!meetingDays.includes(weekdayForDate(previousDate))) continue;
    return {
      sessionId: sessionIdForDate(classInfo.id, previousDate),
      nextMeetingAt: nextMeeting.timestamp,
      clearsAt,
    };
  }

  return {
    sessionId: sessionIdForDate(classInfo.id, nextMeeting.date),
    nextMeetingAt: nextMeeting.timestamp,
    clearsAt,
  };
}
