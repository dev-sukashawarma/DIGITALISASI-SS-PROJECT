# M2 Stok — UAT & Soft Launch Plan

> **Scope:** 2-outlet pilot (Empang + Sukmajaya) → full 19-outlet rollout
> **Duration:** 1-2 weeks UAT → launch
> **Success Criteria:** Zero data corruption, all 3 domains working (opname→ledger→monitoring)

---

## Pilot Outlets & Test Staff

| Outlet | Email | UUID | Notes |
|--------|-------|------|-------|
| **EMPANG** | andi.empang@sukashawarma.com | 9e8df551-406d-4da7-bfdb-22e53253253e | City center, stable WiFi |
| **SUKMAJAYA** | budi.sukmajaya@sukashawarma.com | edf7428a-e37a-43a1-bc66-5b72e83a4026 | Suburb, WiFi decent |

---

## Setup (Completed ✅)

**Test staff created in Supabase:**

```sql
INSERT INTO outlet_staff (id, outlet_id, name, role, status) VALUES
  ('9e8df551-406d-4da7-bfdb-22e53253253e', 
   '550e8400-e29b-41d4-a716-446655440002',  -- Empang
   'Crew Empang',
   'crew',
   'active'),
  ('edf7428a-e37a-43a1-bc66-5b72e83a4026',
   '550e8400-e29b-41d4-a716-446655440005',  -- Sukmajaya
   'Crew Sukmajaya',
   'crew',
   'active');
```

**Auth credentials (set in Supabase Auth):**
- Empang: `andi.empang@sukashawarma.com` (UUID: 9e8df551...)
- Sukmajaya: `budi.sukmajaya@sukashawarma.com` (UUID: edf7428a...)

---

## Critical Path (Must Pass Before Rollout)

### 1️⃣ RLS Security Audit

**Goal:** Verify multi-outlet isolation works.

**Test cases:**
- [ ] Empang staff logs in → sees ONLY Empang opname/ledger/balance
- [ ] Sukmajaya staff logs in → sees ONLY Sukmajaya opname/ledger/balance
- [ ] Empang staff tries to access Sukmajaya ledger via URL hack → denied
- [ ] Query RLS policies directly (verify `outlet_id IN (SELECT...)` enforcement)

**Command (Supabase SQL):**
```sql
-- Check RLS policies on tables
SELECT schemaname, tablename, policyname, qual 
FROM pg_policies 
WHERE tablename IN ('opname', 'ledger_stok', 'stok_balance');
```

**Pass criteria:** ✅ Staff can only see own outlet data, no cross-outlet leaks

---

### 2️⃣ Full Workflow UAT

**Goal:** End-to-end flow: opname → ledger → monitoring (with real crew, real bahan).

#### Scenario A: Harian Opname (Daily Count)
1. **Setup:** Test staff already created (see table above)
   - ✅ Empang: andi.empang@sukashawarma.com
   - ✅ Sukmajaya: budi.sukmajaya@sukashawarma.com
2. **Opname (Empang crew):**
   - Login as Empang crew
   - Go to `/stok/opname/new`
   - Type: `harian`
   - Count 15+ bahan (AYAM, BAWANG, SAUS X HOT, KULIT 25, etc.)
   - Include 3+ items with selisih > 15% (flagged in red)
   - Add notes: "Selisih bawang karena kurang teliti"
   - Click **Finalisasi Opname**
   - ✅ Should redirect to opname list, show "1 selesai hari ini"

3. **Verify Ledger:**
   - Go to `/stok/ledger`
   - Should see 15+ `opname_selisih` entries (qty match what was counted)
   - Running balance (saldo_sesudah) correct
   - Flagged items have "💀 FLAGGED" visual indicator

4. **Verify Monitoring:**
   - Go to `/stok/monitoring`
   - Should see 15 bahan with saldo (from opname counts)
   - Status colors: 
     - 🔴 **Kritis** (saldo < 25% of reorder_point)
     - 🟡 **Menipis** (25% ≤ saldo < 80%)
     - 🟢 **Aman** (saldo ≥ 80%)
   - Alert: "X bahan kritis"

#### Scenario B: Parallel (Sukmajaya same time)
- Sukmajaya crew does opname at SAME TIME as Empang
- Verify: Sukmajaya data is isolated, doesn't mix with Empang
- Both opnames finalize successfully

#### Scenario C: Ledger Manual Entry
1. Empang crew: Go to `/stok/ledger/new`
2. Entry: `waste`, qty=2, bahan=AYAM, reason="basi, discard"
3. ✅ Should appear in ledger with qty=-2 (negative, red)
4. Monitoring should update AYAM saldo immediately

**Pass criteria:** 
- ✅ Opname creates ledger entries
- ✅ Balance updates correctly
- ✅ Monitoring reflects balance
- ✅ No data corruption (saldo negative should be allowed)

---

### 3️⃣ Edge Function Test (M3 Integration)

**Goal:** Verify shipment→ledger flow works (ledger-create-from-shipment Edge Function).

**Prerequisite:** M3 supply chain module ready (shipment created).

**Test:**
1. M3 creates shipment: Kitchen → Empang, 20kg AYAM
2. Edge Function called: `ledger-create-from-shipment(shipment_id, outlet_id, items)`
3. ✅ Ledger entry created: type=`terima_kiriman`, qty=+20, ref_shipment_id
4. ✅ Stok_balance updated: AYAM saldo += 20
5. ✅ Monitoring dashboard reflects new saldo

**Error case:**
- Invalid shipment_id → function returns error (not crash)
- Duplicate call → idempotent (ledger not doubled)

**Pass criteria:** ✅ Shipment → ledger flow atomic, correct balance

---

## Offline Mode Test (Lower Priority)

**Goal:** Verify offline queue resilience.

**Setup:** Empang crew, WiFi OFF
1. Create opname, count bahan
2. Click Finalizasi Opname
3. ✅ Shows: "Tersimpan, akan disinkran saat online"
4. **WiFi ON** → automatic flush, entry appears in ledger

**Pass criteria:** ✅ Queue survives offline, flushes on reconnect

---

## Mobile/Android Check

**Goal:** Verify form inputs, touch targets, rendering on Android 6+.

**Test device:** Android phone (5-6" screen), Chrome browser
1. Login (keyboard enters email/password correctly)
2. Opname form: qty input accepts numeric keyboard (not full keyboard)
3. Buttons: large enough to tap (min 44px height)
4. Text: readable without pinch-zoom
5. No horizontal scroll needed

**Pass criteria:** ✅ Usable on Android 6+, no UX blockers

---

## Performance Baseline

**Goal:** Ensure queries are performant under load.

**Measurements (Empang crew):**
1. **Opname list load time:** < 2s (with 50+ historical opnames)
2. **Monitoring dashboard:** < 3s (30+ bahan, 30-second auto-refresh)
3. **Ledger pagination:** < 2s per page (1000+ ledger entries)
4. **No N+1 queries** (check Supabase query logs)

**Action:** If slow, add indexes or optimize queries.

---

## Data Integrity Checks

**After 2 weeks of UAT:**

```sql
-- 1. Ledger balance consistency
SELECT outlet_id, bahan_baku_id, 
       SUM(qty) as computed_saldo,
       (SELECT saldo FROM stok_balance sb 
        WHERE sb.outlet_id=l.outlet_id AND sb.bahan_baku_id=l.bahan_baku_id)
FROM ledger_stok l
GROUP BY outlet_id, bahan_baku_id
HAVING SUM(qty) != (SELECT saldo FROM stok_balance sb 
                    WHERE sb.outlet_id=l.outlet_id AND sb.bahan_baku_id=l.bahan_baku_id);
-- Should return 0 rows (perfect balance)

-- 2. Opname finalized count
SELECT COUNT(*) FROM opname WHERE status = 'finalized';

-- 3. Total ledger entries created
SELECT COUNT(*), SUM(CASE WHEN qty > 0 THEN 1 ELSE 0 END) as inflows
FROM ledger_stok;
```

---

## Rollout Plan (After UAT Pass)

### Week 1: Soft Launch (2 outlets)
- [ ] UAT pass all criteria
- [ ] Create staff for Empang + Sukmajaya (auth users + outlet_staff)
- [ ] Deploy to staging / or give test access
- [ ] Crew trains for 2-3 days

### Week 2: Monitor & Bug Fix
- [ ] Empang + Sukmajaya run opname nightly
- [ ] Monitor dashboard for errors (Sentry/logs)
- [ ] Fix critical bugs ASAP
- [ ] Collect crew feedback

### Week 3+: Rollout to 17 outlets
- [ ] Create staff for remaining 17 outlets
- [ ] Batch training (1-2 crew per outlet, 30 min each)
- [ ] Deploy to all 19 outlets
- [ ] Daily monitoring for first week

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|---|
| **Data Integrity** | 100% (0 corruption) | balance audit query |
| **Uptime** | 99%+ | error logs |
| **Crew Adoption** | 80%+ (16/20 crew trained) | signup count |
| **Opname Timeliness** | 90%+ finalize before 2am | opname.created_at - finalized timestamps |
| **Zero Ledger Dupes** | 100% (0 duplicate entries) | uniqueness check |

---

## Escalation Path

If UAT fails:
1. **RLS breach** → STOP, fix security, re-audit entire RLS
2. **Data corruption** → Investigate root cause, rollback test data, fix, retry
3. **Edge Function fails** → Pause M3 integration, test in isolation
4. **Performance** → Profile queries, optimize, re-baseline
5. **UX issue (mobile)** → Iterate design, test again

If production issues arise post-launch:
- **Critical (data loss)** → Pause opname finalize, investigate, patch
- **High (can't login)** → Check auth/session, rollback if needed
- **Medium (slow page)** → Optimize queries, cache results
- **Low (cosmetic)** → Log and fix in next release

---

## Ops Runbook (TBD Post-UAT)

After UAT, will document:
- How to recover from opname corruption
- How to backfill ledger if needed
- How to diagnose balance drift
- Nightly monitoring checklist
