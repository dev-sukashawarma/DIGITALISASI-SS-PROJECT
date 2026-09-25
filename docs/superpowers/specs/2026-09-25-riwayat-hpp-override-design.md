# Riwayat HPP Override dengan Tanggal Berlaku — Design

**Tanggal:** 2026-09-25
**Status:** Disetujui (brainstorming), menunggu review spec
**Branch:** `feat/riwayat-hpp-override`

## 1. Masalah

HPP laporan resmi (Owner Dashboard, Profit, P&L & ROI mitra, Rangkuman Penjualan) dihitung dari
`menu_items.hpp_override` dan `menu_items.channel_hpp` **yang berlaku saat laporan dibuka**.
Tidak ada kolom HPP di `order_items`, tidak ada trigger/tabel riwayat di `menu_items`
(diverifikasi di DB live 2026-09-25). Akibatnya:

- Mengganti HPP di tengah bulan menggeser HPP **seluruh** bulan itu, termasuk penjualan sebelum tanggal ganti.
- Bulan yang sudah ditutup (closing Agustus, transfer bagi hasil mitra tgl 10) ikut bergeser saat dibuka ulang.
- Angka lama hilang permanen begitu ditimpa.

**Kasus pemicu:** owner baru menerima info (25 Sep) bahwa HPP override berubah **mulai 19 September**.
Penjualan 1–18 Sep harus tetap memakai HPP lama (angka yang tersimpan hari ini), 19 Sep ke depan
memakai HPP baru. ⚠️ **HPP di layar belum boleh diubah sebelum fitur ini live** — kalau diubah,
angka lama untuk 1–18 Sep hilang.

## 2. Keputusan (brainstorming 2026-09-25)

| # | Keputusan |
|---|---|
| K1 | Pendekatan: **tabel riwayat + tanggal berlaku**. Bukan snapshot per order (mengubah POS). |
| K2 | Cakupan: **`hpp_override` DAN `channel_hpp`** (keduanya menentukan HPP laporan). |
| K3 | Titik awal: angka hari ini disalin ke riwayat sebagai "berlaku sejak awal" → laporan lama tak bergeser. |
| K4 | Tanggal berlaku diisi lewat **kolom "Berlaku mulai" di layar HPP** (admin-dashboard & manager), boleh mundur. |
| K5 | Batas mundur: bulan berjalan bebas; bulan lalu hanya sampai **tanggal 10** bulan berjalan (WIB). Tanggal di masa depan ditolak. Kasus 19 Sep lolos. |
| K6 | Tanggal order = `orders.created_at` dalam **WIB** (`Asia/Jakarta`). |

Di luar cakupan: `menu_outlet_prices.hpp_override` (tak dibaca laporan mana pun), `get_hpp_dinamis_menu`
(HPP dinamis, sumber lain), ecommerce `ecommerce_menu_prices.hpp` (tabel 0 baris).

## 3. Model data

### 3.1 Tabel `menu_hpp_riwayat`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `menu_item_id` | uuid NOT NULL | FK `menu_items(id)` ON DELETE CASCADE |
| `hpp_override` | numeric NULL | snapshot penuh |
| `channel_hpp` | jsonb NULL | snapshot penuh |
| `berlaku_mulai` | date NOT NULL | tanggal WIB; `'2000-01-01'` = "sejak awal" |
| `sumber` | text NOT NULL | `'awal'` / `'layar'` / `'trigger'` |
| `alasan` | text NULL | opsional |
| `dicatat_oleh` | uuid NULL | `auth.uid()` |
| `dicatat_at` | timestamptz NOT NULL | `now()` |

- **UNIQUE (`menu_item_id`, `berlaku_mulai`)** — dua perubahan di tanggal berlaku yang sama = koreksi; baris terakhir menimpa (upsert).
- Index `(menu_item_id, berlaku_mulai DESC)`.
- Satu baris = **snapshot kedua kolom sekaligus**. Mengubah satu kanal di `channel_hpp` tetap menulis baris lengkap.
- RLS: SELECT untuk `authenticated` (laporan di browser membacanya; isinya sama sensitifnya dengan `menu_items` yang sudah terbaca). `REVOKE ALL FROM anon`. **Nol policy tulis** — tulis hanya lewat fungsi `SECURITY DEFINER` di bawah.

### 3.2 Seed titik awal (K3)
Satu baris per menu di `menu_items` (termasuk nonaktif & paket): `berlaku_mulai = '2000-01-01'`,
`sumber = 'awal'`, nilai = `hpp_override`/`channel_hpp` saat migration dijalankan.

### 3.3 `menu_items` tetap jadi "angka hari ini"
Setelah tiap penulisan riwayat, `menu_items.hpp_override/channel_hpp` di-set ke baris riwayat dengan
`berlaku_mulai` **terbesar** (bukan sekadar baris yang baru ditulis — perubahan mundur tak boleh
menimpa perubahan yang lebih baru). Layar non-laporan (POS, menu, resep) tak perlu diubah.

## 4. Penulisan

### 4.1 RPC `ubah_hpp_menu(p_menu_item_id uuid, p_hpp_override numeric, p_channel_hpp jsonb, p_berlaku_mulai date DEFAULT NULL, p_alasan text DEFAULT NULL)`
`SECURITY DEFINER SET search_path = public`.
1. **Role** di dalam fungsi: `outlet_staff.role IN ('owner','admin')` AND `status='active'` untuk `auth.uid()`; selain itu `42501`. (Pelajaran Session 2026-07-20: guard halaman tidak melindungi.)
2. `p_berlaku_mulai` NULL → hari ini WIB. Validasi K5:
   - `> hari ini WIB` → tolak.
   - `< awal bulan berjalan` → hanya boleh bila `>= awal bulan lalu` **dan** tanggal hari ini WIB `<= 10`; selain itu tolak dengan pesan yang menyebut batasnya.
3. `p_hpp_override < 0` → tolak. `p_hpp_override = 0` disimpan sebagai NULL (sama dengan perilaku sekarang: `> 0` baru dianggap override).
4. Upsert baris riwayat (`sumber='layar'`), lalu sinkronkan `menu_items` (3.3) dengan `SET LOCAL app.hpp_via_rpc = 'on'` agar trigger 4.2 tidak mencatat ganda.
5. Mengembalikan baris riwayat yang tertulis.

### 4.2 Trigger jaring pengaman `trg_menu_hpp_catat_riwayat`
`AFTER INSERT OR UPDATE OF hpp_override, channel_hpp ON menu_items`, `SECURITY DEFINER`.
- Lewati bila `current_setting('app.hpp_via_rpc', true) = 'on'`.
- UPDATE yang nilainya `IS DISTINCT FROM` lama → upsert baris `berlaku_mulai = hari ini WIB`, `sumber='trigger'`.
- INSERT (menu baru) → baris `berlaku_mulai = '2000-01-01'`, `sumber='awal'`.
- Tujuan: penulis lama/yang terlupa (`ResepEditor.tsx`, skrip SQL) tetap meninggalkan jejak. Tidak menolak apa pun.

### 4.3 Layar
`HPPView.tsx` (admin-dashboard & manager — berkas kembar, diubah bersamaan) dan `ResepEditor.tsx`
(keduanya) memakai `ubah_hpp_menu` alih-alih `.update({ hpp_override | channel_hpp })`. Tambah input
**"Berlaku mulai"** (default hari ini, `max` = hari ini, `min` = batas K5) dan alasan opsional.
Galat RPC ditampilkan apa adanya (bukan ditelan).
`HppDashboardView.tsx` & `OutletPricingView.tsx` menulis `menu_outlet_prices` → **tidak diubah**; bila
ternyata juga menulis `menu_items.hpp_override`, trigger 4.2 menangkapnya (plan memverifikasi).

## 5. Pembacaan — satu aturan, dua implementasi

**Aturan:** HPP menu M untuk order bertanggal T (WIB) = baris riwayat M dengan `berlaku_mulai`
terbesar yang `<= T`; bila tak ada (tak mungkin setelah seed, tapi tetap dijaga) → baris paling awal.
Dari baris itu, urutan resolusi **sama persis dengan perilaku sekarang**: `channel_hpp` kanal order →
`hpp_override > 0` → paket = Σ (HPP komponen **pada tanggal T** × quantity) → 0.

### 5.1 DB
- `hpp_riwayat_pada(p_menu_item_id uuid, p_tanggal date)` → baris riwayat (STABLE, SECURITY INVOKER).
- `get_mitra_item_hpp_base`, `get_mitra_item_hpp`, `get_mitra_item_hpp_by_name` mendapat parameter
  **`p_tanggal date DEFAULT NULL`** (NULL = hari ini WIB → pemanggil lama berperilaku seperti sekarang).
  Karena menambah parameter, fungsi lama di-`DROP` lalu dibuat ulang dengan grant yang sama
  (bukan overload — hindari ambiguitas pemanggilan).
- `get_mitra_orders_summary`: meneruskan tanggal WIB tiap order.
- `get_owner_dashboard_summary`: CTE `menu_hpp` diganti — **kelompokkan qty per (menu, tanggal WIB)
  dulu, baru beri HPP** lewat `LATERAL` ke riwayat. Wajib, fungsi ini pernah dioptimasi 6,2 dtk → 0,7 dtk
  (pelajaran `20260916110000`: agregasi sebelum penetapan harga). Target: tetap < 1,5 dtk untuk 31 hari semua outlet.

### 5.2 TypeScript
Fungsi murni **`hppMenuPada(menu, tanggalWib, kanal, riwayatMap, opsi)`** + `bangunRiwayatMap(rows)` di
`apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts` dengan test; salinan identik di
`apps/finance/src/lib/hpp/riwayatHpp.ts` (pola repo: salinan per app, bukan package bersama).
Riwayat diambil sekali per halaman (`select * from menu_hpp_riwayat` — ~90 baris, jauh di bawah cap 1.000;
tetap dipaginasi bila > 1.000). Konsumen yang dialihkan (select tetap mengambil `created_at`/`order_date`):

| App | Berkas |
|---|---|
| admin-dashboard | `hooks/useHpp.ts`, `hooks/useHppByChannel.ts`, `app/actions/mitraPnl.ts`, `app/actions/mitraRoi.ts`, `app/actions/ownerDashboard.ts` (bagian ecommerce), `app/dashboard/reports/pos/ReportsView.tsx`, `app/dashboard/pawoon-import/profit/page.tsx` |
| finance | `hooks/useHppByChannel.ts`, `app/laporan/penjualan/ReportsView.tsx` |

Logika resolusi kanal yang kini tersalin di tiap berkas (`ss_online`/`tiktok_shop`/`shopee_shop`,
fallback nama menu) **dipindah apa adanya** ke fungsi bersama — tidak diubah perilakunya.

## 6. Migration & risiko

- Timestamp hari ini (`20260925…`), bukan 2030 (`migration-timestamp-lint` menolak > 2 hari ke depan).
  **Cek `schema_migrations` sebelum memilih timestamp** (sesi paralel).
- ⚠️ `get_owner_dashboard_summary` dan fungsi mitra juga didefinisikan migration **2030**
  (`20300116000000`, `20300125000000`) yang terurut setelahnya → replay dari nol akan menimpa versi baru.
  Produksi aman (sudah terstempel). Didokumentasikan, tidak di-rename (preseden 2026-09-09).
- Apply lewat `-f file`/`exec_sql` + verifikasi katalog + stempel (`supabase db query` inline bisa no-op untuk DDL).

## 7. Pengujian

1. **Nol pergeseran (gerbang utama).** Sebelum apply, catat: `get_owner_dashboard_summary` Agustus & 1–24 Sep
   (semua outlet + per outlet), hasil `get_mitra_orders_summary` outlet mitra periode sama, dan angka
   halaman Profit/Rangkuman Penjualan/P&L mitra (admin-dashboard & finance). Setelah apply + deploy:
   **identik sampai rupiah terakhir.**
2. **Kasus 19 Sep** (transaksi + `ROLLBACK`): `ubah_hpp_menu` satu menu, berlaku 19 Sep. Cek HPP order
   18 Sep 23:30 WIB = lama, 19 Sep 00:10 WIB = baru, paket berisi menu itu ikut per tanggal,
   `menu_items` = angka baru, perubahan mundur di bawah baris yang lebih baru tidak menimpa `menu_items`.
3. **Kontrol negatif:** tanggal masa depan ditolak; bulan lalu setelah tgl 10 ditolak; crew & `admin_finance`
   ditolak (`42501`); `anon` tak bisa SELECT riwayat. Tiap asersi punya kontrol yang terbukti bisa gagal.
4. **Trigger:** UPDATE langsung `menu_items.hpp_override` → 1 baris `sumber='trigger'`; lewat RPC → tidak dobel.
5. **TS:** unit test `hppMenuPada` (batas tanggal, fallback, kanal SS Online, paket, override 0/NULL) +
   pembanding hasil TS vs `get_mitra_item_hpp_base(..., p_tanggal)` untuk sampel order.
6. `yarn type-check` & build `admin-dashboard`, `manager`, `finance`.

## 8. Urutan go-live

1. Apply migration → verifikasi 7.1–7.4.
2. Redeploy `admin-dashboard`, `manager`, `finance` → verifikasi 7.1 di layar.
3. Baru kemudian owner/admin memasukkan HPP baru di layar HPP dengan **Berlaku mulai = 19 Sep 2026**
   (harus sebelum/tanggal 10 Oktober — batas K5 untuk bulan September).
