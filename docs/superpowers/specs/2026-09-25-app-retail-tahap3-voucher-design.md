# App Retail Tahap 3 — Voucher Aplikasi

**Tanggal:** 2026-09-25 · **Status:** desain disetujui owner, belum ada kode
**Dasar:** keputusan owner #9–#14 di `2026-09-24-app-retail-admin-keputusan.md`
**Cakupan app:** `apps/retail-gateway`, `apps/admin-dashboard`, `mobile/customer-app`, DB (skema `retail`)

## 1. Tujuan

Admin pusat (OWNER/ADMIN) bisa membuat voucher bervariasi untuk aplikasi pelanggan, lalu
pelanggan memakainya saat checkout. Voucher ini menggantikan `DISKON_PILOT_PERSEN = 0` yang
ditanam di `checkout/validate/route.ts` dan `orders/route.ts`.

## 2. Keputusan (owner + grilling 2026-09-25)

| # | Keputusan |
|---|---|
| V1 | 5 jenis: `persen` (+ maks potongan) · `nominal` · `gratis_item` · `beli_x_gratis_y` · `harga_spesial` |
| V2 | 8 syarat, semua opsional: periode, kuota total, batas per pelanggan, min. belanja, khusus pesanan pertama, outlet tertentu, hari/jam (WIB), menu/kategori tertentu |
| V3 | Voucher **publik** (tampil di daftar) dan **rahasia** (kode). Maks 1 voucher per pesanan |
| V4 | Item gratis **otomatis ditambahkan server** ke pesanan (grilling: A) |
| V5 | Kuota & batas per pelanggan dihitung **saat lunas**. Pesanan yang sudah lunas **selalu dihormati** walau kuota jadi lewat (grilling: A) |
| V6 | Pelanggan **memilih sendiri** voucher di checkout. Voucher yang belum memenuhi syarat tampil redup beserta alasannya. Ada kolom kode (grilling: A) |
| V7 | Daftar voucher publik ada di **halaman sendiri** di aplikasi (keputusan owner 2026-09-24) |
| V8 | Potongan masuk baris **"Potongan"** outlet, termasuk outlet mitra (#13). Otomatis terjadi karena `total_amount` net |
| V9 | Biaya Xendit ke "Potongan" (#14) **dipisah jadi tugas tersendiri**, di luar spec ini (grilling: A) |
| V10 | Tabel voucher **tersendiri**, tidak menumpang `promos` POS (auto-price per menu, tanpa identitas pelanggan, dan bug kuota P7) |

## 3. Model data (migration baru, skema `retail`)

### `retail.vouchers`
| Kolom | Arti |
|---|---|
| `id` uuid PK | |
| `nama` text NOT NULL | judul yang dilihat pelanggan |
| `deskripsi` text | opsional |
| `kode` text UNIQUE (case-insensitive, disimpan huruf besar) | NULL = publik, terisi = rahasia |
| `jenis` text CHECK (5 nilai V1) | |
| `nilai` numeric | persen (0–100) atau Rp, sesuai jenis |
| `maks_potongan` numeric | khusus `persen` |
| `menu_item_id` uuid → `menu_items` | item gratis (`gratis_item`), menu Y (`beli_x_gratis_y`), menu berharga spesial (`harga_spesial`) |
| `beli_qty`, `gratis_qty` int | khusus `beli_x_gratis_y` (menu X = `menu_ids`) |
| `harga_spesial` numeric | khusus `harga_spesial` |
| `mulai`, `selesai` timestamptz | |
| `kuota_total` int | |
| `batas_per_pelanggan` int | |
| `min_belanja` numeric | dari subtotal seluruh keranjang |
| `khusus_pesanan_pertama` boolean default false | |
| `outlet_ids` uuid[] | NULL/kosong = semua outlet |
| `hari` smallint[] (1=Senin…7=Minggu), `jam_mulai`, `jam_selesai` time | WIB |
| `menu_ids` uuid[], `kategori_ids` uuid[] | |
| `is_active` boolean default true | |
| `created_at`, `updated_at`, `created_by` | |

CHECK per jenis wajib ada, supaya satu jenis tidak bisa berisi nilai yang tidak lengkap. Contoh:
`persen` → `nilai` di (0,100]; `gratis_item` → `menu_item_id` NOT NULL; `beli_x_gratis_y` →
`beli_qty ≥ 1`, `gratis_qty ≥ 1`, dan salah satu dari `menu_item_id`/`menu_ids`.

### `retail.voucher_pemakaian`
| Kolom | Arti |
|---|---|
| `id` uuid PK | |
| `voucher_id` → `retail.vouchers` ON DELETE RESTRICT | |
| `draft_id` → `retail.order_drafts` UNIQUE | 1 voucher per pesanan |
| `customer_id` → `retail.customers` | |
| `potongan` numeric NOT NULL | termasuk nilai item gratis |
| `dibuat_at` timestamptz default now() | |
| `lunas_at` timestamptz | diisi webhook Xendit |

Kuota & batas per pelanggan = `COUNT(*) WHERE lunas_at IS NOT NULL`. Draft yang kedaluwarsa
atau gagal tidak pernah memakan kuota.

### Akses
`REVOKE ALL FROM anon, authenticated` di kedua tabel (pola Tahap 1). Gateway dan admin
memakai service role. Voucher yang pernah punya pemakaian **tidak bisa dihapus** (FK
RESTRICT), hanya bisa dinonaktifkan.

## 4. Logika hitung — `apps/retail-gateway/src/lib/voucher.ts` (fungsi murni)

```ts
terapkanVoucher(voucher, keranjang, konteks): HasilVoucher
// konteks: { outletId, sekarang (Date), jumlahLunasTotal, jumlahLunasPelanggan,
//            pelangganSudahPernahBayar, menuHarga (Map id→harga aplikasi) }
// HasilVoucher: { berlaku: true, potongan, itemGratis: ItemPesanan[] }
//             | { berlaku: false, alasan: string }
kalimatSyarat(voucher): string   // dipakai gateway DAN admin (salinan identik, pola jamBuka.ts)
```

Aturan:
- Urutan cek syarat: aktif → periode → outlet → hari/jam WIB → pesanan pertama → batas per
  pelanggan → kuota → min. belanja → menu/kategori. Alasan pertama yang gagal dikembalikan.
- `persen`/`nominal` dengan `menu_ids`/`kategori_ids` → potongan dihitung dari **item yang
  cocok saja**. `min_belanja` tetap dari subtotal seluruh keranjang.
- `gratis_item` → server menambahkan `gratis_qty` (default 1) item `menu_item_id`
  **dengan harga normal**, dan nilainya masuk potongan.
- `beli_x_gratis_y` → untuk tiap kelipatan `beli_qty` item X di keranjang, `gratis_qty`
  item Y ditambahkan (Y = `menu_item_id`, atau menu X yang sama bila kosong), dengan
  harga normal, dan nilainya masuk potongan.
- `harga_spesial` → potongan = (harga normal − `harga_spesial`) × qty menu itu, dan tidak
  boleh negatif.
- **Pengaman:** potongan ≤ subtotal (termasuk item gratis) dan ≤ `MAKS_POTONGAN_PERSEN`
  (50%). Kalau melebihi, potongan dijepit ke batas itu, bukan ditolak.
- Menu gratis yang sedang habis di outlet itu (`menuHabisOutlet`) → voucher tidak berlaku,
  dengan alasan "Menu gratis sedang habis".

**Kenapa item gratis bernilai normal, bukan Rp 0:** `mitraPnl.ts` menghitung
Potongan = nilai item − `total_amount`. Kalau item gratis dicatat Rp 0, nilainya hilang dari
baris Potongan (laba tetap sama, tapi Potongan tampak lebih kecil dari kenyataan).

## 5. API gateway

| Endpoint | Perubahan |
|---|---|
| `POST /api/v1/vouchers` (baru, wajib login) | Body opsional `{ outlet_id, items }`. Hasilnya daftar voucher publik aktif dan belum berakhir, masing-masing `{ id, nama, deskripsi, jenis, kalimat_syarat, selesai, status: 'berlaku'|'belum', alasan? }`. Tanpa keranjang, hanya syarat non-keranjang yang dicek |
| `POST /api/v1/checkout/validate` | Field opsional `voucher_id` atau `kode_voucher`. Respons ditambah `voucher: { id, nama, status, alasan?, potongan, item_gratis[] }` |
| `POST /api/v1/orders` | Field sama. Voucher dihitung ulang di server. Tidak berlaku → **409** `{ kode: 'voucher_tidak_berlaku', alasan }`, tidak ada tagihan yang terbit. Berlaku → draft (items + item gratis, `discount_amount`) + baris `voucher_pemakaian` dalam satu alur |
| Webhook Xendit lunas | `UPDATE voucher_pemakaian SET lunas_at = now() WHERE draft_id = … AND lunas_at IS NULL`, tanpa cek ulang kuota (V5) |

- Item gratis diteruskan ke POS lewat `susunPayloadPos` dengan catatan `Gratis voucher`
  (konvensi `nama|NOTE|catatan`, tercetak di struk dapur). `discount_amount` ikut ke
  `orders.discount_amount`. Trigger BOM memotong stok berdasarkan qty seperti biasa.
- Galat DB saat cek voucher → voucher ditolak ("Voucher tidak dapat dicek, coba lagi").
  Pesanan tanpa voucher tetap bisa diproses.
- `DISKON_PILOT_PERSEN` dihapus dari kedua route.
- Klien lama (tanpa field voucher) → perilaku tidak berubah.

## 6. Admin-dashboard — "Voucher Aplikasi" (grup App Retail, OWNER + ADMIN)

- **Daftar:** nama · jenis · publik/kode · status turunan (Aktif / Terjadwal / Berakhir /
  Nonaktif / Kuota habis) · terpakai `n / kuota` (boleh lewat, V5) · total potongan Rp.
- **Form tambah/edit:** bagian "Jenis & nilai" (isian berganti sesuai jenis) dan bagian
  "Syarat" (8 syarat opsional). Di bawahnya pratinjau `kalimatSyarat()`.
- Aktifkan/Nonaktifkan. Hapus hanya bila belum pernah dipakai.
- Semua tulis lewat server action: `requireRole(['owner','admin'])` → service client →
  `app_retail_log`.
- `kalimatSyarat` = salinan identik gateway di `src/lib/appRetail/voucher.ts` (pola
  `jamBuka.ts`), ber-test.

## 7. APK (`mobile/customer-app`, versi 1.2 / versionCode 3)

- **Halaman Voucher** (dari Beranda dan Profil): kartu voucher publik dengan tombol **Pakai**.
  Kalau ditekan, voucher dipasang di keranjang, lalu pelanggan dibawa ke Menu.
- **Checkout:** baris "Pakai voucher" membuka pemilih (voucher berlaku di atas, yang belum
  redup dengan alasan, plus kolom "Punya kode?").
- Rincian harga menampilkan "Potongan voucher −Rp X". Item gratis tampil berlabel
  "Gratis" dan tidak bisa dihapus atau diubah qty-nya oleh pelanggan.
- Kalau keranjang berubah sehingga voucher tidak berlaku lagi, voucher **tetap terpasang
  dan ditandai** beserta alasannya, dan tombol Bayar dikunci sampai voucher dilepas atau
  syaratnya dipenuhi.
- Respons 409 `voucher_tidak_berlaku` dari `POST /orders` → tampilkan alasannya dan minta
  pelanggan melepas voucher.
- Versi minimum di Pengaturan Aplikasi **tidak dinaikkan**.

## 8. Pengujian

- **Gateway (vitest):** `terapkanVoucher` untuk tiap jenis × tiap syarat, termasuk jepit
  50%, potongan per kategori, jam WIB di sekitar tengah malam, menu gratis habis, dan
  kelipatan beli X gratis Y. Route: 409 di `POST /orders`, dan webhook mengisi `lunas_at`
  sekali saja (idempoten).
- **DB (`supabase/verifikasi/voucher/`):** transaksi + `ROLLBACK`. CHECK per jenis menolak
  isian tidak lengkap, `anon`/`authenticated` ditolak, dan hapus voucher yang punya
  pemakaian ditolak. Setiap asersi punya kontrol negatif.
- **Admin:** test `kalimatSyarat` (identik dengan gateway) dan status turunan.
- **APK:** unit test status/rincian voucher, lalu uji langsung di HP.
- **Ujung ke ujung (outlet tes):** buat voucher → pakai → bayar nominal kecil → cek
  `orders.discount_amount`, `order_items` item gratis, dan `voucher_pemakaian.lunas_at` →
  matikan lagi outlet tes.

## 9. Di luar cakupan

- Biaya Xendit ke "Potongan" (V9, tugas terpisah; wajib membuktikan angka Agustus yang
  sudah closing tidak bergeser).
- Broadcast promo voucher (Tahap 4).
- Refund otomatis Xendit.
- Kurasi Menu Terlaris dan halaman Pelanggan (Tahap 2).

## 10. Deploy

Migration (apply + verifikasi ke katalog + stempel) → redeploy `retail-gateway` →
redeploy `admin-dashboard` → rilis APK 1.2. Urutan ini aman karena APK lama tidak
mengirim field voucher.
