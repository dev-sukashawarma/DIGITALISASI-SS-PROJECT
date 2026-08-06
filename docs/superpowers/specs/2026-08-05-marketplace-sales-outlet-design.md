# Marketplace Sales sebagai "Outlet Virtual" — Rangkuman Penjualan (admin-dashboard)

**Status:** Draft — menunggu review user sebelum masuk ke plan implementasi.
**Tanggal:** 2026-08-05
**Scope:** `apps/admin-dashboard` (halaman Pusat Laporan → Rangkuman Penjualan), plus 1 migration DB aditif.

## 1. Latar Belakang & Tujuan

Saat ini Rangkuman Penjualan (`/dashboard/reports/pos`) hanya menampilkan penjualan dari 19 outlet fisik (POS Kasir + POS Pawoon + food apps yang terikat ke outlet tertentu). Bisnis juga berjualan lewat **marketplace nasional** — TikTok Shop dan Shopee (Tokopedia belum diaktifkan, lihat §7) — yang **tidak terikat ke outlet fisik manapun** (barang dikirim langsung dari gudang/kurir, bukan dari dapur outlet).

Tujuan: sediakan cara untuk melihat penjualan marketplace ini di halaman yang sama, lewat dropdown khusus "SS Online", dengan data yang **berdiri sendiri** (terpisah dari data outlet fisik) dan **kosong sampai di-import** dari file laporan Seller Center masing-masing platform.

**Keputusan final soal penempatan UI (setelah beberapa iterasi):** BUKAN masuk ke dalam list dropdown "Semua Cabang" yang sudah berisi 19 outlet fisik. Melainkan tombol dropdown **baru**, terpisah, berlabel **"SS Online"**, sejajar dengan "Integrasi Google Sheets" / "Semua Cabang" / "Semua Channel" / "Bulan Ini" di toolbar Rangkuman Penjualan. Detail lihat §4.

## 2. Model Data

### 2.1 Outlet Virtual

Tambah 2 baris baru ke tabel `outlets` (skema existing, kolom `type` sudah `TEXT DEFAULT 'outlet'` tanpa CHECK constraint — aman ditambah nilai baru):

| Kolom | Nilai |
|---|---|
| `id` | UUID baru (bebas, tidak overlap dengan outlet fisik) |
| `slug` | `tiktok-shop`, `shopee` |
| `name` | "TikTok Shop", "Shopee" |
| `type` | `'marketplace'` |
| `lat` / `lng` | `0` (placeholder — kolom NOT NULL, tidak dipakai untuk marketplace) |
| `is_active` | `true` |

`type='marketplace'` adalah penanda yang membedakan 2 baris ini dari outlet fisik. Dipakai untuk dua hal: (a) sumber data dropdown "SS Online" (lihat §4), dan (b) audit filter supaya TIDAK muncul di dropdown/list outlet lain di seluruh sistem (lihat §5).

### 2.2 Order & Order Item

**Tidak ada tabel baru.** Order marketplace disimpan di tabel `orders`/`order_items` yang sama persis dengan order outlet fisik:

- `orders.outlet_id` → menunjuk ke salah satu dari 2 outlet virtual di atas.
- `orders.sales_source` → nilai baru: `'tiktok_shop'`, `'shopee'` (union type `SalesSource` di `apps/admin-dashboard/src/lib/types.ts` perlu diperluas; berbeda dari `'tiktok'` yang sudah dipakai untuk TikTok Go/food delivery).
- `orders.external_order_id` → ID pesanan dari platform (kolom sudah ada, dipakai juga oleh Pawoon import untuk deteksi duplikat — **dan, seperti ditemukan di §3.1, ini juga otomatis mengaktifkan guard anti-BOM yang sudah ada**).
- `order_items` → sama seperti order biasa: `menu_item_name`, `quantity`, `unit_price`, `subtotal`, opsional `menu_item_id` bila produk sudah di-mapping ke `menu_items`.

**Kenapa reuse skema ini masuk akal:** semua KPI di Rangkuman Penjualan (Gross Revenue, Total COGS, Admin Platform, Gross Profit, item breakdown, best seller, PDF export) sudah 100% dihitung dari `orders` yang di-filter berdasar `outlet_id` — jadi begitu outlet virtual ada isinya, seluruh logic itu **otomatis berfungsi** tanpa perubahan, tinggal filter query-nya diarahkan ke outlet virtual lewat dropdown "SS Online" (lih. §4) alih-alih dropdown "Semua Cabang".

## 3. Alur Import

Halaman baru `/dashboard/marketplace-import`, mirror struktur `/dashboard/pawoon-import` (`apps/admin-dashboard/src/app/dashboard/pawoon-import/page.tsx`):

1. **Pilih platform** (TikTok Shop / Shopee) → menentukan `outlet_id` tujuan dan parser mana yang dipakai.
2. **Upload file** (.xlsx/.csv) hasil download dari Seller Center masing-masing platform.
3. **Parser per-platform** — 2 fungsi parsing terpisah (format kolom tiap platform berbeda), masing-masing menormalisasi ke bentuk generik:
   ```
   { external_order_id, order_date, status, gross_amount, admin_fee, product_lines: [{name, qty, unit_price}] }
   ```
4. **Preview** — ringkasan (total omzet, jumlah pesanan, deteksi duplikat via `external_order_id` yang sudah pernah tersimpan) sebelum disimpan — sama seperti alur Pawoon.
5. **Mapping produk tak dikenal** — nama produk dari file yang belum match `menu_items` wajib di-mapping (pola sama seperti `unmappedItems` di Pawoon import) sebelum bisa sync:
   - Produk yang overlap dengan menu resep dapur → mapping ke `menu_items` existing → Total COGS ikut terhitung dari resep.
   - Produk khusus marketplace (merchandise, saus botolan retail, dll, tanpa resep) → dibuatkan `menu_items` baru tanpa `hpp_override` dan tanpa resep → HPP-nya otomatis 0, bukan error.
6. **Simpan** → insert ke `orders`/`order_items` dengan `outlet_id` = outlet virtual platform terkait.

### 3.1 Trigger BOM — sudah aman, TIDAK perlu migration tambahan

Insert ke `order_items` bisa memicu trigger `trg_process_bom_stok` (pemotongan stok otomatis via resep). Outlet virtual **tidak punya baris `stok_balance` sama sekali**, jadi ini berisiko kalau trigger tetap jalan untuk order marketplace.

**Temuan saat riset (diverifikasi dari file migration, bukan asumsi):** fungsi `trg_process_bom_stok` versi yang berlaku saat ini (`supabase/migrations/20300105000009_restore_package_bom_after_pawoon_guard.sql`, ini adalah versi kanonik — lihat catatan ranjau migration 2030 di CLAUDE.md) **sudah punya guard**:
```sql
IF NEW.external_order_id IS NOT NULL THEN
  RETURN NEW;
END IF;
```
Guard ini awalnya dibuat untuk order hasil import Pawoon (yang juga selalu mengisi `external_order_id`). Karena alur import marketplace di §3 **juga** mengisi `orders.external_order_id` dengan ID pesanan dari platform (dipakai untuk deteksi duplikat), trigger BOM **otomatis ter-skip** untuk semua order marketplace tanpa perlu perubahan apa pun ke fungsi ini.

**Konsekuensi untuk implementasi:** pastikan Server Action/kode import marketplace SELALU mengisi `external_order_id` (bukan `NULL`) untuk setiap order yang di-sync — ini bukan cuma soal dedup, tapi juga satu-satunya hal yang mencegah BOM trigger mencoba memotong stok outlet virtual.

## 4. Tampilan di Rangkuman Penjualan

**Dropdown baru "SS Online"** — komponen baru `MarketplaceFilter.tsx`, tampilan mirip `BranchFilter.tsx` (tombol dengan chevron, bukan native `<select>`), ditaruh di toolbar `ReportsView.tsx` **di antara** dropdown "Semua Cabang" dan "Semua Channel" yang sudah ada. Isi dropdown: "Semua Platform Online" (default) + "TikTok Shop" + "Shopee" (2 outlet virtual dari §2.1, diambil dari `outlets` yang sudah ter-fetch, difilter `type === 'marketplace'`).

**Perilaku saling-reset** (satu order cuma bisa dimiliki satu `outlet_id`, jadi kedua dropdown ini merepresentasikan pilihan yang sama secara mutually exclusive di balik layar):
- Pilih platform di "SS Online" → `selectedOutlet` (state yang sudah ada di `ReportsView.tsx`) di-set ke `outlet_id` platform tsb, dan tombol "Semua Cabang" otomatis kembali menampilkan label default "Semua Cabang".
- Pilih cabang fisik dari dropdown "Semua Cabang" (atau pilih "Semua Cabang" itu sendiri) → dropdown "SS Online" otomatis kembali ke label default "Semua Platform Online".
- Tidak ada perubahan pada mekanisme fetch data (`fetchOrders`) — karena keduanya cuma dua cara berbeda untuk men-set `selectedOutlet`, satu-satunya state yang benar-benar dipakai query.

**Yang TIDAK berubah:**
- `BranchFilter.tsx` — tidak disentuh sama sekali; daftar outlet fisik yang ditampilkannya HARUS difilter `type !== 'marketplace'` di titik fetch outlet (lihat §5) supaya 2 outlet virtual ini tidak dobel-muncul di situ.
- Dropdown "Semua Channel" — tetap ada, tidak diubah perilakunya. Saat outlet virtual terpilih, dropdown ini otomatis cuma berisi 1 opsi relevan (channel platform itu sendiri) karena `availableChannels` dihitung dari `orders` yang sedang termuat.

**`resolveOrderSource` (`lib/order-source.ts`)** — tambah 2 entri channel baru (warna/label khas TikTok Shop hitam, Shopee oranye) supaya badge sumber pesanan & PDF export ("PDF Semua Channel") menampilkan label yang benar, bukan fallback generik "POS PAWOON".

**Kondisi data kosong** — sebelum ada import, memilih platform di "SS Online" menampilkan KPI Rp0 dan tabel kosong (state yang sudah tertangani secara alami oleh halaman ini untuk outlet mana pun tanpa order — tidak perlu penanganan khusus).

## 5. Isolasi Lintas-App (wajib diaudit saat implementasi)

Tabel `outlets` dipakai bersama oleh semua app (`stok`, `absensi`, `distribusi`, `pos-kasir`, `admin-dashboard`). Tanpa penyaringan eksplisit, 2 outlet virtual ini bisa muncul di tempat yang tidak relevan secara operasional — termasuk `BranchFilter.tsx` di Rangkuman Penjualan itu sendiri (§4), yang HARUS tetap hanya berisi outlet fisik karena "SS Online" sudah jadi jalur terpisah untuk platform. Filter `type != 'marketplace'` (atau `type = 'outlet'`) perlu ditambahkan di:

- `apps/stok` — monitoring board (papan 19 outlet), dropdown outlet di permintaan bahan/opname/surat jalan
- `apps/absensi` — pemilihan outlet kiosk, halaman enrollment, manajemen kru
- `apps/distribusi` — daftar outlet tujuan pengiriman
- `apps/admin-dashboard` — halaman non-laporan yang pakai `useOutlets()`: manajemen outlet (`/dashboard/outlets`), assignment staff (`StaffForm`), monitoring, dll. **Termasuk `BranchFilter.tsx` di Rangkuman Penjualan sendiri** — outlet virtual HANYA boleh muncul lewat dropdown "SS Online" yang baru (§4), bukan di "Semua Cabang". Praktisnya: `ReportsView.tsx` menerima satu `initialOutlets` (semua outlet, tanpa filter, dari server), lalu di-split di sisi client — `outlets.filter(o => o.type !== 'marketplace')` untuk `BranchFilter`, `outlets.filter(o => o.type === 'marketplace')` untuk `MarketplaceFilter` — supaya tidak perlu dua query terpisah.
- `apps/pos-kasir` — kemungkinan tidak terdampak (app ini beroperasi per-outlet fisik tunggal by design, jarang query daftar semua outlet), tetap perlu dicek sekali saat implementasi.

Audit ini dieksekusi sebagai task terpisah di plan implementasi — daftar di atas adalah titik awal, bukan daftar final; setiap query `.from('outlets')` di tiap app perlu ditelusuri satu per satu untuk memastikan konteks pemakaiannya (fisik vs laporan).

## 6. Migration

Satu migration baru, aditif, dua bagian:
1. Insert 2 baris `outlets` (TikTok Shop, Shopee) dengan `type='marketplace'`.
2. Perluas CHECK constraint `orders.sales_source` (didefinisikan di `20260619100000_orders_sales_source.sql` sebagai `orders_sales_source_check`, belum pernah di-rename/diubah migration lain) — `DROP CONSTRAINT IF EXISTS orders_sales_source_check` lalu `ADD CONSTRAINT` dengan daftar nilai lama ditambah `'tiktok_shop'` dan `'shopee'`.

**Tidak perlu** migration untuk trigger BOM — sudah aman by design, lihat temuan di §3.1.

## 7. Di Luar Scope (fase ini)

- Halaman `/dashboard/marketplace-import` dan 2 parser per-platform — didesain terstruktur di atas, tapi **implementasi parser (mapping kolom Excel spesifik tiap platform) menunggu sesi terpisah** setelah tim dapat contoh file laporan asli dari tiap Seller Center.
- **Tokopedia** — belum diaktifkan di fase ini (keputusan user 2026-08-05). Struktur data (`type='marketplace'`, dropdown "SS Online") sengaja dibuat generik sehingga menambah Tokopedia nanti tinggal insert 1 baris `outlets` + 1 nilai CHECK constraint + 1 entri channel di `order-source.ts`, tanpa perubahan struktural.
- Data marketplace tidak ikut ke halaman lain di Pusat Laporan (Selisih Stok, Bonus Crew, Kerugian Waste, Target Harian) — tidak relevan (tidak ada stok/crew/waste untuk marketplace).
- Redeploy `admin-dashboard` setelah migration/kode ini di-merge (mengikuti pola sesi-sesi sebelumnya di project ini).
