# Test Infrastructure Plan

## Test Philosophy
We rely on opaque-box End-to-End testing using Playwright to ensure the POS system seamlessly handles external events (facial recognition attendance) and transitions states reliably. Tests must validate user-facing behavior and integrations (WebSockets/API polling) without coupling to internal React state. The testing approach prioritizes simulating the external stimulus (the mock event trigger) and observing the browser's autonomous reaction (auto-login & redirect).

## Feature Inventory
1. **F1: Attendance Waiting Screen** - The default landing state actively listening for remote check-in success events.
2. **F2: Auto-Login & Transition** - Seamless authentication and navigation to the dashboard upon receiving the event payload.
3. **F3: Dashboard Cashier Display** - The dashboard dynamically rendering the cashier's name and branch/outlet based on the event payload.
4. **F4: Mock Event Trigger** - A documented mechanism (e.g., API route or CLI script) to simulate the external attendance success event.

## Test Architecture
- **Framework:** Playwright (`@playwright/test`)
- **Web Server:** Integrated with Next.js development/production server via Playwright's `webServer` configuration.
- **Test Structure:** E2E tests residing in `tests/e2e/`.
- **Event Simulation:** Tests will utilize the Mock Event Trigger (via API request using Playwright's `request` context) to inject the mock payload and trigger the auto-login flow.
- **Assertion Layer:** DOM assertions to verify the "Waiting for Attendance" state, followed by assertions verifying the presence of the cashier's information on the dashboard.

## Real-World Scenarios
- **Scenario 1: Happy Path Auto-Login**
  - **Given** the POS is open on the "Waiting for Attendance" screen.
  - **When** a valid mock event (Cashier "John Doe", Branch "Downtown") is triggered remotely.
  - **Then** the POS automatically transitions to the dashboard without manual interaction.
  - **And** the dashboard displays "John Doe" and "Downtown".

- **Scenario 2: Event Listener Robustness**
  - **Given** the POS is open on the "Waiting for Attendance" screen.
  - **When** an invalid or unrelated payload is received.
  - **Then** the POS remains securely on the waiting screen and logs an appropriate diagnostic.

## Coverage Thresholds
- **Critical Paths:** 100% E2E coverage for the happy path auto-login scenario (F1 -> F2 -> F3).
- **Mock Interfaces:** The Mock Event Trigger (F4) must have a verified test ensuring it successfully invokes the state change.
