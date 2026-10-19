import { test, expect } from '@playwright/test';

test('scheduled alarm rings, rejects failed verification and stops only after success', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 19, 6, 59, 50) });
  await page.goto('http://127.0.0.1:5173');
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: AlarmSystem } = await import('/src/alarm-system/AlarmSystem.jsx');
    window.audioStarts = 0;
    window.audioStops = 0;
    const originalStart = AudioBufferSourceNode.prototype.start;
    const originalStop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) { window.audioStarts++; return originalStart.apply(this, args); };
    AudioBufferSourceNode.prototype.stop = function (...args) { window.audioStops++; return originalStop.apply(this, args); };
    let attempt = 0;
    const host = document.createElement('div');
    document.body.append(host);
    ReactDOM.createRoot(host).render(React.createElement(AlarmSystem, {
      alarms: [{ id: 'test', label: 'Test morning', time: '07:00', days: [], enabled: true }, { id: 'second', label: 'Second alarm', time: '07:00', days: [1], enabled: true }],
      onOneShotFired: ids => { window.firedIds = ids; },
      scanAndVerify: async () => { attempt++; if (attempt === 1) throw new Error('Camera unavailable'); return attempt >= 3; },
    }));
  });
  await page.getByRole('button', { name: 'Enable alarm sound' }).last().click();
  await page.clock.runFor(10000);
  const dialog = page.getByRole('dialog', { name: 'Test morning' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.audioStarts)).toBe(1);
  expect(await page.evaluate(() => window.firedIds)).toEqual(['test']);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Scan QR code' }).click();
  await expect(dialog).toContainText('Check camera access');
  await dialog.getByRole('button', { name: 'Scan QR code' }).click();
  await expect(dialog).toContainText('did not match');
  expect(await page.evaluate(() => window.audioStops)).toBe(0);
  await dialog.getByRole('button', { name: 'Scan QR code' }).click();
  await expect(dialog).toHaveCount(0);
  const second = page.getByRole('dialog', { name: 'Second alarm' });
  await expect(second).toBeVisible();
  expect(await page.evaluate(() => window.audioStops)).toBe(0);
  await second.getByRole('button', { name: 'Scan QR code' }).click();
  await expect(second).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.audioStops)).toBe(1);
  await page.clock.runFor(60000);
  await expect(dialog).toHaveCount(0);
});

test('preview connects alarm management to scheduling without a QR bypass', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 19, 6, 59, 50) });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'New alarm' }).click();
  await page.getByLabel('Alarm name').fill('Integration alarm');
  await page.getByLabel('Alarm time').fill('07:00');
  await page.getByRole('button', { name: 'Once', exact: true }).click();
  await page.getByRole('button', { name: 'Save alarm' }).click();
  await page.clock.runFor(10000);
  const dialog = page.getByRole('dialog', { name: 'Integration alarm' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Scan QR code' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Enable Integration alarm' })).not.toBeChecked();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
