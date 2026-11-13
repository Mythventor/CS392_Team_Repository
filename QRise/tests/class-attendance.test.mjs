import test from "node:test";
import assert from "node:assert/strict";
import { classAttendanceStatus } from "../src/classAttendance.js";

test("class check-ins are on time through the configured grace period", () => {
  const atMeetingTime = new Date(2026, 10, 12, 9, 0).getTime();
  const atGraceDeadline = new Date(2026, 10, 12, 9, 5).getTime();
  const afterGrace = new Date(2026, 10, 12, 9, 6).getTime();

  assert.equal(classAttendanceStatus(atMeetingTime, "09:00", 5), "On time");
  assert.equal(classAttendanceStatus(atGraceDeadline, "09:00", 5), "On time");
  assert.equal(classAttendanceStatus(afterGrace, "09:00", 5), "Late");
});

test("class check-ins can have no grace period", () => {
  const atMeetingTime = new Date(2026, 10, 12, 9, 0).getTime();
  const afterMeetingTime = new Date(2026, 10, 12, 9, 1).getTime();

  assert.equal(classAttendanceStatus(atMeetingTime, "09:00", 0), "On time");
  assert.equal(classAttendanceStatus(afterMeetingTime, "09:00", 0), "Late");
});

test("class check-in timing uses the class time zone", () => {
  const atDeadlineInChicago = Date.parse("2026-11-12T15:05:00Z");
  const afterDeadlineInChicago = Date.parse("2026-11-12T15:06:00Z");

  assert.equal(classAttendanceStatus(atDeadlineInChicago, "09:00", 5, "America/Chicago"), "On time");
  assert.equal(classAttendanceStatus(afterDeadlineInChicago, "09:00", 5, "America/Chicago"), "Late");
});

test("invalid attendance timestamps or class meeting times are reported as unknown", () => {
  assert.equal(classAttendanceStatus("not a timestamp", "09:00", 5), "Unknown");
  assert.equal(classAttendanceStatus(Date.now(), "25:00", 5), "Unknown");
  assert.equal(classAttendanceStatus(Date.now(), "09:00", 5, "Invalid/Zone"), "Unknown");
});
