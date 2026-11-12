import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alarmNotificationTag,
  closeAlarmNotifications,
  notificationPermission,
  requestNotificationPermission,
  showAlarmNotification,
} from '../src/alarm-system/notifications.js';

function fakeWindow(permission, requestResult = permission) {
  const shown = [];
  const open = [];
  const registration = {
    async showNotification(title, options) {
      shown.push({ title, options });
      open.push({ tag: options.tag, closed: false, close() { this.closed = true; } });
    },
    async getNotifications() { return open; },
  };
  let registered = null;
  function Notification() {}
  Notification.permission = permission;
  Notification.requestPermission = async () => requestResult;
  return {
    shown, open,
    get registered() { return registered; },
    Notification,
    document: { baseURI: 'https://qrise.example/app/' },
    navigator: {
      serviceWorker: {
        async register(url) { registered = url; return registration; },
        async getRegistration() { return registered ? registration : undefined; },
      },
    },
  };
}

const alarm = { id: 'a1', occurrenceId: 'a1@2026-10-28T07:30', label: 'Morning class', time: '07:30', days: [1] };

test('notifications report unsupported browsers without throwing', async () => {
  assert.equal(notificationPermission({ navigator: {} }), 'unsupported');
  assert.equal(await requestNotificationPermission({ navigator: {} }), 'unsupported');
  assert.equal(await showAlarmNotification(alarm, '7:30 AM', { navigator: {} }), false);
});

test('granting permission registers the service worker relative to the app base path', async () => {
  const win = fakeWindow('default', 'granted');
  assert.equal(await requestNotificationPermission(win), 'granted');
  assert.equal(win.registered, 'https://qrise.example/app/sw.js');
});

test('denied permission shows no notification', async () => {
  const win = fakeWindow('denied');
  assert.equal(await showAlarmNotification(alarm, '7:30 AM', win), false);
  assert.equal(win.shown.length, 0);
});

test('a ringing alarm shows a persistent notification tagged by occurrence, closed after dismissal', async () => {
  const win = fakeWindow('granted');
  assert.equal(await showAlarmNotification(alarm, '7:30 AM', win), true);
  const [{ title, options }] = win.shown;
  assert.equal(title, '⏰ Morning class');
  assert.match(options.body, /7:30 AM/);
  assert.equal(options.tag, alarmNotificationTag(alarm));
  assert.equal(options.requireInteraction, true);
  win.open.push({ tag: 'other-app', closed: false, close() { this.closed = true; } });
  await closeAlarmNotifications(win);
  assert.deepEqual(win.open.map(n => n.closed), [true, false]);
});
