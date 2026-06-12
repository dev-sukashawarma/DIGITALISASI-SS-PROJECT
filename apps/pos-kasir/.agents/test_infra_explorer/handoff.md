# Handoff Report: E2E Test Infra Design

## 1. Observation
- The project is located at `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir` and is built using Next.js `14.2.5` with React `18.3.1`. (Verified via `package.json`).
- `SCOPE.md` specifies the setup of Playwright for End-to-End opaque-box testing and the creation of `TEST_INFRA.md`.
- `ORIGINAL_REQUEST.md` requires: 
  - An "Attendance Waiting Screen" listening for remote events.
  - Auto-login and dashboard transition upon receiving a success event.
  - Displaying the cashier's name and branch.
  - A mock event trigger (script or curl) to simulate the attendance system.

## 2. Logic Chain
- Because the project is a Next.js application, Playwright should be installed as a standard `devDependency` (`@playwright/test`) to seamlessly integrate with the Node.js ecosystem.
- Configuring Playwright's `webServer` to run `npm run dev` or `npm run start` will allow tests to spin up the local Next.js server automatically before running E2E tests against `http://localhost:3000`.
- The requirements in `ORIGINAL_REQUEST.md` directly dictate the core feature inventory for testing: waiting state (F1), auto-login transition (F2), dashboard info (F3), and the mechanism to test it (mock trigger - F4).
- The E2E tests should simulate the complete real-world scenario (cashier checks in remotely -> POS logs in automatically). Playwright can issue API requests to the mock trigger to test this asynchronous flow.

## 3. Caveats
- The exact implementation details of the active listener (WebSocket vs. API Polling vs. SSE) are not yet finalized in the source code. The E2E strategy must remain "opaque-box", relying only on the Mock Event Trigger to stimulate the system and observing the DOM changes.
- Ensure the Mock Event Trigger is implemented as an accessible endpoint or script that Playwright's APIRequestContext can invoke during the test.

## 4. Conclusion
**Playwright Installation & Configuration Strategy:**
- **Installation:** Run `npm install -D @playwright/test` to add Playwright.
- **Configuration:** Create `playwright.config.ts` in the project root. Configure it to point to `baseURL: 'http://localhost:3000'` and include a `webServer` block executing `npm run dev` (or a dedicated test script) so the Next.js app starts automatically when tests run. Place tests in a `tests/e2e/` directory.

**TEST_INFRA.md Content Design:**
- I have designed the complete draft for `TEST_INFRA.md` which encompasses the Test Philosophy, Feature Inventory, Architecture, Scenarios, and Coverage Thresholds.
- The content is available at: `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir\.agents\test_infra_explorer\proposed_TEST_INFRA.md`.

## 5. Verification Method
- **Playwright config:** Verify by inspecting `playwright.config.ts` once implemented, and running `npx playwright test` to ensure it successfully launches the Next.js server.
- **Content Check:** Review `proposed_TEST_INFRA.md` to ensure it maps exactly to the Acceptance Criteria stated in `ORIGINAL_REQUEST.md`.
