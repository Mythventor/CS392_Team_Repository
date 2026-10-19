import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AlarmScheduler, nextOccurrence } from '../src/alarm-system/scheduler.js';
const alarm = { id: 'a', label: 'Wake up', time: '07:00', days: [], enabled: true };
const date = (day, hour, minute = 0, second = 0) => new Date(2026, 9, day, hour, minute, second);

test('once schedules tomorrow after the time has passed, repeats select the next local weekday', () => {
  assert.equal(nextOccurrence(alarm, date(19, 8)), +date(20, 7));
  assert.equal(nextOccurrence({ ...alarm, days: [1] }, date(19, 8)), +date(26, 7));
  assert.equal(nextOccurrence({ ...alarm, enabled: false }, date(19, 6)), null);
  assert.equal(nextOccurrence({ ...alarm, time: '99:00' }, date(19, 6)), null);
});
test('fires at the boundary exactly once, including after unrelated state updates', () => {
  const scheduler = new AlarmScheduler();
  scheduler.sync([alarm], date(19, 6));
  assert.equal(scheduler.tick(date(19, 6, 59, 59)).length, 0);
  assert.equal(scheduler.tick(date(19, 7)).length, 1);
  scheduler.sync([{ ...alarm, label: 'Renamed' }], date(19, 7));
  assert.equal(scheduler.tick(date(20, 8)).length, 0);
});
test('edits, disabling, deletion and re-enabling update pending schedules', () => {
  const scheduler = new AlarmScheduler();
  scheduler.sync([alarm], date(19, 6));
  scheduler.sync([{ ...alarm, time: '08:00' }], date(19, 6));
  assert.equal(scheduler.tick(date(19, 7)).length, 0);
  scheduler.sync([{ ...alarm, enabled: false }], date(19, 7));
  assert.equal(scheduler.tick(date(19, 8)).length, 0);
  scheduler.sync([alarm], date(19, 8));
  assert.equal(scheduler.tick(date(20, 7)).length, 1);
  scheduler.sync([], date(20, 8));
  assert.equal(scheduler.entries.size, 0);
});
test('delayed ticks catch up, simultaneous alarms survive and repeating alarms recur', () => {
  const scheduler = new AlarmScheduler();
  scheduler.sync([alarm, { ...alarm, id: 'b', days: [1, 2] }], date(19, 6));
  assert.equal(scheduler.tick(date(19, 9)).length, 2);
  assert.equal(scheduler.tick(date(19, 10)).length, 0);
  assert.deepEqual(scheduler.tick(date(20, 7)).map(item => item.id), ['b']);
});
