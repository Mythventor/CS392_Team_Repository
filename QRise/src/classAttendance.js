export function classAttendanceStatus(checkedInAt, meetingTime, graceMinutes = 5, timeZone) {
  const timestamp = new Date(checkedInAt);
  const [meetingHours, meetingMinutes] = String(meetingTime ?? "").split(":").map(Number);
  const grace = Number(graceMinutes);
  if (
    Number.isNaN(timestamp.getTime())
    || !Number.isInteger(meetingHours)
    || !Number.isInteger(meetingMinutes)
    || meetingHours < 0
    || meetingHours > 23
    || meetingMinutes < 0
    || meetingMinutes > 59
    || !Number.isFinite(grace)
    || grace < 0
  ) return "Unknown";

  let checkInHours = timestamp.getHours();
  let checkInMinutes = timestamp.getMinutes();
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(timestamp);
      checkInHours = Number(parts.find((part) => part.type === "hour")?.value);
      checkInMinutes = Number(parts.find((part) => part.type === "minute")?.value);
    } catch {
      return "Unknown";
    }
  }

  const checkInTime = checkInHours * 60 + checkInMinutes;
  const meetingTimeMinutes = meetingHours * 60 + meetingMinutes;
  const deadline = meetingTimeMinutes + grace;
  return checkInTime < meetingTimeMinutes || checkInTime <= deadline ? "On time" : "Late";
}
