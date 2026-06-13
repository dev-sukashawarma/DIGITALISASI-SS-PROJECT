# E2E Test Scope

## Architecture
- Playwright E2E tests for the POS Attendance Integration as specified in TEST_INFRA.md.
- Opaque-box requirement-driven tests.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Tier 1 Tests | Feature Coverage (Happy Path) tests 1-20 | none | PLANNED |
| 2 | Tier 2 Tests | Boundary/Corner Cases tests 21-40 | M1 | PLANNED |
| 3 | Tier 3 Tests | Cross-Feature Combinations tests 41-44 | M1, M2 | PLANNED |
| 4 | Tier 4 Tests | Real-World Application Scenarios tests 45-49 | M1, M2, M3 | PLANNED |

## Interface Contracts
- Playwright will test against the existing app setup. Playwright config should be defined if missing, though it might exist. Tests live in `e2e/`.

## Code Layout
- `e2e/attendance-tier1.spec.ts`
- `e2e/attendance-tier2.spec.ts`
- `e2e/attendance-tier3.spec.ts`
- `e2e/attendance-tier4.spec.ts`
