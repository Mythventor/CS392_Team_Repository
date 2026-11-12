// Pure check-in logic: scheduling, check-in windows, links, and attendance lists.
// Dates and times are interpreted in the device's local timezone.

export const DEFAULT_EVENT = {
  title: "",
  location: "",
  date: "",
  time: "09:00",
  durationMinutes: 60,
  repeatDays: [],
  opensMinutesBefore: 30,
  lateAfterMinutes: 10,
  roster: [],
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function occurrenceStart(event, key) {
  const [hour, minute] = event.time.split(":").map(Number);
  const day = parseDateKey(key);
  day.setHours(hour, minute, 0, 0);
  return day;
}

export function buildOccurrence(event, key, now = new Date()) {
  const start = occurrenceStart(event, key);
  const opensAt = new Date(start.getTime() - event.opensMinutesBefore * 60000);
  const end = new Date(start.getTime() + event.durationMinutes * 60000);
  const lateAt = new Date(start.getTime() + event.lateAfterMinutes * 60000);
  const t = now.getTime();
  const status = t < opensAt.getTime() ? "upcoming" : t <= end.getTime() ? "open" : "ended";
  return { key, start, opensAt, end, lateAt, status };
}

function isOccurrenceDay(event, day) {
  if (dateKey(day) < event.date) return false;
  if (!event.repeatDays.length) return dateKey(day) === event.date;
  return event.repeatDays.includes(day.getDay());
}

// Occurrence keys from `fromKey` onward (inclusive), up to `count` of them.
export function occurrenceKeysFrom(event, fromKey, count) {
  if (!event.repeatDays.length) return event.date >= fromKey ? [event.date] : [];
  const keys = [];
  const day = parseDateKey(fromKey > event.date ? fromKey : event.date);
  for (let i = 0; i < 400 && keys.length < count; i += 1) {
    if (isOccurrenceDay(event, day)) keys.push(dateKey(day));
    day.setDate(day.getDate() + 1);
  }
  return keys;
}

// Most recent occurrence keys strictly before `beforeKey`, newest first.
export function previousOccurrenceKeys(event, beforeKey, count) {
  if (!event.repeatDays.length) return event.date < beforeKey ? [event.date] : [];
  const keys = [];
  const day = parseDateKey(beforeKey);
  for (let i = 0; i < 400 && keys.length < count; i += 1) {
    day.setDate(day.getDate() - 1);
    if (dateKey(day) < event.date) break;
    if (isOccurrenceDay(event, day)) keys.push(dateKey(day));
  }
  return keys;
}

// The occurrence people care about right now: one whose check-in window is open,
// otherwise the next upcoming one, otherwise the most recent one.
export function currentOccurrence(event, now = new Date()) {
  const yesterday = dateKey(new Date(now.getTime() - DAY_MS));
  const candidates = occurrenceKeysFrom(event, yesterday, 9).map((key) => buildOccurrence(event, key, now));
  const open = candidates.find((occurrence) => occurrence.status === "open");
  if (open) return open;
  const next = candidates.find((occurrence) => occurrence.status === "upcoming");
  if (next) return next;
  const lastKey = candidates.at(-1)?.key ?? previousOccurrenceKeys(event, dateKey(now), 1)[0] ?? event.date;
  return buildOccurrence(event, lastKey, now);
}

export function checkInTiming(occurrence, timestamp) {
  return timestamp.getTime() > occurrence.lateAt.getTime() ? "late" : "on-time";
}

export function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function cleanName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 60);
}

export function validateEvent(event) {
  const errors = [];
  if (!cleanName(event.title ?? "")) errors.push("Give the event a name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date ?? "")) errors.push("Choose a start date.");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.time ?? "")) errors.push("Choose a start time.");
  if (!(event.durationMinutes >= 5 && event.durationMinutes <= 24 * 60)) errors.push("Length must be between 5 minutes and 24 hours.");
  if (!(event.opensMinutesBefore >= 0 && event.opensMinutesBefore <= 24 * 60)) errors.push("Check-in must open 0–1440 minutes before the start.");
  if (!(event.lateAfterMinutes >= 0 && event.lateAfterMinutes <= event.durationMinutes)) errors.push("The late cutoff must fall within the event.");
  return errors;
}

// Expected people come from the organizer's roster plus anyone who joined through the
// invite link or checked in. Names are matched case-insensitively.
export function attendance({ event, members, checkins, occurrence }) {
  const forOccurrence = checkins.filter((checkin) => checkin.occurrence === occurrence.key);
  const rosterNames = new Set(event.roster.map((person) => normalizeName(person.name)));
  const present = [];
  const presentNames = new Set();
  const presentUids = new Set();
  for (const checkin of [...forOccurrence].sort((a, b) => a.checkedInAt - b.checkedInAt)) {
    const key = normalizeName(checkin.name);
    if (presentNames.has(key) || (checkin.uid && presentUids.has(checkin.uid))) continue;
    presentNames.add(key);
    if (checkin.uid) presentUids.add(checkin.uid);
    const member = members.find((m) => m.uid === checkin.uid);
    present.push({
      id: checkin.id,
      name: checkin.name,
      checkedInAt: checkin.checkedInAt,
      timing: checkInTiming(occurrence, checkin.checkedInAt),
      manual: Boolean(checkin.manual),
      addedAtCheckIn: !rosterNames.has(key) && member?.source === "checkin",
    });
  }
  const absent = [];
  const seen = new Set();
  for (const person of [
    ...event.roster.map((p) => ({ id: `roster-${p.id}`, name: p.name, source: "roster" })),
    ...members.map((m) => ({ id: `member-${m.uid}`, name: m.name, uid: m.uid, source: m.source })),
  ]) {
    const key = normalizeName(person.name);
    if (seen.has(key)) continue;
    seen.add(key);
    if (presentNames.has(key) || (person.uid && presentUids.has(person.uid))) continue;
    absent.push(person);
  }
  return { present, absent };
}

// Links: scanning the event QR opens `?checkin=<event>&code=<secret>`; the invite link
// is `?event=<event>` and does not let anyone check in.
export function checkInLink(baseUrl, eventId, code) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ checkin: eventId, code }).toString();
  url.hash = "";
  return url.href;
}

export function inviteLink(baseUrl, eventId) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ event: eventId }).toString();
  url.hash = "";
  return url.href;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export function parseCheckInLink(text) {
  try {
    const url = new URL(text);
    const eventId = url.searchParams.get("checkin");
    const code = url.searchParams.get("code");
    if (!eventId || !code || !ID_PATTERN.test(eventId) || !ID_PATTERN.test(code)) return null;
    return { eventId, code };
  } catch {
    return null;
  }
}

export function readRoute(search) {
  const params = new URLSearchParams(search);
  const checkin = params.get("checkin");
  const code = params.get("code");
  if (checkin && code && ID_PATTERN.test(checkin) && ID_PATTERN.test(code)) return { view: "checkin", eventId: checkin, code };
  const event = params.get("event");
  if (event && ID_PATTERN.test(event)) return { view: "invite", eventId: event };
  return null;
}

const PAGES = ["home", "checkin", "alarms", "qr"];

// The app's location in the address bar, so refreshing or using Back keeps you in place.
export function readLocation(search) {
  const route = readRoute(search);
  if (route) return { page: "checkin", route };
  const params = new URLSearchParams(search);
  const manage = params.get("manage");
  if (manage && ID_PATTERN.test(manage)) return { page: "checkin", route: { view: "manage", eventId: manage } };
  const page = params.get("page");
  return { page: PAGES.includes(page) ? page : "home", route: null };
}

export function locationSearch({ page, route }) {
  if (page === "checkin" && route?.view === "manage") return `?${new URLSearchParams({ manage: route.eventId })}`;
  if (page === "checkin" && route?.view === "checkin") return `?${new URLSearchParams({ checkin: route.eventId, code: route.code })}`;
  if (page === "checkin" && route?.view === "invite") return `?${new URLSearchParams({ event: route.eventId })}`;
  return page === "home" ? "" : `?${new URLSearchParams({ page })}`;
}

export function randomId(bytes = 16) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (v) => v.toString(16).padStart(2, "0")).join("");
}
