# Data Validation Channel Penjualan — TikTok GO (Fase 1)

**Status:** Draft disetujui, siap ditulis jadi plan implementasi.
**Tanggal:** 2026-08-07
**App:** `apps/admin-dashboard` — tidak menyentuh app lain (pos-kasir, absensi, stok, distribusi, finance) maupun `packages/*`.

## Latar Belakang

Suka Shawarma perlu memvalidasi jumlah menu yang terjual di tiap channel food delivery (TikTok GO, ShopeeFood, GrabFood, GoFood) terhadap **penarikan dana**/laporan resmi dari platform, dibandingkan dengan apa yang sudah tercatat di sistem internal. Fitur `data-validate` yang sudah ada di admin-dashboard baru menangani TikTok GO secara kasar (whitelist hardcoded di dua tempat, 1 outlet per validasi, hasil tak disimpan, agregasi ditarik mentah ke JS lalu dijumlah di client — rawan salah karena batas 1.000 baris PostgREST).

Channel lain (ShopeeFood, GrabFood, GoFood) punya format file & struktur data yang berbeda-beda dan **belum dianalisis**. Untuk menjaga kualitas dan menghindari kesalahan yang sama terulang 4×, pekerjaan ini dipecah **per channel**. Spec ini mencakup **TikTok GO saja** sebagai vertical slice pertama, end-to-end (parsing → mapping → perbandingan → simpan → riwayat). Channel lain menyusul sebagai spec terpisah setelah file contohnya tersedia dan dianalisis dengan pola yang sama.

## Tujuan

1. Validasi **qty per menu** yang terjual (file export TikTok GO) vs yang tercatat di sistem (`orders`/`order_items`), untuk periode 1–31 Juli 2026, per outlet atau semua outlet sekaligus.
2. Omzet Kotor dihitung terpisah dari Promo — Promo dipecah jadi komponen-komponen yang bisa ditelusuri asalnya, bukan digabung jadi satu angka buram.
3. Hasil validasi **disimpan** (bukan sekali-pakai) sehingga bisa dibuka lagi kapan saja tanpa upload ulang file.
4. Pemetaan outlet & menu (nama di file vs nama di sistem) dikelola dari database + UI, bukan hardcode yang butuh redeploy tiap ada nama baru.

## Analisis Sumber Data (TikTok GO)

File contoh: `sample-reports/juli-2026/TIKTOKGO SS JULY.xlsx`, sheet `order detail`, 3.540 baris, 1–31 Juli 2026, 19 lokasi redemption.

### Kolom yang dipakai

| Kolom file | Kegunaan | Catatan |
|---|---|---|
| `Redemption time` | tanggal transaksi | Sudah `YYYY-MM-DD` bersih di file ini. **Header row perlu dideteksi dinamis** — pada varian file lain (dipakai `platformSettlement/tiktokgo.ts`), header ada di baris ke-4, bukan baris ke-1. |
| `Redemption location` | → outlet (via mapping) | 19 nilai berupa nama toko, bukan ID |
| `Item name` | → menu (via mapping) | 13 nilai unik pada file ini |
| `Item order ID` | penghitung qty | Unik per baris (3.540/3.540) → **1 baris = 1 qty**. Tidak ada kolom Quantity terpisah. |
| `Original price` | harga list (referensi) | |
| `Payment amount` | **Omzet Kotor** (keputusan final, lihat di bawah) | |
| `Platform incentive` | komponen promo | Subsidi dari TikTok |
| `Merchant incentive` | komponen promo | Ditanggung merchant |
| `Settlement amount` | dasar hitung Admin Platform fee | Terisi 3.469/3.540; 71 baris kosong (semua tanggal 31 Juli — belum cair saat export) |

Kolom yang **tidak dipakai** karena kosong 100% di seluruh file: `Price before tax`, `Total price`, `Estimated tax`, `Final tax`, `Refund amount`, `Breakdown`.

### Definisi angka (keputusan final, sudah dikonfirmasi berulang dengan data nyata)

```
Harga List (referensi)     Original price
Omzet Kotor                Payment amount          ← keputusan pemilik bisnis
Promo (3 komponen, dipisah, TANPA netto)
  ├ Diskon Deal             = Original price − Payment amount − Platform incentive − Merchant incentive
  ├ Platform Incentive      = Platform incentive (kolom langsung)
  └ Merchant Incentive      = Merchant incentive (kolom langsung)
Admin Platform (fee)       = (Payment amount + Platform incentive + Merchant incentive) − Settlement amount
```

**Kenapa Admin Platform BUKAN `Settlement − Payment` secara langsung:** diverifikasi pada data nyata, 19,5% baris (690/3.540) punya `Platform incentive > 0`. Rumus naif `Payment − Settlement` menghasilkan **416 baris fee negatif** (mustahil secara akuntansi) karena PI tidak dimasukkan ke basis. Rumus yang benar memasukkan PI+MI ke basis sebelum dikurangi Settlement — terverifikasi 0 baris negatif, dan total fee konsisten 8%/13% di 99% baris settled.

**Kenapa `Original price` bukan Omzet Kotor:** meskipun secara akuntansi lebih "murni" (sebelum semua promo), pemilik bisnis memutuskan Omzet Kotor = `Payment amount` (uang yang tercatat sebagai penjualan setelah semua promo diserap, sejalan dengan cara sistem mencatat `total_amount`). Analisis pembanding menunjukkan `total_amount` sistem lebih dekat ke `Payment+PI+MI` (gap 0,79%) dibanding ke `Payment` sendirian (gap 3,2%) — gap ini **bukan bug**, melainkan konsekuensi definisi yang dipilih, dan dicatat di sini supaya tidak disalahartikan sebagai kesalahan input saat tool dipakai.

### Sisi Sistem (Database)

- **Qty & Omzet Kotor sistem** = `SUM(order_items.quantity)`, `SUM(orders.total_amount)`, diagregasi **di sisi PostgreSQL** (RPC baru), bukan ditarik mentah ke JS. Pola lama (`data-validate/actions.ts` saat ini) menarik `orders`+`order_items` mentah lalu menjumlah di JavaScript — terbukti pada sesi analisis menghasilkan **angka yang meleset ~6%** karena batas 1.000 baris PostgREST pada relasi embedded. Tidak boleh diulang.
- **Channel TikTok GO tersebar di 2 nilai kolom**: `channel IN ('tiktokgo','tiktok')` ATAU `sales_source IN ('tiktokgo','tiktok')` (mayoritas order dari Pawoon punya `channel` kosong, hanya `sales_source='tiktok'` terisi). Pola resolusi ini sudah ada presedennya di `channel_gross_by_outlet()` (migration `20260729150000_platform_settlements.sql`) dan `resolveOrderSource()` (`src/lib/order-source.ts`) — RPC baru mengikuti pola yang sama, bukan menciptakan aturan baru.
- **`menu_item_name`** di `order_items` sering berimbuhan `|ID|xxx|NOTE|...` — dibersihkan dengan split pada karakter pertama `|`, sama seperti pola yang sudah dipakai `data-validate/actions.ts` yang lama.

## Keputusan Desain

### 1. Pemetaan Outlet — tabel DB + UI (bukan JSON hardcode)

Tabel baru **`platform_store_mapping`**: `platform, store_key (raw dari file), outlet_id`.

- Saat parsing, nama toko dicocokkan otomatis dulu via normalisasi (lowercase, buang prefix "Kebab", "SUKA Shawarma", "Kota Wisata", "MITRA"). Pada file contoh, 18/19 lokasi cocok otomatis dengan normalisasi ini.
- Yang gagal cocok **tidak dibuang diam-diam** — tampil di layar preview sebagai daftar "Belum dipetakan" lengkap dengan qty & omzetnya. Admin pilih outlet tujuan sekali dari dropdown, tersimpan ke tabel, upload berikutnya otomatis kena.
- Diseed awal dari `platform_store_map.json.tiktokgo` yang sudah ada (1 entri: Cibubur) supaya tidak mengulang kerja mapping yang sudah ada. **File JSON asal tidak diubah** — halaman `platform-settlement` tetap memakainya seperti sebelumnya, nol regresi terhadap fitur yang sudah jalan.

### 2. Pemetaan Menu — tabel DB + UI (pola sama)

Tabel baru **`channel_menu_mapping`**: `platform, source_item_name (raw dari file), canonical_menu_name (nama bersih yang dipakai untuk group-by di kedua sisi)`.

- Sama seperti outlet: nama tak dikenal tampil di preview sebagai "Belum dipetakan" (bukan dibuang), admin petakan sekali dari dropdown daftar menu sistem.
- Ini memperbaiki cacat `data-validate` yang lama, di mana whitelist hardcoded membuang menu baru (`PAKET JUARA`, 2 qty pada file contoh) tanpa jejak sama sekali.

### 3. Simpan hasil — tabel `channel_validation_runs` + `channel_validation_results`

- **`channel_validation_runs`**: 1 baris per proses upload — `platform, period_from, period_to, source_file_name, uploaded_by, uploaded_at, unmapped_stores (jsonb), unmapped_items (jsonb)`.
- **`channel_validation_results`**: grain **terkecil** — `(run_id, outlet_id, canonical_menu_name, tanggal)` — menyimpan `qty_file, qty_system, omzet_kotor_file, omzet_kotor_system, promo_diskon_deal, promo_platform_incentive, promo_merchant_incentive, admin_platform_fee`.
- UI ringkas (per outlet + per menu, dijumlah seluruh periode) dan UI drill-down (per tanggal untuk 1 menu) **sama-sama** membaca dari tabel hasil ini — tidak ada tabel agregat terpisah yang bisa divergen dari data mentahnya.
- Riwayat run bisa dibuka lagi kapan saja tanpa upload ulang file.

### 4. Alur & Tampilan

1. Admin buka `/dashboard/data-validate`, pilih channel = **TikTok GO** (satu-satunya yang aktif di fase ini), pilih outlet (1 spesifik atau "Semua Outlet"), upload file. Periode terkunci 1–31 Juli 2026 sesuai cakupan file (bukan date-picker bebas).
2. Parser baca file dengan deteksi header baris dinamis (scan baris awal, cari baris yang mengandung kolom `Item name` + `Redemption location`).
3. Resolusi mapping outlet & menu. Yang gagal tampil inline untuk dipetakan admin sebelum lanjut.
4. Hitung sisi file (qty, Omzet Kotor, 3 komponen promo, Admin Platform fee) per (outlet, menu, tanggal).
5. Tarik sisi sistem via RPC baru, grain yang sama.
6. Tampilkan tabel ringkas per menu (qty file vs qty sistem, dijumlah 1–31 Juli). Baris yang qty-nya sama tetap ciut. Baris yang beda punya tombol **▸ Lihat per tanggal** — expand menampilkan 31 baris tanggal untuk menu itu, menunjukkan tanggal persis yang bermasalah.
7. Admin klik **Simpan** → tersimpan ke `channel_validation_runs`/`channel_validation_results`.
8. Halaman riwayat menampilkan run-run sebelumnya, bisa dibuka ulang tanpa upload file lagi.

### 5. Arsitektur Kode

Modul baru, terpisah total dari `platform-settlement` yang sudah ada (nol perubahan pada modul itu):

```
apps/admin-dashboard/src/app/dashboard/data-validate/
├── parsers/tiktokgo.ts       ← parser khusus qty-level, deteksi header dinamis
├── mapping.ts (server actions) ← resolve outlet & menu, list "belum dipetakan"
├── compare.ts (server actions) ← agregasi (via RPC) & bandingkan file vs sistem
└── components/                  ← upload, preview, tabel hasil + drill-down, riwayat
```

Parser **tidak** memakai ulang `src/lib/platformSettlement/tiktokgo.ts` — itu untuk kebutuhan berbeda (uang level-hari, `HEADER_ROW=3` hardcoded untuk varian file lain) dan menyatukannya berisiko meregresikan fitur settlement yang sudah berjalan di produksi.

## Keterbatasan yang Diketahui (dicatat, bukan disembunyikan)

1. **Gap struktural ~3,2%** antara `Payment amount` (file) dan `total_amount` (sistem) adalah konsekuensi definisi Omzet Kotor yang dipilih, bukan indikasi data salah. Dicantumkan di UI sebagai catatan agar tidak disalahartikan tiap kali dipakai.
2. **71 baris (semua tanggal 31 Juli) belum punya `Settlement amount`** saat file diexport (belum cair) → Admin Platform fee untuk tanggal tersebut ditandai *belum bisa dihitung*, bukan ditampilkan sebagai 0.
3. **Harga berubah di tengah bulan** (mis. `Best Seller 2` dari Rp 47.000 → Rp 42.000 pada 3 Juli) tidak relevan untuk definisi Omzet Kotor final (`Payment amount`, dibaca langsung per baris), sehingga tidak menimbulkan error rekonstruksi — dicatat di sini karena sempat jadi pertimbangan saat opsi `strike_price` masih dipertimbangkan.
4. **Scope spec ini hanya TikTok GO.** ShopeeFood, GrabFood, GoFood punya format file yang sama sekali berbeda (level order bukan level item untuk sebagian besar export settlement-nya) dan memerlukan analisis file contoh masing-masing sebelum spec terpisah bisa ditulis.

## Isolasi (constraint keras dari pemilik proyek)

- Semua perubahan kode terbatas pada `apps/admin-dashboard`.
- `orders` dan `order_items` **read-only** — tidak ada write, tidak ada trigger baru, tidak ada perubahan skema pada tabel ini. Ini penting karena trigger BOM/ledger stok di `apps/pos-kasir` bereaksi terhadap perubahan pada tabel-tabel terkait order; fitur ini tidak boleh menyentuhnya sama sekali.
- Perubahan DB **aditif saja**: 3 tabel baru (`platform_store_mapping`, `channel_menu_mapping`, `channel_validation_runs` + `channel_validation_results`) dan 1 fungsi RPC baru. Tidak ada `ALTER` pada tabel yang sudah ada.
- `packages/*` (`@suka/auth`, `@suka/design-system`, `@suka/realtime`) — tidak disentuh.
- `apps/pos-kasir`, `apps/absensi`, `apps/stok`, `apps/distribusi`, `apps/finance` — tidak disentuh sama sekali.
- `src/lib/platformSettlement/*` dan halaman `platform-settlement` — tidak disentuh. `platform_store_map.json` yang sudah ada tidak diubah (tabel mapping baru berdiri sendiri, diseed dari situ tapi tidak menggantikannya).

## Next

Setelah spec ini disetujui pemilik proyek → tulis implementation plan (`superpowers:writing-plans`) mencakup: migration 3 tabel + RPC, parser + unit test, server actions mapping & compare, UI upload/preview/hasil/riwayat, dan verifikasi manual terhadap file contoh (`TIKTOKGO SS JULY.xlsx`) dengan angka yang sudah diverifikasi di sesi brainstorming ini sebagai baseline pembanding.
