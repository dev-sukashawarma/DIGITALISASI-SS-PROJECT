# Waste Dashboard Komprehensif + Laporan Per-Insiden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merombak `/dashboard/owner/waste` di `apps/admin-dashboard` agar angka waste bisa dibandingkan antar-outlet secara adil, dan menambah laporan per-insiden untuk setiap waste yang sudah di-approve.

**Architecture:** Dua RPC Postgres baru menggantikan `get_waste_breakdown` khusus untuk halaman ini — satu agregat kecil (menyuplai semua tile, chart, ranking) dan satu daftar insiden terpaginasi di server. Pemisahan ini wajib karena cap 1.000 baris PostgREST bisa memotong hasil tanpa error. Di sisi klien, semua aritmetika baru tinggal di fungsi murni ber-unit-test, dan `page.tsx` menjadi composition root tipis di atas enam komponen terekstrak.

**Tech Stack:** Next.js App Router (client components), React 18, TypeScript, TanStack Query v5, TailwindCSS (palet `suka-*`), Recharts, framer-motion, lucide-react, Supabase JS, Vitest + jsdom, Postgres/PL-pgSQL.

**Spec:** `docs/superpowers/specs/2026-09-07-waste-dashboard-comprehensive-design.md`

---

## Global Constraints

Berlaku untuk **semua** task di bawah.

- **Branch:** `feat/waste-dashboard-comprehensive`. ⚠️ Otomasi repo ini terbukti memindahkan branch di tengah sesi (sudah terjadi sekali saat menulis plan ini — commit selamat, working tree berpindah ke `main`). **Jalankan `git branch --show-current` sebelum setiap commit.** Kalau sudah pindah, `git checkout feat/waste-dashboard-comprehensive` dan lanjutkan.
- **Jangan sentuh file yang tidak disebut plan ini.** Working tree bisa berisi perubahan tak-terkait dari dev/otomasi lain (saat plan ini ditulis: `ProfitView.tsx`, `Sidebar.tsx`). `git add` selalu dengan path eksplisit, **tidak pernah** `git add -A` atau `git add .`.
- **Akses:** owner/admin saja. Kedua RPC dijaga `public.is_owner_or_admin()` dan `public.accessible_outlet_ids()`. Tidak ada perubahan RLS, policy, atau role.
- **Jangan ubah** `get_waste_periode` (menyuplai halaman Profit & Expenses — mengubahnya menggeser Laba Bersih termasuk milik mitra) dan **jangan ubah** `get_waste_breakdown` (dibiarkan utuh untuk konsumen lain).
- **Bahasa UI Indonesia.** Rupiah lewat `rupiah()` dari `@/lib/format`. Palet `suka-*` (`suka-brown`, `suka-cream`, `suka-gray-*`, `suka-ink`, `suka-orange`, `suka-green`) + `red-*` untuk kerugian.
- **React 18 — JANGAN taruh hook setelah early-return.** Semua `useState`/`useMemo`/`useEffect` harus berada di atas `if (...) return`. Pelanggaran = React error #310 di produksi (crash yang pernah terjadi di app `stok`).
- **Pembagian nol → `null`, dirender `N/A`.** Tidak pernah `Infinity`, tidak pernah `0%` palsu. Ikuti konvensi `computeWasteGap` di `src/lib/wasteGap.ts`.
- **Perintah verifikasi** (dijalankan dari `apps/admin-dashboard`):
  - `yarn test` → `vitest run`
  - `yarn type-check` → `tsc --noEmit`
  - `yarn build` → `next build`
- **Baseline test:** suite ini punya kegagalan pre-existing yang tak terkait. Sebelum mulai, catat jumlah gagal; di akhir jumlahnya harus **sama atau lebih kecil**. Nol regresi, bukan nol kegagalan.
- **Unit test hanya untuk fungsi murni di `src/lib/*.test.ts`.** Itu konvensi nyata app ini (semua test yang ada ada di sana). Komponen React diverifikasi lewat `type-check` + `build` + smoke test manual, bukan test render.
- **Faktor penuh (kecil per besar)** — ekspresi kanonik, dipakai identik di setiap tempat:
  ```sql
  GREATEST(COALESCE(CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
                         THEN b.faktor_tampilan ELSE b.faktor_konversi END, 1), 1)
  ```
- **Basis harga kanonik (sejak 2026-09-03):** `harga_beli` per satuan besar, `kemasan_qty` = faktor penuh, harga per satuan kecil = `harga_beli / kemasan_qty`.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `supabase/migrations/20300202000000_waste_dashboard_rpcs.sql` | **Create** — dua RPC baru |
| `src/lib/wasteMetrics.ts` | **Create** — fungsi murni baru (delta, % omzet, sebaran outlet) |
| `src/lib/wasteMetrics.test.ts` | **Create** — unit test fungsi di atas |
| `src/hooks/useWasteSummary.ts` | **Create** — wrapper `get_waste_summary_v2` |
| `src/hooks/useWasteIncidents.ts` | **Create** — wrapper `get_waste_incidents`, terpaginasi |
| `src/components/waste/WasteKpiRow.tsx` | **Create** — 4 tile KPI |
| `src/components/waste/WasteOutletRanking.tsx` | **Create** — tabel ranking outlet, sortable |
| `src/components/waste/WasteReasonBreakdown.tsx` | **Create** — bar per alasan |
| `src/components/waste/WasteBahanRanking.tsx` | **Create** — ranking bahan + sebaran outlet |
| `src/components/waste/WasteIncidentTable.tsx` | **Create** — tabel per-insiden + paginasi |
| `src/components/waste/WasteIncidentDetailModal.tsx` | **Create** — modal detail satu insiden |
| `src/app/dashboard/owner/waste/page.tsx` | **Modify** — jadi composition root tipis |

**Dipakai ulang, TIDAK diubah:** `src/lib/wasteBreakdown.ts` (`aggregateByOutlet`, `aggregateByReason`, `aggregateByDate` — `aggregateByReason` dan `aggregateByBahan` sudah ada tapi belum dipakai halaman), `src/lib/wasteGap.ts` (`computeWasteGap`), `src/lib/period.ts` (`previousRange`, `diffDays`), `src/hooks/useBudgetLoss.ts`, `src/hooks/useSalesSummary.ts`, `src/hooks/useOutlets.ts`, `src/hooks/useScopedFilter.ts`, `src/components/WasteTrendChart.tsx`, `src/components/ui/*`.

---

## Task 1: Migration — dua RPC baru

**Files:**
- Create: `supabase/migrations/20300202000000_waste_dashboard_rpcs.sql`

**Interfaces:**
- Consumes: tabel `stok_waste_reports`, `outlets`, `bahan_baku`, `bahan_baku_harga`, `outlet_staff`, `ledger_stok`; fungsi `public.is_owner_or_admin()`, `public.accessible_outlet_ids()`.
- Produces:
  - `get_waste_summary_v2(p_from date, p_to date)` → `TABLE(outlet_id uuid, outlet_name text, bahan_baku_id uuid, bahan_nama text, reason text, tanggal date, qty numeric, qty_kecil numeric, satuan_kecil text, hpp_kecil numeric, nilai numeric, jumlah_insiden bigint)`
  - `get_waste_incidents(p_from date, p_to date, p_outlet_id uuid, p_limit int, p_offset int)` → `TABLE(id uuid, outlet_id uuid, outlet_name text, bahan_baku_id uuid, bahan_nama text, reason text, qty numeric, qty_kecil numeric, satuan_besar text, satuan_kecil text, hpp_kecil numeric, nilai numeric, photo_url text, reporter_name text, approver_name text, created_at timestamptz, updated_at timestamptz, ledger_row_count bigint, total_count bigint)`

**Catatan timestamp:** `20300202000000` dipilih karena migration tertinggi saat ini `20300201000000`. Timestamp 2030 adalah utang teknis yang sudah ada di repo ini (ranjau yang selalu jalan terakhir); jangan menambah yang baru di luar deret ini, dan jangan me-rename yang lama.

- [ ] **Step 1: Cek tidak ada tabrakan nama fungsi**

Run dari root repo:
```bash
grep -rn "get_waste_summary_v2\|get_waste_incidents" supabase/migrations/
```
Expected: tidak ada output (exit 1). Kalau ADA output, berhenti dan lapor — berarti dev lain sudah memakai nama itu.

- [ ] **Step 2: Tulis file migration**

Create `supabase/migrations/20300202000000_waste_dashboard_rpcs.sql`:

```sql
-- 20300202000000_waste_dashboard_rpcs.sql
--
-- Dua RPC untuk halaman /dashboard/owner/waste (admin-dashboard) yang dirombak.
-- Spec: docs/superpowers/specs/2026-09-07-waste-dashboard-comprehensive-design.md
--
-- KENAPA DUA, BUKAN SATU: PostgREST memotong hasil RPC di 1.000 baris tanpa
-- error. Satu bulan waste di 19 outlet berpotensi melewatinya, dan total yang
-- terpotong lebih berbahaya daripada tidak ada total karena angkanya tetap
-- terlihat masuk akal. Jadi agregat di-roll up di server (hasil kecil), daftar
-- insiden dipaginasi di server (hasil dibatasi 100).
--
-- PERBAIKAN VALUASI: hpp_kecil kini dibagi kemasan_qty (basis harga kanonik
-- 2026-09-03), bukan faktor_konversi seperti get_waste_breakdown. Ini HANYA
-- mengubah kolom tampilan per-satuan. Kolom `nilai` (= qty * harga_beli) tidak
-- disentuh dan tidak menggeser satu rupiah pun di total mana pun.
--
-- TIDAK MENYENTUH get_waste_periode (menyuplai Profit/Expenses -> Laba Bersih)
-- maupun get_waste_breakdown (masih dipakai konsumen lain).

-- ── 1. Agregat ────────────────────────────────────────────────────────────
-- Satu baris per (outlet, bahan, alasan, tanggal). Menyuplai seluruh tile,
-- chart, dan ranking di halaman.

CREATE OR REPLACE FUNCTION get_waste_summary_v2(p_from date, p_to date)
RETURNS TABLE(
  outlet_id uuid,
  outlet_name text,
  bahan_baku_id uuid,
  bahan_nama text,
  reason text,
  tanggal date,
  qty numeric,
  qty_kecil numeric,
  satuan_kecil text,
  hpp_kecil numeric,
  nilai numeric,
  jumlah_insiden bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      w.outlet_id                                   AS s_outlet_id,
      o.name                                        AS s_outlet_name,
      w.bahan_baku_id                               AS s_bahan_baku_id,
      b.nama                                        AS s_bahan_nama,
      w.reason                                      AS s_reason,
      (w.created_at AT TIME ZONE 'Asia/Jakarta')::date AS s_tanggal,
      w.qty                                         AS s_qty,
      b.satuan_kecil                                AS s_satuan_kecil,
      COALESCE(bh.harga_beli, 0)                    AS s_harga_beli,
      NULLIF(bh.kemasan_qty, 0)                     AS s_kemasan_qty,
      -- faktor penuh (kecil per besar) -- ekspresi kanonik, sama persis dengan
      -- 20300120000001, trg_process_bom_stok, dan to_ledger_scale().
      GREATEST(
        COALESCE(
          CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
               THEN b.faktor_tampilan
               ELSE b.faktor_konversi
          END,
          1
        ),
        1
      ) AS s_faktor_penuh
    FROM stok_waste_reports w
    JOIN outlets o     ON o.id = w.outlet_id
    JOIN bahan_baku b  ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND w.outlet_id IN (SELECT public.accessible_outlet_ids())
  )
  SELECT
    s.s_outlet_id,
    s.s_outlet_name,
    s.s_bahan_baku_id,
    s.s_bahan_nama,
    s.s_reason,
    s.s_tanggal,
    SUM(s.s_qty)::numeric,
    SUM(s.s_qty * s.s_faktor_penuh)::numeric,
    s.s_satuan_kecil,
    (s.s_harga_beli / COALESCE(s.s_kemasan_qty, s.s_faktor_penuh))::numeric,
    SUM(s.s_qty * s.s_harga_beli)::numeric,
    COUNT(*)::bigint
  FROM scoped s
  GROUP BY
    s.s_outlet_id, s.s_outlet_name, s.s_bahan_baku_id, s.s_bahan_nama,
    s.s_reason, s.s_tanggal, s.s_satuan_kecil, s.s_harga_beli,
    s.s_kemasan_qty, s.s_faktor_penuh;
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_summary_v2(date, date) TO authenticated;

-- ── 2. Daftar insiden (terpaginasi) ───────────────────────────────────────
-- Satu baris per laporan waste. p_outlet_id NULL = semua outlet yang boleh
-- diakses. total_count dihitung window function SEBELUM LIMIT, jadi UI bisa
-- menampilkan jumlah halaman yang jujur.
--
-- ledger_row_count menjawab kelas bug yang didokumentasikan 20300120000002:
-- laporan APPROVED yang tidak pernah menghasilkan baris ledger sama sekali
-- (4 kasus nyata Agustus 2026). Yang dilaporkan KEBERADAAN, bukan kecocokan
-- qty -- skala ledger bergantung saldo_is_gram sedangkan qty laporan selalu
-- satuan besar, jadi perbandingan langsung akan memicu alarm palsu.

CREATE OR REPLACE FUNCTION get_waste_incidents(
  p_from      date,
  p_to        date,
  p_outlet_id uuid DEFAULT NULL,
  p_limit     int  DEFAULT 25,
  p_offset    int  DEFAULT 0
)
RETURNS TABLE(
  id               uuid,
  outlet_id        uuid,
  outlet_name      text,
  bahan_baku_id    uuid,
  bahan_nama       text,
  reason           text,
  qty              numeric,
  qty_kecil        numeric,
  satuan_besar     text,
  satuan_kecil     text,
  hpp_kecil        numeric,
  nilai            numeric,
  photo_url        text,
  reporter_name    text,
  approver_name    text,
  created_at       timestamptz,
  updated_at       timestamptz,
  ledger_row_count bigint,
  total_count      bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit  int := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  IF NOT public.is_owner_or_admin() THEN
    RAISE EXCEPTION 'Hanya owner/admin yang boleh melihat rincian waste';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      w.id                       AS s_id,
      w.outlet_id                AS s_outlet_id,
      o.name                     AS s_outlet_name,
      w.bahan_baku_id            AS s_bahan_baku_id,
      b.nama                     AS s_bahan_nama,
      w.reason                   AS s_reason,
      w.qty                      AS s_qty,
      b.satuan                   AS s_satuan_besar,
      b.satuan_kecil             AS s_satuan_kecil,
      w.photo_url                AS s_photo_url,
      rep.name                   AS s_reporter_name,
      apr.name                   AS s_approver_name,
      w.created_at               AS s_created_at,
      w.updated_at               AS s_updated_at,
      COALESCE(bh.harga_beli, 0) AS s_harga_beli,
      NULLIF(bh.kemasan_qty, 0)  AS s_kemasan_qty,
      GREATEST(
        COALESCE(
          CASE WHEN b.faktor_tengah IS NOT NULL AND b.faktor_tampilan IS NOT NULL
               THEN b.faktor_tampilan
               ELSE b.faktor_konversi
          END,
          1
        ),
        1
      ) AS s_faktor_penuh
    FROM stok_waste_reports w
    JOIN outlets o    ON o.id = w.outlet_id
    JOIN bahan_baku b ON b.id = w.bahan_baku_id
    LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
    LEFT JOIN outlet_staff rep    ON rep.id = w.reported_by
    LEFT JOIN outlet_staff apr    ON apr.id = w.approved_by
    WHERE w.status = 'APPROVED'
      AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
      AND w.outlet_id IN (SELECT public.accessible_outlet_ids())
      AND (p_outlet_id IS NULL OR w.outlet_id = p_outlet_id)
  )
  SELECT
    s.s_id,
    s.s_outlet_id,
    s.s_outlet_name,
    s.s_bahan_baku_id,
    s.s_bahan_nama,
    s.s_reason,
    s.s_qty,
    (s.s_qty * s.s_faktor_penuh)::numeric,
    s.s_satuan_besar,
    s.s_satuan_kecil,
    (s.s_harga_beli / COALESCE(s.s_kemasan_qty, s.s_faktor_penuh))::numeric,
    (s.s_qty * s.s_harga_beli)::numeric,
    s.s_photo_url,
    s.s_reporter_name,
    s.s_approver_name,
    s.s_created_at,
    s.s_updated_at,
    (SELECT COUNT(*) FROM ledger_stok l WHERE l.ref_waste_id = s.s_id)::bigint,
    -- Tanda kurung luar WAJIB: `COUNT(*) OVER ()::bigint` salah parse.
    (COUNT(*) OVER ())::bigint
  FROM scoped s
  ORDER BY s.s_created_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_waste_incidents(date, date, uuid, int, int) TO authenticated;
```

- [ ] **Step 3: Commit file migration**

```bash
git branch --show-current   # HARUS feat/waste-dashboard-comprehensive
git add supabase/migrations/20300202000000_waste_dashboard_rpcs.sql
git commit -m "feat(db): RPC agregat + insiden waste untuk dashboard yang dirombak"
```

- [ ] **Step 4: Apply ke DB — JANGAN `supabase db push` polos**

Riwayat migration di DB bersama ini rutin diverged karena dev lain push paralel. `db push` akan tersandung migration remote-only yang tidak punya file lokal.

Urutan yang benar:
1. Coba `supabase db push`. Kalau lolos, lanjut Step 5.
2. Kalau terhalang drift: **jangan** `migration repair --status reverted` pada timestamp milik orang lain (pernah menyebabkan insiden di proyek ini). Sebagai gantinya, apply isi file langsung lewat SQL Editor Supabase / RPC `exec_sql`, lalu stempel:
   ```bash
   supabase migration repair --status applied 20300202000000
   ```

- [ ] **Step 5: Verifikasi ground-truth di DB live — bukan `migration list`**

Status `migration list` tidak membuktikan fungsinya ada (pelajaran berulang di proyek ini). Jalankan:

```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('get_waste_summary_v2', 'get_waste_incidents');
```

Expected: **2 baris**, keduanya `prosecdef = true`.

- [ ] **Step 6: Uji penerimaan valuasi — total tidak boleh bergeser**

```sql
-- Ganti tanggal dengan periode yang punya data waste.
SELECT
  (SELECT SUM(nilai) FROM get_waste_summary_v2('2026-08-01','2026-08-31')) AS total_baru,
  (SELECT SUM(nilai) FROM get_waste_breakdown ('2026-08-01','2026-08-31')) AS total_lama;
```

Expected: **kedua angka identik.** Kalau berbeda, hentikan — berarti perbaikan pembagi bocor ke kolom `nilai`, yang dilarang spec.

---

## Task 2: Fungsi murni `wasteMetrics.ts` (TDD)

**Files:**
- Create: `apps/admin-dashboard/src/lib/wasteMetrics.ts`
- Test: `apps/admin-dashboard/src/lib/wasteMetrics.test.ts`

**Interfaces:**
- Consumes: tidak ada dependensi ke task lain. `WasteSummaryRow` **didefinisikan di file ini**, bukan diimpor — ia mencerminkan bentuk hasil `get_waste_summary_v2` (Task 1) dan berbeda dari `WasteBreakdownRow` yang sudah ada karena punya `jumlah_insiden`.
- Produces:
  - `computeDeltaPct(current: number, previous: number): number | null`
  - `computeWastePctOmzet(nilai: number, omzet: number): number | null`
  - `aggregateByBahanWithSpread(rows: WasteSummaryRow[]): BahanSpreadAgg[]`
  - `interface BahanSpreadAgg { id: string; name: string; nilai: number; qty_kecil: number; satuan_kecil: string; outletCount: number }`
  - `interface WasteSummaryRow` (baris `get_waste_summary_v2`, di-export dari sini)

Semua dijalankan dari `apps/admin-dashboard`.

- [ ] **Step 1: Tulis test yang gagal**

Create `src/lib/wasteMetrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeDeltaPct,
  computeWastePctOmzet,
  aggregateByBahanWithSpread,
  type WasteSummaryRow,
} from './wasteMetrics'

const row = (over: Partial<WasteSummaryRow>): WasteSummaryRow => ({
  outlet_id: 'o1',
  outlet_name: 'Outlet 1',
  bahan_baku_id: 'b1',
  bahan_nama: 'KEJU',
  reason: 'Basi / Expired',
  tanggal: '2026-08-01',
  qty: 1,
  qty_kecil: 10,
  satuan_kecil: 'Lembar',
  hpp_kecil: 1000,
  nilai: 10000,
  jumlah_insiden: 1,
  ...over,
})

describe('computeDeltaPct', () => {
  it('naik 50% ketika 100 -> 150', () => {
    expect(computeDeltaPct(150, 100)).toBe(50)
  })

  it('turun 25% ketika 100 -> 75', () => {
    expect(computeDeltaPct(75, 100)).toBe(-25)
  })

  it('mengembalikan null ketika periode sebelumnya nol (bukan Infinity)', () => {
    expect(computeDeltaPct(150, 0)).toBeNull()
  })

  it('mengembalikan 0 ketika keduanya sama', () => {
    expect(computeDeltaPct(100, 100)).toBe(0)
  })
})

describe('computeWastePctOmzet', () => {
  it('menghitung 2% dari 20.000 waste atas 1.000.000 omzet', () => {
    expect(computeWastePctOmzet(20_000, 1_000_000)).toBe(2)
  })

  it('mengembalikan null ketika omzet nol (bukan Infinity)', () => {
    expect(computeWastePctOmzet(20_000, 0)).toBeNull()
  })

  it('mengembalikan null ketika omzet negatif', () => {
    expect(computeWastePctOmzet(20_000, -5)).toBeNull()
  })
})

describe('aggregateByBahanWithSpread', () => {
  it('menjumlahkan nilai per bahan dan mengurutkan menurun', () => {
    const out = aggregateByBahanWithSpread([
      row({ bahan_baku_id: 'b1', bahan_nama: 'KEJU', nilai: 100 }),
      row({ bahan_baku_id: 'b2', bahan_nama: 'SAPI', nilai: 500 }),
      row({ bahan_baku_id: 'b1', bahan_nama: 'KEJU', nilai: 50 }),
    ])
    expect(out.map((b) => b.name)).toEqual(['SAPI', 'KEJU'])
    expect(out[1].nilai).toBe(150)
  })

  it('menghitung sebaran outlet unik, bukan jumlah baris', () => {
    const out = aggregateByBahanWithSpread([
      row({ outlet_id: 'o1', nilai: 10 }),
      row({ outlet_id: 'o1', nilai: 10 }),
      row({ outlet_id: 'o2', nilai: 10 }),
    ])
    expect(out[0].outletCount).toBe(2)
  })

  it('menjumlahkan qty_kecil dan mempertahankan satuan', () => {
    const out = aggregateByBahanWithSpread([
      row({ qty_kecil: 4, satuan_kecil: 'Lembar' }),
      row({ qty_kecil: 6, satuan_kecil: 'Lembar' }),
    ])
    expect(out[0].qty_kecil).toBe(10)
    expect(out[0].satuan_kecil).toBe('Lembar')
  })

  it('mengembalikan array kosong untuk input kosong', () => {
    expect(aggregateByBahanWithSpread([])).toEqual([])
  })
})
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `yarn vitest run src/lib/wasteMetrics.test.ts`
Expected: FAIL — `Failed to resolve import "./wasteMetrics"`.

- [ ] **Step 3: Tulis implementasi minimal**

Create `src/lib/wasteMetrics.ts`:

```ts
// apps/admin-dashboard/src/lib/wasteMetrics.ts
// Fungsi murni tambahan untuk dashboard waste. Yang sudah ada di
// wasteBreakdown.ts (aggregateByOutlet/Reason/Date) dipakai ulang, tidak
// diduplikasi di sini.

/** Satu baris hasil get_waste_summary_v2. */
export interface WasteSummaryRow {
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  bahan_nama: string
  reason: string
  tanggal: string // 'YYYY-MM-DD'
  qty: number
  qty_kecil: number
  satuan_kecil: string
  hpp_kecil: number
  nilai: number
  jumlah_insiden: number
}

export interface BahanSpreadAgg {
  id: string
  name: string
  nilai: number
  qty_kecil: number
  satuan_kecil: string
  /** Berapa outlet berbeda melaporkan bahan ini. 1 = masalah lokal, banyak = sistemik. */
  outletCount: number
}

/**
 * Perubahan persen terhadap periode sebelumnya.
 * previous <= 0 -> null (dirender "N/A"), bukan Infinity.
 */
export function computeDeltaPct(current: number, previous: number): number | null {
  if (!(previous > 0)) return null
  return ((current - previous) / previous) * 100
}

/**
 * Waste sebagai persen omzet — pembanding adil antar-outlet berbeda ukuran.
 * omzet <= 0 -> null (dirender "N/A"), bukan Infinity.
 */
export function computeWastePctOmzet(nilai: number, omzet: number): number | null {
  if (!(omzet > 0)) return null
  return (nilai / omzet) * 100
}

/**
 * Ranking bahan penyumbang kerugian, plus sebaran outlet. Sebaran memisahkan
 * masalah lokal (1 outlet: penyimpanan/shift) dari sistemik (banyak outlet:
 * porsi resep salah atau batch supplier jelek) — penanganannya beda total.
 */
export function aggregateByBahanWithSpread(rows: WasteSummaryRow[]): BahanSpreadAgg[] {
  const map = new Map<string, BahanSpreadAgg & { outlets: Set<string> }>()
  for (const r of rows) {
    const cur =
      map.get(r.bahan_baku_id) ??
      {
        id: r.bahan_baku_id,
        name: r.bahan_nama,
        nilai: 0,
        qty_kecil: 0,
        satuan_kecil: r.satuan_kecil,
        outletCount: 0,
        outlets: new Set<string>(),
      }
    cur.nilai += r.nilai
    cur.qty_kecil += r.qty_kecil
    cur.outlets.add(r.outlet_id)
    map.set(r.bahan_baku_id, cur)
  }
  return [...map.values()]
    .map(({ outlets, ...rest }) => ({ ...rest, outletCount: outlets.size }))
    .sort((a, b) => b.nilai - a.nilai)
}
```

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `yarn vitest run src/lib/wasteMetrics.test.ts`
Expected: PASS — 11 test hijau.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/lib/wasteMetrics.ts apps/admin-dashboard/src/lib/wasteMetrics.test.ts
git commit -m "feat(admin-dashboard): fungsi murni metrik waste (delta, % omzet, sebaran outlet)"
```

---

## Task 3: Hook `useWasteSummary` dan `useWasteIncidents`

**Files:**
- Create: `apps/admin-dashboard/src/hooks/useWasteSummary.ts`
- Create: `apps/admin-dashboard/src/hooks/useWasteIncidents.ts`

**Interfaces:**
- Consumes: `WasteSummaryRow` dari `@/lib/wasteMetrics`; `createClient` dari `@/lib/supabase`; `PeriodFilterValue` dari `@/lib/types`; RPC dari Task 1.
- Produces:
  - `useWasteSummary(filter: PeriodFilterValue): { rows: WasteSummaryRow[]; loading: boolean; error: string | null }`
  - `useWasteSummary(filter, opts: { rangeOverride?: { from: string; to: string } })` — dipakai untuk periode sebelumnya
  - `useWasteIncidents(filter: PeriodFilterValue, page: number): { rows: WasteIncidentRow[]; totalCount: number; loading: boolean; error: string | null }`
  - `interface WasteIncidentRow` (di-export dari `useWasteIncidents.ts`)
  - `const INCIDENTS_PER_PAGE = 25`

Pola mengikuti `useWasteBreakdown.ts` yang sudah ada: `useQuery`, `staleTime: 2 * 60_000`, filter outlet di klien untuk summary (hasilnya kecil), tapi **di server** untuk incidents (karena paginasi).

- [ ] **Step 1: Tulis `useWasteSummary.ts`**

```ts
// apps/admin-dashboard/src/hooks/useWasteSummary.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'
import type { WasteSummaryRow } from '@/lib/wasteMetrics'

/**
 * Agregat waste APPROVED dari get_waste_summary_v2 (owner/admin only).
 * Hasilnya sudah di-roll up di server, jadi aman dari cap 1.000 baris
 * PostgREST dan cukup difilter outlet di klien.
 *
 * `rangeOverride` dipakai untuk menarik periode pembanding (previousRange)
 * tanpa menyentuh filter global.
 */
export function useWasteSummary(
  filter: PeriodFilterValue,
  opts?: { rangeOverride?: { from: string; to: string } }
) {
  const supabase = createClient()
  const from = opts?.rangeOverride?.from ?? filter.from
  const to = opts?.rangeOverride?.to ?? filter.to

  const query = useQuery<WasteSummaryRow[]>({
    queryKey: ['waste_summary_v2', from, to, filter.outletId],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_summary_v2', {
        p_from: from,
        p_to: to,
      })
      if (error) throw error
      let rows: WasteSummaryRow[] = (data ?? []).map((r: any) => ({
        outlet_id: r.outlet_id as string,
        outlet_name: r.outlet_name as string,
        bahan_baku_id: r.bahan_baku_id as string,
        bahan_nama: r.bahan_nama as string,
        reason: r.reason as string,
        tanggal: r.tanggal as string,
        qty: Number(r.qty),
        qty_kecil: Number(r.qty_kecil),
        satuan_kecil: r.satuan_kecil as string,
        hpp_kecil: Number(r.hpp_kecil),
        nilai: Number(r.nilai),
        jumlah_insiden: Number(r.jumlah_insiden),
      }))
      if (filter.outletId !== 'all') rows = rows.filter((r) => r.outlet_id === filter.outletId)
      return rows
    },
  })

  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
```

- [ ] **Step 2: Tulis `useWasteIncidents.ts`**

```ts
// apps/admin-dashboard/src/hooks/useWasteIncidents.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { PeriodFilterValue } from '@/lib/types'

export const INCIDENTS_PER_PAGE = 25

/** Satu laporan waste APPROVED. */
export interface WasteIncidentRow {
  id: string
  outlet_id: string
  outlet_name: string
  bahan_baku_id: string
  bahan_nama: string
  reason: string
  qty: number
  qty_kecil: number
  satuan_besar: string
  satuan_kecil: string
  hpp_kecil: number
  nilai: number
  photo_url: string | null
  reporter_name: string | null
  approver_name: string | null
  created_at: string
  updated_at: string
  /** Jumlah baris ledger_stok dengan ref_waste_id = laporan ini. 0 = stok tidak pernah terpotong. */
  ledger_row_count: number
}

/**
 * Daftar insiden waste APPROVED, dipaginasi DI SERVER.
 * `page` 1-indexed. Filter outlet juga di server (bukan klien) karena
 * memfilter setelah paginasi akan membuat halaman bolong.
 */
export function useWasteIncidents(filter: PeriodFilterValue, page: number) {
  const supabase = createClient()
  const safePage = Math.max(1, page)

  const query = useQuery<{ rows: WasteIncidentRow[]; totalCount: number }>({
    queryKey: ['waste_incidents', filter.from, filter.to, filter.outletId, safePage],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_waste_incidents', {
        p_from: filter.from,
        p_to: filter.to,
        p_outlet_id: filter.outletId === 'all' ? null : filter.outletId,
        p_limit: INCIDENTS_PER_PAGE,
        p_offset: (safePage - 1) * INCIDENTS_PER_PAGE,
      })
      if (error) throw error
      const raw = data ?? []
      const rows: WasteIncidentRow[] = raw.map((r: any) => ({
        id: r.id as string,
        outlet_id: r.outlet_id as string,
        outlet_name: r.outlet_name as string,
        bahan_baku_id: r.bahan_baku_id as string,
        bahan_nama: r.bahan_nama as string,
        reason: r.reason as string,
        qty: Number(r.qty),
        qty_kecil: Number(r.qty_kecil),
        satuan_besar: (r.satuan_besar as string) ?? '',
        satuan_kecil: (r.satuan_kecil as string) ?? '',
        hpp_kecil: Number(r.hpp_kecil),
        nilai: Number(r.nilai),
        photo_url: (r.photo_url as string) ?? null,
        reporter_name: (r.reporter_name as string) ?? null,
        approver_name: (r.approver_name as string) ?? null,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        ledger_row_count: Number(r.ledger_row_count),
      }))
      // total_count identik di setiap baris (window function sebelum LIMIT).
      const totalCount = raw.length > 0 ? Number(raw[0].total_count) : 0
      return { rows, totalCount }
    },
  })

  return {
    rows: query.data?.rows ?? [],
    totalCount: query.data?.totalCount ?? 0,
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
```

- [ ] **Step 3: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru pada dua file ini. (Error pre-existing di file lain diabaikan — bandingkan dengan baseline.)

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/hooks/useWasteSummary.ts apps/admin-dashboard/src/hooks/useWasteIncidents.ts
git commit -m "feat(admin-dashboard): hook agregat & insiden waste"
```

---

## Task 4: `WasteKpiRow` — empat tile KPI

**Files:**
- Create: `apps/admin-dashboard/src/components/waste/WasteKpiRow.tsx`

**Interfaces:**
- Consumes: `computeDeltaPct`, `computeWastePctOmzet` (Task 2); `computeWasteGap` dari `@/lib/wasteGap`; `StatTile` dari `@/components/ui`; `rupiah` dari `@/lib/format`.
- Produces: `<WasteKpiRow totalNilai totalPrevious totalOmzet totalBudget totalInsiden outletCount />`

```ts
interface WasteKpiRowProps {
  totalNilai: number
  totalPrevious: number
  totalOmzet: number
  totalBudget: number
  totalInsiden: number
  outletCount: number
}
```

- [ ] **Step 1: Tulis komponen**

```tsx
// apps/admin-dashboard/src/components/waste/WasteKpiRow.tsx
'use client'

import CountUp from 'react-countup'
import { TrendingDown, TrendingUp, Percent, Target, ClipboardList } from 'lucide-react'
import { StatTile } from '@/components/ui'
import { rupiah } from '@/lib/format'
import { computeDeltaPct, computeWastePctOmzet } from '@/lib/wasteMetrics'
import { computeWasteGap } from '@/lib/wasteGap'

interface WasteKpiRowProps {
  totalNilai: number
  totalPrevious: number
  totalOmzet: number
  totalBudget: number
  totalInsiden: number
  outletCount: number
}

export function WasteKpiRow({
  totalNilai, totalPrevious, totalOmzet, totalBudget, totalInsiden, outletCount,
}: WasteKpiRowProps) {
  const delta = computeDeltaPct(totalNilai, totalPrevious)
  const pctOmzet = computeWastePctOmzet(totalNilai, totalOmzet)
  const gap = computeWasteGap(totalNilai, totalBudget)
  const rataPerOutlet = outletCount > 0 ? totalInsiden / outletCount : null

  const deltaSub =
    delta === null
      ? 'Tak ada data periode sebelumnya'
      : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta).toFixed(1)}% vs periode sebelumnya`

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatTile
        label="Total Kerugian Waste"
        value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
        sub={deltaSub}
        icon={delta !== null && delta > 0 ? TrendingUp : TrendingDown}
        accent={delta === null ? 'brown' : delta > 0 ? 'red' : 'green'}
        tooltip="Nilai waste yang sudah di-approve pada periode terpilih, dibandingkan dengan periode sama panjang tepat sebelumnya."
      />

      <StatTile
        label="Waste % Omzet"
        value={pctOmzet === null ? 'N/A' : <><CountUp end={pctOmzet} duration={1} decimals={2} /> %</>}
        sub={pctOmzet === null ? 'Belum ada omzet pada periode ini' : `Dari omzet ${rupiah(totalOmzet)}`}
        icon={Percent}
        accent={pctOmzet === null ? 'brown' : pctOmzet > 2 ? 'red' : 'green'}
        tooltip="Waste dibagi omzet. Pembanding yang adil antar-outlet: rupiah mentah membuat outlet besar selalu tampak paling boros."
      />

      <StatTile
        label="Gap vs Alokasi BOM"
        value={gap.gapPct === null ? 'N/A' : <><CountUp end={gap.gapPct} duration={1} decimals={1} /> %</>}
        sub={gap.gapPct === null ? 'Belum ada alokasi BOM pada periode ini' : `${rupiah(totalNilai)} aktual vs ${rupiah(totalBudget)} alokasi`}
        icon={Target}
        accent={gap.gapPct === null ? 'brown' : gap.gapPct > 0 ? 'red' : 'green'}
        tooltip="Alokasi = buffer_amount di resep dikali qty terjual. Gap positif berarti waste melebihi yang sudah dianggarkan resep."
      />

      <StatTile
        label="Jumlah Insiden"
        value={<CountUp end={totalInsiden} duration={1} separator="." />}
        sub={rataPerOutlet === null ? 'Belum ada outlet dengan waste' : `Rata-rata ${rataPerOutlet.toFixed(1)} per outlet`}
        icon={ClipboardList}
        accent="brown"
        tooltip="Banyaknya laporan waste yang di-approve. Membedakan banyak kerugian kecil dari satu kerugian besar."
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/components/waste/WasteKpiRow.tsx
git commit -m "feat(admin-dashboard): baris KPI waste (total+delta, % omzet, gap BOM, insiden)"
```

---

## Task 5: `WasteOutletRanking` — tabel sortable dengan % omzet

**Files:**
- Create: `apps/admin-dashboard/src/components/waste/WasteOutletRanking.tsx`

**Interfaces:**
- Consumes: `OutletAgg` dari `@/lib/wasteBreakdown`; `computeWastePctOmzet` (Task 2); `computeWasteGap`.
- Produces: `<WasteOutletRanking rows={OutletAgg[]} budgetByOutlet={Map<string, number>} omzetByOutlet={Map<string, number>} />`

- [ ] **Step 1: Tulis komponen**

```tsx
// apps/admin-dashboard/src/components/waste/WasteOutletRanking.tsx
'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { OutletAgg } from '@/lib/wasteBreakdown'
import { computeWasteGap } from '@/lib/wasteGap'
import { computeWastePctOmzet } from '@/lib/wasteMetrics'

type SortKey = 'name' | 'nilai' | 'pctOmzet' | 'budget' | 'gapPct'

interface WasteOutletRankingProps {
  rows: OutletAgg[]
  budgetByOutlet: Map<string, number>
  omzetByOutlet: Map<string, number>
}

interface Enriched {
  id: string
  name: string
  nilai: number
  pctOmzet: number | null
  budget: number
  gapPct: number | null
}

/** null selalu di bawah, apa pun arah sortirnya — N/A bukan "nilai terkecil". */
function cmpNullable(a: number | null, b: number | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return (a - b) * dir
}

export function WasteOutletRanking({ rows, budgetByOutlet, omzetByOutlet }: WasteOutletRankingProps) {
  const [sortKey, setSortKey] = useState<SortKey>('nilai')
  const [dir, setDir] = useState<1 | -1>(-1)

  const enriched = useMemo<Enriched[]>(
    () =>
      rows.map((o) => {
        const budget = budgetByOutlet.get(o.id) ?? 0
        return {
          id: o.id,
          name: o.name.replace('SUKA SHAWARMA ', ''),
          nilai: o.nilai,
          pctOmzet: computeWastePctOmzet(o.nilai, omzetByOutlet.get(o.id) ?? 0),
          budget,
          gapPct: computeWasteGap(o.nilai, budget).gapPct,
        }
      }),
    [rows, budgetByOutlet, omzetByOutlet]
  )

  const sorted = useMemo(() => {
    const copy = [...enriched]
    copy.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      if (sortKey === 'nilai') return (a.nilai - b.nilai) * dir
      if (sortKey === 'budget') return (a.budget - b.budget) * dir
      return cmpNullable(a[sortKey], b[sortKey], dir)
    })
    return copy
  }, [enriched, sortKey, dir])

  const toggle = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setDir(key === 'name' ? 1 : -1) }
  }

  const Th = ({ k, label, align = 'right' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={`py-3 px-6 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`inline-flex items-center gap-1 hover:text-suka-brown transition-colors ${sortKey === k ? 'text-suka-brown' : ''}`}
        aria-label={`Urutkan menurut ${label}`}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </th>
  )

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Ranking per Outlet</h3>
        <p className="text-[11px] text-suka-gray-500 mt-0.5">% Omzet adalah pembanding yang adil antar-outlet berbeda ukuran</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
              <Th k="name" label="Outlet" align="left" />
              <Th k="nilai" label="Nilai" />
              <Th k="pctOmzet" label="% Omzet" />
              <Th k="budget" label="Budget BOM" />
              <Th k="gapPct" label="Gap %" />
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {sorted.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
            ) : sorted.map((o) => (
              <tr key={o.id} className="hover:bg-suka-cream/20 transition-colors">
                <td className="py-3 px-6 text-suka-ink font-bold">{o.name}</td>
                <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(o.nilai)}</td>
                <td className={`py-3 px-6 text-right font-bold ${o.pctOmzet === null ? 'text-suka-gray-400' : o.pctOmzet > 2 ? 'text-red-700' : 'text-suka-green'}`}>
                  {o.pctOmzet === null ? 'N/A' : `${o.pctOmzet.toFixed(2)}%`}
                </td>
                <td className="py-3 px-6 text-right text-suka-gray-600">{rupiah(o.budget)}</td>
                <td className={`py-3 px-6 text-right font-bold ${o.gapPct === null ? 'text-suka-gray-400' : o.gapPct > 0 ? 'text-red-700' : 'text-suka-green'}`}>
                  {o.gapPct === null ? 'N/A' : `${o.gapPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/components/waste/WasteOutletRanking.tsx
git commit -m "feat(admin-dashboard): ranking outlet waste sortable dengan kolom % omzet"
```

---

## Task 6: `WasteReasonBreakdown` dan `WasteBahanRanking`

**Files:**
- Create: `apps/admin-dashboard/src/components/waste/WasteReasonBreakdown.tsx`
- Create: `apps/admin-dashboard/src/components/waste/WasteBahanRanking.tsx`

**Interfaces:**
- Consumes: `ReasonAgg` dari `@/lib/wasteBreakdown`; `BahanSpreadAgg` dari `@/lib/wasteMetrics`.
- Produces: `<WasteReasonBreakdown rows={ReasonAgg[]} total={number} />`, `<WasteBahanRanking rows={BahanSpreadAgg[]} limit={number} />`

Digabung dalam satu task karena keduanya tampilan ranking read-only tanpa state, berbagi pola bar yang sama, dan seorang reviewer akan menilai keduanya bersama.

- [ ] **Step 1: Tulis `WasteReasonBreakdown.tsx`**

```tsx
// apps/admin-dashboard/src/components/waste/WasteReasonBreakdown.tsx
'use client'

import { rupiah } from '@/lib/format'
import type { ReasonAgg } from '@/lib/wasteBreakdown'

/** Alasan yang berarti uang bisa diklaim balik ke supplier, bukan diserap sendiri. */
const CLAIMABLE = 'Kualitas Buruk (dari supplier)'

interface WasteReasonBreakdownProps {
  rows: ReasonAgg[]
  total: number
}

export function WasteReasonBreakdown({ rows, total }: WasteReasonBreakdownProps) {
  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Breakdown per Alasan</h3>
      </div>
      <div className="p-6 space-y-4">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-suka-gray-400 text-sm">Belum ada waste pada periode ini</p>
        ) : rows.map((r) => {
          const share = total > 0 ? (r.nilai / total) * 100 : 0
          const claimable = r.reason === CLAIMABLE
          return (
            <div key={r.reason}>
              <div className="flex justify-between items-baseline gap-3 mb-1">
                <span className={`text-xs font-bold ${claimable ? 'text-suka-orange' : 'text-suka-ink'}`}>
                  {r.reason}
                  {claimable && <span className="ml-1.5 text-[10px] font-semibold uppercase">• bisa diklaim ke supplier</span>}
                </span>
                <span className="text-xs font-extrabold text-red-700 whitespace-nowrap tabular-nums">
                  {rupiah(r.nilai)} <span className="text-suka-gray-400 font-semibold">({share.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-suka-cream overflow-hidden">
                <div
                  className={`h-full rounded-full ${claimable ? 'bg-suka-orange' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(share, 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Tulis `WasteBahanRanking.tsx`**

```tsx
// apps/admin-dashboard/src/components/waste/WasteBahanRanking.tsx
'use client'

import { rupiah } from '@/lib/format'
import type { BahanSpreadAgg } from '@/lib/wasteMetrics'

interface WasteBahanRankingProps {
  rows: BahanSpreadAgg[]
  /** Berapa bahan teratas yang ditampilkan. */
  limit?: number
}

/** >= ambang ini dianggap sistemik, bukan masalah satu outlet. */
const SYSTEMIC_OUTLETS = 5

export function WasteBahanRanking({ rows, limit = 10 }: WasteBahanRankingProps) {
  const shown = rows.slice(0, limit)

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100">
        <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Ranking Bahan Baku</h3>
        <p className="text-[11px] text-suka-gray-500 mt-0.5">
          Sebaran outlet memisahkan masalah lokal dari masalah sistemik (porsi resep / batch supplier)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
              <th className="py-3 px-6">Bahan Baku</th>
              <th className="py-3 px-6 text-right">Qty</th>
              <th className="py-3 px-6 text-right">Nilai</th>
              <th className="py-3 px-6 text-right">Sebaran Outlet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {shown.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
            ) : shown.map((b) => {
              const systemic = b.outletCount >= SYSTEMIC_OUTLETS
              return (
                <tr key={b.id} className="hover:bg-suka-cream/20 transition-colors">
                  <td className="py-3 px-6 text-suka-ink font-bold">{b.name}</td>
                  <td className="py-3 px-6 text-right text-suka-gray-600 whitespace-nowrap">
                    {b.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {b.satuan_kecil}
                  </td>
                  <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(b.nilai)}</td>
                  <td className="py-3 px-6 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${systemic ? 'bg-red-100 text-red-700' : 'bg-suka-cream text-suka-brown'}`}>
                      {b.outletCount} outlet{systemic ? ' • sistemik' : ''}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/components/waste/WasteReasonBreakdown.tsx apps/admin-dashboard/src/components/waste/WasteBahanRanking.tsx
git commit -m "feat(admin-dashboard): breakdown alasan waste + ranking bahan dengan sebaran outlet"
```

---

## Task 7: `WasteIncidentTable` — tabel per-insiden terpaginasi

**Files:**
- Create: `apps/admin-dashboard/src/components/waste/WasteIncidentTable.tsx`

**Interfaces:**
- Consumes: `WasteIncidentRow`, `INCIDENTS_PER_PAGE` dari `@/hooks/useWasteIncidents`.
- Produces: `<WasteIncidentTable rows totalCount page onPageChange onSelect showOutletColumn loading />`

```ts
interface WasteIncidentTableProps {
  rows: WasteIncidentRow[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  onSelect: (row: WasteIncidentRow) => void
  showOutletColumn: boolean
  loading: boolean
}
```

- [ ] **Step 1: Tulis komponen**

```tsx
// apps/admin-dashboard/src/components/waste/WasteIncidentTable.tsx
'use client'

import { Camera, CameraOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { rupiah } from '@/lib/format'
import { INCIDENTS_PER_PAGE, type WasteIncidentRow } from '@/hooks/useWasteIncidents'

interface WasteIncidentTableProps {
  rows: WasteIncidentRow[]
  totalCount: number
  page: number
  onPageChange: (page: number) => void
  onSelect: (row: WasteIncidentRow) => void
  showOutletColumn: boolean
  loading: boolean
}

const fmtTanggal = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))

export function WasteIncidentTable({
  rows, totalCount, page, onPageChange, onSelect, showOutletColumn, loading,
}: WasteIncidentTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / INCIDENTS_PER_PAGE))
  const firstOnPage = totalCount === 0 ? 0 : (page - 1) * INCIDENTS_PER_PAGE + 1
  const lastOnPage = Math.min(page * INCIDENTS_PER_PAGE, totalCount)
  const colSpan = showOutletColumn ? 9 : 8

  return (
    <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-suka-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-extrabold text-suka-brown text-sm tracking-tight uppercase">Rincian Insiden</h3>
          <p className="text-[11px] text-suka-gray-500 mt-0.5">Satu baris = satu laporan waste yang sudah di-approve</p>
        </div>
        <span className="text-[11px] font-semibold text-suka-gray-500 tabular-nums">
          {totalCount === 0 ? '0 insiden' : `${firstOnPage}–${lastOnPage} dari ${totalCount} insiden`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-suka-cream/30 text-left text-suka-gray-500 font-bold border-b border-suka-gray-100">
              <th className="py-3 px-6">Tanggal</th>
              {showOutletColumn && <th className="py-3 px-6">Outlet</th>}
              <th className="py-3 px-6">Bahan Baku</th>
              <th className="py-3 px-6 text-right">Qty</th>
              <th className="py-3 px-6">Alasan</th>
              <th className="py-3 px-6">Pelapor</th>
              <th className="py-3 px-6">Penyetuju</th>
              <th className="py-3 px-6 text-right">Nilai</th>
              <th className="py-3 px-6 text-center">Bukti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100 font-medium">
            {loading ? (
              <tr><td colSpan={colSpan} className="py-8 text-center text-suka-gray-400">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="py-8 text-center text-suka-gray-400">Belum ada waste pada periode ini</td></tr>
            ) : rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r)}
                className="hover:bg-suka-cream/30 cursor-pointer transition-colors"
              >
                <td className="py-3 px-6 text-suka-gray-600 whitespace-nowrap">{fmtTanggal(r.created_at)}</td>
                {showOutletColumn && (
                  <td className="py-3 px-6 text-suka-gray-600">{r.outlet_name.replace('SUKA SHAWARMA ', '')}</td>
                )}
                <td className="py-3 px-6 text-suka-ink font-bold">{r.bahan_nama}</td>
                <td className="py-3 px-6 text-right text-suka-gray-600 whitespace-nowrap">
                  {r.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {r.satuan_kecil}
                </td>
                <td className="py-3 px-6 text-suka-gray-600">{r.reason}</td>
                <td className="py-3 px-6 text-suka-gray-600">{r.reporter_name ?? '—'}</td>
                <td className="py-3 px-6 text-suka-gray-600">{r.approver_name ?? '—'}</td>
                <td className="py-3 px-6 text-right text-red-700 font-extrabold">{rupiah(r.nilai)}</td>
                <td className="py-3 px-6 text-center">
                  {r.photo_url ? (
                    <Camera className="w-4 h-4 text-suka-green inline" aria-label="Ada foto bukti" />
                  ) : (
                    <CameraOff className="w-4 h-4 text-suka-gray-300 inline" aria-label="Tidak ada foto bukti" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-suka-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suka-cream/70 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
          </button>
          <span className="text-[11px] font-semibold text-suka-gray-500 tabular-nums">
            Halaman {page} dari {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-suka-brown bg-suka-cream disabled:opacity-40 disabled:cursor-not-allowed hover:bg-suka-cream/70 transition-colors"
          >
            Berikutnya <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/components/waste/WasteIncidentTable.tsx
git commit -m "feat(admin-dashboard): tabel per-insiden waste dengan paginasi server"
```

---

## Task 8: `WasteIncidentDetailModal` — detail satu insiden

**Files:**
- Create: `apps/admin-dashboard/src/components/waste/WasteIncidentDetailModal.tsx`

**Interfaces:**
- Consumes: `WasteIncidentRow` dari `@/hooks/useWasteIncidents`.
- Produces: `<WasteIncidentDetailModal isOpen onClose row />` (`row: WasteIncidentRow | null`)

Pola modal mengikuti `src/components/NetProfitBreakdownModal.tsx`: prop `isOpen`/`onClose`, listener Escape, klik backdrop menutup, `role="dialog"` + `aria-modal`.

⚠️ **`useEffect` HARUS berada di atas `if (!isOpen) return null`** — hook setelah early-return memicu React error #310 di produksi.

- [ ] **Step 1: Tulis komponen**

```tsx
// apps/admin-dashboard/src/components/waste/WasteIncidentDetailModal.tsx
'use client'

import { useEffect } from 'react'
import { X, ImageOff, CheckCircle2, AlertTriangle } from 'lucide-react'
import { rupiah } from '@/lib/format'
import type { WasteIncidentRow } from '@/hooks/useWasteIncidents'

interface WasteIncidentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  row: WasteIncidentRow | null
}

const fmtWaktu = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))

/** Jeda lapor -> approve dalam bahasa manusia. */
function formatJeda(fromIso: string, toIso: string): string {
  const ms = Date.parse(toIso) - Date.parse(fromIso)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const menit = Math.floor(ms / 60000)
  if (menit < 60) return `${menit} menit`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam ${menit % 60} menit`
  const hari = Math.floor(jam / 24)
  return `${hari} hari ${jam % 24} jam`
}

export function WasteIncidentDetailModal({ isOpen, onClose, row }: WasteIncidentDetailModalProps) {
  // Hook WAJIB di atas early-return (React #310).
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !row) return null

  const adaLedger = row.ledger_row_count > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detail waste ${row.bahan_nama}`}
        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-suka-gray-100 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-extrabold text-suka-brown tracking-tight">{row.bahan_nama}</h3>
            <p className="text-xs text-suka-gray-500 mt-0.5">
              {row.outlet_name.replace('SUKA SHAWARMA ', '')} · {row.reason}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-xl hover:bg-suka-cream transition-colors">
            <X className="w-4 h-4 text-suka-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Foto bukti */}
          <div>
            <p className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Foto Bukti</p>
            {row.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.photo_url}
                alt={`Bukti waste ${row.bahan_nama}`}
                className="w-full max-h-80 object-contain rounded-2xl border border-suka-gray-200 bg-suka-cream/30"
              />
            ) : (
              <div className="w-full py-10 rounded-2xl border border-dashed border-suka-gray-200 bg-suka-cream/20 flex flex-col items-center gap-2">
                <ImageOff className="w-6 h-6 text-suka-gray-300" />
                <p className="text-xs font-semibold text-suka-gray-400">Tidak ada foto bukti</p>
              </div>
            )}
          </div>

          {/* Angka */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Qty (satuan besar)', value: `${row.qty.toLocaleString('id-ID', { maximumFractionDigits: 4 })} ${row.satuan_besar}` },
              { label: 'Qty (satuan kecil)', value: `${row.qty_kecil.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${row.satuan_kecil}` },
              { label: 'HPP / satuan kecil', value: rupiah(row.hpp_kecil) },
              { label: 'Nilai kerugian', value: rupiah(row.nilai), strong: true },
            ].map((f) => (
              <div key={f.label} className="p-3 rounded-2xl bg-suka-cream/40">
                <p className="text-[10px] font-bold text-suka-gray-500 uppercase tracking-wider">{f.label}</p>
                <p className={`mt-1 text-sm font-extrabold tabular-nums ${f.strong ? 'text-red-700' : 'text-suka-ink'}`}>{f.value}</p>
              </div>
            ))}
          </div>

          {/* Jejak waktu */}
          <div>
            <p className="text-[11px] font-bold text-suka-gray-500 uppercase tracking-wider mb-2">Jejak Waktu</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-suka-gray-600">Dilaporkan oleh <strong className="text-suka-ink">{row.reporter_name ?? '—'}</strong></span>
                <span className="text-suka-gray-500 whitespace-nowrap">{fmtWaktu(row.created_at)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-suka-gray-600">Disetujui oleh <strong className="text-suka-ink">{row.approver_name ?? '—'}</strong></span>
                <span className="text-suka-gray-500 whitespace-nowrap">{fmtWaktu(row.updated_at)}</span>
              </div>
              <div className="flex justify-between gap-3 pt-2 border-t border-suka-gray-100">
                <span className="text-suka-gray-600">Jeda lapor → approve</span>
                <span className="font-bold text-suka-brown">{formatJeda(row.created_at, row.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Status potongan stok */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${adaLedger ? 'bg-suka-green/5 border-suka-green/20' : 'bg-red-50 border-red-200'}`}>
            {adaLedger
              ? <CheckCircle2 className="w-5 h-5 text-suka-green shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
            <div>
              <p className={`text-sm font-bold ${adaLedger ? 'text-suka-green' : 'text-red-700'}`}>
                {adaLedger
                  ? `Potongan stok tercatat (${row.ledger_row_count} baris ledger)`
                  : 'Tidak ada baris ledger — stok tidak pernah terpotong'}
              </p>
              <p className="text-[11px] text-suka-gray-500 mt-1 leading-relaxed">
                Yang diperiksa adalah keberadaan baris ledger, bukan kecocokan jumlahnya. Skala ledger
                bergantung pada <code>saldo_is_gram</code> tiap outlet sedangkan qty laporan selalu satuan
                besar, jadi perbandingan angka langsung akan menghasilkan alarm palsu.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/components/waste/WasteIncidentDetailModal.tsx
git commit -m "feat(admin-dashboard): modal detail insiden waste (foto, jejak waktu, cek ledger)"
```

---

## Task 9: Rakit `page.tsx` + verifikasi menyeluruh

**Files:**
- Modify: `apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx` (ganti seluruh isi)

**Interfaces:**
- Consumes: semua komponen Task 4–8, hook Task 3, `useOutlets`, `useScopedFilter`, `useBudgetLoss`, `useSalesSummary`, `previousRange`, `aggregateByOutlet`/`aggregateByReason`/`aggregateByDate`, `aggregateByBahanWithSpread`.
- Produces: halaman `/dashboard/owner/waste` yang sudah dirombak.

⚠️ **Semua hook di atas early-return.** Jangan letakkan `useState`/`useMemo` di bawah `if (loading) return`.

- [ ] **Step 1: Ganti isi `page.tsx`**

```tsx
// apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
'use client'

import { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useScopedFilter } from '@/hooks/useScopedFilter'
import { useOutlets } from '@/hooks/useOutlets'
import { useWasteSummary } from '@/hooks/useWasteSummary'
import { useWasteIncidents, type WasteIncidentRow } from '@/hooks/useWasteIncidents'
import { useBudgetLoss } from '@/hooks/useBudgetLoss'
import { useSalesSummary } from '@/hooks/useSalesSummary'
import { aggregateByOutlet, aggregateByReason, aggregateByDate } from '@/lib/wasteBreakdown'
import { aggregateByBahanWithSpread } from '@/lib/wasteMetrics'
import { previousRange } from '@/lib/period'
import { PeriodFilter } from '@/components/PeriodFilter'
import { PageHeader, Section, StatTilesSkeleton } from '@/components/ui'
import { WasteKpiRow } from '@/components/waste/WasteKpiRow'
import { WasteOutletRanking } from '@/components/waste/WasteOutletRanking'
import { WasteReasonBreakdown } from '@/components/waste/WasteReasonBreakdown'
import { WasteBahanRanking } from '@/components/waste/WasteBahanRanking'
import { WasteIncidentTable } from '@/components/waste/WasteIncidentTable'
import { WasteIncidentDetailModal } from '@/components/waste/WasteIncidentDetailModal'

const WasteTrendChart = dynamic(
  () => import('@/components/WasteTrendChart').then((m) => m.WasteTrendChart),
  { ssr: false, loading: () => <div className="h-64 bg-white rounded-2xl border border-suka-gray-200 animate-pulse" /> }
)

export default function WastePage() {
  const { data: outlets = [] } = useOutlets()
  const { filter, setFilter, lockedOutletId } = useScopedFilter()

  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<WasteIncidentRow | null>(null)

  const prev = useMemo(() => previousRange({ from: filter.from, to: filter.to }), [filter.from, filter.to])

  const summary = useWasteSummary(filter)
  const summaryPrev = useWasteSummary(filter, { rangeOverride: prev })
  const incidents = useWasteIncidents(filter, page)
  const budgetLoss = useBudgetLoss(filter)
  const sales = useSalesSummary(filter, outlets)

  // Ganti filter -> kembali ke halaman 1, supaya tidak terjebak di halaman
  // yang sudah tidak ada pada hasil baru.
  useEffect(() => { setPage(1) }, [filter.from, filter.to, filter.outletId])

  // summaryPrev & sales ikut digate: kalau tidak, tile sempat menampilkan
  // "N/A" palsu (delta & % omzet) sebelum datanya datang.
  const loading = summary.loading || summaryPrev.loading || budgetLoss.loading || sales.loading
  const error = summary.error || budgetLoss.error || incidents.error

  const totalNilai = useMemo(() => summary.rows.reduce((s, r) => s + r.nilai, 0), [summary.rows])
  const totalPrevious = useMemo(() => summaryPrev.rows.reduce((s, r) => s + r.nilai, 0), [summaryPrev.rows])
  const totalInsiden = useMemo(() => summary.rows.reduce((s, r) => s + r.jumlah_insiden, 0), [summary.rows])
  const totalBudget = useMemo(() => budgetLoss.rows.reduce((s, r) => s + r.budget_loss, 0), [budgetLoss.rows])

  const byOutlet = useMemo(() => aggregateByOutlet(summary.rows), [summary.rows])
  const byReason = useMemo(() => aggregateByReason(summary.rows), [summary.rows])
  const byDate = useMemo(() => aggregateByDate(summary.rows), [summary.rows])
  const byBahan = useMemo(() => aggregateByBahanWithSpread(summary.rows), [summary.rows])

  const omzetByOutlet = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of sales.rows) map.set(r.outlet_id, (map.get(r.outlet_id) ?? 0) + r.omzet)
    return map
  }, [sales.rows])

  const budgetByOutlet = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of budgetLoss.rows) map.set(r.outlet_id, r.budget_loss)
    return map
  }, [budgetLoss.rows])

  const totalOmzet = useMemo(() => {
    let sum = 0
    for (const [outletId, omzet] of omzetByOutlet) {
      if (filter.outletId === 'all' || outletId === filter.outletId) sum += omzet
    }
    return sum
  }, [omzetByOutlet, filter.outletId])

  const showOutletColumn = filter.outletId === 'all'

  return (
    <div className="space-y-6">
      <PageHeader title="Kerugian Waste" description="Rincian waste bahan baku yang sudah di-approve">
        <PeriodFilter value={filter} onChange={setFilter} outlets={outlets} lockedOutletId={lockedOutletId} hideSource />
      </PageHeader>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          Gagal memuat data waste: {error}
        </div>
      )}

      {loading ? (
        <StatTilesSkeleton count={4} />
      ) : (
        <>
          <WasteKpiRow
            totalNilai={totalNilai}
            totalPrevious={totalPrevious}
            totalOmzet={totalOmzet}
            totalBudget={totalBudget}
            totalInsiden={totalInsiden}
            outletCount={byOutlet.length}
          />

          <Section title="Tren Waktu">
            <WasteTrendChart data={byDate} />
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {showOutletColumn && (
              <WasteOutletRanking rows={byOutlet} budgetByOutlet={budgetByOutlet} omzetByOutlet={omzetByOutlet} />
            )}
            <div className={showOutletColumn ? '' : 'lg:col-span-2'}>
              <WasteReasonBreakdown rows={byReason} total={totalNilai} />
            </div>
          </div>

          <WasteBahanRanking rows={byBahan} />

          <WasteIncidentTable
            rows={incidents.rows}
            totalCount={incidents.totalCount}
            page={page}
            onPageChange={setPage}
            onSelect={setSelected}
            showOutletColumn={showOutletColumn}
            loading={incidents.loading}
          />
        </>
      )}

      <WasteIncidentDetailModal isOpen={selected !== null} onClose={() => setSelected(null)} row={selected} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `yarn type-check`
Expected: tidak ada error baru dibanding baseline.

- [ ] **Step 3: Test suite penuh — bandingkan dengan baseline**

Run: `yarn test`
Expected: `wasteMetrics.test.ts` hijau (11 test); jumlah kegagalan total **sama atau lebih kecil** dari baseline yang dicatat di awal. Nol regresi.

- [ ] **Step 4: Build**

Run: `yarn build`
Expected: sukses, dan route `/dashboard/owner/waste` muncul di output.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add apps/admin-dashboard/src/app/dashboard/owner/waste/page.tsx
git commit -m "feat(admin-dashboard): rakit ulang halaman waste jadi composition root"
```

- [ ] **Step 6: Smoke test manual di browser**

Login sebagai owner atau admin, buka `/dashboard/owner/waste`, pilih periode yang punya data waste. Verifikasi:

1. Empat tile KPI terisi; `Waste % Omzet` bukan `Infinity` dan bukan `NaN`.
2. Pilih periode tanpa penjualan sama sekali → `% Omzet` menampilkan `N/A`, bukan angka.
3. Klik header kolom di Ranking per Outlet → urutan berubah; klik lagi → arah terbalik; baris `N/A` selalu di bawah.
4. Filter satu outlet → Ranking per Outlet hilang, kolom Outlet di tabel insiden hilang, dan halaman insiden kembali ke 1.
5. Tabel Rincian Insiden menampilkan baris per laporan; klik baris → modal terbuka dengan foto bukti (atau "Tidak ada foto bukti").
6. Modal: tekan `Escape` menutup; klik backdrop menutup; jejak waktu dan jeda tampil masuk akal.
7. Kalau ada insiden yang `ledger_row_count = 0`, modalnya menampilkan peringatan merah — catat insiden itu untuk ditindaklanjuti.
8. Paginasi: tombol Sebelumnya nonaktif di halaman 1; Berikutnya membawa ke halaman 2 dengan data berbeda.

- [ ] **Step 7: Uji penerimaan valuasi di UI**

Bandingkan Total Kerugian Waste pada periode yang sama dengan angka "Kerugian Waste" di halaman Profit (`/dashboard/owner/profit`).
Expected: **identik.** Kalau berbeda, perbaikan pembagi bocor ke `nilai` — hentikan dan periksa Task 1 Step 6.

---

## Deploy

Setelah semua task selesai dan di-review:

1. **Rebase ke `main` terkini.** Branch ini dibuat dari `main` yang sudah bergerak selama sesi (otomasi repo aktif). `git fetch origin && git rebase origin/main`.
2. Buat PR `feat/waste-dashboard-comprehensive` → `main`.
3. **Redeploy `admin-dashboard`.** Perubahan tidak live sampai Coolify di-trigger ulang untuk app ini.
4. **Sebelum merge, jalankan `supabase migration list` sekali lagi** — riwayat remote di DB bersama ini terbukti berubah karena aktivitas dev lain di tengah sesi; jangan andalkan hasil pengecekan lama.

---

## Catatan untuk reviewer

- **Tidak ada test render komponen.** Itu konvensi app ini — semua test yang ada di `src/lib/*.test.ts` dan menguji fungsi murni. Logika yang layak diuji sudah diekstrak ke `wasteMetrics.ts`; komponen tinggal presentasi.
- **`aggregateByReason` dan `aggregateByBahan` sudah ada** di `wasteBreakdown.ts` sejak sebelumnya, hanya tidak pernah dipakai halaman. Plan ini memakainya kembali alih-alih menulis ulang. `aggregateByBahanWithSpread` baru karena butuh hitung outlet unik yang tidak disediakan versi lama.
- **`previousRange` sudah ada** di `period.ts` dan sudah ber-test. Tidak ditulis ulang.
- **Yang sengaja tidak dikerjakan** (lihat spec §7): export Excel/CSV/PDF, metrik kedisiplinan pelaporan, rekonsiliasi kuantitas ledger, dan perubahan apa pun pada `apps/manager` `/waste`.
