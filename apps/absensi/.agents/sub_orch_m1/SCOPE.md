# Scope: M1 (Database Schema)

## Architecture
- Database & Realtime: Supabase (Postgres)
- Migration: Supabase CLI migration file
- Data model:
  - `checklist_categories`: id, name, outlet_id
  - `checklist_items` (templates): id, category_id, task_name, required
  - `daily_checklist_records`: id, outlet_id, date
  - `daily_checklist_ticks`: id, record_id, item_id, ticked_by, ticked_at
- RLS Policies for access control
- Realtime publication on `daily_checklist_ticks` (and potentially other tables if needed).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Schema | Create supabase migration for categories, templates, and daily records, including RLS and publication for realtime. | none | DONE |

## Interface Contracts
### Database Schema
- `checklist_categories`: `id` (uuid, pk), `name` (text), `outlet_id` (uuid, fk or text if outlet isn't defined yet)
- `checklist_items`: `id` (uuid, pk), `category_id` (uuid, fk to checklist_categories), `task_name` (text), `required` (boolean)
- `daily_checklist_records`: `id` (uuid, pk), `outlet_id` (uuid/text), `date` (date)
- `daily_checklist_ticks`: `id` (uuid, pk), `record_id` (uuid, fk to daily_checklist_records), `item_id` (uuid, fk to checklist_items), `ticked_by` (uuid/text), `ticked_at` (timestamptz)

Realtime: Add `daily_checklist_ticks` to supabase realtime publication.
