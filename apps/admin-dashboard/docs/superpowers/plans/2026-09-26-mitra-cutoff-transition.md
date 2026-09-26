# Cutoff Transisi Outlet Internal ke Kemitraan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menetapkan batasan tanggal cutoff kemitraan (26 September 2026) untuk Outlet Sawangan sehingga seluruh transaksi era internal sebelum tanggal tersebut tidak bocor ke Dashboard Kemitraan maupun perhitungan BEP/ROI.

**Architecture:** Menggunakan `mitra_investments.tanggal_mulai` sebagai Single Source of Truth batasan kemitraan per outlet. Mengoptimalkan RPC Postgres `get_mitra_orders_summary`, server action `mitraPnl.ts`, akrual BEP di `mitraRoi.ts`, dan utility `outletOwnership.ts` agar menyaring transaksi secara tanggal-sadar (*date-aware*).

**Tech Stack:** Next.js (App Router, Server Actions), Supabase (PostgreSQL RPC, PL/pgSQL), TypeScript, Vitest.

## Global Constraints

- Cutoff tanggal mulai kemitraan Sawangan: `2026-09-26` (WIB).
- Transaksi Sawangan sebelum 26 September 2026 harus tetap terhitung sebagai milik Internal/Pusat.
- Tidak boleh merusak kalkulasi outlet mitra lain (Cibinong, Sentul, Paledang, Ciseeng, Pekayon, Kalisari, Cibubur, Cicurug, Cileungsi, Pamulang).
- Buffer and performance overhead di Postgres RPC harus tetap optimal (index-friendly).

---

### Task 1: Setup Data Investasi & Profil Sawangan di Database

**Files:**
- Modify/Execute: `scripts/seed_sawangan_investment.js`

**Interfaces:**
- Produces: Baris di `public.mitra_investments` untuk outlet Sawangan (`550e8400-e29b-41d4-a716-446655440008`) dengan `tanggal_mulai = '2026-09-26'` dan update `mitra_profiles.tanggal_pks = '2026-09-26'`.

- [ ] **Step 1: Buat script migrasi data seed untuk investasi Sawangan**

```javascript
// scripts/seed_sawangan_investment.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://khpkoreaaucvyqfhynfq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocGtvcmVhYXVjdnlxZmh5bmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2MzI5MiwiZXhwIjoyMDk2NTM5MjkyfQ.Dy0QMAHfB8EU9BK-JuyRrBidpG6iM94t9RtiJ_viZz8'
);

async function main() {
  const sawanganId = '550e8400-e29b-41d4-a716-446655440008';

  // 1. Upsert ke mitra_investments
  const { data: inv, error: errInv } = await supabase
    .from('mitra_investments')
    .upsert({
      outlet_id: sawanganId,
      nilai_investasi: 0,
      tanggal_mulai: '2026-09-26',
      catatan: 'Peralihan cabang internal ke kemitraan per 26 Sept 2026',
      persentase_bagi_hasil: 100,
      management_fee: 3,
      is_profit_sharing_active: true,
      omzet_historis: 0,
      transfer_historis: 0
    }, { onConflict: 'outlet_id' })
    .select();
  
  if (errInv) throw errInv;
  console.log('Investasi Sawangan berhasil di-upsert:', inv);

  // 2. Update tanggal_pks di mitra_profiles
  const { data: prof, error: errProf } = await supabase
    .from('mitra_profiles')
    .update({ tanggal_pks: '2026-09-26' })
    .contains('outlet_ids', [sawanganId])
    .select();
  
  if (errProf) throw errProf;
  console.log('Profil Mitra Sawangan berhasil di-update:', prof);
}

main().catch(console.error);
```

- [ ] **Step 2: Jalankan script seed dan verifikasi**
Run: `node scripts/seed_sawangan_investment.js`
Expected: Output menampilkan baris `mitra_investments` dan `mitra_profiles` ter-update dengan `tanggal_mulai: '2026-09-26'`.

---

### Task 2: Migrasi RPC Postgres `get_mitra_orders_summary` Sadar Cutoff Date

**Files:**
- Create: `supabase/migrations/20300247000000_mitra_orders_summary_cutoff_aware.sql`
- Execute: script apply migration

**Interfaces:**
- Consumes: `public.mitra_investments.tanggal_mulai`
- Produces: `public.get_mitra_orders_summary(uuid[], timestamptz, timestamptz)` dengan filter `o.created_at >= GREATEST(p_from, COALESCE((SELECT (mi.tanggal_mulai::text || ' 00:00:00+07')::timestamptz FROM public.mitra_investments mi WHERE mi.outlet_id = o.outlet_id LIMIT 1), p_from))`

- [ ] **Step 1: Tulis migration SQL**

```sql
-- supabase/migrations/20300247000000_mitra_orders_summary_cutoff_aware.sql
BEGIN;

CREATE OR REPLACE FUNCTION public.get_mitra_orders_summary(
    p_outlet_ids uuid[],
    p_from timestamp with time zone,
    p_to timestamp with time zone
)
RETURNS SETOF mitra_orders_summary_row
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH orders_filtered AS (
        SELECT
            o.id AS order_id,
            o.outlet_id,
            COALESCE(o.total_amount, 0)     AS total_amount,
            COALESCE(o.discount_amount, 0)  AS discount_amount,
            COALESCE(o.promo_subsidy, 0)    AS promo_subsidy,
            lower(COALESCE(o.channel, 'pos'))                  AS channel,
            (o.created_at AT TIME ZONE 'Asia/Jakarta')::date   AS tgl,
            CASE
                WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%tiktok%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%tiktok%'
                     OR o.channel = 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8'
                     OR o.channel = 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5') THEN 'tiktok'
                WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%grab%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gofood%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%go_food%'
                     OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gojek%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%shopee%'
                     OR lower(COALESCE(o.sales_source, o.channel, 'pos')) IN ('food_delivery', 'food_apps', 'foodapps')
                     OR lower(COALESCE(o.channel, 'pos')) LIKE '%grab%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%gofood%'
                     OR lower(COALESCE(o.channel, 'pos')) LIKE '%go_food%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%gojek%'
                     OR lower(COALESCE(o.channel, 'pos')) LIKE '%shopee%'
                     OR lower(COALESCE(o.channel, 'pos')) IN ('food_delivery', 'food_apps', 'foodapps')
                     OR o.channel IN ('1284ac2a-e753-4380-9f32-59219a322459',
                                    '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a',
                                    '0eaf2746-da9f-492c-a9b4-f091307c98c2')) THEN 'foodApps'
                ELSE 'pos'
            END AS channel_group,
            CASE WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%grab%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%grab%'
                       OR o.channel = '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a')
                      AND lower(COALESCE(o.sales_source, o.channel, 'pos')) NOT LIKE '%tiktok%' AND lower(COALESCE(o.channel, 'pos')) NOT LIKE '%tiktok%'
                 THEN COALESCE(o.total_amount, 0) ELSE 0 END AS grab_rev_val,
            CASE WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gofood%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%go_food%' OR lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%gojek%'
                       OR lower(COALESCE(o.channel, 'pos')) LIKE '%gofood%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%go_food%'
                       OR lower(COALESCE(o.channel, 'pos')) LIKE '%gojek%'
                       OR o.channel = '1284ac2a-e753-4380-9f32-59219a322459')
                      AND lower(COALESCE(o.sales_source, o.channel, 'pos')) NOT LIKE '%tiktok%' AND lower(COALESCE(o.channel, 'pos')) NOT LIKE '%tiktok%'
                 THEN COALESCE(o.total_amount, 0) ELSE 0 END AS gofood_rev_val,
            CASE WHEN (lower(COALESCE(o.sales_source, o.channel, 'pos')) LIKE '%shopee%' OR lower(COALESCE(o.channel, 'pos')) LIKE '%shopee%'
                       OR o.channel = '0eaf2746-da9f-492c-a9b4-f091307c98c2')
                      AND lower(COALESCE(o.sales_source, o.channel, 'pos')) NOT LIKE '%tiktok%' AND lower(COALESCE(o.channel, 'pos')) NOT LIKE '%tiktok%'
                 THEN COALESCE(o.total_amount, 0) ELSE 0 END AS shopee_rev_val
        FROM public.orders o
        LEFT JOIN public.mitra_investments mi ON mi.outlet_id = o.outlet_id
        WHERE o.status = 'completed'
          AND o.outlet_id = ANY(p_outlet_ids)
          AND o.outlet_id != '00000000-0000-0000-0000-000000000000'
          AND o.created_at >= GREATEST(
              p_from,
              COALESCE((mi.tanggal_mulai::text || ' 00:00:00+07')::timestamptz, p_from)
          )
          AND o.created_at <= p_to
    ),
    order_items_val AS (
        SELECT oi.order_id, SUM(oi.subtotal) AS item_value
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        GROUP BY oi.order_id
    ),
    rev_by_group AS (
        SELECT
            of.outlet_id,
            of.channel_group,
            COUNT(*)::integer AS order_count,
            SUM(of.total_amount + CASE
                WHEN oiv.item_value IS NULL THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oiv.item_value - of.total_amount)
            END) AS gross_revenue,
            SUM(CASE
                WHEN oiv.item_value IS NULL THEN of.discount_amount + of.promo_subsidy
                ELSE GREATEST(0, oiv.item_value - of.total_amount)
            END) AS deductions,
            SUM(of.grab_rev_val)   AS grab_rev,
            SUM(of.gofood_rev_val) AS gofood_rev,
            SUM(of.shopee_rev_val) AS shopee_rev
        FROM orders_filtered of
        LEFT JOIN order_items_val oiv ON of.order_id = oiv.order_id
        GROUP BY of.outlet_id, of.channel_group
    ),
    active_channels AS (
        SELECT DISTINCT channel FROM orders_filtered
    ),
    period_check AS (
        SELECT EXISTS (
            SELECT 1 FROM public.menu_hpp_riwayat
            WHERE berlaku_mulai > (p_from AT TIME ZONE 'Asia/Jakarta')::date
              AND berlaku_mulai <= (p_to AT TIME ZONE 'Asia/Jakarta')::date
        ) AS has_price_change
    ),
    item_hpp_lookup AS (
        SELECT
            m.id AS menu_item_id,
            ac.channel,
            public.get_mitra_item_hpp(m.id, ac.channel, (p_to AT TIME ZONE 'Asia/Jakarta')::date) AS hpp
        FROM public.menu_items m
        CROSS JOIN active_channels ac
    ),
    cogs_by_group AS (
        SELECT
            of.outlet_id,
            of.channel_group,
            SUM(oi.quantity * CASE
                WHEN pc.has_price_change THEN
                    COALESCE(
                        NULLIF(public.get_mitra_item_hpp(oi.menu_item_id, of.channel, of.tgl), 0),
                        public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl),
                        0
                    )
                ELSE
                    COALESCE(
                        NULLIF(lk.hpp, 0),
                        public.get_mitra_item_hpp_by_name(oi.menu_item_name, of.channel, of.tgl),
                        0
                    )
            END) AS cogs
        FROM public.order_items oi
        JOIN orders_filtered of ON oi.order_id = of.order_id
        CROSS JOIN period_check pc
        LEFT JOIN item_hpp_lookup lk ON oi.menu_item_id = lk.menu_item_id AND of.channel = lk.channel
        GROUP BY of.outlet_id, of.channel_group
    )
    SELECT
        r.outlet_id,
        r.channel_group,
        r.gross_revenue,
        r.deductions,
        COALESCE(c.cogs, 0) AS cogs,
        r.order_count,
        r.grab_rev,
        r.gofood_rev,
        r.shopee_rev
    FROM rev_by_group r
    LEFT JOIN cogs_by_group c ON r.outlet_id = c.outlet_id AND r.channel_group = c.channel_group;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_mitra_orders_summary(uuid[], timestamp with time zone, timestamp with time zone) TO authenticated, service_role, anon;

COMMIT;
```

- [ ] **Step 2: Jalankan migrasi dan uji via script**
Jalankan uji:
1. Panggil `get_mitra_orders_summary` dengan `p_from = '2026-09-01'`, `p_to = '2026-09-25'` untuk Sawangan -> harus kosong (0 row).
2. Panggil `get_mitra_orders_summary` dengan `p_from = '2026-09-01'`, `p_to = '2026-09-26'` untuk Sawangan -> hanya menghasilkan penjualan tanggal 26 September.

---

### Task 3: Filter OPEX, Waste, dan Settlements di `mitraPnl.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/app/actions/mitraPnl.ts`

- [ ] **Step 1: Tambahkan filter cutoff untuk expenses dan waste**
Di `mitraPnl.ts`, setelah `investmentsRes` diterima:
Buat map `outletCutoffMap = new Map<string, string>()` dari `investments.tanggal_mulai`.
Filter data:
- `pettyExpenses = pettyExpenses.filter(e => !outletCutoffMap.has(e.outlet_id) || e.expense_date >= outletCutoffMap.get(e.outlet_id)!)`
- `monthlyExpenses = monthlyExpenses.filter(e => !outletCutoffMap.has(e.outlet_id) || e.expense_date >= outletCutoffMap.get(e.outlet_id)!)`
- `settlements = settlements.filter(s => !outletCutoffMap.has(s.outlet_id) || s.tanggal >= outletCutoffMap.get(s.outlet_id)!)`
- Di kalkulasi direct waste reports, tambahkan filter `created_at >= (cutoffDate + 'T00:00:00+07:00')`.

---

### Task 4: Tangani Akrual Realtime di `mitraRoi.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/app/actions/mitraRoi.ts`

- [ ] **Step 1: Skip bulan sebelum `tanggal_mulai` outlet**
Di `getMitraRealtimeBepBreakdown`:
Untuk setiap outlet:
```typescript
const outletTanggalMulai = invMap[oid]?.tanggal_mulai
const outletStartMonth = outletTanggalMulai ? outletTanggalMulai.slice(0, 7) : SYSTEM_START_MONTH

for (const m of activeMonths) {
  if (m.key < outletStartMonth) {
    // Lewati bulan sebelum outlet menjadi mitra resmi
    continue
  }
  // Lanjutkan kalkulasi akrual bulan berjalan...
}
```

---

### Task 5: Date-Aware Scope di `src/lib/outletOwnership.ts`

**Files:**
- Modify: `apps/admin-dashboard/src/lib/outletOwnership.ts`
- Modify: `apps/admin-dashboard/src/lib/outletOwnership.test.ts`

- [ ] **Step 1: Tulis unit test untuk `isMitraAtDate` / `isInScopeAtDate`**
- [ ] **Step 2: Implementasi date-awareness di `outletOwnership.ts`**
Memastikan bahwa untuk outlet yang beralih status pada tanggal $D$, tanggal $< D$ dievaluasi sebagai `internal`, dan $\ge D$ sebagai `mitra`.

---

### Task 6: Verifikasi Akhir & Laporan

- [ ] **Step 1: Jalankan seluruh test suite unit test**
Run: `yarn test` di `apps/admin-dashboard`
- [ ] **Step 2: Jalankan end-to-end data check script**
Verifikasi angka Laba Rugi Sawangan di Dashboard Kemitraan:
- Kemarin (25 Sept): Rp 0
- Hari ini (26 Sept): Sesuai transaksi hari ini
- September (1-26 Sept): Hanya mencatat transaksi hari ini
- BEP/ROI: Akrual Agustus = Rp 0
