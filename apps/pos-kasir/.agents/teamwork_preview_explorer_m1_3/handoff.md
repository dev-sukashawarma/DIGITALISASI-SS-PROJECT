# Observation
- The project is a Next.js application with `vitest` currently set up for node environment testing, but it lacks an E2E testing framework.
- The requirements in `ORIGINAL_REQUEST.md` and `PROJECT.md` detail an integration flow where a facial recognition event triggers a webhook (`/api/attendance/webhook`), broadcasting an event to a waiting screen (`/attendance`), which auto-logs the user in and redirects to the dashboard (`/kasir`).
- The project runs on Windows and uses npm.

# Logic Chain
1. Since the attendance flow requires real browser interaction, including WebSocket connections (Supabase Realtime) and page navigation/redirection, opaque-box E2E testing via Playwright is the best fit.
2. Playwright should be configured to run tests in an isolated environment (`e2e` directory) to avoid cluttering `tests` which is currently used by Vitest.
3. The Playwright configuration needs to start the Next.js development server automatically for tests to be truly opaque-box.
4. The `TEST_INFRA.md` must clearly map the user requirements (waiting screen, mock trigger, auto-login, dashboard state) into concrete E2E scenarios.

# Caveats
- Since the facial recognition system is a mock script, E2E tests will need to execute this script (or call the webhook directly) during the test run to trigger the flow.
- Ensure the Supabase project is running locally or configured correctly in the test environment so Realtime and Auth features function.

# Conclusion
The project should install `@playwright/test` and create a dedicated configuration `playwright.config.ts`. The Test Infra should focus on validating the whole roundtrip: page load -> webhook trigger -> realtime broadcast -> auto-login -> dashboard display.

# Verification Method
1. Run the installation commands provided.
2. Place the `TEST_INFRA.md` content in the root directory.
3. Verify that `npx playwright test` can be executed once tests are implemented based on the infrastructure document.

---

## Commands to Install and Configure Playwright

Run the following commands in the project root (`c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir`):

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

Create `playwright.config.ts` in the project root:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Proposed Content for TEST_INFRA.md

```markdown
# Test Infrastructure Architecture

## Test Philosophy
We employ opaque-box End-to-End (E2E) testing to validate the POS Attendance Integration from a user's perspective. The tests will interact with the application solely through the browser UI and public API endpoints. We avoid mocking internal states or components, ensuring that the integration between the Next.js frontend, the webhook API, and Supabase Auth/Realtime works together precisely as it will in production.

## Feature Inventory
1. **Attendance Waiting Screen (`/attendance`)**: Listens for check-in events.
2. **Webhook API (`/api/attendance/webhook`)**: Receives events from the external (or mock) system and broadcasts them.
3. **Auto-Login Mechanism**: Authenticates the cashier based on the broadcasted event payload.
4. **Cashier Dashboard (`/kasir`)**: Displays the logged-in cashier's name and branch.
5. **Mock Event Trigger (`mock-attendance.js`)**: Simulates external system requests.

## Test Architecture
- **Framework**: Playwright (`@playwright/test`)
- **Directory**: `e2e/` (separated from Vitest unit tests in `tests/`)
- **Environment**: Next.js development server started automatically via Playwright's `webServer` configuration.
- **Execution**: Tests run against a local Chromium browser instance.
- **Triggers**: E2E tests will programmatically call the `/api/attendance/webhook` (acting as `mock-attendance.js`) to trigger the real-time broadcast and observe the UI's reaction.

## Real-World Scenarios (Tier 4)
1. **Successful Auto-Login (Happy Path)**
   - **Action**: User opens `/attendance`. Test triggers the webhook with valid credentials and payload.
   - **Expected**: Browser automatically redirects to `/kasir`. The dashboard prominently displays the correct cashier name and branch from the payload.
2. **Invalid Credentials (Sad Path)**
   - **Action**: User opens `/attendance`. Test triggers the webhook with invalid credentials.
   - **Expected**: System fails to authenticate. User remains on `/attendance`, and an appropriate error message is displayed.
3. **Unauthorized Access Protection**
   - **Action**: Unauthenticated user attempts to visit `/kasir` directly.
   - **Expected**: User is redirected back to the `/attendance` or login screen.
4. **Multiple Branch Isolation**
   - **Action**: Two separate browsers open `/attendance` configured for different branches (if applicable). Test triggers a check-in for Branch A.
   - **Expected**: Only the browser for Branch A auto-logs in. Branch B remains on the waiting screen.

## Coverage Thresholds
- **E2E Scenario Coverage**: 100% of the defined Real-World Scenarios must be automated and passing.
- **Critical Path Coverage**: The happy path (webhook -> broadcast -> login -> dashboard) must pass consistently without flakiness.
```
