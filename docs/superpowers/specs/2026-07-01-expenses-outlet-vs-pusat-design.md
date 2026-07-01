# Spec — Pengeluaran Outlet vs Pusat (apps/admin-dashboard)

**Tanggal:** 2026-07-01
**Status:** Disetujui (brainstorming + grill-with-docs)
**Konteks glossary:** `CONTEXT.md` → "Pengeluaran/Expenses" (scope Outlet vs Pusat)
**ADR terkait:** ADR-0013 (skema scope pengeluaran)

## Masalah

Owner mengelola pengeluaran sebagai rekap bulanan per outlet dengan **14 kategori spesifik** (lihat di bawah). Dua di antaranya — **Pengeluaran Global** & **Gaji Staff Kantor** — adalah biaya **pusat/company-wide** (satu nilai untuk seluruh perusahaan, bukan per-outlet) dan harus **dikecualikan dari P&L per-outlet**, tapi **tetap dihitung di P&L company-wide**.

Model saat ini tak mendukung ini:
- `expenses.category` hanya 6 enum kasar (`bahan_baku|gaji|operasional|sewa|utilitas|lainnya`) — tak bisa hasilkan breakdown 14-baris.
- `expenses.outlet_id` `NOT NULL` — setiap biaya terpaksa nempel ke outlet; tak ada cara merepresentasikan biaya pusat.
- `computeProfit` menjumlahkan SEMUA expense sebagai biaya outlet → laba per-outlet salah kalau biaya pusat ikut.

## Keputusan (hasil grill)

| # | Keputusan |
|---|---|
| Q1 | Breakdown ditampilkan **di dalam app** (bukan spreadsheet eksternal). |
| Q2 | Pengeluaran Pusat = **company-wide, satu nilai** (bukan per-outlet, bukan prorata). |
| Q3 | Pusat **exclude dari P&L outlet**, tetap **dihitung di P&L company-wide**. |
| Q4 | **14 kategori kanonik baru** menggantikan 6 enum lama (ganti total, tanpa mapping). |
| Q5 | `outlet_id` **nullable**; `NULL` = pusat. Integritas via CHECK. RLS diperbaiki. (ADR-0013) |
| Q6 | Input via **form rekap bulanan** (scope kerja termasuk bikin form). |
| Q7 | **Upsert** per `(outlet_id, category, period_month)` — satu nilai final per periode. |
| Q8 | Tulis dibatasi **owner/admin**; kategori **pusat owner-only**. |
| Q9 | Profit: "Semua Outlet" → Laba Perusahaan (Σ outlet − pusat), pusat sbg baris tersendiri; satu outlet → Laba Outlet saja (pusat tak muncul). |

### Kategori kanonik (14)

**Outlet (12, `outlet_id` wajib terisi):**
`pengeluaran_outlet` (lain-lain), `gaji_crew_outlet`, `bonus_leader`, `bonus_korlap`, `lembur`, `ads`, `endorsement`, `promo`, `pdam`, `pln`, `internet`, `sewa_outlet`

**Pusat (2, `outlet_id` wajib NULL):**
`pengeluaran_global`, `gaji_staff_kantor`

> `bahan_baku` dibuang dari expenses — biaya bahan baku kini dihitung sebagai **HPP** (ADR-0011), bukan expense.

### Aturan pembebanan

- **Laba Outlet** = Omzet outlet − HPP outlet − Pengeluaran Outlet (outlet itu saja)
- **Laba Perusahaan** = Σ Laba Outlet − Σ Pengeluaran Pusat

## Desain teknis

### 1. Skema (`supabase/migrations/<ts>_expenses_outlet_vs_pusat.sql`)

```sql
DELETE FROM public.expenses;                        -- kategori lama tak lagi valid; data diisi ulang via form

ALTER TABLE public.expenses ALTER COLUMN outlet_id DROP NOT NULL;
ALTER TABLE public.expenses ADD COLUMN period_month DATE NOT NULL;  -- selalu tanggal-1 bulan ybs

-- drop CHECK category lama, buat CHECK 14 kategori baru
ALTER TABLE public.expenses DROP CONSTRAINT expenses_category_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_category_check CHECK (category IN (
  'pengeluaran_outlet','gaji_crew_outlet','bonus_leader','bonus_korlap',
  'lembur','ads','endorsement','promo','pdam','pln','internet','sewa_outlet',
  'pengeluaran_global','gaji_staff_kantor'));

-- integritas scope: kategori pusat ⇔ outlet_id NULL
ALTER TABLE public.expenses ADD CONSTRAINT expenses_scope_check CHECK (
  (category IN ('pengeluaran_global','gaji_staff_kantor')) = (outlet_id IS NULL));

-- upsert per periode
CREATE UNIQUE INDEX expenses_period_unique
  ON public.expenses (outlet_id, category, period_month) NULLS NOT DISTINCT;
```

### 2. RLS

```sql
-- SELECT: outlet rows per accessible_outlet_ids; pusat rows (NULL) owner/admin only
DROP POLICY IF EXISTS "expenses_select_scoped" ON public.expenses;
CREATE POLICY "expenses_select_scoped" ON public.expenses FOR SELECT TO authenticated USING (
  outlet_id IN (SELECT public.accessible_outlet_ids())
  OR (outlet_id IS NULL AND public.is_owner_or_admin())   -- helper: cek role owner/admin
);

-- WRITE: ganti policy permissif (WITH CHECK true) →
--   outlet rows: owner/admin; pusat rows (NULL): owner only
-- (INSERT/UPDATE/DELETE)
```

> Penegakan tulis diutamakan lewat **server action / RPC** di admin-dashboard, RLS sebagai lapis kedua.

### 3. Query layer

- **`useExpenses.ts`** — `ExpenseRow`: `category` (union 14), `outlet_id: string | null`, `period_month: string`, `scope: 'outlet' | 'pusat'` (derived dari kategori). Select tambah `period_month`.
- **`lib/profit.ts`** — pisah dua level murni + testable:
  - `computeOutletProfit(omzet, hpp, pengeluaranOutlet)`
  - `computeCompanyProfit(sumLabaOutlet, pengeluaranPusat)`

### 4. Reporting UI

- **Profit page** (`dashboard/owner/profit`):
  - "Semua Outlet" → Laba Perusahaan = Σ laba outlet − Pengeluaran Pusat; kartu baru **"Biaya Pusat"**; tabel per-outlet TIDAK kebagian pusat.
  - Satu outlet → Laba Outlet saja; baris pusat difilter keluar (`outlet_id !== null`).
- **Expenses page** (`dashboard/owner/expenses`):
  - Label/warna/ikon di-refresh untuk 14 kategori.
  - "Semua Outlet" → section terpisah **Outlet** vs **Pusat**; satu outlet → sembunyikan pusat.

### 5. Form input rekap bulanan (baru)

Route `dashboard/owner/expenses/input` (owner/admin only, tersembunyi dari mitra/leader):
- Pilih **Bulan** + **Target** (satu outlet / "Pusat").
- Target outlet → 12 kategori; Target Pusat → 2 kategori (owner-only).
- Muat nilai existing → koreksi → simpan **upsert** per `(outlet_id, category, period_month)`.
- Tulis via server action/RPC yang menegakkan akses.
- Nav: tambah entri "Input Pengeluaran" di grup owner.

## Non-goals (YAGNI)

- Prorata biaya pusat ke outlet (ditolak eksplisit — pusat company-wide, tak dibagi).
- Alokasi/pembagian biaya pusat proporsional omzet.
- Import Excel/CSV otomatis (input manual via form dulu).
- Riwayat/audit perubahan angka rekap (bisa fase lanjut).

## Isolasi

- Perubahan skema aditif+konversi terbatas ke tabel `expenses` (dummy sudah kosong).
- `@suka/auth`, HPP, omzet tak tersentuh.
- Owner/admin lihat semua (helper `accessible_outlet_ids()` kembalikan semua outlet); mitra/leader otomatis tak lihat pusat.
