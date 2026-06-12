# Handoff: Test Infra Design Plan

## 1. Observation
- **Project Structure**: Investigated `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir`. The root contains `package-lock.json`, `package.json`, `playwright.config.ts` (configured for local chromium and `e2e` dir), and `TEST_INFRA.md`.
- **Dependencies**: `package.json` does *not* list `@playwright/test` in `dependencies` or `devDependencies`.
- **Requirements**: `ORIGINAL_REQUEST.md` specifies four requirements (R1: Attendance Waiting Screen, R2: Auto-Login, R3: Display Cashier Info, R4: Mock Event Trigger).
- **Current `TEST_INFRA.md`**: Exists but does not explicitly format its feature inventory mapped to R1-R4, nor does it explicitly mention "Dual Track methodology" for coverage thresholds.

## 2. Logic Chain
- Since `package-lock.json` is present and `package.json` lacks Playwright, the correct installation tool is `npm`. To install Playwright without overwriting existing configs using `init`, the safest manual installation commands are `npm install -D @playwright/test` and `npx playwright install --with-deps chromium` (as `playwright.config.ts` only defines the chromium project).
- To adhere to the user's request for "Dual Track methodology", the `TEST_INFRA.md` needs to be rewritten/updated. Dual Track separates testing into Discovery (Behavioral/Acceptance Testing) and Delivery (Technical/Code Coverage).
- The "Requirement-Driven Feature Inventory" should directly trace back to R1-R4 from `ORIGINAL_REQUEST.md`.

## 3. Caveats
- `playwright.config.ts` and `TEST_INFRA.md` already exist in the repository (likely from a previous attempt or manual creation). My plan will overwrite/update the existing `TEST_INFRA.md`.
- Playwright's `e2e` directory does not exist yet. It will be implicitly created when tests are added.

## 4. Conclusion
### Playwright Setup Commands
```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

### Plan for TEST_INFRA.md
We must update `TEST_INFRA.md` with the following structure:
1. **Test Philosophy**: Opaque-box E2E testing using Playwright.
2. **Requirement-Driven Feature Inventory**:
   - **F1 (maps to R1)**: Attendance Waiting Screen (`/attendance`).
   - **F2 (maps to R2)**: Auto-Login & Redirect flow.
   - **F3 (maps to R3)**: Cashier Dashboard (`/kasir`) dynamic data validation.
   - **F4 (maps to R4)**: Mock Event Trigger (Webhook Simulation).
3. **Dual Track Methodology Coverage Thresholds**:
   - **Track 1: Discovery (Acceptance/Behavioral Coverage)**: 100% of Real-World Scenarios from `ORIGINAL_REQUEST.md` must be automated (Happy path, Sad path).
   - **Track 2: Delivery (Technical Coverage)**: Code-level E2E coverage targets (e.g., critical path execution must be 100% reliable, Playwright test retries configured, trace on failure).
4. **Test Architecture & Real-World Scenarios**: Update existing sections to align with F1-F4.

## 5. Verification Method
- **Verify Setup**: Run the proposed `npm install` commands and verify `@playwright/test` appears in `package.json`.
- **Verify Implementation**: Review the updated `TEST_INFRA.md` to ensure "Dual Track methodology" and R1-R4 mappings are explicitly present.
