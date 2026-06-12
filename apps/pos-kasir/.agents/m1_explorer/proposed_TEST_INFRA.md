# Test Infrastructure Architecture

## Test Philosophy
We employ opaque-box End-to-End (E2E) testing to validate the POS Attendance Integration from a user's perspective. The tests will interact with the application solely through the browser UI and public API endpoints. We avoid mocking internal states or components, ensuring that the integration between the Next.js frontend, the webhook API, and Supabase Auth/Realtime works together precisely as it will in production.

## 4-Tier E2E Testing Methodology

### Tier 1: Feature Coverage
Validates the foundational building blocks independently.
- **Attendance Waiting Screen (`/attendance`)**:
  - Verifies the screen renders correctly with the "Waiting for Attendance" status.
  - Ensures the WebSocket/polling listener initializes on mount.
- **Cashier Dashboard (`/kasir`)**:
  - Verifies the dashboard renders safely.
  - Ensures cashier name and branch name components reflect the logged-in state.

### Tier 2: Boundary/Corner Cases
Tests edge cases, invalid inputs, and unexpected conditions.
- **Invalid Payload**: Mock event trigger sends malformed JSON or missing required fields (e.g., missing branch or cashier name). Verify the POS does not crash and remains in waiting state.
- **Unauthorized Access**: Attempting to access `/kasir` directly without a prior check-in event redirects back to `/attendance`.
- **Event Mismatch**: An event for a different branch is received. Verify the current POS ignores it and remains waiting.

### Tier 3: Cross-Feature Integration
Tests the handover and communication between major subsystems.
- **Event to State Transition**: Receiving a valid check-in event triggers the auth flow and transitions the UI state from "Waiting" to "Authenticated".
- **Rapid Re-Triggering**: Firing multiple check-in events in quick succession to ensure the POS debounces or handles them without multiple rapid redirects.

### Tier 4: Real-World Application Scenarios
End-to-End journeys mapping directly to user workflows.
1. **Successful Auto-Login (Happy Path)**
   - **Action**: POS open on `/attendance`. Mock event trigger is executed with valid credentials for Branch A.
   - **Expected**: POS receives the event, authenticates, and auto-redirects to `/kasir`. Dashboard displays the correct cashier name and Branch A.
2. **Multiple Branch Isolation**
   - **Action**: Two browser instances open `/attendance` configured for Branch A and Branch B. Mock event trigger is executed for Branch A.
   - **Expected**: Only the POS at Branch A auto-redirects. Branch B remains on `/attendance`.

## Coverage Thresholds
- **Tier 1 & Tier 4 (Happy Path) Coverage**: 100% automated and passing. These form the critical path.
- **Tier 2 & Tier 3 Coverage**: Minimum 80% automated to catch regressions in edge cases.
- **Critical Path Consistency**: The webhook -> broadcast -> login -> dashboard flow must pass consistently without flakiness (0% failure rate across 5 consecutive runs).

## Setup & Execution Commands

### Playwright Initialization
To initialize Playwright and install the required Chromium browser:
```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Running Tests
To execute the E2E test suite:
```bash
npx playwright test
```
