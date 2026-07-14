# Design: Integrasi Nilai Waste ke Laba & Dashboard Analitik

**Tanggal:** 2026-07-14
**App:** `apps/admin-dashboard` (baca), `apps/stok` (sumber data, tidak diubah)
**Status:** Approved, siap masuk fase planning

## Latar Belakang

Alur waste sudah lengkap: crew lapor waste (qty, alasan, foto wajib) via `WasteModal.tsx` → status `PENDING` → SPV/leader approve/reject di `waste-approval/page.tsx` → saat `APPROVED`, trigger DB `trg_waste_report_approval` (migration `20260709050000_create_stok_waste_reports.sql`) otomatis insert `ledger_stok` (tipe `waste`, qty negatif) → stok fisik berkurang.

**Masalah:** HPP di dashboard bisnis (`get_hpp_periode`, migration `20260708225000_hpp_teoritis_periode.sql`) murni teoritis — dihitung dari `resep` (BOM) × qty terjual × harga beli saat ini. Nilai waste yang sudah di-approve **tidak pernah masuk ke perhitungan HPP atau Laba manapun**. Waste hanya mengurangi stok fisik secara ledger, biayanya invisible secara akuntansi.

## Keputusan Desain

1. **Waste TIDAK dicampur ke HPP.** HPP resep tetap murni teoritis (dipakai untuk analisa food cost per menu, margin per resep) — supaya angka itu tetap bisa dipakai membandingkan efisiensi resep tanpa noise operasional.
2. **Waste jadi baris biaya terpisah "Kerugian Waste"** yang mengurangi Laba Bersih outlet & perusahaan, sejajar konsepnya dengan `expenses` (Outlet vs Pusat) yang sudah ada.
3. **Basis harga: harga beli saat ini** (`bahan_baku_harga` current), bukan snapshot historis — konsisten dengan cara `get_hpp_periode` menghitung, dan menghindari kebutuhan kolom baru.
4. **Alur approval waste TIDAK diubah** — project ini murni soal visibilitas nilai & integrasi laporan.
5. **Akses breakdown detail: owner & admin only.** Mitra TIDAK melihat breakdown/rincian waste, tapi Laba Bersih yang mereka lihat **tetap terpotong** oleh nilai waste (angka konsisten dengan yang dilihat owner) — cuma detail/rinciannya disembunyikan.

## Data Layer

### RPC 1: `get_waste_periode(p_from date, p_to date)`
Pola identik `get_hpp_periode` — scoped `accessible_outlet_ids()`, dipakai di Profit page & card Expenses (termasuk untuk mitra, karena Laba Bersih mereka harus ikut terpotong).

```sql
SELECT o.id AS outlet_id, COALESCE(SUM(w.qty * COALESCE(bh.harga_beli, 0)), 0) AS nilai_waste
FROM outlets o
LEFT JOIN stok_waste_reports w ON w.outlet_id = o.id
  AND w.status = 'APPROVED'
  AND (w.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN p_from AND p_to
LEFT JOIN bahan_baku_harga bh ON bh.bahan_baku_id = w.bahan_baku_id
WHERE o.id IN (SELECT public.accessible_outlet_ids())
GROUP BY o.id;
```
`SECURITY DEFINER SET search_path = public`, `GRANT EXECUTE ... TO authenticated`.

### RPC 2: `get_waste_breakdown(p_from date, p_to date)`
**Owner/admin only** — cek eksplisit di dalam function (`IF NOT (is_owner() OR is_admin()) THEN RAISE EXCEPTION`), defense-in-depth di luar UI hide. Return baris granular: `outlet_id, outlet_name, reason, bahan_baku_id, bahan_nama, tanggal, qty, nilai`. Agregasi per 4 dimensi (outlet/alasan/bahan/tren waktu) dilakukan di client dari satu query — hindari 4 RPC terpisah.

## Perubahan Perhitungan (`apps/admin-dashboard/src/lib/profit.ts`)

- `computeOutletProfit(omzet, hpp, pengeluaranOutlet, wasteValue)` — `labaBersih = labaKotor - pengeluaranOutlet - wasteValue`. HPP tidak berubah.
- `computeProfit(omzet, hpp, expenses, wasteValue)` — analog untuk level ringkasan.
- `computeCompanyProfit(sumLabaOutlet, pengeluaranPusat)` — tidak berubah (waste sudah terpotong di level outlet sebelum di-sum).
- Unit test baru di `profit.test.ts`: waste mengurangi labaBersih tanpa menyentuh HPP/labaKotor.

## UI Components

### 1. Profit page (`dashboard/owner/profit/page.tsx`)
- Hook baru `useWaste(filter)` (pola sama `useHpp.ts`, RPC `get_waste_periode`).
- StatTile baru "Kerugian Waste" (accent merah/warning), ikut masuk formula Laba Bersih.

### 2. Expenses page
- Card ringkasan terpisah "Kerugian Waste" — read-only, pola sama card "Biaya Pusat" yang sudah ada. Di luar 14 kategori terkelola, tidak muncul di form input manual, tidak bisa diedit.

### 3. Halaman baru `dashboard/owner/waste/page.tsx`
- Nav Owner, sejajar Profit/Expenses/Targets. Guard role: owner/admin only (pola `RoleContext` yang sudah ada, redirect non-owner/admin).
- Pakai `PeriodFilter` (rentang tanggal + outlet) yang sudah dipakai di halaman lain.
- 4 view dari satu `get_waste_breakdown` query:
  - **Per outlet** — ranking table/bar chart (fokus mana yang perlu dibina)
  - **Per alasan** (Basi/Jatuh/Gosong/dll) — pie/bar chart (pola: expired vs human error)
  - **Per bahan baku** — table qty & nilai (bahan paling sering/mahal ke-waste)
  - **Tren waktu** — line chart harian dalam rentang filter

## Edge Cases
- `bahan_baku_harga` kosong/0 → nilai dihitung 0 (konsisten pola `anyMissingPrice` di `hpp.ts`), tapi qty tetap tercatat di breakdown supaya tidak hilang dari radar meski nilai Rupiah belum akurat.
- Mitra: RLS `stok_waste_reports` sudah scoped `accessible_outlet_ids()`; RPC breakdown ditutup eksplisit di level function — defense in depth, bukan cuma UI hide.
- Waste `REJECTED`/`PENDING` tidak dihitung sama sekali — hanya `APPROVED` (konsisten dengan trigger ledger yang sudah ada).

## Testing
- Unit test `profit.ts` — waste mengurangi labaBersih, HPP tidak berubah.
- Manual smoke test: approve 1 waste report → verifikasi angka konsisten di 3 tempat (Profit, Expenses, dashboard Waste) = qty × harga_beli current yang sama.
- Type-check + build `admin-dashboard` bersih.

## Out of Scope
- Tidak mengubah alur approval waste yang sudah ada.
- Tidak mengubah `get_hpp_periode` / HPP resep.
- Tidak ada snapshot harga historis di `stok_waste_reports` (pakai harga current).
- Halaman waste analitik hanya di `admin-dashboard`, tidak dibuat versi ringkas di `apps/stok`.
