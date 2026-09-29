# App Retail — Voucher Prabayar ("Paket Voucher")

**Tanggal:** 2026-09-29 · **Status:** desain disetujui owner (grilling 25 pertanyaan), belum ada kode
**Dasar:** Tahap 3 voucher diskon (`2026-09-25-app-retail-tahap3-voucher-design.md`), keputusan owner `2026-09-24-app-retail-admin-keputusan.md`
**Cakupan app:** `apps/retail-gateway`, `apps/admin-dashboard`, `mobile/customer-app`, DB (skema `retail`)

## 1. Tujuan

Pelanggan membeli voucher dengan **harga tetap** (mis. Rp 100.000) dan mendapat **jatah slot**
(mis. 2 makanan, 2 minuman, 1 snack), lalu menebusnya kemudian, sekaligus atau dicicil.
Isi dan aturan ditentukan admin pusat; pelanggan hanya memilih menu di dalam slot.

Ini **bukan** voucher diskon. Ia produk prabayar: uang masuk sebelum barang keluar.
Karena itu ia mendapat tabel dan alur sendiri, tidak menjadi "jenis ke-6" di `retail.vouchers`
(daftar `jenis` tertutup, dan `voucher_pemakaian.draft_id` UNIQUE = satu pemakaian per pesanan,
sedangkan voucher ini ditebus berkali-kali).

**Prinsip yang tidak boleh dilanggar:** yang dimiliki pelanggan adalah **jatah item**, bukan saldo
rupiah. Yang berkurang saat tebus adalah jumlah slot, bukan uang. Harga normal menu yang dipilih
tidak memengaruhi apa pun. Aplikasi tidak pernah menampilkan "sisa Rp xx", hanya "sisa 3 slot".

## 2. Keputusan (owner + grilling 2026-09-29)

| # | Keputusan |
|---|---|
| P1 | **Prabayar:** beli dulu (Xendit), tebus nanti. |
| P2 | **Model slot.** Tiap slot = kelompok pilihan menu + jumlah unit yang harus dipilih. Daftar pilihan berisi menu apa pun yang **tampil di aplikasi**. Pelanggan tidak bisa memilih di luar slot. |
| P3 | **Dua jendela waktu.** Jendela beli: tanggal mulai/akhir, opsional. Jendela tebus: mode `tanggal_tetap` atau `hari_sejak_beli` (N hari); bila keduanya terisi, **yang paling awal berlaku**. |
| P4 | **Hangus** setelah batas tebus, tanpa refund. Nilai slot yang hangus = **pendapatan pusat**. |
| P5 | **Saat dibeli**, uang masuk **pusat** (kewajiban voucher), bukan omzet outlet mana pun, untuk outlet pusat maupun mitra. |
| P6 | **Saat ditebus**, jadi omzet outlet penebus dengan **nilai slot**. Untuk outlet mitra, pusat menyetor nilainya lewat transfer bulanan (tanggal 10). Metode bayar "voucher" **tidak** masuk baris "Potongan". |
| P7 | **Nilai per slot ditetapkan admin**, tidak dipukul rata; total semua slot **harus = harga beli**. Aplikasi menyarankan nilai otomatis (proporsi harga normal menu di slot), admin boleh mengubah. |
| P8 | **Cicilan boleh:** tebus sekaligus atau bertahap sampai batas tebus. |
| P9 | Pesanan tebus memakai **menu asli** (resep, stok, HPP lewat jalur BOM biasa). Harga item = **nilai slot**. Penandaan lewat **satu kolom nullable baru di `order_items`** (`voucher_tebus_id` → `retail.voucher_tebus`), bukan menu duplikat. Diputuskan 2026-09-29 (revisi dari rancangan awal "tabel terpisah tanpa menyentuh `order_items`": duplikasi menu ditolak karena resep/HPP ganda, jumlah kombinasi menu × nilai, dan statistik terpecah). Kolom ini memungkinkan POS/struk dapur memberi label "VOUCHER" dan laporan memisahkan omzet voucher. |
| P10 | **Boleh campur** dengan belanja biasa dalam satu pesanan. Keranjang berisi hanya item voucher (total Rp 0) **melewati Xendit**. |
| P11 | Tebus **bebas di outlet mana pun** yang buka; cicilan boleh pindah outlet. |
| P12 | Menu habis/nonaktif di outlet terpilih **disembunyikan** dari pilihan slot. Bila semua pilihan sebuah slot habis: slot ditandai "belum tersedia di outlet ini, coba outlet lain"; voucher tidak berkurang. |
| P13 | **Setelah ada pembelian, struktur terkunci:** harga, jumlah slot, jumlah unit, nilai slot. Daftar menu boleh ditambah/dikurangi asal tiap slot minimal punya satu pilihan. Penjualan baru bisa dihentikan. Setiap perubahan tercatat di `app_retail_log`. |
| P14 | **Syarat beli hanya dua:** kuota total dan batas per pelanggan (keduanya opsional). Dihitung dari pembelian **lunas**. |
| P15 | **Pengingat** notifikasi H-3 dan H-1 sebelum hangus, hanya untuk voucher yang masih punya sisa slot (`retail.customer_notifications`, dijadwalkan pg_cron). |
| P16 | Pesanan tebus yang **dibatalkan mengembalikan slot** (memakai pengait pembatalan yang sama dengan `trg_catat_refund_pesanan`). **Tidak** memperpanjang batas tebus: bila sudah lewat batas, slot tetap hangus. Bagian yang dibayar Xendit (item tambahan) masuk antrean "Perlu dikembalikan" Tahap 1. |
| P17 | **Fee Xendit dibebankan ke outlet penebus**, proporsional: `fee_beli × nilai_slot ÷ harga_beli`, masuk baris "Potongan" outlet. Bagian hangus ditanggung pusat. Pembatalan tebus membalik fee. Angka fee = **nilai riil dari Xendit**; bila belum tersedia pakai 0,7% lalu koreksi. |
| P18 | Voucher **terikat ke akun pembeli** (`customer_id`). Tidak bisa dipindah/dihadiahkan. |
| P19 | **Tidak ada refund** pembelian sama sekali. Wajib tertulis di halaman beli dan S&K. |
| P20 | **Perpanjang batas tebus:** admin boleh memperpanjang satu voucher milik pelanggan, **sekali** per voucher, **alasan wajib**, tercatat di `app_retail_log`. Tidak mengubah nilai, slot, atau uang. |
| P21 | **Dua laporan uang:** (1) kewajiban voucher berjalan, (2) setoran ke mitra per bulan. |
| P22 | Layar pembuatan menampilkan **peringatan** (tidak memblokir) bila HPP menu terburuk di sebuah slot melebihi nilai slot; juga margin paket setelah fee. |
| P23 | **Peluncuran bertahap:** uji rahasia (voucher kecil, akun tim, outlet tes) → voucher pertama berkuota kecil (mis. 20) → kuota besar. APK dengan **versi minimum** yang mewajibkan update. |

### Default yang diusulkan (belum dikonfirmasi eksplisit — cek saat review)

| # | Default |
|---|---|
| D1 | Jumlah slot yang bisa ditebus dalam satu pesanan: **tanpa batas**, selama pesanan valid. |
| D2 | Pembayaran Xendit pembelian tidak selesai: voucher **tidak terbit**, tagihan kedaluwarsa seperti pesanan biasa. |
| D3 | Pembuat voucher: **admin dan owner** (`requireRole(['owner','admin'])`), sama dengan voucher diskon. |
| D4 | **Voucher diskon Tahap 3 tidak digabung** dengan tebus dalam satu pesanan (maks 1 voucher per pesanan tetap berlaku; bila ada tebus, kolom voucher diskon dinonaktifkan). Menggabungkan berarti menentukan apakah diskon berlaku pada item voucher, dan itu belum dibahas. |

## 3. Model data (migration baru, skema `retail`)

Semua tabel: `REVOKE ALL FROM anon, authenticated`, RLS aktif tanpa policy, hanya service role
(gateway dan server action admin). CHECK yang bergantung kolom nullable **wajib** `IS NOT NULL`
eksplisit (pelajaran Tahap 3).

### `retail.voucher_paket` (yang dijual)
`id`, `nama`, `deskripsi`, `harga` (> 0), `beli_mulai`/`beli_selesai` (timestamptz NULL),
`tebus_mode` (`tanggal_tetap` | `hari_sejak_beli`), `tebus_sampai` (timestamptz, wajib bila mode tanggal),
`tebus_hari` (int > 0, wajib bila mode hari), `kuota_total` NULL, `batas_per_pelanggan` NULL,
`is_active` (penjualan baru), `created_at/updated_at/created_by`.
Bila admin mengisi keduanya (tanggal dan N hari), disimpan dua kolom terisi dan **yang lebih awal menang**
saat dihitung; `tebus_mode` menandai mana yang utama untuk tampilan admin.

### `retail.voucher_paket_slot`
`id`, `paket_id`, `urut`, `nama` (mis. "Makanan utama"), `jumlah` (unit, ≥ 1), `nilai_per_unit` (> 0).
**Invarian:** `SUM(jumlah × nilai_per_unit)` per paket = `voucher_paket.harga`. Ditegakkan di server action
(dan constraint trigger deferred sebagai jaring pengaman).

### `retail.voucher_paket_slot_menu`
`slot_id`, `menu_item_id` → `menu_items` (ON DELETE RESTRICT). Satu slot minimal satu baris.

### `retail.voucher_milik` (kepemilikan pelanggan)
`id`, `paket_id`, `customer_id`, `dibeli_at`, `lunas_at` (NULL sampai webhook), `kedaluwarsa_at`
(dihitung saat lunas dari P3), `diperpanjang_at` NULL + `diperpanjang_alasan` (penanda perpanjangan sekali),
`xendit_ref`, `fee_riil` numeric NULL (isi dari data Xendit), `harga_dibayar`.

### `retail.voucher_milik_slot` (satu baris per **unit** — agar pengurangan atomik)
`id`, `milik_id`, `slot_id`, `nilai` (snapshot `nilai_per_unit` saat lunas), `fee_bagian`
(snapshot = fee ÷ harga × nilai), `status` (`tersedia` | `terpakai` | `hangus`), `tebus_item_id` NULL.
Dibuat saat lunas. Tebus = `UPDATE … SET status='terpakai' WHERE status='tersedia'` di dalam transaksi
yang sama dengan pembuatan pesanan (pesanan gagal ⇒ rollback ⇒ slot tidak terpotong).

### `retail.voucher_tebus` dan `retail.voucher_tebus_item`
`voucher_tebus`: `id`, `milik_id`, `order_id`/`draft_id`, `outlet_id`, `dibuat_at`, `status` (`aktif` | `dibatalkan`).
`voucher_tebus_item`: `tebus_id`, `milik_slot_id`, `menu_item_id`, `nilai`, `fee_dibebankan`, `order_item_id`
(satu baris per unit slot yang ditebus; sumber angka nilai dan fee untuk laporan).

### Perubahan tabel POS (satu-satunya, aditif)
`public.order_items.voucher_tebus_id uuid NULL` → `retail.voucher_tebus(id)` (`ON DELETE SET NULL`), diisi hanya
pada item yang dibayar voucher. Nullable tanpa default: baris dan kode lama tidak terpengaruh. Migration wajib
memeriksa dulu bahwa tidak ada trigger/view/RPC yang memakai `SELECT *` atau daftar kolom tetap dari
`order_items` yang akan rusak (lihat §7 risiko 1). Kolom ini bukan pengganti `voucher_tebus_item`; keduanya
dipertahankan (kolom untuk POS/laporan penjualan, tabel untuk nilai/fee/slot).

### Log
`app_retail_log.aksi` CHECK diperluas: `voucher_paket_buat`, `voucher_paket_ubah`, `voucher_paket_hentikan`,
`voucher_paket_slot_ubah`, `voucher_milik_perpanjang`. (Ikuti pola CHECK di `20260925100000`; cek
timestamp kembar dulu: `ls supabase/migrations | cut -c1-14 | sort | uniq -d`.)

## 4. Alur

**Beli.** Pelanggan membuka daftar paket yang dijual (jendela beli terbuka, `is_active`, kuota belum habis,
batas per pelanggan belum tercapai) → gateway membuat tagihan Xendit sebesar `harga` → webhook lunas
(idempoten, pola Tahap 3) membuat `voucher_milik` + baris `voucher_milik_slot`, menghitung `kedaluwarsa_at`.
Kuota dihitung dari `lunas_at IS NOT NULL`. Tagihan tak dibayar ⇒ tidak ada voucher (D2).

**Tebus.** Pelanggan memilih outlet (yang buka) → layar tebus menampilkan slot tersisa; tiap slot hanya
menampilkan menu yang tersedia di outlet itu (P12) → pelanggan memilih menu per unit slot yang ingin
ditebus sekarang (boleh sebagian, P8), boleh menambah belanja biasa (P10) → `checkout/validate` menghitung
ulang di server → `POST /orders`: dalam satu transaksi, tandai slot `terpakai`, buat pesanan (item voucher
berharga `nilai`), isi `voucher_tebus` + `voucher_tebus_item` (termasuk `fee_dibebankan`). Total Rp 0 ⇒ tanpa
tagihan Xendit, pesanan langsung masuk POS lewat jalur pembayaran normal.

**Batal tebus.** Pesanan berpindah ke `cancelled` ⇒ `voucher_tebus.status='dibatalkan'`, slot kembali `tersedia`
bila `now() <= kedaluwarsa_at`, selain itu `hangus`; fee dan nilai tebus itu tidak dihitung di laporan.

**Hangus & pengingat.** pg_cron harian (`0 19 * * *` = 02:00 WIB; ingat cron dalam UTC): tandai slot `tersedia`
pada voucher lewat `kedaluwarsa_at` menjadi `hangus`; kirim notifikasi H-3 dan H-1 untuk voucher yang masih
punya slot `tersedia`, sekali per hari-H (jangan kirim ganda).

**Perpanjang.** Admin membuka detail satu `voucher_milik` → isi tanggal baru + alasan → server action
(`requireRole`) menolak bila `diperpanjang_at` sudah terisi → update `kedaluwarsa_at`, catat log.

## 5. Gateway (`apps/retail-gateway`)

- `GET /api/v1/voucher-paket` — paket yang sedang dijual (tanpa cache, seperti banner).
- `POST /api/v1/voucher-paket/{id}/beli` — validasi jendela/kuota/batas, buat tagihan.
- `GET /api/v1/voucher-saya` — daftar `voucher_milik` pelanggan + slot tersisa + batas tebus.
- `checkout/validate` dan `POST /orders` menerima `tebus: { milik_id, pilihan: [{ milik_slot_id, menu_item_id }] }`.
  Semua penilaian nilai, ketersediaan menu, dan status slot **di server**; klien tidak pernah mengirim nilai.
- Gagal validasi ⇒ 409 `{ error: 'voucher_tidak_berlaku', pesan }` tanpa tagihan (pola Tahap 3).
- Webhook Xendit: tambah cabang untuk pembelian paket (lunas ⇒ terbitkan voucher), tetap idempoten.
- Versi minimum APK ditegakkan di `GET /api/v1/config` (mekanisme Tahap 1).

## 6. Admin (`apps/admin-dashboard`, grup App Retail)

Halaman **Voucher Prabayar**: daftar paket (terjual, sisa kuota, status), form buat/ubah paket
(slot, daftar menu dari menu tampil-di-aplikasi, nilai per slot dengan saran otomatis, kuota, jendela beli/tebus),
peringatan margin (P22), tombol hentikan penjualan, dan detail per `voucher_milik` dengan tombol perpanjang (P20).
Semua tulis lewat server action: `requireRole(['owner','admin'])` → service client → `app_retail_log`.
Setelah terkunci (P13) form menonaktifkan kolom struktur.

**Laporan uang (P21):**
1. *Kewajiban berjalan* — `SUM(nilai)` slot `tersedia` pada voucher belum kedaluwarsa, per paket.
2. *Setoran mitra per bulan* — per outlet mitra: `SUM(nilai)` item tebus aktif − `SUM(fee_dibebankan)`,
   berdasar tanggal tebus. Ini dasar transfer tanggal 10.
Laporan mitra yang sudah ada (`mitraPnl.ts`, `mitraRoi.ts`) harus memasukkan `fee_dibebankan` ke "Potongan"
dan tidak menganggap item voucher sebagai diskon.

## 7. Risiko & hal yang wajib diverifikasi sebelum menulis rencana

1. **Cara pesanan menyatakan "sebagian dibayar voucher".** `orders.total_amount` di Tahap 3 bernilai net.
   Untuk tebus, omzet penuh (nilai slot + item tambahan) harus tercatat tanpa menjadi `discount_amount`,
   sementara yang ditagih Xendit hanya item tambahan. Item voucher ditandai `order_items.voucher_tebus_id` (P9).
   Verifikasi sebelum migration: kolom/enum `payment_method`, struk POS/dapur (perlu label "VOUCHER"),
   pembacaan omzet di laporan, dan semua trigger/view/RPC/`SELECT *` yang menyentuh `order_items`
   (termasuk `trg_process_bom_stok` dan `trg_order_items_isi_menu_dari_nama`) agar kolom baru tidak merusaknya.
   Kolom ini juga harus dibaca oleh app POS (`apps/pos-kasir`) dan app native; itu menyentuh kode POS,
   jadi butuh redeploy `pos-kasir` dan pengujian cetak. Jangan menebak.
2. **Jalur Rp 0.** Xendit menolak invoice Rp 0; pesanan tetap harus masuk POS (`sales_source='app'`,
   `status` awal seperti pesanan berbayar) dan memicu pemotongan BOM normal.
3. **Atomik.** Slot hanya boleh terpotong bersama keberhasilan pembuatan pesanan (satu transaksi / RPC).
4. **Replay migration.** Fungsi yang juga didefinisikan migration bertimestamp 2030 akan tertimpa saat replay
   dari nol — sebelum membuat/menimpa fungsi, `grep -rn "<nama_fungsi>" supabase/migrations/`. Jangan pakai
   timestamp 2030 (CI menolak); cek timestamp kembar.
5. **Fee riil Xendit** — cek apa yang benar-benar dilaporkan webhook/API; bila tidak ada, 0,7% + koreksi.
6. **`PUSAT_OUTLET_ID` di POS = BNR** (catatan lama): jangan dipakai sebagai "pusat" untuk pembukuan voucher.
7. **Realtime tidak menyala di VIEW** bila layar admin memakai view ringkasan: subscribe ke tabel dasar.
8. **Outlet tes** dikecualikan dari laporan uang (`outlet_ids_terhitung()` / `type <> 'test'`), tapi tetap
   dipakai untuk uji rahasia (P23).

## 7b. Temuan penyelidikan kode (2026-09-29) yang mengubah rancangan

Dibaca dari kode, bukan DB live (kecuali disebut). Ini **mengoreksi** bagian lain di spec ini bila bertentangan.

1. **`total_amount` pesanan tebus harus = Σ`subtotal` penuh** (nilai slot + item tambahan). Semua laporan
   menghitung `Potongan = MAX(0, Σsubtotal − total_amount)`; kalau `total_amount` hanya bagian yang ditagih
   Xendit, nilai slot otomatis terbaca sebagai Potongan dan itu bertentangan dengan P6. Draft (`order_drafts.total_amount`)
   tetap = jumlah yang **ditagih**; keduanya sengaja berbeda untuk pesanan tebus. Webhook saat ini meneruskan
   `draft.total_amount` ke pesanan, jadi jalur tebus **tidak boleh** memakai `susunPayloadPos`/`atomic_insert_order` apa adanya.
2. **RPC baru, jangan menulis ulang `atomic_insert_order`.** Fungsi itu punya banyak salinan (2026 dan 2030) yang
   saling menimpa saat replay, dan memakai daftar kolom tetap. Buat RPC baru `retail.buat_pesanan_tebus(...)`
   yang menulis `orders` + `order_items` (termasuk `voucher_tebus_id`) dan menandai slot `terpakai`, atomik.
3. **Slot punya status keempat: `ditahan`.** Untuk tebus campur, pesanan POS baru dibuat di webhook lunas, tetapi slot
   harus terkunci sejak `POST /orders`. Alur: `tersedia → ditahan` (terikat `draft_id`) → `terpakai` saat webhook
   lunas; `ditahan → tersedia` bila draft `kadaluarsa`/`gagal` (cron `expire-drafts` dan webhook gagal).
   Tebus total Rp 0 tidak ada webhook: pesanan dibuat langsung di `POST /orders` dan slot langsung `terpakai`.
   Ini menggantikan "satu transaksi dengan pembuatan pesanan" untuk kasus campur.
4. **`payment_method`:** CHECK live `orders_payment_method_check` menolak `'voucher'` (definisinya tidak ada di repo,
   hanya di dokumen lama). Butuh DDL aditif yang dipagari `sales_source='app'`, **setelah** membaca `pg_get_constraintdef`
   live. Pesanan tebus campur tetap `'qris'` (yang ditagih memang QRIS); pesanan tebus murni Rp 0 memakai `'voucher'`.
   Struk pelanggan POS mencetak selain `'qris'` sebagai TUNAI → wajib diperbaiki agar `'voucher'` tidak tercetak tunai.
5. **`periksaKeranjang` menolak item yang harganya ≠ harga katalog** dan cap potongan 50% (`MAKS_POTONGAN_PERSEN`)
   berlaku di voucher diskon. Item tebus harus lewat jalur terpisah; cap 50% **tidak** berlaku untuk tebus (D4: tidak digabung).
6. **Fee Xendit riil tidak tersedia di kode/webhook.** Versi pertama memakai **0,7% dari harga beli** sebagai estimasi
   (`voucher_milik.fee_riil` nullable, tetap dikoreksi bila nanti ada data nyata). Verifikasi payload asli di dashboard Xendit.
7. **Pengingat H-3/H-1 hanya masuk inbox aplikasi** (`retail.customer_notifications`, tipe `reminder`). Gateway belum punya
   pengirim push FCM (hanya rute pendaftaran token). Push menjadi pekerjaan terpisah.
8. **Guard refund Rp 0:** `trg_catat_refund_pesanan` mencatat antrean refund dari `draft.total_amount` berstatus `dibayar`;
   draft tebus Rp 0 yang dibatalkan akan menghasilkan baris refund bernilai 0. Tambahkan guard `nominal > 0`.
9. **`retail.voucher_tebus.order_id`** wajib `ON DELETE CASCADE` (atau `SET NULL`), karena `hard_reset_outlet_data`
   menjalankan `DELETE FROM orders`.
10. **Kuota beli** (P14) harus dihitung di dalam RPC dengan penguncian (`pg_advisory_xact_lock` per paket), bukan
    hitung-lalu-tulis seperti `voucherDb.ts`, karena kuota kecil (~20) rentan balapan.
11. **Laporan mitra** (`mitraPnl.ts:258/448`, `mitraRoi.ts:354/380`, POS `reports/actions.ts`) menghitung Potongan dari
    Σsubtotal − total_amount; `fee_dibebankan` dari `voucher_tebus_item` harus ditambahkan ke Potongan di sana.
12. **Utang replay migration:** skema `retail` baru dibuat di `20300119000000` sehingga migration bertanggal 2026 yang
    merujuk `retail.*` sudah tidak bisa replay dari nol. Migration baru mengikuti pola yang sama; produksi aman.
13. **Perubahan kode POS tidak terhindarkan:** label "VOUCHER" di struk dapur/pelanggan (`buildReceiptItems`,
    `printReceipt.ts`, `bluetooth-printer.ts`), cetak metode bayar, dan `types/index.ts` → butuh redeploy `pos-kasir`.

## 8. Peluncuran (P23)

1. **Uji rahasia** — paket kecil (mis. Rp 1.000) untuk akun tim, ditebus di outlet tes. Uji ujung ke ujung:
   beli, tebus sebagian, tebus campur belanja biasa, pesanan Rp 0, batal tebus (slot kembali, fee dibalik),
   hangus, perpanjang, pengingat, dan tampilan menu habis per outlet.
2. **Kuota kecil** — paket sungguhan berkuota ~20; pantau kewajiban berjalan dan transfer mitra tanggal 10 pertama.
3. **Kuota besar** — setelah dua langkah di atas bersih.
APK: naikkan versi minimum bersamaan rilis layar beli/tebus, agar APK lama tidak bisa membeli voucher
yang tidak bisa mereka tebus.

## 9. Catatan keputusan yang dipertimbangkan dan ditolak

- **Menu duplikat khusus voucher** (ditolak 2026-09-29): resep/HPP ganda (preseden 12 menu "Voucher Pamulang 10%"),
  ledakan kombinasi menu × nilai slot, statistik penjualan terpecah, risiko salah tautan lewat nama, dan tetap
  butuh tabel slot serta cara menandai item tidak ditagih.
- **Tabel penanda terpisah tanpa kolom di `order_items`** (rancangan awal, digantikan P9): menghindari POS tetapi
  membuat laporan penjualan dan struk dapur tidak bisa membedakan item voucher tanpa join.

## 10. Di luar cakupan

Hadiah/pemindahan voucher · refund pembelian · penambahan slot oleh admin · syarat beli selain kuota dan
batas per pelanggan (mis. khusus pelanggan baru) · penggabungan dengan voucher diskon (D4) ·
rincian riwayat per pelanggan untuk CS · biaya Xendit untuk voucher diskon Tahap 3 (tugas terpisah).
