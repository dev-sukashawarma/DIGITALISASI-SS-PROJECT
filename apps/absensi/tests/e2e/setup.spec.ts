import { test, expect } from '@playwright/test';

test('infrastructure setup works', async ({ page }) => {
  // Give it a bit more time for Next.js to compile on the first run
  test.setTimeout(60000);
  
  await page.goto('/');
  await expect(page).toHaveTitle(/Absensi/);
});
