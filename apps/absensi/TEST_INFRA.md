# E2E Test Infra: Realtime Operational Daily Checklist

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | SPV - Create Checklist Template (Category & Item) | ORIGINAL_REQUEST § R3 | 5      | 5      | ✓      |
| 2 | SPV - Edit Checklist Template (Category & Item) | ORIGINAL_REQUEST § R3 | 5      | 5      | ✓      |
| 3 | SPV - Delete Checklist Template (Category & Item) | ORIGINAL_REQUEST § R3 | 5      | 5      | ✓      |
| 4 | Kru - View Checklist for Outlet | ORIGINAL_REQUEST § R2 | 5      | 5      | ✓      |
| 5 | Kru - Tick/Untick Checklist Item | ORIGINAL_REQUEST § R2 | 5      | 5      | ✓      |
| 6 | Kru - Realtime Sync of Ticks | ORIGINAL_REQUEST § R1 | 5      | 5      | ✓      |

## Test Architecture
- Test runner: Playwright (`npx playwright test`)
- Test case format: Playwright test spec (`tests/e2e/*.spec.ts`)
- Directory layout:
  - `tests/e2e/spv.spec.ts` (T2)
  - `tests/e2e/kiosk.spec.ts` (T3)
  - `tests/e2e/realtime.spec.ts` (T3)
  - `tests/e2e/workload.spec.ts` (Tier 4)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | SPV setup complete checklist, then 2 Kru users fill it and see sync | F1, F4, F5, F6 | High |
| 2 | SPV modifies template mid-day, Kru sees updated structure | F1, F2, F3, F4 | Medium |
| 3 | Multiple Kru from different outlets tick items concurrently | F4, F5, F6 | High |
| 4 | Kru ticks item, unticks, another Kru ticks it | F5, F6 | Medium |
| 5 | Complex CRUD by SPV then complete deletion | F1, F2, F3 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature (where boundaries exist)
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
