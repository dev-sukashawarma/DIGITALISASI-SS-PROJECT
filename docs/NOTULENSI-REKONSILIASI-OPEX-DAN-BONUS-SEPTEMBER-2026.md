# NOTULENSI KESEPAKATAN & REKONSILIASI OPEX, GAJI MANAJER, DAN BONUS
**Periode Evaluasi:** September 2026  
**Tanggal Notulensi:** 9 Oktober 2026  
**Ditujukan Kepada:** Tim Finance, Tim HR / Payroll, dan Manajemen Operasional Suka Shawarma  
**Topik Utama:** Standarisasi Alokasi Gaji Pokok Manajer (Clean Salary), Pemisahan Bonus Performa Berbasis Pcs, Perlakuan Cabang Tutup Tengah Bulan (Mitra Paledang - Opsi A), dan Pencegahan Double-Counting (Sawangan Internal vs DTC)

---

## 1. RINGKASAN EKSEKUTIF

Pada evaluasi laporan keuangan dan penutupan buku (EOM Closing) bulan September 2026, telah disepakati dan diimplementasikan penyelarasan sistematis antara **Slip Gaji HR (HR Payroll)** dan **Laporan Laba Rugi Outlet (P&L OPEX Prorata)** dengan prinsip:

1. **Prinsip "Clean Salary" Manajer:**
   Gaji kotor manajer dipecah menjadi dua bagian yang terpisah:
   - **Gaji Bersih / Tetap (Clean Salary = Gaji Pokok + Tunjangan Jabatan + Tunjangan Kehadiran):** Dibagi rata (*equal split*) ke seluruh outlet binaan/operasional dan dicatat pada pos **`Gaji, Lembur & Upah Crew`** (`gaji_crew_outlet`).
   - **Bonus Performa Manajer (Berdasarkan Total Pcs Terjual):** Dicatat terpisah pada pos tersendiri (**`Bonus Area Manager`** dan **`Bonus Regional Manager`**), langsung proporsional sesuai jumlah pcs yang terjual di masing-masing outlet ($1\text{ pcs} = \text{Rp } 50$).
2. **Penerapan Opsi A untuk MITRA PALEDANG (Tutup 21 September 2026):**
   Outlet Mitra Paledang beroperasi selama 21 hari (1–21 September 2026) sebelum nonaktif. Disepakati menggunakan **Opsi A (Proporsional Penuh 21 Hari)**:
   - Mengakui penuh 843 transaksi selesai (omzet Rp 38.438.048, total 1.293 pcs).
   - Kru toko Paledang tetap berhak mendapatkan bonus kehadiran operasional sebesar **Rp 122.200**.
   - Penjualan 1.293 pcs Paledang tetap memberikan hak bonus AM dan RM masing-masing sebesar **Rp 64.650** ($1.293 \times \text{Rp } 50$).
   - Paledang tetap memikul alokasi gaji bersih AM (1 dari 5 cabang) dan RM (1 dari 21 cabang).
3. **Pencegahan Double-Counting Kasus Khusus:**
   - **Sawangan:** Cabang internal lama dialihkan menjadi `MITRA SAWANGAN DTC` per 26 September 2026. Slug `sawangan-depok-internal` dikecualikan dari pembagian manajer agar lokasi Sawangan hanya dihitung 1 kali.
   - **Outlet Dummy / Backup:** Outlet non-operasional seperti `SS BACKUP`, outlet uji coba (`test`, `trial`, `demo`) dikecualikan mutlak dari pembagian beban manajer.
4. **Total Discrepansi Biaya Se-Perusahaan = Rp 0:**
   Total biaya gaji dan bonus yang dibebankan ke seluruh outlet binaan tepat 100% klop dengan total pengeluaran slip gaji HR pusat.

---

## 2. DETAIL PERHITUNGAN REKONSILIASI HR & FINANCE

### A. Area Manager (Abu Bakar)
- **Cabang Binaan (5 Cabang):** Cicurug, Cimanggu, Dramaga, Empang, dan Paledang.
- **Data Slip HR September 2026:**
  - Total Gaji pada Slip: **Rp 5.378.400**
  - Komponen Bonus (17.568 pcs $\times$ Rp 50): **Rp 878.400**
  - **Gaji Bersih Manajer (Clean Salary):** $\text{Rp } 5.378.400 - \text{Rp } 878.400 = \mathbf{\text{Rp } 4.500.000}$
- **Alokasi Beban ke Outlet:**
  - Gaji Bersih per Outlet: $\text{Rp } 4.500.000 \div 5\text{ outlet} = \mathbf{\text{Rp } 900.000\text{ / outlet}}$ (masuk pos `gaji_crew_outlet`).
  - Bonus per Outlet: Dihitung riil dari pcs masing-masing cabang ($pcs \times \text{Rp } 50$), tercatat pada pos `bonus_area_manager`.

| Outlet Binaan AM | Total Pcs Terjual | Beban Gaji Bersih AM (Rp) | Beban Bonus AM (Rp) | Total Beban AM di Outlet (Rp) |
| :--- | :---: | :---: | :---: | :---: |
| **Mitra Cicurug** | 4.041 pcs | Rp 900.000 | Rp 202.050 | Rp 1.102.050 |
| **Mitra Cimanggu** | 4.062 pcs | Rp 900.000 | Rp 203.100 | Rp 1.103.100 |
| **Mitra Dramaga** | 4.296 pcs | Rp 900.000 | Rp 214.800 | Rp 1.114.800 |
| **Mitra Empang** | 3.876 pcs | Rp 900.000 | Rp 193.800 | Rp 1.093.800 |
| **Mitra Paledang** *(1–21 Sept)* | 1.293 pcs | Rp 900.000 | Rp 64.650 | Rp 964.650 |
| **TOTAL** | **17.568 pcs** | **Rp 4.500.000** | **Rp 878.400** | **Rp 5.378.400** |
| **Status Selisih vs Slip HR** | | **Rp 0** | **Rp 0** | **Rp 0 (Klop)** |

---

### B. Regional Manager (Indra Adam Sami)
- **Cakupan Wilayah:** Seluruh cabang operasional aktif (20 cabang penuh + 1 cabang Paledang = **21 cabang operasional**).
- **Data Slip HR September 2026:**
  - Total Gaji pada Slip: **Rp 8.179.700**
  - Komponen Bonus (53.852 pcs $\times$ Rp 50 = Rp 2.692.600, pembulatan HR): **Rp 2.692.700**
  - **Gaji Bersih Manajer (Clean Salary):** $\text{Rp } 8.179.700 - \text{Rp } 2.692.700 = \mathbf{\text{Rp } 5.487.000}$
- **Alokasi Beban ke Outlet:**
  - Pembagian Rata: $\text{Rp } 5.487.000 \div 21\text{ outlet} = \text{Rp } 261.285,71$
  - Algoritma *Deterministic Integer Split*: 15 outlet pertama mendapatkan **Rp 261.286**, dan 6 outlet berikutnya mendapatkan **Rp 261.285**.
  - Beban Bonus per Outlet: Berdasarkan pcs masing-masing outlet ($pcs \times \text{Rp } 50$), tercatat pada pos `bonus_regional_manager`.
  - Total Alokasi Gaji Bersih Se-Perusahaan: tepat **Rp 5.487.000** (Selisih **Rp 0**).

---

### C. Kasus Khusus: MITRA PALEDANG (Opsi A - Proporsional Penuh 21 Hari)
Meskipun operasional Mitra Paledang berhenti per tanggal 21 September 2026, aktivitas operasional selama 21 hari menghasilkan omzet dan biaya riil yang sah:
- **Kinerja Penjualan:** 843 order selesai, 1.293 pcs, Omzet Rp 38.438.048.
- **Rincian Beban Karyawan & Manajer Paledang:**
  1. **Gaji Kru Toko (Jamaludin):** Rp 459.615 (sesuai slip HR).
  2. **Alokasi Bersih AM Abu Bakar:** Rp 900.000.
  3. **Alokasi Bersih RM Indra Adam Sami:** Rp 261.285.
  4. **Subtotal Pos `Gaji Crew Outlet` Paledang:** $459.615 + 900.000 + 261.285 = \mathbf{\text{Rp } 1.620.900}$.
  5. **Bonus Kru Paledang (Kehadiran 1–21 Sept):**
     - Agung Wardhana (10 hari hadir): Rp 58.850
     - Emul Mulyana (11 hari hadir): Rp 63.350
     - Subtotal Pos `Bonus Crew`: $\mathbf{\text{Rp } 122.200}$.
  6. **Bonus AM Paledang:** $1.293\text{ pcs} \times \text{Rp } 50 = \mathbf{\text{Rp } 64.650}$.
  7. **Bonus RM Paledang:** $1.293\text{ pcs} \times \text{Rp } 50 = \mathbf{\text{Rp } 64.650}$.
- **Total Beban Terkait Personalia Paledang:** $\mathbf{\text{Rp } 1.872.400}$.

---

### D. Kasus Peralihan: Cabang Sawangan
- Pada tanggal 26 September 2026, operasional cabang `SUKA SHAWARMA SAWANGAN (INTERNAL)` dialihkan statusnya menjadi kemitraan dengan entitas `MITRA SAWANGAN DTC`.
- **Ketentuan Sistem:**
  - Posisi fisik outlet Sawangan adalah 1 lokasi.
  - Untuk mencegah beban ganda (*double-charging* gaji manajer), sistem secara otomatis mengecualikan slug `sawangan-depok-internal` dari daftar outlet pembagi beban manajer, dan membebankannya kepada `MITRA SAWANGAN DTC`.
  - Dengan demikian, jumlah outlet operasional yang menanggung RM tetap tepat **21 outlet**, bukan 22.

---

## 3. PERUBAHAN TEKNIS PADA SISTEM (CHANGELOG)

Untuk mendukung kesepakatan di atas tanpa mengganggu periode lainnya, tim IT telah merilis pembaruan teknis:

1. **Database Functions (Migration `20300254000500_historical_operational_bonus_outlets.sql`):**
   - Fungsi `public.get_monthly_crew_bonus` diperbarui agar menyertakan outlet yang memiliki order berstatus `completed` pada bulan berjalan, meskipun kolom `is_active` saat ini bernilai `false`.
   - Fungsi `public.get_monthly_am_bonus` dan `public.get_monthly_rm_bonus` diperbarui dengan aturan yang sama serta menyaring outlet dummy/test.
2. **Kalkulasi Prorata (`opexProrata.ts`):**
   - Outlet nonaktif historis yang memiliki slip gaji atau bonus tidak lagi diabaikan (*skip*) dalam rendering biaya bulanan lampau (Mode 2).
   - Remainder pembagian gaji bersih manajer didistribusikan secara deterministik untuk menjamin Rp 0 selisih se-perusahaan.
3. **Penyelarasan Server Actions (`mitraPnl.ts`, `prorataAuxiliary.ts`, `useProratedOpex.ts`):**
   - Himpunan `operationalOutletIds` membaca outlet yang memiliki aktivitas (`hadActivityInPeriod`) dan secara eksplisit menyaring `sawangan-depok-internal`.
4. **Invalidasi Cache Browser (`periodCache.ts`):**
   - Versi cache dinaikkan dari `v11` ke `v12` untuk memastikan seluruh dashboard menampilkan angka rekonsiliasi terbaru secara instan.
5. **Uji Validasi Unit Test (`opexProrata.test.ts`):**
   - 30 unit tests dijalankan dan berhasil 100% lulus, mencakup simulasi penutupan tengah bulan Paledang dan pembagian bersih manajer.

---

## 4. PANDUAN PENGECEKAN UNTUK TIM FINANCE & HR

Bagi Tim Finance dan Tim HR yang ingin memverifikasi angka-angka di atas melalui aplikasi Admin Dashboard:

1. **Pengecekan Laba Rugi Mitra (Menu: P&L Mitra / Profit Sharing):**
   - Pilih Outlet: **MITRA PALEDANG**
   - Pilih Periode: **1 September 2026 s/d 30 September 2026**
   - Verifikasi:
     - Pos **Gaji, Lembur & Upah Crew**: Tercatat **Rp 1.620.900** (Kru Rp 459.615 + AM Rp 900.000 + RM Rp 261.285).
     - Pos **Bonus Crew**: Tercatat **Rp 122.200**.
     - Pos **Bonus Area Manager**: Tercatat **Rp 64.650**.
     - Pos **Bonus Regional Manager**: Tercatat **Rp 64.650**.
2. **Pengecekan Dashboard AM (Abu Bakar):**
   - Pilih Periode September 2026.
   - Total bonus yang tercatat di ringkasan AM: **Rp 878.400** (cocok 100% dengan slip HR Abu Bakar).
3. **Pengecekan Dashboard RM (Indra Adam Sami):**
   - Total bonus yang tercatat di ringkasan RM: **Rp 2.692.600** (selisih pembulatan Rp 100 dari slip HR Rp 2.692.700).

---

*Notulensi ini dibuat sebagai rujukan resmi operasional keuangan dan penggajian Suka Shawarma.*
