# E2E Test Analysis (Tier 1) Handoff

## 1. Observation
- `SCOPE.md` lines 18-23 specifies the target file layout: `e2e/attendance-tier1.spec.ts` for Tier 1 tests.
- `TEST_INFRA.md` lines 20-48 lists the 20 tests for Tier 1, divided across 4 features:
  - **Feature 1 (Tests 1-5):** Waiting Screen UI and Supabase Realtime connection.
  - **Feature 2 (Tests 6-10):** Auto-Login transitions via valid mock event.
  - **Feature 3 (Tests 11-15):** Dashboard UI correctly extracting payload data.
  - **Feature 4 (Tests 16-20):** Mock script CLI execution, argument parsing, payload formatting, and successful POST.
- Playwright is fully configured:
  - `package.json` contains `@playwright/test` (`^1.49.0`) in `devDependencies`.
  - `playwright.config.ts` exists at the project root, configured with `testDir: './e2e'` and a `webServer` block for Next.js (`npm run dev` at `http://localhost:3000`).

## 2. Logic Chain
1. Because `playwright.config.ts` and the dependency are already present, **no Playwright initialization (`npx playwright init`) is needed**.
2. To provide structured and readable tests, `e2e/attendance-tier1.spec.ts` should be organized using `test.describe` blocks for each of the 4 features.
3. For **Feature 1**, standard UI assertions (`page.goto('/attendance')`) will cover basic tests. Testing Realtime reconnection (Test 4) will likely require toggling the network state using Playwright's `context.setOffline()`.
4. For **Features 2 & 3**, the tests must simulate the external POS system sending data. The cleanest approach within Playwright is to open a browser page to `/attendance`, then use `request.post()` (Playwright's APIRequestContext) to fire the webhook payload directly. The test then observes the browser for the automatic redirect to `/kasir` and validates the dashboard text (cashier/branch name).
5. For **Feature 4**, the tests evaluate a "Mock Script" (CLI tool). The test block will need to use Node's `child_process.exec` to run the script file, pass arguments, verify `stdout` for success logs, and verify it exits without errors.

## 3. Caveats
- The exact name and location of the "Mock Script" (Feature 4) and the webhook endpoint path are not detailed in `TEST_INFRA.md`. The implementer will need to find them (e.g., in `scripts/` and `app/api/`) before writing the code.
- Checking Supabase Realtime connection statuses (Test 2) may require intercepting websockets (`page.on('websocket')`) or looking for specific UI connection indicators, depending on what the app renders.

## 4. Conclusion
Playwright is fully initialized. The recommended strategy for `e2e/attendance-tier1.spec.ts` is to group the 20 tests into 4 feature blocks:
- **Suite 1 (F1):** Page navigations, UI assertions, and offline/online toggling for the `/attendance` page.
- **Suite 2 & 3 (F2/F3):** Navigate to `/attendance`, trigger the webhook via `request.post()`, and assert automatic navigation to `/kasir` and correct UI state (names shown, login hidden).
- **Suite 4 (F4):** Use `child_process.exec` within the test to invoke the external mock script with arguments and assert on its standard output/exit code.

## 5. Verification Method
- **To verify initialization:** Run `npx playwright test --list` from the project root; it should execute without configuration errors.
- **To verify the spec file structure:** Check `e2e/attendance-tier1.spec.ts` once implemented to ensure it contains 4 `describe` blocks and 20 distinct `test` cases matching `TEST_INFRA.md`.
