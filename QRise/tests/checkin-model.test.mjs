import test from "node:test";
import assert from "node:assert/strict";
import {
  attendance,
  buildOccurrence,
  checkInLink,
  currentOccurrence,
  inviteLink,
  occurrenceKeysFrom,
  parseCheckInLink,
  previousOccurrenceKeys,
  readRoute,
  validateEvent,
} from "../src/checkin/model.js";

const base = {
  title: "CS392 lecture", location: "", date: "2026-10-26", time: "09:00", durationMinutes: 60,
  repeatDays: [], opensMinutesBefore: 30, lateAfterMinutes: 10, roster: [],
};
const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);

test("a one-time event is upcoming, then open from 30 minutes before until it ends, then ended", () => {
  assert.equal(currentOccurrence(base, at(2026, 10, 26, 8, 0)).status, "upcoming");
  assert.equal(currentOccurrence(base, at(2026, 10, 26, 8, 30)).status, "open");
  assert.equal(currentOccurrence(base, at(2026, 10, 26, 10, 0)).status, "open");
  const after = currentOccurrence(base, at(2026, 10, 27, 12, 0));
  assert.equal(after.status, "ended");
  assert.equal(after.key, "2026-10-26");
});

test("events can be scheduled ahead and repeat on chosen weekdays", () => {
  const weekly = { ...base, date: "2026-11-02", repeatDays: [1, 3] }; // Mon & Wed from Mon Nov 2
  assert.deepEqual(occurrenceKeysFrom(weekly, "2026-10-28", 4), ["2026-11-02", "2026-11-04", "2026-11-09", "2026-11-11"]);
  const now = at(2026, 10, 28, 12);
  const next = currentOccurrence(weekly, now);
  assert.equal(next.key, "2026-11-02");
  assert.equal(next.status, "upcoming");
  assert.deepEqual(previousOccurrenceKeys(weekly, "2026-11-11", 5), ["2026-11-09", "2026-11-04", "2026-11-02"]);
});

test("a repeating event moves to the next date after today's ends, and changing the time reschedules", () => {
  const daily = { ...base, repeatDays: [0, 1, 2, 3, 4, 5, 6] };
  assert.equal(currentOccurrence(daily, at(2026, 10, 27, 11)).key, "2026-10-28");
  assert.equal(currentOccurrence({ ...daily, time: "13:00" }, at(2026, 10, 27, 11)).key, "2026-10-27");
});

test("check-ins after the late cutoff are marked late; roster, invitees, and walk-ins are merged", () => {
  const event = { ...base, roster: [{ id: "r1", name: "Ana Lee" }, { id: "r2", name: "Ben" }, { id: "r3", name: "Cara" }] };
  const occurrence = buildOccurrence(event, "2026-10-26", at(2026, 10, 26, 9, 30));
  const members = [
    { uid: "u-ana", name: "ana lee", source: "checkin" },
    { uid: "u-dev", name: "Dev", source: "invite" },
    { uid: "u-eli", name: "Eli", source: "checkin" },
  ];
  const checkins = [
    { id: "c1", uid: "u-ana", name: "ana lee", occurrence: "2026-10-26", checkedInAt: at(2026, 10, 26, 8, 55) },
    { id: "c2", uid: "u-eli", name: "Eli", occurrence: "2026-10-26", checkedInAt: at(2026, 10, 26, 9, 12) },
    { id: "c3", uid: null, name: "Ben", manual: true, occurrence: "2026-10-26", checkedInAt: at(2026, 10, 26, 9, 5) },
    { id: "old", uid: "u-dev", name: "Dev", occurrence: "2026-10-19", checkedInAt: at(2026, 10, 19, 9) },
  ];
  const { present, absent } = attendance({ event, members, checkins, occurrence });
  assert.deepEqual(present.map((p) => [p.name, p.timing, p.addedAtCheckIn, p.manual]), [
    ["ana lee", "on-time", false, false],
    ["Ben", "on-time", false, true],
    ["Eli", "late", true, false],
  ]);
  assert.deepEqual(absent.map((p) => p.name), ["Cara", "Dev"]);
});

test("check-in and invite links round-trip, and malformed links are rejected", () => {
  const link = checkInLink("https://qrise-cs392.web.app/", "evt123abc", "code456def789");
  assert.deepEqual(parseCheckInLink(link), { eventId: "evt123abc", code: "code456def789" });
  assert.deepEqual(readRoute(new URL(link).search), { view: "checkin", eventId: "evt123abc", code: "code456def789" });
  assert.deepEqual(readRoute(new URL(inviteLink("https://qrise-cs392.web.app/", "evt123abc")).search), { view: "invite", eventId: "evt123abc" });
  assert.equal(parseCheckInLink("qrise:alarm:v1:3f2b8c1e-9a4d-4e6b-8c2a-1d5e7f9a0b3c"), null);
  assert.equal(parseCheckInLink("https://example.com/?checkin=../x&code=1"), null);
  assert.equal(readRoute("?event=<script>"), null);
});

test("event validation catches missing names and impossible timings", () => {
  assert.deepEqual(validateEvent(base), []);
  assert.equal(validateEvent({ ...base, title: "  " }).length, 1);
  assert.equal(validateEvent({ ...base, lateAfterMinutes: 90 }).length, 1);
  assert.equal(validateEvent({ ...base, durationMinutes: 2, lateAfterMinutes: 0 }).length, 1);
});
