# M2 Stok — Cleanup Notes & Design Decisions

## Database Cleanup (Dev Only)

After initial dev/testing, run in Supabase SQL Editor to clean test data:

```sql
-- Remove old sample bahan_baku (replaced with real 33 ingredients)
DELETE FROM bahan_baku 
WHERE nama IN ('Daging Ayam', 'Daging Sapi', 'Roti Pita', 'Saus Mayo', 
               'Saus Sambal', 'Selada', 'Tomat', 'Bawang Bombay', 
               'Kemasan Box', 'Bumbu Shawarma');

-- Remove test outlet_staff entries (should be empty in prod)
DELETE FROM outlet_staff 
WHERE name IN ('Test User', 'Admin SS');
```

## Critical Design Decisions

### outlet_staff Provisioning

**Rule:** `outlet_staff.id` MUST match `auth.users.id` for login to work.

**Correct flow:**
1. New staff member signs up (or admin creates auth user) in Supabase Auth
2. Auth user gets UUID (e.g., `e6e53818-18d6-4073-a6d7-b916325217c5`)
3. Insert `outlet_staff` row with `id = auth_user_id`
   ```sql
   INSERT INTO outlet_staff (id, outlet_id, name, role, status)
   VALUES ('e6e53818-18d6-4073-a6d7-b916325217c5', outlet_uuid, 'Name', 'crew', 'active');
   ```
4. User logs in → AuthContext fetches `outlet_staff` by session.user.id → match found ✅

**Anti-pattern (causes "Memuat..." hangs):**
- Seeding `outlet_staff` with random UUIDs (no `DEFAULT gen_random_uuid()`)
- Creating staff without corresponding auth users
- This was the root cause of all login blockers during development

### bahan_baku Seeding

**Current state:**
- Sample seed (10 items) replaced with real 33 ingredients from owner
- All 33 are seeded in migration `20260609001800_seed_sample_stok.sql`
- Satuan enum updated to include `crt`, `kompan`

**Migration note:** Initial seed creates 10 sample items. If running fresh install, you'll get all 33. In dev, we manually deleted old sample rows—in fresh install, they're replaced automatically via `ON CONFLICT (nama) DO NOTHING`.

## Error Handling Improvements

All async operations now have proper error handling:
- `useLedger.ts` → returns `error` state
- `useBahanBaku.ts` → returns `error` state
- `LedgerDetail.tsx` → displays error message
- `OpnameDetail.tsx` → displays error message on query failure
- `ManualEntryForm.tsx` → validates qty is numeric before submit

No more silent failures or infinite "Memuat..." spinner.

## Future Work (Not M2)

1. **Login/signup page** — currently M2 has a login form but no signup flow
   - M0 should add auth enrollment (new staff signup)
   - Link auth creation → outlet_staff provisioning

2. **Tailwind v4 migration** — v3 now fixed for all apps
   - Create planned task for v4 migration across absensi/distribusi/owner-dashboard

3. **Per-outlet bahan_baku override** — deferred to M4
   - Currently reorder_point is global (default_reorder_point in bahan_baku)
   - M4 owner dashboard should allow per-outlet override

4. **Batch operations** — queue multiple opnames for bulk finalize
   - Currently one-at-a-time. Future: finalize N at once via RPC.
