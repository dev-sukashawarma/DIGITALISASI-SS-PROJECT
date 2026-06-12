# Handoff Report: Test Infra Design for POS-Kasir

## 1. Observation
- The original request (`.agents/ORIGINAL_REQUEST.md`) asks for a "Waiting for Attendance" screen, auto-login logic, cashier information display on the dashboard, and a mock event trigger for a POS system.
- The project `package.json` reveals a Next.js (14.2.5) environment with Vitest already installed, but no Playwright dependencies are present.
- The objective is to design a `TEST_INFRA.md` following a 4-tier E2E testing methodology and establishing coverage thresholds, as well as providing commands to initialize Playwright.

## 2. Logic Chain
- To implement E2E testing for the requested features, Playwright must be added to the Next.js project. Since the user wants exact shell commands, `npm init playwright@latest` is standard, or explicitly installing via NPM since Next.js often uses standard Node modules.
- The 4-tier E2E methodology maps as follows:
  - **Feature Coverage:** Tests the direct requirements (Waiting screen, successful auto-login event, UI display of cashier details).
  - **Boundary/Corner:** Tests invalid payloads, mismatched branches, and timeout behaviors.
  - **Cross-Feature:** Tests how auto-login coexists with manual logout, state clearing, and standard dashboard navigation.
  - **Real-World Scenarios:** Tests start-of-day flows and shift changes simulating actual kiosk operations.
- The instruction calls for establishing coverage thresholds; setting 80% across Statements, Branches, Functions, and Lines is a standard robust benchmark for critical applications like POS systems.

## 3. Caveats
- Playwright doesn't natively collect Next.js backend/frontend unified code coverage without extra instrumentation (e.g., using Babel plugins or V8 node coverage). The 80% coverage threshold assumes combined analysis using Vitest for unit tests and potentially instrumented Playwright runs, or serves as a target standard rather than a strictly automated CI block initially.
- Specific data state structure (e.g., using Zustand, given it's in `package.json`) and specific internal routes (e.g., `/waiting`) are assumed but flexible pending the actual implementation.

## 4. Conclusion
- I have designed the exact proposed contents for `TEST_INFRA.md`, available at `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir\.agents\14d3d666\proposed_TEST_INFRA.md`.
- The following exact shell commands should be executed to initialize and configure Playwright in the project:
  ```powershell
  # Navigate to the correct directory if not already there
  cd c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir
  
  # Initialize Playwright (accept defaults or adjust as needed)
  npm init playwright@latest --yes -- --quiet --browser=chromium,firefox,webkit --gha
  ```
  *(Alternatively, run `npm install -D @playwright/test` followed by `npx playwright install --with-deps` if a purely manual setup is preferred).*

## 5. Verification Method
- **Setup:** Execute the proposed `npm init playwright@latest` command in `apps\pos-kasir` and verify `playwright.config.ts` and the `tests/` directory are created.
- **Content:** Inspect `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir\.agents\14d3d666\proposed_TEST_INFRA.md` to confirm it explicitly addresses the 4 tiers (Feature, Boundary, Cross-Feature, Real-World) and defines coverage thresholds.
