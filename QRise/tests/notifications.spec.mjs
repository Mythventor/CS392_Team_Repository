import { test, expect } from '@playwright/test';

const alarm = { id: 'notify', label: 'Notify me', time: '07:00', days: [], enabled: true };

test('notifications can be turned on from the app', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toBeVisible();
  await expect(page.getByText('Turn on notifications to be alerted')).toBeVisible();
});

test('a ringing alarm shows a system notification while QRise is open in the browser', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await page.clock.install({ time: new Date(2026, 9, 19, 6, 59, 50) });
  await page.addInitScript(a => {
    localStorage.setItem('qrise.alarms', JSON.stringify([a]));
    window.shownNotifications = [];
    const original = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
      window.shownNotifications.push([title, options.tag, options.requireInteraction]);
      return original.call(this, title, options).catch(() => {});
    };
  }, alarm);
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByText('Notifications are on.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable notifications' })).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration()))).toBe(true);
  await page.clock.runFor(10000);
  await expect(page.getByRole('dialog', { name: 'Notify me' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.shownNotifications.length)).toBe(1);
  const [[title, tag, persistent]] = await page.evaluate(() => window.shownNotifications);
  expect(title).toBe('⏰ Notify me');
  expect(tag).toMatch(/^qrise-alarm-notify/);
  expect(persistent).toBe(true);
});
