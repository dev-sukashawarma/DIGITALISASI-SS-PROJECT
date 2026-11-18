# Biaya Xendit di Rangkuman Penjualan — Desain

Tanggal: 2026-11-18 · Status: menunggu persetujuan owner

## Maksud
Pesanan website (Order Online) dibayar lewat Xendit, dan Xendit memotong ±6,6–7,8% dari
uang masuk (Okt Rp 631.848 dari Rp 8.076.276). Di Rangkuman Penjualan biaya ini tidak
tercatat di mana pun, sehingga laba kotor website terlalu besar. Kartu merah **Admin Fee**
harus memuat **Biaya Xendit**, dan Laba Kotor ikut terpotong.

## Tujuan / bukan tujuan
- Tujuan: biaya Xendit aktual (dari file Balance History) per pesanan website; estimasi
  bertanda untuk pesanan yang belum ada di file; Admin Fee & Laba Kotor ikut berubah.
- Bukan tujuan (keputusan owner 18 Nov, "Rangkuman saja dulu"): Laba Rugi internal,
  Profit, Laba Rugi Mitra, bagi hasil, bot. Angka di sana sengaja belum berubah.
- Anti-tujuan: biaya produk lain di akun Xendit (Reference `PR-…`) atau pembayaran yang
  tidak menjadi penjualan ikut membebani outlet; angka omzet kotor bergeser.

## Fakta tarif (dari file Okt & Nov, terverifikasi)
| Komponen | Tarif | Di file |
|---|---|---|
| Processing Fee (sejak 1 Okt 2026) | Rp 4.000 + PPN 11% = **Rp 4.440 per pembayaran sukses** | `PROCESSING_FEE_DEDUCTION` + `PROCESSING_FEE_VAT_DEDUCTION`, borongan harian, tanpa referensi transaksi |
| QRIS ≥ Rp 100.000 | 0,63% + PPN 11% | `QR_CODE_PAYMENT Fee` + `… VAT`, Reference = transaksinya |
| QRIS < Rp 100.000 | 0 (MDR 0% sejak 1 Okt) | — |
| Virtual Account | Rp 9.000 + PPN = Rp 9.990 | `VA_PAYMENT Fee` + `… VAT`, Reference = transaksinya |
| Sebelum 1 Okt | hanya MDR 0,63% + PPN, tanpa Processing Fee | |

Oktober cocok persis: 496.000 + 54.560 + 59.940 (VA) + 21.348 (QRIS) = **631.848**.

## Pendekatan
- **A (dipilih owner):** simpan biaya asli per pembayaran saat file diunggah; laporan
  memakai biaya asli, estimasi bertanda untuk sisanya.
- B: hitung dari aturan saja tanpa menyimpan — ditolak: selalu estimasi, perubahan tarif
  atau potongan janggal tak tertangkap.
- C: simpan tagihan harian lalu dibagi — ditolak: tarif sudah tetap per pembayaran,
  pembagian hanya menambah kerumitan.

## Desain
### 1. Data (migration bertanggal 2026-11-18, cek timestamp kembar)
Kolom baru di `public.xendit_pembayaran`:
- `biaya_mdr numeric` — jumlah baris FEE + VAT ber-Reference sama dengan pembayaran ini.
- `biaya_proses numeric` — Processing Fee + PPN pembayaran ini (4.440 bila tanggal bayar
  ≥ 2026-10-01 WIB, 0 sebelumnya).
- NULL = belum diketahui (baris dari webhook yang belum pernah ada di file).

RLS & grant tidak berubah (baca lewat `boleh_baca_xendit()`).

### 2. Unggah file (`lib/xendit/balanceHistory.ts`, `unggah.ts`, `dbSupabase.ts`)
- Parser ikut membaca baris `FEE`/`VAT` (DEBIT) dan menjumlahkannya per **Transaction ID**
  (baris FEE/VAT membawa Transaction ID pembayarannya; dicek di file Okt 60/60 & Nov 32/32
  cocok, Reference juga unik tapi Transaction ID = kolom unik `xendit_id`) → `biaya_mdr`.
- Pembayaran tanpa baris FEE: `biaya_mdr = 0` hanya bila menurut aturan memang tak kena
  MDR (QRIS < Rp 100.000 sejak 1 Okt); bila seharusnya kena tapi barisnya tak ada →
  NULL (laporan memakai estimasi). Di kedua file semua pembayaran yang seharusnya kena
  fee punya barisnya di file yang sama (Okt 20/20, Nov 16/16). *(Keputusan pembangun.)*
- Baris FEE/VAT yang pembayarannya tak ada di file itu tetapi sudah ada di database
  tetap ditempelkan ke baris database. *(Keputusan pembangun.)*
- `biaya_proses` diisi per pembayaran sukses menurut aturan tanggal di atas.
- **Pengecek:** jumlahkan `PROCESSING_FEE_DEDUCTION` di file, bandingkan dengan
  `Rp 4.000 × jumlah pembayaran sukses` (semua pembayaran, termasuk PR-) di rentang yang
  sama; kalau beda, ringkasan unggah menampilkan peringatan berisi kedua angka. Tidak
  memblokir unggah.
- Unggah ulang memperbarui kedua kolom (ikut jalur `perbarui`, kolom data file).

### 3. Laporan (`lib/posReport/biayaXendit.ts` baru, dipanggil `laporan.ts`)
Dihitung **di luar cache hari laporan** (sama seperti status Xendit di `xenditLoad.ts`),
karena data Xendit berubah setelah unggah dan bergantung hak baca pemanggil.

Untuk setiap pesanan website selesai di `analytics.completedOrders` (sudah tersaring
outlet/kanal/tanggal, `isPesananWebsite`):
- Ada pembayaran tertaut (`external_order_id`, bukan `bukan_penjualan`) dengan kedua
  kolom biaya terisi → biaya = Σ(`biaya_mdr` + `biaya_proses`) semua pembayarannya
  (bayar dobel = biaya dobel, memang ditagih).
- Selain itu → **estimasi** dari aturan tarif, memakai `total_amount`, tanggal pesanan,
  dan channel pembayaran bila diketahui (tak diketahui = dianggap QRIS).
- Pemanggil tanpa hak baca Xendit → semua estimasi.

Pembayaran dimuat menurut `external_order_id` pesanan website di laporan, bukan jendela
tanggal, agar pesanan lewat tengah malam tak kehilangan pembayarannya. Batas 1 Okt untuk
estimasi memakai tanggal pesanan. *(Keputusan pembangun.)*

Pembayaran Xendit yang tak tertaut ke pesanan selesai (hanya di Xendit / pesanan batal)
**tidak** dibebankan: omzetnya juga tidak ada di laporan.

Hasil ditambahkan ke analytics: `biayaXendit`, `biayaXenditEstimasi` (bagian estimasi),
`jumlahPesananEstimasi`. `totalAdminFee += biayaXendit`, lalu `netDisbursement` dan
`realGrossProfit` dihitung ulang dengan rumus yang sama seperti di `compute.ts`.
`compute.ts` tidak diubah.

### 4. Tampilan (`ReportsView.tsx`)
- Kartu Admin Fee mendapat baris **"Biaya Xendit: Rp …"** bila `biayaXendit > 0`, dengan
  keterangan "(sebagian estimasi, N pesanan)" bila ada estimasi. Berlaku setiap kali
  pesanan website ada dalam pilihan (termasuk "Semua sumber"), bukan hanya filter
  Website — biayanya nyata di mana pun pesanan itu dihitung. *(Keputusan pembangun.)*
- Bila sumber yang dipilih hanya Website, baris "Komisi Platform: Belum di-upload"
  disembunyikan (tak relevan untuk website).
- Tooltip `AdminFeeBreakdownTooltip` ikut menampilkan baris Biaya Xendit.
- Ekspor (Excel/PDF) tidak diubah pada tahap ini. *(Keputusan pembangun; catat sebagai
  lanjutan.)*

### 5. Paritas
`lib/posReport/biayaXendit.ts`, `laporan.ts`, `ReportsView.tsx`, tooltip — salin
byte-identik ke `apps/finance` & `apps/HR` dan daftarkan di
`rangkumanPenjualan.parity.test.ts` keduanya. Parser/unggah hanya ada di admin.

## Uji & selesai
- Unit: parser (FEE/VAT per Reference, Processing Fee per tanggal, peringatan selisih),
  `biayaXendit` (aktual, estimasi, dobel, bukan_penjualan, tanpa hak baca, sebelum 1 Okt).
- Migration diuji dalam transaksi + ROLLBACK dengan kontrol negatif.
- Selesai bila: setelah file Oktober diunggah ulang, kartu Admin Fee filter Website
  Oktober menampilkan Biaya Xendit ≈ Rp 631.848 (selisih hanya dari pembayaran yang
  tidak tertaut ke pesanan selesai, dijelaskan); test & type-check admin/finance/HR
  lulus; paritas lulus.

## Diserahkan ke pembangun
Nama kolom/fungsi, susunan teks kartu, bentuk peringatan unggah, uji kering untuk
memastikan total Oktober.
