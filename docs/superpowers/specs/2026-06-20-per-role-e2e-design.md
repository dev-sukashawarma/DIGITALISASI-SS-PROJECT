# Per-Role E2E Test Suite — Design

**Date:** 2026-06-20
**Status:** Approved (brainstorming)
**Owner:** Dev Suka Shawarma

## Goal

End-to-end tests that verify the **role → app access matrix** for all 7 roles
(`admin`, `owner`, `spv`, `kepala_outlet`, `kasir`, `crew`, `kiosk`) through real
browser flows, not just unit-level matrix checks (those already exist in
`packages/auth/src/access.test.ts`).

"E2E per role" means: log in as each role and prove that the **portal launcher**
shows the right apps and that each **app's own middleware guard** allows or denies
that role end-to-end.

## Scope (agreed)

- **Tier: Portal launcher + per-app guards.** Not deep per-app operational flows
  (those grow later, per app). Portal-only would merely re-test the unit matrix.
- **All 7 roles.** Human SSO roles via the portal; `kiosk` handled separately
  (QR/device-bound, not portal SSO).
- **Auth: seeded Supabase test users**, credentials **provided by the user** in a
  gitignored `.env.test` (no seed script written).
- **Target: deployed staging/prod subdomains** (`*.sukashawarma.com`). Real cookie
  domain + all guards active (incl. owner-dashboard, which skips enforcement on
  `localhost`).
- **Read-only:** login + navigation only. No operational writes. Test accounts must
  be dedicated, non-operational.

## Architecture

New top-level workspace `e2e/` (spans portal + all subdomains, so it belongs to no
single app):

```
e2e/
  package.json            # @suka/e2e — @playwright/test + @suka/auth + dotenv
  playwright.config.ts    # no webServer; runs against deployed subdomains
  .env.test               # GITIGNORED — per-role creds + app URLs
  .env.test.example       # committed template
  README.md               # how to run, known constraints
  fixtures/
    roles.ts              # role → {email,password} from env; app URL map
    auth.setup.ts         # logs in each human role once → storageState/<role>.json
  specs/
    portal-launcher.spec.ts
    app-guards.spec.ts
    kiosk.spec.ts
```

### Auth strategy — storageState per role

A Playwright **setup project** logs in each human role through the real portal login
form once and saves the session to `storageState/<role>.json` (gitignored). Spec
projects declare a `dependency` on setup and reuse that state — fast, no re-login per
test. `kiosk` is excluded (QR/device flow).

### Single source of truth for the matrix

Specs import `accessibleApps(role)` / `hasAppAccess(role, app)` / `ROLE_APP_ACCESS`
from `@suka/auth`. The expected app set is **derived from production code**, so the
test cannot drift from the real matrix.

### App URL map

Mirror the launcher's `APP_URL` map, sourced from `.env.test`
(`E2E_URL_PORTAL`, `E2E_URL_STOK`, `E2E_URL_ABSENSI`, `E2E_URL_DISTRIBUSI`,
`E2E_URL_POS_KASIR`, `E2E_URL_OWNER_DASHBOARD`, `E2E_URL_ADMIN_DASHBOARD`), with
prod subdomains as fallback defaults.

## The three specs

### `portal-launcher.spec.ts`
Per human role, reuse its storageState, open the portal launcher, and assert the
rendered app cards equal **exactly** `accessibleApps(role)`. Special cases:
- `admin` → asserts redirect to admin-dashboard (no launcher menu).
- inactive account (optional, if a creds slot provided) → asserts denial message and
  no launcher.

### `app-guards.spec.ts`
The real end-to-end matrix. For each role × each of the 6 apps, visit the app root
URL with that role's storageState and assert:
- `hasAppAccess(role, app)` true → lands inside the app (URL stays on the app host,
  no redirect to portal).
- false → redirected to the portal (`enforceAppAccess` denial).

### `kiosk.spec.ts`
1. Assert `kiosk` credentials are **rejected at the portal** (kiosk must never enter
   human SSO).
2. pos-kasir QR device-login happy path — **scaffolded with `test.fixme` + TODO**,
   since the QR token is device-bound and not seedable in this iteration.

## Known constraints (also in `e2e/README.md`)

- **pos-kasir has no portal-SSO middleware** (kiosk QR flow). Its guard *denial*
  cannot be asserted via redirect; pos-kasir is covered only at the launcher /
  access-matrix level, with a note in the spec.
- **owner-dashboard skips enforcement on `localhost`** — running against deployed
  subdomains (the chosen target) keeps its guard active.
- Tests are read-only against a live environment; use dedicated test accounts.

## Testing approach

This suite *is* the test artifact. Validation of the work itself:
- `e2e/` workspace installs and `playwright.config.ts` + specs **type-check / compile**.
- `playwright test --list` enumerates the expected per-role tests without running them
  (no creds needed to verify structure).
- A full run requires the user's `.env.test` creds; documented in README.

## Out of scope

- Seed script for test users (user provides creds).
- Deep per-app operational happy-paths (kasir sale, crew clock-in, opname, etc.).
- Automated kiosk QR device login (scaffolded, deferred).
