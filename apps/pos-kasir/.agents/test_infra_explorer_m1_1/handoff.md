# Handoff Report: Test Infra Design

## 1. Observation
- The project is a Next.js application (identified by `next.config.js`, `package.json`).
- The `package.json` file contains `vitest` for unit testing but does not list `@playwright/test` in its dependencies or devDependencies.
- A `playwright.config.ts` file already exists in the project root, configured to run tests in the `./e2e` directory against a local Next.js server (`npm run dev` at `http://localhost:3000`).
- An existing `TEST_INFRA.md` is present but only contains a partial structure (only defining Real-World Scenarios and Coverage Thresholds), failing to follow the required 4-tier E2E testing methodology.
- The original request in `.agents/ORIGINAL_REQUEST.md` specifies building an Attendance Waiting Screen, Auto-Login transition, Cashier Dashboard, and a Mock Event Trigger.

## 2. Logic Chain
1. Since `@playwright/test` is missing from `package.json`, we must outline the exact `npm` commands to install the framework and its browsers.
2. Because `playwright.config.ts` already exists, we do not need to run `npm init playwright@latest` which would overwrite the config. We simply need to install the dependencies (`npm install -D @playwright/test` and `npx playwright install --with-deps`).
3. To fulfill the prompt's requirement of using a 4-tier E2E testing methodology, I have rewritten the `TEST_INFRA.md` content to include Tier 1 (Feature Coverage), Tier 2 (Boundary/Corner), Tier 3 (Cross-Feature), and Tier 4 (Real-World Application Scenarios), based directly on the features requested (Waiting Screen, Auto-login, Dashboard Info, Mock Event).
4. Coverage thresholds have been explicitly established to ensure high confidence in the critical path and boundary cases.

## 3. Caveats
- I did not modify the `TEST_INFRA.md` or execute the commands myself, as instructed by the "read-only investigation" constraints. I am providing the required content as a proposal.
- The 4-tier testing strategy assumes that cross-branch communication and routing behavior will be handled correctly by the underlying features.

## 4. Conclusion
The testing infrastructure requires installing Playwright dependencies and updating `TEST_INFRA.md` to adhere to the comprehensive 4-tier E2E testing methodology. The proposed content correctly aligns the testing strategy with the user's requested features.

## 5. Verification Method
- Execute the provided shell commands in the project root and ensure `npm` completes without errors.
- Run `npx playwright test` after writing the tests to confirm the environment is correctly configured and the Next.js server boots up.

---

## Proposed Changes

### 1. Shell Commands for Playwright Initialization
Run the following commands in the project root (`c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir`):

```powershell
# Install Playwright testing package as a development dependency
npm install -D @playwright/test

# Install Playwright browsers and their OS dependencies
npx playwright install --with-deps
```

### 2. Proposed Content for `TEST_INFRA.md`
Please overwrite the existing `TEST_INFRA.md` with the following content:

```markdown
# Test Infrastructure Architecture

## Test Philosophy
We employ opaque-box End-to-End (E2E) testing to validate the POS Attendance Integration from a user's perspective. The tests will interact with the application solely through the browser UI and public API endpoints. We avoid mocking internal states or components, ensuring that the integration between the Next.js frontend, the webhook API, and Supabase Auth/Realtime works together precisely as it will in production.

## 4-Tier E2E Testing Methodology

### Tier 1: Feature Coverage (Core Mechanisms)
1. **Attendance Waiting Screen:** Verify that the `/attendance` route renders correctly and actively listens for check-in events.
2. **Auto-Login:** Verify that a valid mock event triggers the auto-login transition from the waiting screen to the dashboard.
3. **Cashier Dashboard:** Verify that the dashboard (`/kasir`) correctly extracts and displays the cashier name and branch from the event payload.
4. **Mock Event Trigger:** Verify that the `mock-attendance.js` script successfully emits a valid payload that the POS can receive.

### Tier 2: Boundary/Corner Cases
1. **Missing Data in Payload:** Trigger an event with missing `username` or `branch` and verify the system does not crash, displaying a fallback or error.
2. **Invalid Event Payload:** Send malformed JSON or corrupted data; verify the waiting screen ignores it or shows a validation error.
3. **Unauthorized Direct Access:** Attempt to visit `/kasir` directly without a prior check-in; verify the user is redirected to the `/attendance` or login screen.
4. **Network/Event Delays:** Simulate delayed event delivery and ensure the waiting screen remains functional and does not time out unexpectedly.
5. **Rapid Success Events:** Send multiple check-in events in quick succession to verify the system handles debouncing or processes only the first valid login.

### Tier 3: Cross-Feature Interactions
1. **Router Integration:** Ensure the transition to `/kasir` occurs via the Next.js router without a full page reload.
2. **Global State Persistence:** After auto-login, refreshing the `/kasir` page should retain the authenticated state and display the correct cashier information.
3. **Logout Flow:** Verify that logging out from the dashboard correctly clears the session and returns the POS to the waiting screen.

### Tier 4: Real-World Application Scenarios
1. **End-to-End Cashier Shift Start (Happy Path):** User opens `/attendance`. A separate device simulates a check-in event. The POS detects it, logs in automatically, and the dashboard prominently displays the correct cashier name and branch.
2. **Multi-Branch Isolation:** Two POS instances open `/attendance`, configured for Branch A and Branch B. A check-in event for Branch A is triggered. Verify that only the POS for Branch A logs in, while Branch B remains on the waiting screen.

## Coverage Thresholds
- **E2E Scenario Coverage:** 100% of the defined Real-World Scenarios (Tier 4) must be automated and passing.
- **Critical Path Coverage:** The happy path (webhook -> broadcast -> login -> dashboard) must pass consistently without flakiness (Tier 1).
- **Edge Case Coverage:** At least 80% of defined Boundary/Corner Cases (Tier 2) must have an associated automated test.

## Framework Configuration
- **Framework:** Playwright (`@playwright/test`)
- **Directory:** `e2e/`
- **Environment:** Next.js development server started automatically via Playwright's `webServer`.
- **Browser:** Chromium (Desktop Chrome)
```
