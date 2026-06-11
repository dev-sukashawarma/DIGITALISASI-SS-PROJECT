import { test, expect } from '@playwright/test';

test('loads the app and checks login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/login/);
  await expect(page.locator('h1')).toHaveText('Absensi');
});
