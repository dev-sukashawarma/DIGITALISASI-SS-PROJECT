# Handoff Report: Playwright Setup for E2E Testing

## 1. Observation
- **Package Manager**: The project uses Yarn workspaces (yarn workspaces foreach in root package.json, and .yarnrc.yml is present). 
- **Next.js App**: pps/absensi/package.json defines "dev": "next dev -p 3000", running Next.js v16.1.6 on port 3000.
- **Requirements**: TEST_INFRA.md specifies Playwright (
px playwright test) as the test runner with the directory layout 	ests/e2e/*.spec.ts (spv, kiosk, ealtime, workload).

## 2. Logic Chain
- Because the repository utilizes Yarn Workspaces, @playwright/test should be installed via Yarn in the pps/absensi workspace.
- The Playwright config (playwright.config.ts) needs to be located in pps/absensi and configured with 	estDir: './tests/e2e'.
- The webServer block in Playwright config must start the local Next.js server (yarn dev or 
pm run dev) and wait for http://localhost:3000 so tests can run against a real local instance.
- The specified file structure (	ests/e2e/spv.spec.ts, etc.) must be created to satisfy the architecture laid out in TEST_INFRA.md.

## 3. Caveats
- Both package-lock.json and yarn.lock exist in the root. However, the root package.json specifies "yarn workspaces foreach", so Yarn is definitively the active package manager.
- Running tests against a dev server (yarn dev) works for E2E, but could be slow to boot. For CI environments, it's typically recommended to build and start (yarn build && yarn start), but yarn dev is adequate and easier for local realtime development.
- Database/Supabase seeding is not yet configured in Playwright; complex workload tests may eventually need a globalSetup to reset states.

## 4. Conclusion
To implement this setup, the following changes should be made:

**Dependencies:**
Run yarn workspace @suka/absensi add -D @playwright/test or cd apps/absensi && yarn add -D @playwright/test.

**Directory Structure:**
Create the following files:
- pps/absensi/tests/e2e/spv.spec.ts
- pps/absensi/tests/e2e/kiosk.spec.ts
- pps/absensi/tests/e2e/realtime.spec.ts
- pps/absensi/tests/e2e/workload.spec.ts

**Config Setup (apps/absensi/playwright.config.ts):**
`	ypescript
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 3000;
const baseURL = \http://localhost:\\;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Can add Firefox, WebKit later if needed
  ],
  webServer: {
    command: 'yarn dev', // starts next dev -p 3000
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
`

**NPM Scripts (Optional but recommended):**
Add "test:e2e": "playwright test" to pps/absensi/package.json.

## 5. Verification Method
1. Ensure the implementer runs 
px playwright install --with-deps chromium (or equivalent) to get browser binaries.
2. Run cd apps/absensi && npx playwright test (or yarn test:e2e if the script was added).
3. The command should automatically boot up the Next.js server on port 3000, discover the 4 spec files in 	ests/e2e, and run them without configuration errors.
