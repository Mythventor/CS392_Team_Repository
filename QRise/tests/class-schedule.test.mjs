import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceSessionForClass,
  formatMeetingTime,
  meetingDaysLabel,
  selectedMeetingDays,
} from "../src/classSchedule.js";

test("recurring sessions switch exactly 30 minutes before the next meeting", () => {
  const classInfo = {
    id: "math",
    recurring: true,
    meetingDays: "1",
    meetingTime: "09:00",
    timeZone: "America/New_York",
  };

  const beforeCutoff = attendanceSessionForClass(classInfo, Date.parse("2026-03-09T12:29:59Z"));
  const atCutoff = attendanceSessionForClass(classInfo, Date.parse("2026-03-09T12:30:00Z"));
  const afterCutoff = attendanceSessionForClass(classInfo, Date.parse("2026-03-09T12:30:01Z"));

  assert.notEqual(beforeCutoff.sessionId, atCutoff.sessionId);
  assert.equal(atCutoff.sessionId, afterCutoff.sessionId);
  assert.equal(atCutoff.nextMeetingAt, Date.parse("2026-03-09T13:00:00Z"));
  assert.equal(beforeCutoff.nextMeetingAt, atCutoff.nextMeetingAt);
});

test("recurring sessions select the next configured weekday in the class timezone", () => {
  const classInfo = {
    id: "science",
    recurring: true,
    meetingDays: "3,6",
    meetingTime: "09:00",
    timeZone: "America/Los_Angeles",
  };

  const beforeSaturdayCutoff = attendanceSessionForClass(classInfo, Date.parse("2026-01-10T16:29:59Z"));
  const atSaturdayCutoff = attendanceSessionForClass(classInfo, Date.parse("2026-01-10T16:30:00Z"));

  assert.notEqual(beforeSaturdayCutoff.sessionId, atSaturdayCutoff.sessionId);
  assert.equal(atSaturdayCutoff.nextMeetingAt, Date.parse("2026-01-10T17:00:00Z"));
});

test("recurring meeting times follow daylight-saving changes in the class timezone", () => {
  const classInfo = {
    id: "history",
    recurring: true,
    meetingDays: "1",
    meetingTime: "09:00",
    timeZone: "America/New_York",
  };

  const beforeMeeting = attendanceSessionForClass(classInfo, Date.parse("2026-11-02T13:29:59Z"));
  const atCutoff = attendanceSessionForClass(classInfo, Date.parse("2026-11-02T13:30:00Z"));

  assert.notEqual(beforeMeeting.sessionId, atCutoff.sessionId);
  assert.equal(atCutoff.nextMeetingAt, Date.parse("2026-11-02T14:00:00Z"));
});

test("single-meeting classes and invalid recurring schedules are handled", () => {
  assert.deepEqual(
    attendanceSessionForClass({ recurring: false }),
    { sessionId: "single", nextMeetingAt: null, clearsAt: null },
  );
  assert.equal(attendanceSessionForClass({
    id: "invalid",
    recurring: true,
    meetingDays: "",
    meetingTime: "09:00",
    timeZone: "UTC",
  }).sessionId, "");
  assert.deepEqual(selectedMeetingDays("1,3,6"), [1, 3, 6]);
  assert.equal(meetingDaysLabel("1,2,3,4,5"), "Weekdays");
  assert.equal(meetingDaysLabel("1,3,5"), "Monday, Wednesday, Friday");
  assert.equal(formatMeetingTime("09:05"), "9:05 a.m.");
  assert.equal(formatMeetingTime("13:00"), "1:00 p.m.");
});
