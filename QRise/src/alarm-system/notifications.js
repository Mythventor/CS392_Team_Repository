// Browser notifications for ringing alarms.
// Notifications are shown through the service worker registration because mobile
// Chrome does not allow `new Notification()` from a page. They only appear while the
// browser is still running QRise (for example in a background tab); a web app cannot
// wake a phone that is locked or a browser that is closed.

export const NOTIFICATION_TAG_PREFIX = 'qrise-alarm-';

export function notificationsSupported(win = globalThis) {
  return typeof win.Notification === 'function' && 'serviceWorker' in (win.navigator ?? {});
}

export function notificationPermission(win = globalThis) {
  return notificationsSupported(win) ? win.Notification.permission : 'unsupported';
}

export async function registerNotificationWorker(win = globalThis) {
  if (!notificationsSupported(win)) return null;
  const base = win.document?.baseURI ?? '/';
  return win.navigator.serviceWorker.register(new URL('sw.js', base).href);
}

export async function requestNotificationPermission(win = globalThis) {
  if (!notificationsSupported(win)) return 'unsupported';
  const permission = await win.Notification.requestPermission();
  if (permission === 'granted') await registerNotificationWorker(win);
  return permission;
}

export function alarmNotificationTag(alarm) {
  return NOTIFICATION_TAG_PREFIX + (alarm.occurrenceId ?? alarm.id);
}

export function alarmNotificationOptions(alarm, clock) {
  return {
    body: `${clock} · Open QRise and scan your QR code to turn it off.`,
    tag: alarmNotificationTag(alarm),
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 400],
    icon: 'favicon.svg',
    badge: 'favicon.svg',
    data: { alarmId: alarm.id },
  };
}

async function readyRegistration(win) {
  return (await win.navigator.serviceWorker.getRegistration()) ?? registerNotificationWorker(win);
}

export async function showAlarmNotification(alarm, clock, win = globalThis) {
  if (notificationPermission(win) !== 'granted') return false;
  const registration = await readyRegistration(win);
  if (!registration) return false;
  await registration.showNotification(`⏰ ${alarm.label}`, alarmNotificationOptions(alarm, clock));
  return true;
}

export async function closeAlarmNotifications(win = globalThis) {
  if (notificationPermission(win) !== 'granted') return;
  const registration = await win.navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const open = await registration.getNotifications();
  open.filter(n => n.tag?.startsWith(NOTIFICATION_TAG_PREFIX)).forEach(n => n.close());
}
