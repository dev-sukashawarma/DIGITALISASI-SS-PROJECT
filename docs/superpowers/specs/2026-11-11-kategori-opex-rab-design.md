# Kategori OPEX "RAB" (Ditanggung Dana Investasi)

**Tanggal:** 2026-11-11 · **Status:** disetujui owner (grilling 11 Nov 2026)

## Tujuan

Pengeluaran yang sudah ditanggung pembayaran investasi (RAB pembukaan outlet)
tercatat rapi di rekap Buku Kas, **tanpa mengurangi angka apa pun**: tidak
masuk OPEX, laba outlet, laba perusahaan, laba/bagi hasil mitra, ROI/BEP,
budget Marcom, dan tidak memotong saldo rekening.

## Keputusan owner

| # | Topik | Keputusan |
|---|---|---|
| 1 | Sumber input | Form Input Pengeluaran (admin-dashboard & finance) + form OPEX Marcom (Sumber Dana = Dana RAB) |
| 2 | Penyimpanan | Tabel `expenses`, `category = 'rab'` |
| 3 | Pengaman | `type = 'rab'` (bukan `'expense'`). Semua laporan laba sudah memfilter `type = 'expense'` |
| 4 | RAB Marcom | Disatukan ke `expenses`. `biaya_rab_outlet` dipensiunkan (kosong per 11 Nov) |
| 5 | Mitra | **Boleh melihat** RAB outletnya (membatalkan aturan 5 Nov "mitra tidak boleh tahu") |
| 6 | Buku Kas | Baris RAB di daftar transaksi dengan badge "RAB · tidak dihitung", nominal abu-abu, bisa difilter; total di kartu "Ditanggung RAB"; tidak masuk Total OPEX/rincian kategori; ekspor memisahkannya dari grand total |
| 7 | Dashboard Mitra | Blok info "Ditanggung RAB (dana investasi)" di Laba Rugi Mitra; laba, bagi hasil, ROI, BEP tidak berubah |
| 8 | Alokasi | Wajib satu outlet (form + DB) |
| 9 | Rekening | Tidak memotong rekening pusat (form menyembunyikan pilihan, DB menolak) |
| 10 | Data lama | Boleh diubah ke/dari RAB, kecuali bulan yang sudah closing (≤ 31 Okt 2026) |

## Model data

- `category = 'rab'` ⇔ `type = 'rab'` — CHECK `expenses_rab_type_check`
  (`IS NOT DISTINCT FROM`, supaya `type` NULL tak lolos).
- Baris RAB: `outlet_id` wajib, `cash_location_id` NULL, `payment_source <> 'cash_drawer'`
  — CHECK `expenses_rab_outlet_check`.
- Trigger `trg_expenses_jaga_rab` (BEFORE INSERT/UPDATE):
  - Tulis/ubah baris RAB dari klien (`auth.uid()` terisi) hanya admin finance/admin/owner
    (`kas_pencatat_ok()`) atau developer. Server action service role lewat.
  - Mengubah baris dari/ke RAB ditolak bila tanggal lama atau baru ≤ `batas_closing_opex()`.
- `batas_closing_opex()` = `2026-10-31`. **Naikkan setiap closing bulan baru**, bersama
  `BATAS_CLOSING_RAB` di `lib/pengeluaran/rab.ts` (admin-dashboard & finance).

Tidak ada RLS baru: `expenses_select_scoped` sudah membuat mitra/leader hanya
melihat outletnya sendiri.

## Mengapa aman (tidak mengurangi apa pun)

Pembaca `expenses` yang menghasilkan angka laba semuanya memfilter
`type = 'expense'`: `get_owner_dashboard_summary`, `get_mitra_roi`,
`ambilPengeluaran` (Buku Kas/Profit/Hermes/SUKA Bot), `mitraPnl`, `mitraRoi`,
`profitExport`, `prorataAuxiliary`, manager, bot. `get_expected_shift_cash`
hanya membaca `payment_source = 'cash_drawer'` (RAB dilarang memakainya).
`trg_expenses_sinkron_kas` hanya bergerak bila ada `cash_location_id` (RAB
dilarang). `owner-dashboard/useExpenses` (tak di-deploy) diberi filter juga.

## Aplikasi

- `lib/pengeluaran/rab.ts` (identik admin & finance, masuk test paritas):
  konstanta, `cekPerubahanRab()`, `ambilBiayaRab()`, ringkasan.
- `actions/expenses.ts`: create/update menulis `type='rab'` untuk kategori RAB,
  menegakkan aturan yang sama dengan DB; `upsertExpensesAction` menolak RAB.
- `ExpenseFormModal`: opsi "RAB (Ditanggung Dana Investasi)", Head Office &
  rekening disembunyikan untuk RAB.
- Buku Kas: baris RAB digabung ke daftar tampilan saja (bukan `allTransactions`
  yang menjadi dasar total), total tabel & ekspor hanya non-RAB, RAB ditambah
  sebagai bagian terpisah di Excel/CSV dan satu baris catatan di PDF.
- `BiayaRabPanel`: sumber data dari `expenses type='rab'`; dipakai di Buku Kas,
  Profit, dan Laba Rugi Mitra.
- Marcom: `syncManualExpenseOpex` menulis RAB ke `expenses`
  (`category/type = 'rab'`); Dana RAB wajib punya outlet; hapus/ubah memakai
  `expenseId` yang sama.

## Deploy

1. Apply migration.
2. Deploy admin-dashboard, finance, marcom (otomatis saat merge ke `main`).
3. Jalankan sinkron ulang Marcom (cron `sync-opex` / tombol sinkron) supaya RAB
   Marcom yang sempat masuk `biaya_rab_outlet` sebelum deploy pindah ke `expenses`.

## Addendum 11 Nov 2026 — kas kecil & aturan otomatis per outlet

**Kas kecil (migration `20261111160000`, LIVE):** `petty_cash_expenses` boleh
`type = 'rab'`. Saldo kas kecil tetap berkurang (uangnya keluar dari laci);
`get_owner_dashboard_summary`, `get_mitra_roi`, mitraPnl, mitraRoi, dan bot
menyaring `type <> 'rab'`.

**Aturan otomatis (migration `20261111170000`):** tabel `rab_outlet_otomatis`
(outlet, periode, `kategori_kecuali`). Trigger `trg_*_zz_rab_otomatis` (BEFORE
INSERT/UPDATE, sesudah penjaga peran) memaksa baris `type='expense'` yang cocok
menjadi RAB — **mutlak**, termasuk sinkron ulang Marcom. Tidak menyentuh bulan
closing, `cash_drawer`, pemasukan, atau voucher kantor.

Kasus pertama — **Mitra Karawaci s.d. 30 Nov 2026**, kecuali gas, PLN, PDAM,
internet, utilitas, sewa outlet, endorsement. Gaji/bonus crew (payroll HR) di
luar aturan. Kategori asal tidak disimpan.

**Perubahan keputusan #9:** RAB **boleh** dibayar dari rekening pusat; rekening
tetap terpotong (uangnya memang keluar), hanya tidak dihitung OPEX/laba.
