# Tier 1 Tests - E2E Analysis & Strategy

## 1. Observation
- `SCOPE.md` assigns Tier 1 Tests (tests 1-20) to `e2e/attendance-tier1.spec.ts`.
- `TEST_INFRA.md` details 20 tests across 4 features (Feature 1: Waiting Screen, Feature 2: Auto-Login, Feature 3: Dashboard Info, Feature 4: Mock Script).
- Playwright is already initialized. `package.json` contains `@playwright/test` and `playwright.config.ts` is fully configured with a `webServer` block pointing to `npm run dev` on `http://localhost:3000`.
- The mock script `mock-attendance.js` is present in the root directory. It accepts arguments via `process.argv` and sends a POST request to `http://localhost:3000/api/attendance/webhook`.

## 2. Logic Chain
1. **Playwright Initialization**: Since `playwright.config.ts` and `@playwright/test` are present, Playwright is ready. No `npm init playwright@latest` is needed.
2. **Feature 1 (Waiting Screen - Tests 1-5)**: Requires UI assertions on `/attendance`. Connecting/disconnecting from Realtime can be tested by using `context.setOffline(true)`.
3. **Feature 2 (Auto-Login - Tests 6-10)**: Can be validated by opening the `/attendance` page, then simulating the webhook event using Playwright's `request` API (`request.post`), then verifying the page naturally redirects to `/kasir`.
4. **Feature 3 (Dashboard Info - Tests 11-15)**: Follows immediately after Feature 2. Once redirected to `/kasir`, test assertions can read elements off the page to confirm cashier and branch name, and verify absence of login state UI.
5. **Feature 4 (Mock Script - Tests 16-20)**: Requires executing `mock-attendance.js` directly. Since Playwright runs in a Node environment, we can use `child_process.execSync` inside a `test()` block to run the file, pass arguments, and verify its `stdout` logging and exit code.

## 3. Caveats
- Feature 1 requires testing Supabase Realtime channel connections. Playwright can observe WebSockets in the Network tab (`page.on('websocket', ...)`), but exact implementations of the `supabase` client may dictate how to reliably intercept these.
- Feature 1 Test 5 ("Screen displays the specific branch it is assigned to") might depend on pre-seeded database data or a local storage/URL parameter. The exact method the branch is assigned isn't clear from the opaque-box spec and may require looking at the actual app implementation if the test fails.
- The `webServer` spins up `npm run dev` against the real or local Supabase. If the tests mutate state, it could cause flaky tests across test runs unless the database is reset. 

## 4. Conclusion
- **Playwright Status**: Fully initialized and ready.
- **Implementation Plan for `e2e/attendance-tier1.spec.ts`**:
  - Group the 20 tests into 4 `test.describe` blocks matching the 4 features.
  - **F1**: Navigate to `/attendance`, check DOM visibility, intercept WebSocket for connection state, toggle `context.setOffline()` to test reconnect logic.
  - **F2 & F3**: These should ideally be sequential or tested together since F3 relies on the successful login of F2. Navigate to `/attendance`, use Playwright's `APIRequestContext` to `POST` to `/api/attendance/webhook`, `await page.waitForURL('**/kasir')`, and then assert the dashboard UI elements.
  - **F4**: Use `import { execSync } from 'child_process'` to test `mock-attendance.js` execution and its stdout outputs.

## 5. Verification Method
- **Implementation verification**: Create the file `e2e/attendance-tier1.spec.ts`.
- **Test Command**: Run `npx playwright test e2e/attendance-tier1.spec.ts`.
- **Invalidation**: If tests fail due to missing data, we will need to inject mock data or adjust how Playwright setups the environment before tests.
