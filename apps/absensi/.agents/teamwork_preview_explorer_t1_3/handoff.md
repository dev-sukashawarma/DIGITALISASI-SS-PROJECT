# Playwright Setup Investigation Report

## 1. Observation
- `package.json` confirms this is a Next.js application (`"next": "^16.1.6"`) using Typescript, with Vitest currently configured for unit testing. 
- `TEST_INFRA.md` requires Playwright tests to be structured under `tests/e2e/` with specific specs: `spv.spec.ts`, `kiosk.spec.ts`, `realtime.spec.ts`, and `workload.spec.ts`. 

## 2. Logic Chain
- To support Playwright in a Next.js environment, the project needs `@playwright/test` added to `devDependencies`.
- The `playwright.config.ts` must define a `testDir` of `./tests/e2e`.
- The `playwright.config.ts` should ideally boot up the Next.js development server during testing to ensure an opaque-box E2E testing methodology, which matches `npm run dev` running on port 3000 as seen in `package.json`.
- The directory layout needs to be manually created to fulfill the requirements from `TEST_INFRA.md`.

## 3. Caveats
- No caveats found. The setup is a standard Next.js Playwright integration.

## 4. Conclusion

### Setup Commands
Run the following commands in the `apps/absensi` directory:
```bash
npm install -D @playwright/test
npx playwright install chromium --with-deps
```

### Directory Structure
Create the following directory and empty spec files:
```text
tests/
└── e2e/
    ├── kiosk.spec.ts
    ├── realtime.spec.ts
    ├── spv.spec.ts
    └── workload.spec.ts
```

### Recommended `playwright.config.ts`
Create `playwright.config.ts` in `apps/absensi`:
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
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 5. Verification Method
- Execute `npx playwright test` after setup. 
- The build should correctly parse `playwright.config.ts`, automatically boot Next.js using `npm run dev` on port `3000`, run all specs (even if empty), and exit with a success code.
