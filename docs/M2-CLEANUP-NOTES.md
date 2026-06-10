# M2 Stok — Cleanup Notes & Design Decisions

## Database Cleanup (Dev Only)

After initial dev/testing, run in Supabase SQL Editor. **ORDER MATTERS** (FK constraints):

```sql
-- CAUTION: Delete in this exact order to avoid FK violations

-- 1. Ledger entries for old bahan (ledger_stok → bahan_baku FK)
DELETE FROM ledger_stok 
WHERE bahan_baku_id IN (
  SELECT id FROM bahan_baku 
  WHERE nama IN ('Daging Ayam', 'Daging Sapi', 'Roti Pita', 'Saus Mayo', 
                 'Saus Sambal', 'Selada', 'Tomat', 'Bawang Bombay', 
                 'Kemasan Box', 'Bumbu Shawarma')
);

-- 2. Stok balance entries for old bahan
DELETE FROM stok_balance 
WHERE bahan_baku_id IN (
  SELECT id FROM bahan_baku 
  WHERE nama IN ('Daging Ayam', 'Daging Sapi', 'Roti Pita', 'Saus Mayo', 
                 'Saus Sambal', 'Selada', 'Tomat', 'Bawang Bombay', 
                 'Kemasan Box', 'Bumbu Shawarma')
);

-- 3. Opname items for old bahan (opname_item → bahan_baku FK)
DELETE FROM opname_item 
WHERE bahan_baku_id IN (
  SELECT id FROM bahan_baku 
  WHERE nama IN ('Daging Ayam', 'Daging Sapi', 'Roti Pita', 'Saus Mayo', 
                 'Saus Sambal', 'Selada', 'Tomat', 'Bawang Bombay', 
                 'Kemasan Box', 'Bumbu Shawarma')
);

-- 4. Orphaned opname entries (no items)
DELETE FROM opname 
WHERE id NOT IN (SELECT DISTINCT opname_id FROM opname_item);

-- 5. Resep items for old bahan (resep_item → bahan_baku FK)
DELETE FROM resep_item 
WHERE bahan_baku_id IN (
  SELECT id FROM bahan_baku 
  WHERE nama IN ('Daging Ayam', 'Daging Sapi', 'Roti Pita', 'Saus Mayo', 
                 'Saus Sambal', 'Selada', 'Tomat', 'Bawang Bombay', 
                 'Kemasan Box', 'Bumbu Shawarma')
);

-- 6. Orphaned resep entries (no items)
DELETE FROM resep 
WHERE id NOT IN (SELECT DISTINCT resep_id FROM resep_item);

-- 7. Finally: old bahan_baku (all FKs cleaned up)
DELETE FROM bahan_baku 
WHERE nama IN ('Daging Ayam', 'Daging Sapi', 'Roti Pita', 'Saus Mayo', 
               'Saus Sambal', 'Selada', 'Tomat', 'Bawang Bombay', 
               'Kemasan Box', 'Bumbu Shawarma');

-- 8. Remove test outlet_staff entries (should be empty in prod)
DELETE FROM outlet_staff 
WHERE name IN ('Test User', 'Admin SS');

-- Verify final state
SELECT COUNT(*) as bahan FROM bahan_baku;
SELECT COUNT(*) as opname FROM opname;
SELECT COUNT(*) as ledger FROM ledger_stok;
SELECT COUNT(*) as resep FROM resep;
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

**Migration note:** Seed now creates 33 real bahan only. Phantom resep/resep_item entries (referencing deleted sample bahan) have been removed. BOM structure exists for M4 auto-deduction (wired when POS feed ready), but no seed data needed in M2.

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
