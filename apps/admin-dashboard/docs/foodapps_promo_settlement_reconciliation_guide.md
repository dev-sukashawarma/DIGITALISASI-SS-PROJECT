# Panduan & Dokumentasi Rekonsiliasi Promo & Settlement Food Apps
**Suka Shawarma Digital Platform — Modul Rekonsiliasi & Analitik POS**  
*Dokumen Referensi Resmi Analisis & Pengembangan Laporan Penjualan (Updated: Oktober 2026)*

---

## 1. Eksekutif Ringkasan (Executive Summary)

Dalam operasional bisnis F&B multi-outlet dengan berbagai kanal penjualan daring (*Food Apps* dan *Voucher Platform*), terdapat perbedaan mendasar antara:
1. **Apa yang di-input kasir pada mesin POS toko**, dengan
2. **Apa yang sebenarnya terjadi pada laporan keuangan & pencairan rekening platform (*Settlement*)**.

Dokumen ini mendokumentasikan secara rinci arsitektur logika, temuan lapangan, formula perhitungan, penanganan anomali kasir, dan siklus pencairan untuk seluruh platform (*GoFood, GrabFood, ShopeeFood, dan TikTok Go*).

---

## 2. Karakteristik & Skema Masing-Masing Platform

| Platform | Model Transaksi | Omzet Kotor (Gross) | Diskon / Promo Beban Toko | Subsidi Platform (Bukan Beban Toko) | Biaya Layanan / Komisi Platform |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GoFood (GoBiz)** | Pesanan Pesan-Antar (Food Delivery) | Harga Menu sebelum diskon | **Promo Resto** (Diskon yang ditanggung mitra usaha) | **Subsidi Gojek** (Voucher diskon konsumen dari Gojek) | **Komisi GoBiz** (~20%) dari penjualan bersih/kotor sesuai kontrak |
| **GrabFood** | Pesanan Pesan-Antar (Food Delivery) | Amount (Gross Sales) | **Merchant-Funded Discount** (Diskon yang dibiayai merchant) | Hampir tidak ada (promo pelanggan langsung dari Grab) | **Komisi Grab (Flat 20.00%)** dari Net Sales (`Amount - Diskon Toko`) |
| **ShopeeFood** | Pesanan Pesan-Antar (Food Delivery) | Order Amount (Harga Menu) | **Diskon Toko Murni** (Voucher Merchant & Subsidi Ongkir Toko) | Diskon koin/voucher Shopee | **Komisi Shopee** (~20%) dipotong dari pencairan |
| **TikTok Go** | **Penukaran Voucher di Kasir (Voucher Redemption)** | **Base Merchant** (`Payment Amount + Platform Incentive`) | **Merchant Incentive** (Kolom V file TikTok, biasanya Rp 0) | **Platform Incentive** (100% diganti penuh oleh TikTok ke rekening resto) | **Platform Fee (~8%) + Komisi Affiliate Creator** (dipotong saat pencairan bank) |

---

## 3. Anatomi 4 Card POS vs 2 Card Settlement

Di halaman `/dashboard/reports/pos` (Rangkuman Penjualan), metrik dibagi menjadi dua bagian dengan batas garis tegas:

### A. 4 Card Bagian Atas — Perspektif Operasional Kasir POS
Dihitung dari tabel database pesanan POS (`orders` & `order_items`):

1. **Gross Revenue (Omzet Kotor)**
   - Formula: $\sum (\text{Nilai Menu}) = \text{total\_amount} + \text{Potongan}$
   - Mencerminkan seluruh nilai omzet kotor pesanan sebelum dipotong diskon apa pun.
2. **Total COGS (HPP Resep)**
   - Formula: $\sum (\text{HPP per item} \times \text{Qty})$
   - Beban modal bahan baku murni berdasarkan porsi piring/shawarma yang dikeluarkan dapur.
3. **Potongan Merchant (Card Biru)**
   - Formula: Promo & diskon yang **benar-benar menjadi beban toko**.
   - Di GoFood: Menggunakan `promo_merchant` dari settlement GoBiz jika ada, memulihkan subsidi Gojek yang keliru diinput kasir.
   - Di TikTok Go: Bernilai **Rp 0** karena seluruh potongan voucher adalah subsidi TikTok (`Platform Incentive`).
   - Diskon yang disubsidi platform dipisahkan ke badge khusus:
     $$\text{Subsidi Platform} = \max(0, \text{promo\_subsidy\_kasir} - \text{promo\_merchant})$$
4. **Gross Profit (Card Hijau)**
   - Formula: $\text{Gross Revenue} - (\text{Total COGS} + \text{Potongan Merchant})$
   - Menunjukkan laba kotor toko sebelum memperhitungkan komisi aplikasi pihak ketiga.

### B. 2 Card Bagian Bawah — Perspektif Rekonsiliasi Pencairan Bank (Settlement)
Dihitung dari tabel rekonsiliasi perbankan platform (`platform_settlements`):

1. **Total Settlement (Card Biru-Ungu)**
   - Formula:
     $$\text{Omzet Kotor Settlement} - \text{Promo Merchant} - \text{Komisi Platform}$$
   - Uang riil yang dicairkan oleh platform ke rekening bank merchant.
   - Dilengkapi badge persentase ketercapaian pencairan terhadap POS:
     $$\text{Settlement Rate (\%)} = \left(\frac{\text{Total Settlement}}{\text{Gross Revenue POS}}\right) \times 100\%$$
2. **Admin Settlement (Card Ungu)**
   - Biaya layanan platform (komisi) dan komisi afiliasi kreator yang dipotong langsung di sumber pencairan.

---

## 4. Keputusan Arsitektur: Kenapa Admin Settlement Tidak Digabung ke Card Biru?

*Keputusan Bisnis & Desain (2026-10-03):*
1. **Pemisahan Peran:** 
   - 4 Card Atas mengukur **efisiensi kasir toko dan dapur** (apakah kasir salah menginput diskon? apakah HPP membengkak?).
   - 2 Card Bawah mengukur **kontrak finansial dengan platform** (berapa komisi yang diambil Gojek/Grab/TikTok? berapa uang bersih yang masuk rekening?).
2. **Ketiadaan Data Realtime di Kasir:**
   - Kasir di toko fisik tidak pernah mengetahui potongan komisi platform (misal 20% GoFood atau 8% TikTok) saat pesanan dicetak.
   - Memasukkan komisi ke Card Atas hanya bisa dilakukan jika file Excel settlement sudah diunggah oleh bagian finance. Jika belum diunggah, angka laba atas akan melonjak dan membingungkan pengguna jika berganti-ganti status.
3. **Pengecualian SS Online:**
   - Hanya channel marketplace virtual (`SS Online` / `Shopee Seller` & `TikTok Shop Online`) yang menggabungkan seluruh beban biaya admin ke Card Biru (disebut *"Beban Biaya Platform P&L"*), karena transaksi online sejak awal tidak melewati kasir fisik outlet.

---

## 5. Studi Kasus & Anomali Lapangan: Kasir Diskon 100% (Kasus Cibinong & Pajajaran)

### Kronologi Masalah:
- Pada bulan September 2026, TikTok Go meluncurkan kampanye voucher diskon besar.
- Kasir di Cabang Cibinong dan Pajajaran mengira voucher tersebut adalah diskon yang harus mereka kurangi secara manual di mesin kasir POS dengan memilih opsi *"Diskon 100%"*.
- **Akibat Fatal di Sistem:**
  - `total_amount` tercatat Rp 0.
  - `promo_subsidy` membengkak hingga Rp 6.635.108.
  - Omzet toko hilang, dan resto tercatat menanggung rugi promo fiktif sebesar Rp 6,63 Juta.
- **Fakta Finansial:**
  - Voucher tersebut dibeli pelanggan di aplikasi TikTok dan disubsidi 100% oleh TikTok (`Platform Incentive`). TikTok tetap mentransfer uang seharga menu voucher ke rekening resto.

### Solusi & Normalisasi:
1. Dilakukan normalisasi database SQL pada 155 transaksi tersebut:
   - `promo_subsidy` dikembalikan ke `0`.
   - `amount_received` dan `total_amount` dikembalikan ke harga menu utuh.
   - Ditambahkan catatan audit trail di kolom `notes`: `[AUTO-FIX] Normalisasi promo TikTok Go...`.
2. Dibuatkan proteksi kode pada `posReportKpi.ts` fungsi `isTikTokGoOrder()`:
   - Transaksi dengan channel TikTok Go otomatis membatasi diskon merchant ke `settlement_promo_merchant` (atau 0), dan sisa input kasir dialihkan ke subsidi platform agar Laba Kotor tidak pernah tertekan lagi.

---

## 6. Siklus Pencairan Platform (Payout Latency) & Jadwal Tarik Data

Setiap platform memiliki jadwal transfer bank yang berbeda:

```
[Transaksi di Kasir] ────> [Proses Verifikasi Platform] ────> [Pencairan ke Bank Merchant]
```

1. **GoFood & GrabFood:**
   - **T+1 Hari Kerja:** Penjualan hari ini masuk ke rekening keesokan harinya.
2. **ShopeeFood:**
   - **T+1 s/d T+3:** Bergantung pada hari libur bank dan tipe akun merchant.
3. **TikTok Go:**
   - **T+4 Hari Kerja (Senin–Jumat):**
   - Transaksi di akhir pekan (Sabtu & Minggu) serta hari libur nasional **tidak dihitung** dalam hari kerja perbankan.
   - **Aturan Tutup Buku Akhir Bulan TikTok Go:**
     * Transaksi tanggal 29 September 2026 (Selasa) $\rightarrow$ Cair Senin, 5 Oktober 2026.
     * Transaksi tanggal 30 September 2026 (Rabu) $\rightarrow$ Cair Selasa sore, 6 Oktober 2026.
     * **Rekomendasi:** Tarik kembali (*export*) file settlement dari TikTok Seller Center pada **Rabu, 7 Oktober 2026** agar seluruh data bulan September ter-cover **100% tuntas**.

---

## 7. Arsitektur Teknis: Paginasi Wajib PostgREST (`fetchAllPages`)

### Masalah Limit Diam-diam 1.000 Baris:
- PostgREST / Supabase API memiliki batas bawaan maksimal **1.000 baris per panggilan HTTP**, bahkan jika kode memanggil `.limit(5000)`.
- Jika pemanggilan `platform_settlements` untuk seluruh cabang dalam satu bulan menghasilkan lebih dari 1.000 baris (misal September 2026: 2.104 baris), maka query tanpa paginasi hanya mengambil halaman pertama dan memotong 1.104 baris lainnya **tanpa pesan error**.
- Hal ini sempat menyebabkan TikTok Go hanya terbaca 5 baris terakhir (tanggal 30 September saja) dan melaporkan settlement hanya Rp 3,41 Juta.

### Implementasi Standar:
Semua pemanggilan tabel agregasi wajib menggunakan helper `@/lib/fetchAllPages` dengan urutan deterministik:

```typescript
const settlements = await fetchAllPages<any>(() => {
  let q = supabase
    .from('platform_settlements')
    .select('*')
    .gte('tanggal', req.from)
    .lte('tanggal', req.to)
    .order('id', { ascending: true }) // Wajib deterministik

  if (!includeAll) {
    q = q.in('outlet_id', realOutlets)
  }
  return q
})
```

---

## 8. Panduan Integrasi Pemetaan Toko (`platform_store_map.json`)

File `src/data/platform_store_map.json` adalah Single Source of Truth pemetaan ID cabang platform pihak ketiga ke UUID cabang internal grup SS:
- Memiliki dua indeks pencarian:
  1. `byStoreId`: Pencarian primer berbasis ID toko platform (contoh: ID toko TikTok `749583...`).
  2. `byName`: Pencarian sekunder toleran (*fuzzy*) berbasis normalisasi nama outlet.
- Setiap penambahan outlet baru wajib didaftarkan di file ini agar parser otomatis mengenali cabang tanpa menghasilkan baris *unmapped*.

---

## 9. Cetak Biru (Blueprint) Fitur Mendatang: Tab "Audit Promo Kasir"

Berdasarkan hasil analisis wawancara desain (*Grill-Me Session* 3 Oktober 2026), telah disepakati spesifikasi lengkap untuk pengembangan modul audit promo kasir pada fase berikutnya:

### A. Lokasi & Penempatan
- Ditempatkan sebagai **Tab Terpisah** pada menu **Rekonsiliasi Settlement** (`/dashboard/platform-settlement`).
- Memberikan ruang kerja terpadu bagi tim Finance untuk mengunggah settlement sekaligus memvalidasi kelayakan input kasir di seluruh cabang.

### B. Aturan Pemicu Anomali (Detection Rules)
Sistem secara otomatis menyaring transaksi kasir yang memenuhi salah satu kriteria berikut:
1. **Diskon Ekstrem ($\ge$ 50%):** Transaksi Food Apps (`gofood`, `grabfood`, `shopeefood`, `tiktokgo`) dengan nilai potongan $\ge$ 50% dari subtotal pesanan.
2. **Diskon 100% (Omzet Nol):** Transaksi Food Apps dengan nilai penerimaan `total_amount = 0` (kasus salah pencet diskon total).
3. **Diskon Manual TikTok Go:** Transaksi kanal TikTok Go yang memiliki `promo_subsidy > 0` atau `discount_amount > 0` (karena seluruh promo voucher TikTok Go adalah subsidi platform 100% dan bukan beban toko).

### C. Fitur & Tindakan Koreksi (Actionability)
1. **Daftar Checklist Interaktif:** Menampilkan cabang, kasir/shift, nomor order, tanggal, nominal diskon yang salah diinput, dan estimasi kerugian laba kotor toko.
2. **Tombol "Normalisasi Otomatis" (1-Klik):**
   - Mengembalikan `promo_subsidy = 0` dan `amount_received = total_amount` secara aman.
   - Menambahkan catatan audit trail permanen: `[AUDIT-FIX] Dinormalisasi oleh Admin Finance pada YYYY-MM-DD...`.
3. **Export Laporan (CSV / PDF):**
   - Mengunduh daftar anomali kasir per cabang untuk diteruskan sebagai evaluasi SOP operasional ke Supervisor dan Kasir cabang.

