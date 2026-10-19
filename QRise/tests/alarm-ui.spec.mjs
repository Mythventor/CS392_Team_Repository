import { test, expect } from '@playwright/test';
test('create, edit, toggle, and delete alarms', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'New alarm' }).click();
  await page.getByLabel('Alarm name').fill('Early start');
  await page.getByLabel('Alarm time').fill('06:30');
  await page.getByRole('button', { name: 'Save alarm' }).click();
  await expect(page.locator('.alarm-card')).toContainText('6:30');
  await expect(page.locator('.alarm-card')).toContainText('Weekdays');
  await page.getByRole('button', { name: 'Edit Early start' }).click();
  await page.getByLabel('Alarm time').fill('08:15');
  await page.getByLabel('Alarm name').fill('Weekend');
  await page.getByRole('button', { name: 'Once', exact: true }).click();
  await page.getByRole('button', { name: 'Sat', exact: true }).click();
  await page.getByRole('button', { name: 'Sun', exact: true }).click();
  await page.getByRole('button', { name: 'Save alarm' }).click();
  await expect(page.locator('.alarm-card')).toContainText('8:15');
  await expect(page.locator('.alarm-card')).toContainText('Weekends');
  await page.getByRole('checkbox', { name: 'Enable Weekend' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Enable Weekend' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Edit Weekend' }).click();
  await expect(page.getByLabel('Enable alarm')).not.toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Delete Weekend' }).click();
  await expect(page.locator('.alarm-card')).toHaveCount(0);
});

test('home navigation, local alarm persistence, and QR setup placeholder work together', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('heading', { name: 'Rise with intention.' })).toBeVisible();
  await page.getByRole('button', { name: 'New alarm' }).click();
  await page.getByLabel('Alarm name').fill('Persisted alarm');
  await page.getByLabel('Alarm time').fill('06:45');
  await page.getByRole('button', { name: 'Save alarm' }).click();

  await page.reload();
  await expect(page.locator('.alarm-card')).toContainText('Persisted alarm');
  await expect(page.locator('.alarm-card')).toContainText('6:45');
  await page.getByRole('button', { name: 'QR code' }).click();
  await expect(page.getByRole('heading', { name: 'Your QR code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'QR setup unavailable' })).toBeDisabled();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Rise with intention.' })).toBeVisible();
  await expect(page.locator('.alarm-card')).toContainText('Persisted alarm');
});

test('storage failures are announced while alarm controls remain usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('Storage unavailable'); },
    });
  });
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('alert')).toContainText('Saved alarms could not be loaded');
  await page.getByRole('button', { name: 'New alarm' }).click();
  await page.getByRole('button', { name: 'Save alarm' }).click();
  await expect(page.locator('.alarm-card')).toContainText('Morning alarm');
  await expect(page.getByRole('alert')).toContainText('could not be saved on this device');
});
