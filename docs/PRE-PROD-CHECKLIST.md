# Pre-Prod Launch Checklist

> Run this checklist sequentially. Stop and fix before continuing if any item fails.

---

## ✅ Code Audit (Completed)

- [x] RLS policies verified — all 7 tables isolated per outlet
- [x] `finalize_opname` — has auth check + FOR UPDATE anti-double-finalize lock
- [x] Edge function idempotency — unique constraint added (`20260609001900_ledger_shipment_idempotency.sql`)
- [x] `useStokBalance` 30s poll — confirmed, acceptable at 19-outlet scale

---

## 🔴 1. RLS Security Audit (Live, Supabase SQL Editor)

### 1a. Verify policies are applied

```sql
SELECT schemaname, tablename, policyname, qual 
FROM pg_policies 
WHERE tablename IN ('opname', 'ledger_stok', 'stok_balance', 'opname_item');
```
**Pass:** 9+ rows returned, all have `outlet_id IN (SELECT outlet_id FROM outlet_staff WHERE id = auth.uid())` in qual.

### 1b. Verify idempotency index applied

```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ledger_stok' AND indexname = 'idx_ledger_shipment_item';
```
**Pass:** 1 row returned.

### 1c. Cross-outlet isolation test (browser)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login as `andi.empang@sukashawarma.com` | Dashboard loads, outlet = Empang |
| 2 | Go to `/stok/ledger` | Shows only Empang ledger |
| 3 | Open DevTools → Network → copy Supabase ledger request URL | — |
| 4 | Logout, login as `budi.sukmajaya@sukashawarma.com` | Outlet = Sukmajaya |
| 5 | Paste Empang ledger URL in new tab | Should return **empty array** or 401, NOT Empang data |

**Pass criteria:** Cross-outlet URL returns no data.

---

## 🔴 2. Full Workflow UAT

### 2a. Login → Opname → Finalize

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login Empang: `andi.empang@sukashawarma.com` | Dashboard loads |
| 2 | `/stok/opname/new` → Tipe: `harian` | Form shows 15+ bahan |
| 3 | Count: set 3+ items qty jauh dari sistem (>15% selisih) | Item borders merah |
| 4 | Click **Finalisasi Opname** | Loading → redirect ke list |
| 5 | Opname list shows "1 selesai hari ini" | ✅ |

### 2b. Verify Ledger Created

| Step | Action | Expected |
|------|--------|----------|
| 1 | Go to `/stok/ledger` | Entries with tipe `opname_selisih` |
| 2 | Count entries = items with selisih ≠ 0 | Must match |
| 3 | Click one entry → `saldo_sesudah = saldo_sebelum + qty` | Math correct |

### 2c. Verify Monitoring

| Step | Action | Expected |
|------|--------|----------|
| 1 | `/stok/monitoring` | Items sorted kritis→aman |
| 2 | Set one item qty=0 in opname → finalize → check monitoring | Shows 🔴 kritis |
| 3 | Wait 30s (or click ↻ Refresh) | Balance updated |

### 2d. Parallel outlets (Sukmajaya same time)

Open second browser/incognito as `budi.sukmajaya@sukashawarma.com`, repeat 2a-2c simultaneously.
**Pass:** Both outlets finalize without error, data is isolated.

### 2e. Manual ledger entry

| Step | Action | Expected |
|------|--------|----------|
| 1 | `/stok/ledger/new` → tipe: `waste`, qty: 2, bahan: AYAM | — |
| 2 | Submit | Ledger entry qty=-2 (merah) |
| 3 | `/stok/monitoring` → AYAM saldo berkurang 2 | ✅ |

**SQL verification:**
```sql
-- Balance consistency: should return 0 rows
SELECT outlet_id, bahan_baku_id
FROM (
  SELECT outlet_id, bahan_baku_id, SUM(qty) AS computed
  FROM ledger_stok GROUP BY outlet_id, bahan_baku_id
) agg
JOIN stok_balance sb USING (outlet_id, bahan_baku_id)
WHERE ABS(agg.computed - sb.saldo) > 0.001;
```

---

## 🔴 3. Edge Function Test (Supabase Dashboard → Edge Functions)

### Test via curl or Supabase dashboard:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/ledger-create-from-shipment \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "shipment_id": "00000000-0000-0000-0000-000000000001",
    "outlet_id": "550e8400-e29b-41d4-a716-446655440002",
    "items": [{ "bahan_baku_id": "<ayam-uuid>", "qty_terima": 20 }]
  }'
```

| Test | Expected |
|------|----------|
| First call | `{"status":"created", "ledger_ids":["..."]}` |
| **Second identical call (idempotency)** | `{"status":"created", "ledger_ids":[]}` — no new entry |
| Invalid shipment_id (bad UUID format) | 400 error |
| Missing items | `{"error":"missing outlet_id/shipment_id/items"}` |
| Empty items array | 400 error |

**SQL verify after calls:**
```sql
SELECT COUNT(*) FROM ledger_stok 
WHERE ref_shipment_id = '00000000-0000-0000-0000-000000000001';
-- Must be exactly 1, not 2 (idempotency working)
```

---

## 🟡 4. Offline Queue Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Login Empang, go to `/stok/opname/new` | — |
| 2 | Count beberapa bahan | — |
| 3 | **Turn off WiFi** (airplane mode) | — |
| 4 | Click Finalisasi | "Tersimpan, akan disinkron saat online" |
| 5 | **Turn WiFi back on** | Auto-flush, ledger entries appear |

---

## 🟡 5. Performance Baseline

Run these in Supabase SQL Editor and note execution time:

```sql
-- Test 1: Monitoring query (simulates useStokBalance)
EXPLAIN ANALYZE
SELECT * FROM stok_balance 
WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002';
-- Target: < 10ms

-- Test 2: Ledger pagination (page 1, 1000+ entries)
EXPLAIN ANALYZE
SELECT * FROM ledger_stok 
WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002'
ORDER BY created_at DESC LIMIT 20 OFFSET 0;
-- Target: < 50ms

-- Test 3: Balance consistency check
EXPLAIN ANALYZE
SELECT COUNT(*) FROM opname 
WHERE outlet_id = '550e8400-e29b-41d4-a716-446655440002';
-- Target: < 20ms
```

**Record actuals in this table:**

| Query | Target | Actual | Pass? |
|-------|--------|--------|-------|
| stok_balance SELECT | <10ms | — | — |
| ledger_stok paginate | <50ms | — | — |
| opname COUNT | <20ms | — | — |

---

## 🟡 6. Mobile Testing (Android Chrome)

Open app on Android phone (5-6" screen, Android 6+):

- [ ] Login form — keyboard shows email type, numeric for qty fields
- [ ] Opname form — qty input triggers numeric keyboard (`inputmode="numeric"`)
- [ ] Buttons min 44px height — tap-able without zoom
- [ ] No horizontal scroll on any page
- [ ] 5" phone: all text readable without pinch-zoom
- [ ] 7" tablet: layout doesn't break

---

## 🟡 7. Error Scenario Playbook

### Scenario: Opname Selisih Calculation Wrong

```sql
-- Check: opname_item.selisih = qty_fisik - qty_sistem
SELECT oi.id, oi.qty_fisik, oi.qty_sistem, oi.selisih,
       (oi.qty_fisik - oi.qty_sistem) AS computed_selisih,
       oi.selisih = (oi.qty_fisik - oi.qty_sistem) AS is_correct
FROM opname_item oi
WHERE oi.selisih != (oi.qty_fisik - oi.qty_sistem);
-- Should return 0 rows
```

### Scenario: Ledger Entry Created Twice

```sql
-- Check for duplicates (same outlet, bahan, tipe, timestamp within 1 min)
SELECT outlet_id, bahan_baku_id, tipe, COUNT(*), MIN(created_at), MAX(created_at)
FROM ledger_stok
GROUP BY outlet_id, bahan_baku_id, tipe, DATE_TRUNC('minute', created_at)
HAVING COUNT(*) > 1 AND tipe != 'opname_selisih';
-- opname_selisih can have multiple (different opnames), others should not
```

**Recovery:** If duplicates found, identify the bad ledger IDs and delete them. Then run balance reconciliation:
```sql
-- Recalculate balance from ledger sum
UPDATE stok_balance sb
SET saldo = (
  SELECT COALESCE(SUM(qty), 0) FROM ledger_stok l
  WHERE l.outlet_id = sb.outlet_id AND l.bahan_baku_id = sb.bahan_baku_id
), updated_at = NOW();
```

### Scenario: stok_balance Goes Negative

This is **allowed by design** (waste/pemakaian can exceed stock). If it looks wrong:
```sql
SELECT * FROM stok_balance WHERE saldo < 0 ORDER BY saldo ASC;
```
Investigate the ledger for those rows. Usually caused by opname_selisih with large negative qty.

---

## 🚀 8. Backup & Restore Plan

### Supabase Backup

Supabase Pro plan: automatic daily backups, retained 7 days.

**How to verify backup exists:**
- Supabase Dashboard → Project Settings → Database → Backups
- Confirm last backup < 24h ago

**RTO/RPO targets:**
- RPO: 24 hours (daily backup)
- RTO: ~1 hour (restore via Supabase dashboard)

**Point-in-time recovery (PITR):** Available on Pro plan. Enable via Dashboard → Settings → Database → Enable PITR. Recommended before go-live.

**Manual backup (before risky migrations):**
```bash
pg_dump "postgresql://postgres:<password>@<host>:5432/postgres" \
  --schema=public -Fc -f backup-$(date +%Y%m%d).dump
```

**Test restore (staging):**
1. Create a staging Supabase project
2. Restore dump: `pg_restore -d "postgresql://..." backup-YYYYMMDD.dump`
3. Verify row counts match

---

## 🚀 9. Monitoring & Alerting

### Error Logs

Supabase Dashboard → Logs → Edge Functions → filter by function name.

For slow queries: Dashboard → Logs → Postgres → filter `duration > 1000`.

### Recommended Alerts (Set up in Supabase or external)

| Alert | Trigger | Action |
|-------|---------|--------|
| Edge function error rate > 1% | Supabase logs | Check M3 payload format |
| Slow query > 2s | Postgres logs | Add index, optimize |
| Balance inconsistency | Run data integrity query daily | Investigate + reconcile |
| No opname finalized in 48h (per outlet) | Cron query on opname table | Contact outlet crew |

**Daily integrity cron (Supabase pg_cron):**
```sql
-- Add to Supabase cron: daily at 6am
SELECT cron.schedule(
  'daily-balance-check',
  '0 6 * * *',
  $$
  INSERT INTO audit_log (event, detail, created_at)
  SELECT 'balance_drift', json_build_object('outlet_id', outlet_id, 'bahan_baku_id', bahan_baku_id)::text, NOW()
  FROM (
    SELECT l.outlet_id, l.bahan_baku_id, SUM(l.qty) AS computed, sb.saldo
    FROM ledger_stok l
    JOIN stok_balance sb ON sb.outlet_id = l.outlet_id AND sb.bahan_baku_id = l.bahan_baku_id
    GROUP BY l.outlet_id, l.bahan_baku_id, sb.saldo
    HAVING ABS(SUM(l.qty) - sb.saldo) > 0.001
  ) drifts;
  $$
);
```

---

## Summary — UAT Phase Complete ✅

**Completed:**

| # | Item | Status | Evidence |
|---|------|--------|----------|
| Code audit | RLS, triggers, edge function | ✅ | 3 migrations + error handling fix |
| Idempotency fix | Migration + edge function | ✅ | `20260609001900` applied |
| RLS fix | Infinite recursion + trigger security | ✅ | `20260609002000`, `20260609002100` applied |
| 1 | RLS cross-outlet test | ✅ | Andi (Empang) ↔ Budi (Sukmajaya) isolated |
| 2 | Full workflow UAT | ✅ | Opname finalize → Ledger auto-create → Monitoring reflects |
| 5 | Performance baseline | ✅ | stok_balance 0.62ms, ledger 0.62ms, opname <20ms |

**Deferred to Production Phase:**

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3 | Edge function test | ⏸️ | Idempotency curl test deferred |
| 4 | Offline queue test | ⏸️ | WiFi toggle test deferred |
| 6 | Mobile testing | ⏸️ | Android device test deferred |
| 7 | Error scenarios | ⏸️ | SQL recovery scripts ready, test later |
| 8 | Backup verification | ⏸️ | **CRITICAL:** Upgrade Supabase to Pro before production |
| 9 | Monitoring alerts | ⏸️ | Setup after go-live |

**Action Items Before Go-Live:**
- [ ] Deploy 3 migrations to production Supabase
- [ ] Upgrade Supabase project to Pro (daily backup + PITR)
- [ ] Soft launch: 2-outlet pilot (Empang + Sukmajaya)
- [ ] Monitor error logs & crew feedback for 1 week
- [ ] Execute deferred tests before full 19-outlet rollout
