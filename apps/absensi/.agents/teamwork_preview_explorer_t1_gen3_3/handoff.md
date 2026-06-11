# Handoff Report: Playwright Setup Fix

## 1. Observation
- 4 facade files (`kiosk.spec.ts`, `realtime.spec.ts`, `spv.spec.ts`, `workload.spec.ts`) were found in `tests/e2e/`.
- The root route `/` in `src/app/page.tsx` redirects directly to `/login`.
- The `/login` page (`src/app/login/page.tsx`) renders a login form with an `<h1>` tag containing the text "Absensi".
- Running `yarn test:e2e` against a generic test pointing to `/` successfully redirects and finds the text "Absensi".

## 2. Logic Chain
- The 4 spec files (`kiosk.spec.ts`, `realtime.spec.ts`, `spv.spec.ts`, `workload.spec.ts`) correspond to features planned for later milestones (T2 and T3). They currently contain identical dummy logic that fails the tests.
- Deleting these files will remove the integrity violation.
- To prove the Playwright infrastructure is working for T1, we should replace them with a single `setup.spec.ts`.
- Since `/` redirects to `/login` natively, the test must expect this redirect and verify that the login page renders successfully.

## 3. Caveats
- Ensure no automated script or CI relies specifically on the existence of `kiosk.spec.ts` in T1.
- No other mock files should be left behind in `tests/e2e/`.

## 4. Conclusion
We must clean up the `tests/e2e/` folder by deleting the 4 facade files. We then create a `setup.spec.ts` that navigates to `/` and asserts the redirect and presence of the `<h1>Absensi</h1>` header.

### Recommended Fix Commands (PowerShell)
```powershell
Remove-Item -Path tests/e2e/kiosk.spec.ts
Remove-Item -Path tests/e2e/realtime.spec.ts
Remove-Item -Path tests/e2e/spv.spec.ts
Remove-Item -Path tests/e2e/workload.spec.ts
```

### Proposed `tests/e2e/setup.spec.ts` Content
```typescript
import { test, expect } from '@playwright/test';

test('App should load and redirect to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/login/);
  await expect(page.locator('h1')).toHaveText('Absensi');
});
```

## 5. Verification Method
- Execute the deletion commands and create the `setup.spec.ts` file as specified.
- Run `yarn test:e2e`. The test runner should report exactly 1 test passed and 0 failures.
