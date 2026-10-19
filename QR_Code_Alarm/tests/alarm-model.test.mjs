import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayTime, repeatLabel } from '../src/alarms/model.js';
test('midnight and noon are formatted correctly', () => {
  assert.deepEqual(displayTime('00:05'), { clock: '12:05', period: 'AM' });
  assert.deepEqual(displayTime('12:00'), { clock: '12:00', period: 'PM' });
});
test('repeat days have clear labels', () => {
  assert.equal(repeatLabel([]), 'Once');
  assert.equal(repeatLabel([1, 2, 3, 4, 5]), 'Weekdays');
  assert.equal(repeatLabel([0, 6]), 'Weekends');
  assert.equal(repeatLabel([0, 1, 2, 3, 4, 5, 6]), 'Every day');
  assert.equal(repeatLabel([3, 1]), 'Mon, Wed');
});
