# Marketplace Sales sebagai "Outlet Virtual" — Rangkuman Penjualan (admin-dashboard)

**Status:** Draft — menunggu review user sebelum masuk ke plan implementasi.
**Tanggal:** 2026-08-05
**Scope:** `apps/admin-dashboard` (halaman Pusat Laporan → Rangkuman Penjualan), plus 1 migration DB aditif.

## 1. Latar Belakang & Tujuan

Saat ini Rangkuman Penjualan (`/dashboard/reports/pos`) hanya menampilkan penjualan dari 19 outlet fisik (POS Kasir + POS Pawoon + food apps yang terikat ke outlet tertentu). Bisnis juga berjualan lewat **marketplace nasional** — TikTok Shop, Shopee, Tokopedia — yang **tidak terikat ke outlet fisik manapun** (barang dikirim langsung dari gudang/kurir, bukan dari dapur outlet).

Tujuan: sediakan cara untuk melihat penjualan marketplace ini di halaman yang sama, difilter seperti cabang, dengan data yang **berdiri sendiri** (terpisah dari data outlet fisik) dan **kosong sampai di-import** dari file laporan Seller Center masing-masing platform.

## 2. Model Data

### 2.1 Outlet Virtual

Tambah 3 baris baru ke tabel `outlets` (skema existing, kolom `type` sudah `TEXT DEFAULT 'outlet'` tanpa CHECK constraint — aman ditambah nilai baru):

| Kolom | Nilai |
|---|---|
| `id` | UUID baru (bebas, tidak overlap dengan outlet fisik) |
| `slug` | `tiktok-shop`, `shopee`, `tokopedia` |
| `name` | "TikTok Shop", "Shopee", "Tokopedia" |
| `type` | `'marketplace'` |
| `lat` / `lng` | `0` (placeholder — kolom NOT NULL, tidak dipakai untuk marketplace) |
| `is_active` | `true` |

`type='marketplace'` adalah penanda yang membedakan 3 baris ini dari outlet fisik, dipakai untuk audit filter di app lain (lihat §5).

### 2.2 Order & Order Item

**Tidak ada tabel baru.** Order marketplace disimpan di tabel `orders`/`order_items` yang sama persis dengan order outlet fisik:

- `orders.outlet_id` → menunjuk ke salah satu dari 3 outlet virtual di atas.
- `orders.sales_source` → nilai baru: `'tiktok_shop'`, `'shopee'`, `'tokopedia'` (union type `SalesSource` di `apps/admin-dashboard/src/lib/types.ts` perlu diperluas; berbeda dari `'tiktok'` yang sudah dipakai untuk TikTok Go/food delivery).
- `orders.external_order_id` → ID pesanan dari platform (kolom sudah ada, dipakai juga oleh Pawoon import untuk deteksi duplikat).
- `order_items` → sama seperti order biasa: `menu_item_name`, `quantity`, `unit_price`, `subtotal`, opsional `menu_item_id` bila produk sudah di-mapping ke `menu_items`.

**Kenapa reuse skema ini masuk akal:** Rangkuman Penjualan 100% outlet-scoped (`selectedOutlet` → `.eq('outlet_id', ...)`). Begitu outlet virtual ada isinya, seluruh KPI (Gross Revenue, Total COGS, Admin Platform, Gross Profit), item breakdown, best seller, dan PDF export yang sudah ada **otomatis berfungsi** tanpa perubahan logic — cukup pilih "TikTok Shop" di dropdown cabang.

## 3. Alur Import

Halaman baru `/dashboard/marketplace-import`, mirror struktur `/dashboard/pawoon-import` (`apps/admin-dashboard/src/app/dashboard/pawoon-import/page.tsx`):

1. **Pilih platform** (TikTok Shop / Shopee / Tokopedia) → menentukan `outlet_id` tujuan dan parser mana yang dipakai.
2. **Upload file** (.xlsx/.csv) hasil download dari Seller Center masing-masing platform.
3. **Parser per-platform** — 3 fungsi parsing terpisah (format kolom tiap platform berbeda), masing-masing menormalisasi ke bentuk generik:
   ```
   { external_order_id, order_date, status, gross_amount, admin_fee, product_lines: [{name, qty, unit_price}] }
   ```
4. **Preview** — ringkasan (total omzet, jumlah pesanan, deteksi duplikat via `external_order_id` yang sudah pernah tersimpan) sebelum disimpan — sama seperti alur Pawoon.
5. **Mapping produk tak dikenal** — nama produk dari file yang belum match `menu_items` wajib di-mapping (pola sama seperti `unmappedItems` di Pawoon import) sebelum bisa sync:
   - Produk yang overlap dengan menu resep dapur → mapping ke `menu_items` existing → Total COGS ikut terhitung dari resep.
   - Produk khusus marketplace (merchandise, saus botolan retail, dll, tanpa resep) → dibuatkan `menu_items` baru tanpa `hpp_override` dan tanpa resep → HPP-nya otomatis 0, bukan error.
6. **Simpan** → insert ke `orders`/`order_items` dengan `outlet_id` = outlet virtual platform terkait.

### 3.1 Guard trigger BOM (wajib, bagian dari migration yang sama)

Insert ke `order_items` bisa memicu trigger `trg_process_bom_stok` (pemotongan stok otomatis via resep). Outlet virtual **tidak punya baris `stok_balance` sama sekali** — kalau produk yang di-mapping kebetulan terhubung ke resep berbahan baku, trigger ini akan mencoba memotong stok yang tidak eksis untuk outlet tsb.

**Fix:** tambah guard di awal fungsi trigger — skip proses BOM sepenuhnya bila `outlets.type = 'marketplace'` untuk outlet order tsb. Ini bagian dari migration §6, bukan langkah manual terpisah.

## 4. Tampilan di Rangkuman Penjualan

- **Dropdown "Semua Cabang"** (`BranchFilter.tsx`) — otomatis menampilkan TikTok Shop/Shopee/Tokopedia karena mengambil dari `useOutlets()` / `initialOutlets` tanpa filter apa pun. **Tidak ada perubahan kode di komponen ini.**
- **`resolveOrderSource` (`lib/order-source.ts`)** — tambah 3 entri channel baru (warna/label khas TikTok Shop, Shopee oranye, Tokopedia hijau) supaya badge sumber pesanan menampilkan label yang benar, bukan fallback generik "POS PAWOON".
- **Dropdown "Semua Channel"** — tetap ada, tidak diubah perilakunya. Saat outlet virtual dipilih, dropdown ini otomatis cuma berisi 1 opsi yang relevan (channel platform itu sendiri) karena `availableChannels` dihitung dari `orders` yang sedang termuat.
- **PDF export** ("PDF Semua Channel" dkk di `downloadPDFAllChannels`) — otomatis membuat kategori baru "TikTok Shop"/"Shopee"/"Tokopedia" di breakdown, karena sumbernya `resolveOrderSource` yang sama.
- **Kondisi data kosong** — sebelum ada import, memilih outlet virtual menampilkan KPI Rp0 dan tabel kosong (state yang sudah tertangani secara alami oleh halaman ini untuk outlet mana pun tanpa order).

## 5. Isolasi Lintas-App (wajib diaudit saat implementasi)

Tabel `outlets` dipakai bersama oleh semua app (`stok`, `absensi`, `distribusi`, `pos-kasir`, `admin-dashboard`). Tanpa penyaringan eksplisit, 3 outlet virtual ini bisa muncul di tempat yang tidak relevan secara operasional. Filter `type != 'marketplace'` (atau `type = 'outlet'`) perlu ditambahkan di:

- `apps/stok` — monitoring board (papan 19 outlet), dropdown outlet di permintaan bahan/opname/surat jalan
- `apps/absensi` — pemilihan outlet kiosk, halaman enrollment, manajemen kru
- `apps/distribusi` — daftar outlet tujuan pengiriman
- `apps/admin-dashboard` — halaman non-laporan yang pakai `useOutlets()`: manajemen outlet (`/dashboard/outlets`), assignment staff (`StaffForm`), monitoring, dll. **Kecuali** Rangkuman Penjualan (dan laporan penjualan lain yang nanti diputuskan relevan) yang justru HARUS menampilkannya.
- `apps/pos-kasir` — kemungkinan tidak terdampak (app ini beroperasi per-outlet fisik tunggal by design, jarang query daftar semua outlet), tetap perlu dicek sekali saat implementasi.

Audit ini dieksekusi sebagai task terpisah di plan implementasi — daftar di atas adalah titik awal, bukan daftar final; setiap query `.from('outlets')` di tiap app perlu ditelusuri satu per satu untuk memastikan konteks pemakaiannya (fisik vs laporan).

## 6. Migration

Satu migration baru, aditif:
1. Insert 3 baris `outlets` (TikTok Shop, Shopee, Tokopedia) dengan `type='marketplace'`.
2. `CREATE OR REPLACE FUNCTION` untuk `trg_process_bom_stok` (atau fungsi BOM terkait) — tambah guard skip bila outlet order bertipe `marketplace`. **Sebelum ubah fungsi ini, wajib `grep -rn` nama fungsinya di seluruh `supabase/migrations/`** — CLAUDE.md mencatat ada migration bertimestamp 2030 yang menimpa versi fungsi ini tanpa disadari sebelumnya; landing fix harus dengan timestamp yang lebih baru dari migration 2030 tsb agar tidak tertimpa balik.

## 7. Di Luar Scope (fase ini)

- Halaman `/dashboard/marketplace-import` dan 3 parser per-platform — didesain terstruktur di atas, tapi **implementasi parser (mapping kolom Excel spesifik tiap platform) menunggu sesi terpisah** setelah tim dapat contoh file laporan asli dari tiap Seller Center.
- Data marketplace tidak ikut ke halaman lain di Pusat Laporan (Selisih Stok, Bonus Crew, Kerugian Waste, Target Harian) — tidak relevan (tidak ada stok/crew/waste untuk marketplace).
- Redeploy `admin-dashboard` setelah migration/kode ini di-merge (mengikuti pola sesi-sesi sebelumnya di project ini).
