# Project: Realtime Operational Daily Checklist

## Architecture
- Framework: Next.js App Router
- Database & Realtime: Supabase (Postgres)
- Testing: Vitest (Unit/Integration) and Playwright (E2E)
- Data model:
  - `checklist_categories`: id, name, outlet_id
  - `checklist_items` (templates): id, category_id, task_name, required
  - `daily_checklist_records`: id, outlet_id, date
  - `daily_checklist_ticks`: id, record_id, item_id, ticked_by, ticked_at

## Code Layout
- `src/app/spv/checklist/*`: SPV Dashboard Pages
- `src/app/kiosk/checklist/*`: Kru Kiosk Pages
- `src/features/checklist/*`: Hooks, Services, Components for Checklist
- `tests/e2e/*`: Playwright tests

## Milestones (Implementation Track)
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema | Create supabase migration for categories, templates, and daily records, including RLS and publication for realtime. | none | DONE |
| M2 | SPV Dashboard | Next.js CRUD UI for SPV to manage checklist templates. | M1 | PLANNED |
| M3 | Kru Kiosk | Realtime Next.js UI for Kru to tick daily checklist items using Supabase channel. | M1, M2 | PLANNED |
| M4 | Final Integration | Pass E2E Test Suite. | M3, T-E2E | PLANNED |

## Milestones (E2E Testing Track)
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| T1 | Test Infra Setup | Setup Playwright in the project and configure it. | none | PLANNED |
| T2 | SPV Dashboard Tests | Write tests for CRUD template checklist. | T1 | PLANNED |
| T3 | Realtime Kru Tests | Write tests for the real-time syncing of Kru checklist. | T1 | PLANNED |
| T4 | Publish TEST_READY | Generate TEST_READY.md when suite is ready. | T2, T3 | PLANNED |

## Interface Contracts
### Kiosk ↔ Supabase Realtime
- Listen to `postgres_changes` on `daily_checklist_ticks` table for `INSERT`/`UPDATE`/`DELETE` where `record_id` matches today's record for the outlet.
