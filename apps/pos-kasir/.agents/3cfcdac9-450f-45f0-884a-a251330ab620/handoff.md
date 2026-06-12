# Handoff: Test Infra Design (Playwright & TEST_INFRA.md)

## 1. Observation
- **`ORIGINAL_REQUEST.md`**: Requires the POS system to listen for a successful remote check-in event, auto-login, and display the dashboard with cashier/branch info without manual intervention. It also specifies a mock event trigger for testing (R1-R4).
- **`SCOPE.md`**: Defines Milestone 1 to setup Playwright for End-to-End opaque-box testing and to design `TEST_INFRA.md` with Test Philosophy, Feature Inventory, Test Architecture, Real-World Scenarios, and Coverage Thresholds.
- **`package.json`**: The project is a Next.js 14 application (`"dev": "next dev"`, `"test": "vitest run"`), using React 18 and Tailwind CSS.
- **Directory Structure**: Vitest is currently used for unit/integration tests in the `/tests` folder. No Playwright setup exists yet.

## 2. Logic Chain
1. Since the goal is "opaque-box E2E testing", tests should treat the application as a black box running in a browser, rather than testing internal React components or Zustand stores.
2. Playwright is the chosen framework. It needs to start the Next.js dev server (`npm run dev`) before running tests to ensure it tests the actual application stack.
3. Dual Track Testing methodology requires separating feature specifications from implementation. `TEST_INFRA.md` must clearly map the User Requirements (R1-R4) into Test Objectives (Feature Inventory) and Real-World Scenarios.
4. To test the "mock event trigger" requirement (R4) and auto-login (R2), the test architecture must include a way to simulate this external event during Playwright test execution (e.g., calling an API route while the browser is on the waiting screen).

## 3. Caveats
- The exact mechanism for the mock event (WebSocket vs Polling vs Webhook) is not yet implemented. The Playwright setup assumes the mock trigger will be an API call or script that can be executed during the test flow.
- The recommendations are structural and strategic; implementation of the features and test scripts will happen in subsequent milestones.

## 4. Conclusion
We recommend the following setup strategy and TEST_INFRA.md outline:

### Playwright Setup Strategy
1. **Installation**: Run `npm init playwright@latest` to install Playwright. Choose TypeScript and set the test directory to `/e2e` (to separate from existing `/tests` vitest directory).
2. **Configuration (`playwright.config.ts`)**: 
   - Set `baseURL: 'http://localhost:3000'`.
   - Configure the `webServer` block to use `command: 'npm run dev'`, `port: 3000`, and `reuseExistingServer: !process.env.CI`.
3. **Mock Event Trigger Strategy**: To simulate external check-ins, implement a local test-only Next.js API route or utilize Playwright's `request` context within the test to fire the check-in payload while the POS is on the Waiting Screen.

### TEST_INFRA.md Content Outline
Provide the following structure in `TEST_INFRA.md` at the project root:

**1. Test Philosophy**
- *Requirement-driven opaque-box testing:* Testing strictly against R1-R4 as an external user/browser, isolating the app from internal implementations.
- *Dual Track Testing:* Defining tests based on acceptance criteria prior to or parallel with feature development.

**2. Feature Inventory**
- R1: "Waiting for Attendance" Screen State.
- R2: Event-driven Auto-Login and Dashboard Transition.
- R3: Cashier Info Display Verification (Name and Branch).
- R4: Simulation/Mock Trigger mechanism testing.

**3. Test Architecture**
- **Framework**: Playwright (`@playwright/test`).
- **Structure**: `/e2e` folder for E2E tests, separate from unit tests.
- **Event Simulation**: Injecting mock payloads (Cashier Name, Branch) via a dedicated test API endpoint to trigger POS transitions during test execution.

**4. Real-World Scenarios**
- **Scenario A: End-to-End Auto Login Flow** 
  - *Action*: Open POS -> Trigger mock event -> Verify redirect to Dashboard -> Verify Dashboard UI shows correct Name/Branch.
- **Scenario B: Unauthorized/Invalid Payload Flow** 
  - *Action*: Trigger mock event with invalid data -> Verify POS remains on Waiting screen.

**5. Coverage Thresholds**
- 100% pass rate for critical path E2E scenarios before merging.

## 5. Verification Method
- **Method**: The caller agent can view this file to read the strategy. Upon implementation by a subsequent agent, the presence of `playwright.config.ts` configured with the Next.js `webServer` block, the `/e2e` directory, and the generated `TEST_INFRA.md` containing the defined sections can be verified via `view_file`.
