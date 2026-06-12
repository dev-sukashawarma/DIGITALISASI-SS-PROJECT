# Handoff Report: E2E Test Analysis (Tier 1)

## 1. Observation
- **Scope Definition**: `.agents\e2e_orch\SCOPE.md` line 10 assigns "Feature Coverage (Happy Path) tests 1-20" to Tier 1.
- **Test Details**: `TEST_INFRA.md` lines 20-47 details exactly 20 tests grouped into 4 features:
  1. Feature 1: Waiting Screen (tests 1-5)
  2. Feature 2: Auto-Login (tests 6-10)
  3. Feature 3: Dashboard Info (tests 11-15)
  4. Feature 4: Mock Script (tests 16-20)
- **Playwright Setup**: `playwright.config.ts` already exists in the project root. It correctly sets `testDir: './e2e'` and defines a `webServer` block that spins up `npm run dev` at `http://localhost:3000`. The `e2e` folder already exists and contains an `example.spec.ts`.
- **Mock Script**: `mock-attendance.js` exists in the root directory. It takes `process.argv` and executes a fetch POST request to `http://localhost:3000/api/attendance/webhook`.

## 2. Logic Chain
- Since `playwright.config.ts` is fully populated and the `e2e/` folder is present, **Playwright does NOT need to be initialized**.
- Creating `e2e/attendance-tier1.spec.ts` requires translating the 20 requirements directly into Playwright tests. To maintain traceability with `TEST_INFRA.md`, the file should be structured with four `test.describe` blocks corresponding to the four features.
- Tests 1-15 (Features 1-3) focus on the frontend application behavior. The strategy is to use standard Playwright browser automation (`page.goto('/attendance')`, UI assertions).
- To test the Auto-Login and Dashboard (Features 2 & 3), we need to trigger the login event while the browser is waiting on `/attendance`. We can do this from within the Playwright test by directly executing `child_process.execSync('node mock-attendance.js ...')` to emit the webhook and then observe the browser auto-navigating to `/kasir`.
- Tests 16-20 (Feature 4) focus explicitly on the mock script (`mock-attendance.js`). The strategy is to test this purely in Node.js via `child_process.execSync()` within Playwright `test` blocks, asserting on `stdout` and exit codes.

## 3. Caveats
- **Test 4 (Reconnection)**: "Screen correctly handles disconnection/reconnection of Realtime" might require simulating offline behavior in Playwright (e.g., using `context.setOffline(true)`). The exact behavior depends on how Supabase's client handles these network toggles.
- **Supabase/Database state**: The strategy assumes `npm run dev` is sufficient to stand up both the Next.js server and connect to an accessible database. If the webhook requires real Supabase services, the local environment must have them running.

## 4. Conclusion
- **Playwright Initialization**: Not needed. It is fully set up.
- **Recommended Strategy & Plan for `e2e/attendance-tier1.spec.ts`**:
  1. Create the file with four `test.describe` suites named after the four features.
  2. **Feature 1**: Navigate to `/attendance` and assert UI elements (title, waiting indicator, assigned branch).
  3. **Feature 2 & 3**: Use Playwright to load `/attendance`. Then, run `execSync('node mock-attendance.js ...')` (or `page.request.post`) within the test to fire the webhook. Wait for `page.waitForURL('**/kasir')` and assert that session state is set and UI elements (cashier name, branch) are correctly displayed without manual interaction.
  4. **Feature 4**: Write tests utilizing `child_process.execSync` to capture `mock-attendance.js` standard output, verifying formatting, required arguments, and success logging.

## 5. Verification Method
- Upon implementation, run `npx playwright test e2e/attendance-tier1.spec.ts`.
- Check that the test output reports 20 distinct passed tests across the 4 described suites.
- Review `e2e/attendance-tier1.spec.ts` to ensure traceability (e.g. comments or test names referencing "Test 1", "Test 2", etc.).
