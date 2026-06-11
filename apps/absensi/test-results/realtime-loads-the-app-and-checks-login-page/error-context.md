# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: realtime.spec.ts >> loads the app and checks login page
- Location: tests\e2e\realtime.spec.ts:3:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*\/login/
Received string:  "http://127.0.0.1:3000/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    13 × unexpected value "http://127.0.0.1:3000/"

```

```yaml
- alert
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 | 
  3 | test('loads the app and checks login page', async ({ page }) => {
  4 |   await page.goto('/');
> 5 |   await expect(page).toHaveURL(/.*\/login/);
    |                      ^ Error: expect(page).toHaveURL(expected) failed
  6 |   await expect(page.locator('h1')).toHaveText('Absensi');
  7 | });
  8 | 
```