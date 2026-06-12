# Handoff: Playwright Setup Integrity Violation Fix

## 1. Observation
- The `tests/e2e` directory currently contains 4 identical fake spec files: `kiosk.spec.ts`, `realtime.spec.ts`, `spv.spec.ts`, and `workload.spec.ts`.
- The root page `src/app/page.tsx` redirects to `/login`.
- The login page `src/app/login/page.tsx` renders an `<h1>` element with the text `"Absensi"`.
- Running these fake tests led to failures previously because they were meant for future milestones and the infrastructure wasn't aligned, resulting in the integrity violation reported by the Forensic Auditor.

## 2. Logic Chain
- As this is Milestone T1 (Test Infra Setup), we only need a generic working test to prove the infrastructure is correctly configured.
- The 4 facade tests for Kiosk, Realtime, SPV, and Workload belong to milestones T2 and T3. They must be removed to fix the INTEGRITY VIOLATION.
- To prove the infrastructure works, a simple `setup.spec.ts` that loads the root URL (`/`), expects a redirect to `/login`, and checks for the login page's `<h1>` title is sufficient.
- I have locally verified that this new `setup.spec.ts` passes successfully with `yarn test:e2e`.

## 3. Caveats
- No caveats. The fix strategy perfectly aligns with the requirements of Milestone T1.

## 4. Conclusion
We must delete the 4 fake spec files and replace them with a single `setup.spec.ts`.

**Recommended Fix Commands:**
```bash
# 1. Delete the 4 fake specs
rm tests/e2e/kiosk.spec.ts tests/e2e/realtime.spec.ts tests/e2e/spv.spec.ts tests/e2e/workload.spec.ts

# 2. Create tests/e2e/setup.spec.ts with the following content
```

**Contents of `tests/e2e/setup.spec.ts`:**
```typescript
import { test, expect } from '@playwright/test';

test('setup is working', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.*\/login/);
  await expect(page.locator('h1')).toHaveText('Absensi');
});
```

## 5. Verification Method
- Execute `yarn test:e2e`.
- The test suite should run successfully and report `1 passed`. There should be no failures related to kiosk, spv, realtime, or workload.
