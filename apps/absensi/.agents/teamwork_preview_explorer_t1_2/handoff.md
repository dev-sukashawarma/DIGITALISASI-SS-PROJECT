# Handoff: Playwright E2E Test Setup

## 1. Observation
- `apps/absensi/TEST_INFRA.md` specifies the test runner as Playwright (`npx playwright test`) and requires tests to be located in `tests/e2e/`.
- `apps/absensi/package.json` shows this is a Next.js (v16.1.6) application. The `dev` script runs `next dev -p 3000`.
- The workspace root (`c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT`) contains both `package-lock.json` and `yarn.lock`, suggesting `npm` or `yarn` is used.
- `apps/absensi/next.config.ts` has `output: 'export'` configured.

## 2. Logic Chain
- Based on `TEST_INFRA.md`, we need to configure Playwright for E2E tests. 
- The `@playwright/test` package needs to be added to the project's dependencies (`devDependencies`).
- A `playwright.config.ts` file needs to be created in `apps/absensi` to instruct Playwright to look for tests in `./tests/e2e`.
- The configuration should include a `webServer` section to start the Next.js development server (`npm run dev`) before running tests, pointing to `http://localhost:3000`. This ensures tests run against the live app automatically.
- Since it's a static export (`output: 'export'`), an alternative is to serve the `out` directory, but for E2E testing during development, using `npm run dev` is typically the most straightforward and standard approach for Next.js unless specifically targeting production builds.

## 3. Caveats
- Using `npm run dev` in the `webServer` block is great for local development but runs the unoptimized dev server. If the intention is to test the production build, the `webServer` command should be changed to serve the static export (e.g., `npm run build && npx serve@latest out -p 3000`). For now, the standard `npm run dev` is recommended for flexibility.
- Ensure browsers are installed via `npx playwright install` before running tests.

## 4. Conclusion
To set up Playwright, execute the following commands in the `apps/absensi` directory and create the `playwright.config.ts` file.

**Commands to run:**
```bash
cd apps/absensi
npm install -D @playwright/test
npx playwright install --with-deps
```

**Content for `apps/absensi/playwright.config.ts`:**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
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
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

## 5. Verification Method
- After adding the config and installing dependencies, create a dummy test `apps/absensi/tests/e2e/example.spec.ts`.
- Run `npx playwright test`.
- Verify that Playwright starts the Next.js server, runs the test against `http://localhost:3000`, and passes successfully without errors.
