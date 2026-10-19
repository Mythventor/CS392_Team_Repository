// Local wall-clock schedules. A missed tick rings on resume rather than being lost.
export function nextOccurrence(alarm, after) {
  if (!alarm.enabled || !/^([01]\d|2[0-3]):[0-5]\d$/.test(alarm.time)) return null;
  const [hour, minute] = alarm.time.split(':').map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(after);
    date.setDate(date.getDate() + offset);
    date.setHours(hour, minute, 0, 0);
    if (date > after && (!alarm.days.length || alarm.days.includes(date.getDay()))) return date.getTime();
  }
  return null;
}

export class AlarmScheduler {
  entries = new Map();
  sync(alarms, now) {
    const enabled = new Set();
    for (const alarm of alarms.filter(item => item.enabled)) {
      enabled.add(alarm.id);
      const signature = JSON.stringify([alarm.time, [...alarm.days].sort()]);
      const existing = this.entries.get(alarm.id);
      this.entries.set(alarm.id, existing?.signature === signature
        ? { ...existing, alarm: { ...alarm } }
        : { signature, alarm: { ...alarm }, due: nextOccurrence(alarm, now) });
    }
    for (const id of this.entries.keys()) if (!enabled.has(id)) this.entries.delete(id);
  }
  tick(now) {
    const due = [];
    for (const entry of this.entries.values()) {
      if (entry.due !== null && entry.due <= now.getTime()) {
        due.push({ ...entry.alarm, occurrenceId: `${entry.alarm.id}:${entry.due}` });
        // Coalesce missed repeat days into one ring; one-shot stays consumed until re-enabled.
        entry.due = entry.alarm.days.length ? nextOccurrence(entry.alarm, now) : null;
      }
    }
    return due;
  }
}
