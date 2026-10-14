# Closing OPEX Internal September 2026 — Design

**Tanggal:** 14 Oktober 2026
**Status:** Draft, menunggu review owner
**Acuan angka:** `SS LAP. LABA RUGI 2026 fixxxxx.xlsx`, sheet **FIXED SEPTEMBER 2026** (diverifikasi sel per sel 14 Okt 2026)
**Pola yang diikuti:** closing mitra September (`apps/admin-dashboard/src/app/actions/mitraPnlClosingData.ts`)

## 1. Latar belakang

Owner dan finance menyusun Laba Rugi September 2026 di Excel. Untuk outlet internal, angka OPEX di
sistem berbeda dari Excel karena tiga hal:

1. **Data salah tempat / dobel** — misalnya biaya SS Online tercatat di outlet lain, biaya visit
   tercatat dua kali (catatan manual finance + impor Marcom), transaksi PDAM pusat belum diinput.
2. **Aturan hitung berbeda** — Excel memakai bonus slip payroll, membagi bonus RM rata 1/21, memakai
   daftar binaan AM sendiri, dan membebankan kru cadangan ke pusat. Sistem memakai bonus realtime,
   bonus RM per item terjual, dan membagi kru cadangan ke outlet tempat bertugas.
3. **Pengelompokan berbeda** — sistem memindahkan lembur dari kas kecil ke baris Lembur, sedangkan
   Excel menaruhnya di Pengeluaran Outlet.

Sebagian sudah diselesaikan langsung di data selama sesi 14 Okt (lihat §9). Spec ini mengatur sisanya
supaya **tabel OPEX September internal di sistem sama persis dengan Excel**, di semua layar yang
menampilkan OPEX.

## 2. Tujuan dan ukuran berhasil

- Untuk September 2026, tiap baris OPEX per outlet internal (11 outlet + SS Online) dan tiap baris
  OPEX HQ di layar sistem **sama dengan sel Excel**, selisih 0.
- Angka tetap bisa ditelusuri: transaksi asli tetap tampil; selisih yang berasal dari aturan Excel
  ditampilkan sebagai baris **"Penyesuaian closing September"** beralasan.
- Angka ditampilkan sama di Laba Rugi (Internal & Global) + ekspor, Ringkasan Bisnis, Buku Kas
  admin-dashboard, dan Buku Kas app Finance.
- Agustus, Oktober, dan bulan lain **tidak berubah sama sekali**. Rumus bonus RM, alokasi AM, dan
  pembagian kru cadangan untuk Oktober dan seterusnya tetap.
- Dijaga tes otomatis.

## 3. Di luar cakupan

- Pendapatan, HPP, admin fee, waste, dan bagian SS dari mitra (spec berikutnya). Catatan: HPP Excel
  sudah disamakan finance dengan sistem.
- Outlet mitra (sudah memakai closing mitra).
- Daftar transaksi mentah: Analisis Pengeluaran, Rekap Bulanan, EOM Closing Satelit (Finance), SUKA
  Bot/Hermes. Layar ini ikut perubahan data (§5) tapi **tidak** menampilkan penyesuaian closing.
- Jalur cadangan Ringkasan Bisnis (RPC `get_owner_dashboard_summary`, dipakai untuk pengguna baca-saja
  dan rentang sangat panjang) — tidak memuat penyesuaian closing.
- Pemindahan slip payroll Gilang, Ismansyah, Abdul Hanan ke SS Online mulai Oktober (tugas terpisah).

## 4. Keputusan owner & finance (14 Okt 2026)

| # | Keputusan |
|---|---|
| K1 | Angka acuan = sheet FIXED SEPTEMBER 2026 versi `fixxxxx.xlsx` |
| K2 | Pakai data asli selama bisa ditelusuri; angka closing hanya untuk bagian yang berasal dari aturan Excel |
| K3 | Sinkron antar layar (Laba Rugi + ekspor, Ringkasan Bisnis, Buku Kas admin & Finance); internal dulu |
| K4 | Kalau data September berubah setelah closing, angka di layar **tetap sama dengan Excel**; tes memberi tanda |
| K5 | Penyesuaian closing hanya dipasang kalau rentang tanggal mencakup **seluruh** September; rentang sebagian memakai data apa adanya + catatan |
| K6 | GUDANG SS ONLINE (`d23e11b3-23f1-4f9a-b428-cc73e1aa9b91`) menjadi "rumah" biaya SS Online; Laba Rugi menggabungkannya ke kolom SS Online |
| K7 | PLN pusat dikoreksi di data menjadi 4.502.475 |
| K8 | Gaji & bonus kru SS BACKUP September dibebankan ke pusat (baris HQ sendiri), bukan ke outlet |
| K9 | Bonus RM September dibagi rata 1/21 (ikut Excel); rumus Oktober+ tetap |
| K10 | Bonus crew September mengikuti slip payroll |
| K11 | Alokasi gaji RM + stock controller juga ke BNR; SS Online tidak mendapat bagian |
| K12 | Bonus Abdul Hanan (50.000) tidak dibebankan, sesuai Excel |
| K13 | Pembelian galon = Pengeluaran Outlet, bukan PDAM |

## 5. Perubahan data (B1–B6)

Hanya transaksi September. Tiap langkah ditulis sebagai skrip arsip di `SS COGS SET/` berisi data lama
untuk pembatalan, dan diverifikasi ulang ke DB setelah dijalankan. "Kantor Pusat" =
`outlet_id = ffffffff-ffff-ffff-ffff-ffffffffffff`.

| # | Transaksi (`expenses.id`) | Sebelum | Sesudah |
|---|---|---|---|
| B1 | **Baru:** PDAM Kantor Pusat September 2026 | — | Kantor Pusat · `pdam` · 972.800 · 2026-09-30 |
| B2 | `62c9b004…` Powder Jeruk 1.582.100 · `e36aeb3b…` Powder Jeruk 654.650 · `219b4ba1…` Aqua 1.480.000 · `e9e865fd…` Serbuk Es Teh 1.101.200 · `b4dba466…` Bawang Putih Bubuk 38.673 · `0ea83a1b…` Cup Suka Drink 1.713.000 | Kantor Pusat · `bahan_baku` | Kantor Pusat · `pengeluaran_global` |
| B3a | `04596554…` Indihome Jatiasih 260.850 | Jatiasih · `internet` | Kantor Pusat · `pengeluaran_global` |
| B3b | `01d62570…` Lemburan a.n Aby 50.000 | BNR · `lembur` | Kantor Pusat · `pengeluaran_global` |
| B4 | `4af51337…` Bubble Wrap 1.300.000 · `5355e335…` Sticker SS Online 190.200 · `15a180c9…` Ongkos Kirim (Barter) 14.409 | GUDANG SS ONLINE | Kantor Pusat · `bahan_baku` |
| B5 | `3c18a536…` Indihome SS Dapur 260.850 | Kantor Pusat · `internet` | GUDANG SS ONLINE · `internet` |
| B6 | `1d6d2e62…` Token Listrik Kantor | 5.002.750 | 4.502.475 |

Hasil di data setelah B1–B6, biaya pusat: PDAM 972.800, PLN 4.502.475, Pengeluaran Global
126.079.883, Transport 6.368.669, Bahan Baku 1.504.609, Ads 996.780 — **enam baris HQ langsung sama
dengan Excel**. Catatan: 4 transaksi pengeluaran global bertanda "[Kategori: transport]" (750.000)
sudah dibaca sistem sebagai transport, tidak perlu diubah.

## 6. Angka closing (target)

### 6.1 Sumber

File data `opexClosingInternalSeptember2026.ts` di admin-dashboard, **dihasilkan skrip** dari sheet
FIXED (tidak diketik tangan), berisi:
- target per outlet × baris OPEX (baris 37–49) untuk kolom B–M;
- target per baris OPEX HQ (baris 60–70);
- komponen alasan penyesuaian (§6.3).

File Excel sumber **tidak** di-commit (berisi rincian gaji). Skrip generator di-commit dan menulis
path file sumber + tanggal verifikasi di header file data.

### 6.2 Target OPEX outlet (dari Excel)

| Baris | SS Online | BNR (Kitchen) | Empang | Cimanggu (BCC) | Sukmajaya | Jagakarsa | Beji | Sawangan | Pajajaran | Jatiwaringin | Cirendeu | Dramaga |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 37 Pengeluaran Outlet | 0 | 7.900 | 3.629.500 | 3.561.000 | 3.884.000 | 2.257.368 | 1.976.000 | 2.476.313 | 1.996.500 | 2.598.500 | 2.125.000 | 2.541.525 |
| 38 Gaji Crew Outlet | 6.630.000 | 11.202.714 | 10.369.638 | 8.602.714 | 6.327.714 | 6.502.715 | 6.327.714 | 0 | 6.023.713 | 4.612.713 | 6.081.943 | 6.212.714 |
| 39 Bonus Crew | 0 | 148.801 | 457.199 | 368.138 | 278.434 | 212.650 | 209.316 | 0 | 70.350 | 130.800 | 215.100 | 248.050 |
| 40 Bonus Area Manager | 0 | 0 | 175.680 | 175.680 | 124.988 | 70.550 | 151.850 | 0 | 107.500 | 70.550 | 151.850 | 175.680 |
| 41 Bonus Regional Manager | 0 | 128.224 | 128.224 | 128.224 | 128.224 | 128.224 | 128.224 | 0 | 128.224 | 128.224 | 128.224 | 128.224 |
| 42 Lembur | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 43 Ads | 0 | 0 | 498.000 | 0 | 0 | 0 | 0 | 1.332.000 | 0 | 0 | 0 | 6.274.581 |
| 44 Endorsement | 0 | 0 | 580.000 | 450.000 | 370.000 | 650.000 | 0 | 2.220.000 | 250.000 | 700.000 | 400.000 | 275.000 |
| 45 Promo | 0 | 0 | 248.500 | 152.000 | 115.667 | 155.334 | 39.667 | 436.340 | 153.667 | 117.334 | 77.667 | 153.667 |
| 46 PDAM | 0 | 0 | 107.750 | 375.300 | 0 | 0 | 0 | 0 | 79.200 | 0 | 0 | 0 |
| 47 PLN | 0 | 0 | 395.000 | 0 | 407.000 | 403.650 | 404.500 | 0 | 0 | 464.365 | 225.000 | 0 |
| 48 Internet | 260.850 | 0 | 218.290 | 194.250 | 316.350 | 316.350 | 333.000 | 316.350 | 260.850 | 392.940 | 260.850 | 194.250 |
| 49 Sewa Outlet | 0 | 0 | 6.250.000 | 5.417.000 | 6.167.000 | 4.375.000 | 3.000.000 | 3.333.333 | 2.000.000 | 2.084.000 | 2.166.667 | 2.292.000 |
| **50 Total OPEX** | **6.890.850** | **11.487.639** | **23.057.781** | **19.424.306** | **18.119.377** | **15.071.841** | **12.570.271** | **10.114.336** | **11.070.004** | **11.299.426** | **11.832.301** | **18.495.691** |

### 6.3 Target OPEX HQ (dari Excel)

| Baris | Nilai |
|---|---:|
| PDAM | 972.800 |
| PLN | 4.502.475 |
| Internet | 2.014.650 |
| Pengeluaran Global | 126.079.883 |
| Gaji Staff Kantor | 71.705.768 |
| Gaji & Bonus Crew Backup | 8.694.636 |
| Transport | 6.368.669 |
| Bahan Baku | 1.504.609 |
| Ads | 996.780 |
| **Total OPEX HQ** | **222.840.270** |

### 6.4 Penyesuaian yang diharapkan (setelah B1–B6, terhadap data 14 Okt)

Penyesuaian dihitung saat runtime = target − hasil data, jadi angka di bawah adalah perkiraan yang
dipakai untuk tes dan pemantauan, bukan nilai yang disimpan.

| Outlet | Gaji crew | Bonus crew | Bonus AM+RM | Pengeluaran | Lembur | Internet | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| SS Online | +6.630.000 | 0 | 0 | 0 | 0 | 0 | +6.630.000 |
| BNR | −4.630.001 | 0 | +53.824 | 0 | −50.000 | −51.500 | −4.677.677 |
| Empang | −225.000 | −16.498 | −169.796 | +325.000 | −325.000 | 0 | −411.294 |
| Cimanggu | −1.420.000 | −77.568 | −141.796 | +100.000 | −100.000 | 0 | −1.639.364 |
| Sukmajaya | −560.000 | +1.632 | −23.588 | +50.000 | −150.000 | 0 | −681.956 |
| Jagakarsa | −1.384.589 | −11.250 | −25.126 | 0 | 0 | 0 | −1.420.965 |
| Beji | −564.334 | −40.284 | +30.474 | 0 | 0 | 0 | −574.144 |
| Sawangan | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Pajajaran | −1.795.250 | −102.850 | +62.524 | 0 | 0 | 0 | −1.835.576 |
| Jatiwaringin | −653.500 | +130.800 | +39.374 | +50.000 | −50.000 | 0 | −483.326 |
| Cirendeu | −185.257 | −12.700 | +37.874 | 0 | 0 | 0 | −160.083 |
| Dramaga | −1.420.000 | −45.350 | −96 | +250.000 | −250.000 | 0 | −1.465.446 |
| **HQ** | Crew Backup +8.694.636 · Gaji Staff Kantor −2.050.000 · Internet −113.000 | | | | | | |

Alasan per baris (ditampilkan di layar):

| Baris | Komponen alasan |
|---|---|
| Gaji crew | Kru cadangan dibebankan ke pusat · Alokasi gaji AM versi closing (Abu Bakar ÷5 termasuk Paledang, Chairul ÷4 tanpa Cileudug, Mulyadi ÷3 tanpa Kalisari) · Slip Gilang & Ismansyah → SS Online · Slip Abdul Hanan → SS Online |
| Bonus crew | Bonus mengikuti slip payroll |
| Bonus AM + RM | Bonus RM dibagi rata 1/21 |
| Pengeluaran / Lembur | Lembur kas kecil dihitung sebagai pengeluaran outlet · Tidak dihitung: Lembur Gilang (`173d6845…`), Bongkaran Sawangan (`petty_cash_expenses 8ac46907…`) |
| Internet | Tidak dihitung: Pulsa HP Kitchen (`cd0670dd…`), Pulsa KOL (`6da51ecb…`), Pulsa Markom (`76a83c0a…`) |
| HQ | Gaji & bonus kru SS BACKUP ke pusat · Slip Abdul Hanan → SS Online |

## 7. Arsitektur

### 7.1 Unit

1. **Generator** (`apps/admin-dashboard/scripts/closing/bangkitkanOpexInternalSept2026.py`):
   membaca sheet FIXED, menulis file data §6.1. Dijalankan manual; tidak ikut build.
2. **Data closing** (`src/lib/closing/opexClosingInternalSeptember2026.ts`): konstanta target + alasan,
   dikunci id outlet.
3. **Penerap** (`src/lib/closing/terapkanClosingOpex.ts`), fungsi murni:
   `terapkanClosingOpex(rows: ExpenseRow[], filter): { rows: ExpenseRow[]; catatan?: string }`
   - Kalau rentang tidak memuat seluruh 2026-09-01..2026-09-30 → kembalikan `rows` apa adanya; bila
     rentang memotong September, isi `catatan` ("closing September berlaku untuk sebulan penuh").
   - Kalau memuat: kelompokkan baris September per (outlet, baris OPEX) memakai pemetaan kategori yang
     sama dengan ekspor Laba Rugi (`profitExportService.ts:304-321`), gabungkan GUDANG SS ONLINE ke SS
     Online, lalu untuk tiap pasangan dengan selisih ≠ 0 tambahkan satu `ExpenseRow` sintetis:
     `id = 'closing-sep26-<outlet>-<baris>'`, `source: 'monthly'`, kategori baris itu, `amount` =
     target − data (boleh negatif), `description` = alasan.
   - Baris di luar September dan outlet non-internal tidak disentuh.
4. **Pemasangan** (admin-dashboard) — dipanggil tepat setelah `gantiPayrollDenganHr(...)` dan
   `gabungGajiKantor(...)` di:
   - `src/app/dashboard/owner/profit/ProfitView.tsx` (Laba Rugi Global/Internal)
   - `src/lib/export/profitExportFetcher.ts` / `profitExportService.ts` (ekspor)
   - `src/lib/server/opexLabaRugi.ts` (Ringkasan Bisnis)
   - `src/app/dashboard/reports/input-pengeluaran/page.tsx` (Buku Kas admin; kartu gaji/bonus/lembur
     membaca baris hasil penerap, bukan field HR langsung, untuk rentang September penuh)
5. **Finance** — salinan identik unit 2 & 3 di `apps/finance/src/lib/closing/`, dipasang di
   `apps/finance/src/app/laporan/buku-kas/page.tsx`. Tes kesamaan membandingkan isi file admin vs
   finance (pola paritas `posReport/compute.ts`).

### 7.2 Aliran data

```
expenses + petty cash ─► susunBarisPengeluaran ─► calculateProratedExpenses
   ─► gabungGajiKantor ─► gantiPayrollDenganHr ─► terapkanClosingOpex ─► layar
```

### 7.3 Kegagalan & batas

- Data closing hanya untuk outlet yang tercantum; outlet internal baru/lain di September → tidak
  disesuaikan (tes menandai kalau ada outlet internal ber-OPEX September di luar daftar).
- Penerap tidak pernah melempar error; kalau data closing tidak cocok dengan bentuk baris, kembalikan
  `rows` asli dan catat peringatan di konsol server.
- Cache: setelah deploy, bersihkan memo `hitungOpexLabaRugi` dan cache Ringkasan Bisnis
  (`revalidateOwnerDashboardCache`).

## 8. Pengujian

1. **Data vs Excel** — generator menulis checksum; tes memastikan jumlah per outlet = baris 50 dan
   total HQ = 222.840.270.
2. **Penerap (unit)** — fixture baris September + Agustus + Oktober: hasil September per (outlet,
   baris) = target; Agustus & Oktober identik dengan input; rentang 1–15 Sep tidak disesuaikan dan
   mengembalikan `catatan`.
3. **Paritas admin ↔ Finance** — file data & penerap identik.
4. **Cek data hidup** (skrip baca-saja `SS COGS SET/cek-closing-opex-internal-september.mjs`,
   menjalankan pipeline OPEX asli): hitungan sistem September + penyesuaian = target untuk tiap outlet
   & baris HQ; melaporkan penyesuaian yang bergeser dari §6.4 (tanda bahwa data September berubah).
   Dijalankan sebelum dan sesudah deploy.
5. **Browser setelah deploy** — Laba Rugi Internal September, ekspor, Ringkasan Bisnis, Buku Kas admin
   & Finance dibandingkan dengan Excel.

## 9. Sudah dikerjakan di data (14 Okt 2026, di luar spec ini)

| Perubahan | Arsip |
|---|---|
| Join expense September 11 baris (90.625.733) dihapus | `SS COGS SET/cadangan-joint-expense-september-2026-10-14.sql` |
| Sewa outlet September 10 outlet internal (37.085.000) diinput | `SS COGS SET/input-sewa-outlet-september-2026-10-14.sql` |
| 14 baris "Visit" manual finance dobel dengan impor Marcom (935.000) dihapus | `SS COGS SET/cadangan-visit-dobel-pusat-september-2026-10-14.sql` |
| "Visit Sukmajaya" 160.000 dobel | dihapus finance sendiri |

## 10. Urutan kerja & deploy

1. Generator + data closing + tes data.
2. Penerap + tes unit.
3. Pemasangan di 4 layar admin.
4. Salinan Finance + pemasangan Buku Kas Finance + tes paritas.
5. Perubahan data B1–B6 (skrip arsip, verifikasi DB).
6. Cek data hidup → deploy admin-dashboard & finance → bersihkan cache → cek browser.

## 11. Catatan risiko

- **Repo publik.** File data closing berisi angka OPEX per outlet (tanpa nama/gaji per orang), sama
  seperti closing mitra yang sudah ada di repo. Rincian gaji per orang hanya ada di file Excel sumber
  yang tidak di-commit.
- **Kode Finance terduplikasi.** Perubahan berikutnya pada penerap wajib dilakukan di dua app; dijaga
  tes paritas.
- **Jalur cadangan Ringkasan Bisnis** tidak memuat penyesuaian (§3).
