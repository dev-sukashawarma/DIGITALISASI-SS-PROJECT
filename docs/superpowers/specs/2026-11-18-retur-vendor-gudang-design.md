# Retur Bahan Baku ke Vendor dari Gudang Pusat — Rancangan

**Tanggal:** 2026-11-18 · **Status:** draf, menunggu persetujuan owner
**App:** `apps/finance` (menu Pembelian + Hub Approval) · **DB:** Supabase produksi bersama

---

## 1. Maksud & alasannya

Kadang bahan yang sudah diterima di Gudang Pusat ternyata kualitasnya tidak sesuai
harapan. Biasanya itu baru ketahuan beberapa hari kemudian, dari komplain outlet. Bisa
karena barangnya rusak, tapi bisa juga karena barangnya tidak rusak namun di bawah
standar (misalnya daging terlalu berlemak atau ayam kecil-kecil). Manajemen lalu
memutuskan **sisa barang di Gudang Pusat** dikembalikan ke vendor.

Saat ini sistem tidak punya jalur untuk itu:

- Tipe ledger `retur_ke_vendor` sudah ada di CHECK `ledger_stok`, tapi **0 baris** dan
  tidak ada fungsi maupun layar yang menulisnya.
- Tabel `retur_vendor` yang ada di `docs/DESIGN_RETUR_REFUND_BAHAN_BAKU.md` (bagian D)
  belum pernah dibuat.
- Satu-satunya cara saat ini adalah Entri Manual (penyesuaian per vendor). Cara itu
  mengurangi stok, tapi tidak terhubung ke PO dan tidak memengaruhi utang ke vendor.
  Penyelesaian dengan vendor dicatat di luar sistem.

**Hasil yang dianggap berhasil:** setiap retur tercatat dengan vendor, PO asal, bahan,
jumlah, alasan, dan buktinya. Stok Gudang Pusat dan saldo per vendor berkurang dengan
benar. Penyelesaian dari vendor (ganti barang, potong tagihan, atau uang kembali)
tercatat. Retur yang belum diselesaikan vendor tidak bisa terlupa.

## 2. Keputusan owner (18 Nov 2026)

1. **Hanya sisa di Gudang Pusat yang diretur.** Barang yang sudah dikirim ke outlet
   dibiarkan habis terpakai. Tidak ada penarikan dari outlet.
2. **Penyelesaian tergantung vendor**, jadi ketiga cara harus ada: ganti barang, potong
   tagihan, dan uang kembali.
3. **Persetujuan oleh manajemen/finance**, yaitu role `admin`, `owner`, `admin_finance`
   (ditambah `developer` untuk uji), dilakukan di Hub Approval app finance.
4. **Purchasing menjalankan returnya**: mengajukan, menyerahkan barang ke vendor, dan
   mencatat kesepakatan. Kitchen/gudang boleh mengajukan dan menerima barang pengganti.
   Finance mengurus sisi uang.
5. **Alasan retur bukan hanya cacat.** "Kualitas tidak sesuai harapan" adalah alasan
   yang sah dan sering terjadi.
6. **Pendekatan A**: dokumen Retur Vendor tersendiri + saldo kredit vendor (lihat §4).

## 3. Tujuan, bukan tujuan, anti-tujuan

**Tujuan**
- Dokumen Retur Vendor dengan alur: ajukan → setujui/tolak → serahkan ke vendor →
  penyelesaian → selesai.
- Stok Gudang Pusat dan `stok_vendor_gudang_mutasi` berkurang saat barang diserahkan.
- Tiga cara penyelesaian, dengan dampak uang yang tercatat.
- Saldo kredit per vendor yang bisa dipakai saat membayar PO berikutnya.
- Form terima PO: barang yang ditolak saat diterima **tidak ikut ditagih**, dan alasannya
  memakai daftar yang sama.
- Riwayat retur dan penolakan per vendor, sebagai bahan menilai vendor.

**Bukan tujuan (versi ini)**
- Menarik barang dari outlet (keputusan 1).
- Memperbaiki alur retur outlet → gudang (`retur_stok`). Ada temuan terpisah: tipe
  `terima_retur_outlet` 0 baris, jadi barang retur outlet tidak pernah masuk stok gudang.
  Ini dicatat sebagai pekerjaan lain.
- Mengubah HPP, laporan penjualan, atau ledger historis untuk barang yang sudah terpakai.
- Dokumen nota kredit formal dari vendor. Yang dicatat cukup nomor/foto bukti dari vendor.
- Mengubah harga master bahan karena retur.

**Anti-tujuan (gagal walau secara teknis jalan)**
- Retur bisa mengurangi stok tanpa persetujuan.
- Uang atau kredit tercatat dua kali. Contohnya: kredit sudah dipakai di satu PO tapi
  masih bisa dipakai lagi, atau ganti barang masuk stok sekaligus juga memotong tagihan.
- Barang pengganti dari vendor ikut menimpa harga master atau tertagih lagi.
- Alur terima PO, pengaman harga (PO uji coba, salah satuan, isi kemasan vendor), atau
  pembayaran vendor yang sudah ada jadi rusak.
- Penolakan saat terima tetap ikut ditagih (bug yang ada sekarang, lihat §6).

## 4. Pendekatan

| | A. Dokumen Retur Vendor + kredit vendor **(dipilih)** | B. Retur sebagai "PO minus" |
|---|---|---|
| Bentuk | Tabel baru `retur_vendor` + item, terhubung ke PO asal | Baris `purchase_order` bernilai negatif |
| Utang vendor | Penyelesaian "potong tagihan" menambah saldo kredit vendor yang dipakai saat bayar PO berikutnya | Otomatis berkurang lewat `po_payable_spv` |
| Risiko | Alur PO tidak disentuh, kecuali satu titik di pembayaran | Status PO, pengaman harga, laporan pembelian, dan utang harus belajar membedakan "PO minus" |
| PO asal sudah lunas | Kredit tetap tercatat dan dipakai nanti | Utang minus menggantung tanpa arti jelas |

Pendekatan ketiga, yaitu hanya Entri Manual + catatan, tidak dipertimbangkan karena
tidak memenuhi tujuan penyelesaian dengan vendor.

**Kenapa A:** retur hampir selalu terjadi setelah PO asalnya lunas, karena kualitas baru
ketahuan beberapa hari kemudian. Kredit vendor menangani kasus itu secara alami, dan
`verifikasi_terima_po` beserta tiga pengamannya tidak perlu diubah.

## 5. Rancangan

### 5.1 Peran

| Langkah | Role |
|---|---|
| Ajukan retur | `purchasing`, `kitchen`, `admin`, `owner`, `admin_finance`, `developer` |
| Setujui / tolak | `admin`, `owner`, `admin_finance`, `developer`. **Tidak boleh orang yang mengajukan** |
| Batalkan (sebelum diserahkan) | Pengaju, atau role penyetuju |
| Catat serah ke vendor | `purchasing`, `kitchen`, `admin`, `owner`, `developer` |
| Catat penyelesaian | `purchasing`, `admin`, `owner`, `admin_finance`, `developer` |
| Konfirmasi uang kembali (bukti transfer) | `admin_finance`, `admin`, `owner`, `developer` |
| Terima barang pengganti di gudang | `kitchen`, `purchasing`, `admin`, `owner`, `developer` |

Pengecekan role harus ada **di dalam RPC** (SECURITY DEFINER, `auth.uid()` +
`outlet_staff.status='active'`). Jangan memakai `is_finance()` atau `can_manage_po()`,
karena keduanya selalu true (lihat memory `penjaga-peran-palsu`). Pola yang dipakai sama
dengan `ajukan_bayar_po` / `setujui_bayar_po`.

### 5.2 Status dokumen

```
diajukan ──setujui──▶ disetujui ──serahkan──▶ diserahkan ──penyelesaian──▶ selesai
   │                      │
   ├─tolak──▶ ditolak     └─batal──▶ dibatalkan
   └─batal──▶ dibatalkan
```

- Stok **hanya** berubah saat `diserahkan`.
- `selesai` dicapai saat penyelesaiannya tuntas:
  - potong tagihan: langsung saat dicatat (kredit bertambah);
  - uang kembali: saat finance mengonfirmasi bukti transfer;
  - ganti barang: saat seluruh qty pengganti diterima di gudang.
- Dokumen di status `diserahkan` muncul di daftar "Menunggu penyelesaian vendor", diurutkan
  dari yang paling lama.

### 5.3 Isi dokumen

**Header `retur_vendor`:** nomor (`RV/YYYY/MM/NNN`, memakai penghitung atomik seperti
`nomor_urut_berikut`), `supplier_id`, status, alasan utama, catatan, URL bukti (foto
barang, tangkapan layar komplain), pengaju/penyetuju/penyerah beserta waktunya, alasan
tolak/batal, cara penyelesaian, catatan penyelesaian, dan URL bukti dari vendor.

**Item:** `bahan_baku_id`, `purchase_order_item_id` (PO asal), qty dalam **satuan besar**
bahan (sama dengan `qty_terima` PO), harga satuan = `harga_terima` PO asal (dibekukan saat
diajukan), subtotal, alasan per item, dan qty pengganti yang sudah diterima.

**Daftar alasan (dipakai bersama dengan penolakan saat terima PO):**
`rusak` · `kualitas_tidak_sesuai` · `salah_kirim` · `kadaluarsa` · `lainnya`
(untuk `lainnya`, catatan wajib diisi).

### 5.4 Validasi saat diajukan dan diserahkan

**Hanya barang yang masuk lewat PO yang bisa diretur** (keputusan owner 18 Nov). Setiap
item wajib punya `purchase_order_item_id`. Barang dari Beli Tunai, penyesuaian manual,
drop-ship, atau PO impor Excel Agustus (yang tidak punya baris ledger) tidak bisa diretur
lewat fitur ini.

- Semua item berasal dari PO milik vendor yang sama (`purchase_order.supplier_id`), dan PO
  itu berstatus `sebagian_diterima` atau `diterima_lengkap`.
- Qty item ≤ `qty_terima` PO asal dikurangi retur lain yang aktif (belum
  `ditolak`/`dibatalkan`) untuk item PO yang sama.
- Saat **diserahkan** (dicek ulang karena stok bisa bergerak sejak pengajuan):
  - qty dalam skala ledger ≤ saldo Gudang Pusat bahan itu;
  - untuk bahan multi-vendor: qty ≤ sisa vendor itu di `saldo_vendor_gudang`.
  - Kunci yang dipakai sama dengan `sj_vendor_on_dikirim`
    (`pg_advisory_xact_lock(hashtext('svgm:<bahan>:<vendor>'))`, urut).

### 5.5 Dampak saat diserahkan

Per item, dalam satu transaksi:
1. Baris `ledger_stok` di Gudang Pusat (`d23e11b3-23f1-4f9a-b428-cc73e1aa9b90`),
   tipe `retur_ke_vendor`, qty negatif `to_ledger_scale(...)`, dengan rujukan ke dokumen
   retur (kolom rujukan baru, mis. `ref_retur_vendor_id`).
2. Bila bahannya multi-vendor: baris `stok_vendor_gudang_mutasi` dengan sumber baru
   `retur_vendor` (CHECK `sumber` diperluas), qty negatif, `ref_ledger_id` = baris di atas.
3. Penjaga `trg_cek_penyesuaian_gudang_bervendor` saat ini hanya memeriksa
   `adjustment`/`transfer_keluar`, jadi tipe baru tidak akan ditolak. Tapi pastikan
   urutannya sama dengan RPC penyesuaian (mutasi ditulis dulu, lalu ledger) supaya tetap
   aman kalau penjaganya kelak diperluas.

`ledger_stamp_saldo` **mengecualikan** `retur_ke_vendor` dari larangan saldo minus
(`20260914160000`). Jadi satu-satunya penjaga terhadap minus adalah validasi saldo
di dalam RPC serah (§5.4), yang dijalankan di bawah kunci. Pengecualian itu tidak
diubah *(keputusan saya)*, karena tipe ini belum pernah dipakai dan RPC adalah satu-satunya
penulisnya. Uji wajib menyertakan kontrol "serah melebihi saldo → ditolak".

### 5.6 Penyelesaian

**Penyelesaian tidak penuh (keputusan owner 18 Nov: "tidak ada urusan lagi").** Kalau
vendor mengganti lebih sedikit, mengembalikan uang lebih kecil dari nilai retur, atau
tidak merespons, sisanya **tidak dikejar dan tidak diubah jadi kredit**. Penyelesaian
dicatat dengan jumlah yang benar-benar diterima, lalu purchasing atau finance menutup
dokumen dengan tombol "Tutup — sisa tidak dikompensasi" (alasan wajib). Status tetap
`selesai`, tapi dokumen menyimpan `nilai_tidak_dikompensasi` agar terlihat di ringkasan
kualitas vendor. Nilai ini **tidak** dicatat sebagai biaya di laporan laba, karena
barangnya sudah keluar dari persediaan saat diserahkan. Penutupan ini juga berlaku untuk
retur yang vendornya tidak merespons sama sekali.

Satu cara per dokumen *(keputusan saya)*. Kalau vendor mencampur, misalnya sebagian
diganti dan sebagian dipotong, pecah menjadi dua dokumen retur. Ini menjaga aturan
"selesai" tetap sederhana dan mencegah hitungan ganda.

**Potong tagihan**
- Saldo kredit vendor bertambah sebesar total retur. Disimpan sebagai **buku kredit**
  `vendor_kredit` (baris bertanda: `+` dari retur, `−` saat dipakai), **per vendor
  induk** (keputusan owner 18 Nov), memakai pengelompokan yang sama dengan saldo stok per
  vendor (`vendor_induk`). Contohnya, kredit dari PO Pak Aziz Tempo 15 boleh dipakai untuk
  PO Tempo 30. Setiap baris tetap menyimpan `supplier_id` dan PO asalnya untuk jejak.
  Saldo = SUM. Jangan disimpan sebagai satu angka yang di-UPDATE.
- **Pemakaian:** saat `ajukan_bayar_po`, purchasing boleh memilih "pakai kredit vendor"
  hingga min(saldo kredit, total PO). Transaksi kas yang dibuat = total − kredit.
  - Kalau kredit menutup seluruh total, PO dilunasi tanpa transaksi kas lewat jalur
    `lunas_tanpa_kas_*` yang sudah ada, dengan alasan "dibayar dengan kredit retur RV/…".
  - Baris kredit `−` dibuat saat **disetujui** (`setujui_bayar_po`), bukan saat diajukan.
    Saat diajukan, kreditnya dicadangkan. Kalau pembayaran ditolak (`tolak_bayar_po`),
    cadangannya lepas.
- **Persetujuan tetap wajib, termasuk saat seluruh tagihan ditutup kredit** *(keputusan
  saya)*. Purchasing mengajukan, finance menyetujui di Hub Approval, sama seperti
  pembayaran biasa. Untuk pembayaran yang seluruhnya kredit tidak ada transaksi kas
  `pending_approval`, jadi butuh "pegangan" persetujuan lain, misalnya status pengajuan di
  PO atau baris kredit `dicadangkan`. Bentuknya diserahkan ke pembangun, asalkan
  `setujui_bayar_po`/`tolak_bayar_po` (atau versi barunya) tetap jadi satu-satunya pintu
  dan `sync_supplier_payment` tidak menandai PO `paid` sebelum disetujui. Pada kredit
  sebagian, transaksi kas = total − kredit, dan PO dianggap lunas bila kas + kredit = total.
- `po_payable_spv` dan layar Pembayaran Vendor menampilkan "dibayar kas" dan "dibayar
  kredit" terpisah. `trg_po_jaga_kolom_bayar` tetap menjadi satu-satunya penjaga kolom
  bayar PO, jadi semua perubahannya lewat RPC bayar yang diperluas.

**Uang kembali**
- Purchasing mencatat "vendor akan transfer Rp X". Finance mengonfirmasi dengan memilih
  rekening pusat tujuan (default Rekening Bahan Baku Bank) dan bukti transfer wajib.
- `cash_transaction` masuk (`direction='in'`), `source_type` baru `retur_vendor`, terkait
  dokumen. Jumlah yang dikonfirmasi boleh berbeda dari total retur. Selisihnya dicatat di
  catatan, tidak dipaksakan sama.
- Bukan pendapatan. Laporan laba tidak membacanya (sama seperti `top_up`).

**Ganti barang**
- Kitchen menerima barang pengganti dari halaman dokumen retur (bukan lewat PO baru):
  qty pengganti per item, bisa bertahap.
- Ledger Gudang Pusat bertambah, tipe `pembelian_supplier`, **tanpa `ref_po_id`** dan
  dengan rujukan retur. Dengan begitu `cek_isi_kemasan_vendor` (yang hanya aktif bila ada
  `ref_po_id`) dan penulisan harga master/katalog tidak ikut terpicu. Untuk bahan
  multi-vendor ditambah mutasi vendor `retur_vendor` `+`.
- Tidak ada tagihan baru dan tidak ada perubahan harga.

### 5.7 Penolakan saat terima PO (perbaikan bug)

**Kondisi sekarang:** `VerifikasiTerimaModal` (finance) punya pilihan Kondisi
`baik/rusak` per baris. Kalau `rusak`, `verifikasi_terima_po` tidak menulis ledger, tapi
`qty_terima` tetap diisi, dan `subtotal = qty_terima × harga`. Akibatnya barang yang
ditolak **tetap ditagih**. Dari 274 baris, semuanya `baik`/null, jadi belum ada kerugian.

**Perubahan:**
- Kolom baru `purchase_order_item.qty_ditolak` + `alasan_tolak` (daftar §5.3).
- Form terima: per baris ada "jumlah datang", "jumlah ditolak", dan alasan. Barang yang
  masuk stok = datang − ditolak.
- `qty_terima` hanya menghitung barang yang diterima baik, sehingga subtotal dan tagihan
  otomatis benar. Pilihan `kondisi='rusak'` untuk seluruh baris diganti dengan
  qty_ditolak (kolom `kondisi` dipertahankan supaya data lama terbaca).
- **Status PO** *(keputusan saya)*: barang yang ditolak dianggap tuntas, tidak menunggu
  dikirim ulang. Aturan "lengkap" menjadi `qty_terima + qty_ditolak >= qty_pesan`. Kalau
  vendor mengirim ulang, buat PO baru. Dengan begitu PO tidak tertahan di
  `sebagian_diterima` dan tetap bisa dibayar sebesar barang yang diterima baik.
- Ketiga pengaman di `verifikasi_terima_po` **wajib bertahan** (PO uji coba, salah
  satuan, isi kemasan vendor). Ubah fungsinya secara terarah, jangan ditulis ulang dari
  nol. Periksa juga apakah ada migration bertimestamp 2030 yang mendefinisikan ulang
  fungsi ini.

### 5.8 Layar (app finance)

- **Pembelian › Retur Vendor**: daftar dengan tab Diajukan / Menunggu penyelesaian /
  Selesai / Semua, filter vendor, dan tombol "Ajukan retur".
- **Form ajukan**: pilih vendor → pilih item dari PO vendor itu yang sudah diterima
  (tampilkan tanggal terima, qty diterima, sisa yang bisa diretur, saldo gudang/vendor
  sekarang), qty, alasan, bukti.
- **Detail retur**: riwayat status, tombol sesuai status dan role (serahkan, catat
  penyelesaian, konfirmasi uang masuk, terima pengganti).
- **Hub Approval**: jenis baru `retur_vendor` (setujui/tolak, alasan tolak wajib), dicatat
  di `approval_log`.
- **Pembayaran Vendor**: saldo kredit vendor tampil, opsi "pakai kredit" saat mengajukan.
- **Ringkasan kualitas vendor** (tab sederhana di Retur Vendor): per vendor, jumlah dan
  nilai retur + penolakan saat terima, per alasan, per periode.
- Detail PO menampilkan retur yang terkait dengan PO itu.

## 6. Batasan

- Mengikuti pola keamanan yang ada: tabel baru dengan `REVOKE ALL FROM anon,
  authenticated`, baca lewat RLS terbatas (`kas_pencatat_ok()`, purchasing, kitchen,
  developer), dan semua tulis lewat RPC.
- Timestamp migration hari ini atau besok (lint menolak >2 hari ke depan). Cek bentrok
  timestamp sebelum menulis.
- DB bersama: verifikasi perilaku di DB live dengan transaksi + ROLLBACK, lengkap dengan
  kontrol negatif (pola `supabase/verifikasi/...`).
- Skala qty: dokumen memakai satuan besar dan dikonversi lewat `to_ledger_scale` saat
  menulis ledger. Jangan membandingkan angka ledger mentah tanpa konversi (memory
  `migrasi-skala-satuan-stok-belum-selesai`).
- Push ke `main` men-deploy `finance` otomatis.

## 7. Diserahkan ke pembangun

- Nama kolom dan tabel persis, serta letak kolom rujukan retur di `ledger_stok` dan
  `cash_transaction`.
- Cara pencadangan kredit saat pengajuan bayar (kolom di PO atau baris kredit berstatus
  `dicadangkan`), selama aturan §5.6 terpenuhi.
- Bentuk ringkasan kualitas vendor.
- Bagaimana detail retur ditampilkan di app stok (kalau perlu). Versi ini cukup di finance.
