# Riwayat HPP Override dengan Tanggal Berlaku — Design

**Tanggal:** 2026-09-25
**Status:** Disetujui (brainstorming), direvisi saat menyusun plan (lihat §9)
**Branch:** `feat/riwayat-hpp-override`
**Plan:** `docs/superpowers/plans/2026-09-25-riwayat-hpp-override.md`

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
| K4 | Tanggal berlaku diisi lewat **kolom "Berlaku mulai" di layar HPP**, boleh mundur. |
| K5 | Batas mundur: bulan berjalan bebas; bulan lalu hanya sampai **tanggal 10** bulan berjalan (WIB). Tanggal di masa depan ditolak. Kasus 19 Sep lolos. |
| K6 | Tanggal order = `orders.created_at` dalam **WIB** (`Asia/Jakarta`); ecommerce = `ecommerce_sales.order_date` dalam WIB. |

Di luar cakupan: `menu_outlet_prices.hpp_override` (tak dibaca laporan mana pun), `get_hpp_dinamis_menu`
(HPP dinamis, sumber lain), `HPPView.tsx` & `OutletPricingView.tsx` (kode mati — tak di-import di mana pun).

## 3. Model data

### 3.1 Tabel `menu_hpp_riwayat` — satu baris = satu angka

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `menu_item_id` | uuid NOT NULL | FK `menu_items(id)` ON DELETE CASCADE |
| `kunci` | text NOT NULL | `'hpp_override'` atau kunci `channel_hpp` (`ss_online`, `tiktok_shop`, `shopee_shop`, dua UUID kanal SS Online, dll) |
| `nilai` | numeric NULL | NULL = kunci dihapus/direset; CHECK `>= 0` |
| `berlaku_mulai` | date NOT NULL | tanggal WIB; `'2000-01-01'` = "sejak awal" |
| `sumber` | text NOT NULL | `'awal'` / `'layar'` / `'trigger'` |
| `alasan` | text NULL | opsional |
| `dicatat_oleh` | uuid NULL | `auth.uid()` |
| `dicatat_at` | timestamptz NOT NULL | `now()` |

- **UNIQUE (`menu_item_id`, `kunci`, `berlaku_mulai`)** — perubahan kedua pada tanggal berlaku yang sama = koreksi (upsert).
- **Kenapa per kunci, bukan snapshot seluruh kolom:** dengan snapshot, mengubah HPP offline mundur ke 19 Sep
  akan dikalahkan baris snapshot yang lebih baru (mis. perubahan kanal 22 Sep yang menyalin angka offline lama),
  sehingga angka lama "hidup lagi" mulai 22 Sep. Per kunci, tiap angka punya garis waktunya sendiri.
- RLS: SELECT `TO authenticated USING (true)` (laporan di browser membacanya; isinya setara `menu_items` yang
  sudah terbaca). `REVOKE ALL FROM anon, authenticated` lalu `GRANT SELECT TO authenticated`.
  **Nol policy tulis** — tulis hanya lewat fungsi `SECURITY DEFINER`.

### 3.2 Rekonstruksi "nilai pada tanggal T"
Untuk tiap kunci: baris dengan `berlaku_mulai` terbesar yang `<= T`. Kunci tanpa baris `<= T` = tidak ada.
- `hpp_override(T)` = nilai kunci `hpp_override` (NULL bila tak ada).
- `channel_hpp(T)` = objek dari semua kunci kanal yang nilainya tidak NULL; `{}` bila tak ada
  (`channel_hpp` di DB live **tak pernah NULL** — 76 menu `{}`, 11 berisi — jadi `{}` mempertahankan perilaku).
- Menu tanpa satu baris riwayat pun (tak semestinya terjadi setelah seed) → pakai `menu_items` saat ini.

### 3.3 Seed titik awal (K3)
Untuk tiap menu: baris `hpp_override` = nilai saat ini (apa adanya, termasuk 0/NULL) + satu baris per kunci
`channel_hpp`; semuanya `berlaku_mulai = '2000-01-01'`, `sumber = 'awal'`. Rekonstruksi pada tanggal
berapa pun = nilai saat ini → **nol pergeseran**.

### 3.4 `menu_items` tetap jadi "angka hari ini"
Setelah tiap penulisan lewat RPC, `menu_items.hpp_override/channel_hpp` di-set ke rekonstruksi **hari ini**
(bukan sekadar nilai yang baru ditulis). Layar non-laporan (POS, menu, resep) tak perlu diubah.

## 4. Penulisan

### 4.1 RPC `ubah_hpp_menu(p_menu_item_id uuid, p_perubahan jsonb, p_berlaku_mulai date DEFAULT NULL, p_alasan text DEFAULT NULL) RETURNS jsonb`
`SECURITY DEFINER SET search_path = public`. `p_perubahan` = objek `{kunci: angka|null}`, mis.
`{"hpp_override": 22000}` atau lima kunci SS Online sekaligus.
1. **Role** di dalam fungsi: `outlet_staff.role IN ('owner','admin')` AND `status='active'` untuk `auth.uid()`;
   selain itu `42501`. (Pelajaran Session 2026-07-20: guard halaman tidak melindungi.)
2. `p_berlaku_mulai` NULL → hari ini WIB. Validasi K5: `> hari ini` ditolak; `< batas` ditolak, dengan
   `batas = awal bulan lalu` bila hari ini tgl ≤ 10, selain itu `awal bulan berjalan`. Pesan menyebut batasnya.
3. Nilai harus angka JSON `>= 0` atau `null`; objek kosong ditolak; menu harus ada.
4. Upsert tiap kunci (`sumber='layar'`), lalu sinkronkan `menu_items` (3.4) dengan
   `set_config('app.hpp_via_rpc','on',true)` agar trigger 4.2 tidak mencatat ganda.
5. Mengembalikan `{hpp_override, channel_hpp, berlaku_mulai}` (nilai hari ini setelah perubahan).

### 4.2 Trigger jaring pengaman `trg_menu_hpp_catat_riwayat`
`AFTER INSERT OR UPDATE OF hpp_override, channel_hpp ON menu_items`, `SECURITY DEFINER`.
- Lewati bila `current_setting('app.hpp_via_rpc', true) = 'on'`.
- INSERT (menu baru) → baris seed `'2000-01-01'`, `sumber='awal'`.
- UPDATE → untuk tiap kunci yang nilainya berubah (`hpp_override` + union kunci `channel_hpp` lama/baru) →
  upsert `berlaku_mulai = hari ini WIB`, `sumber='trigger'`.
- Tujuan: penulis yang terlupa (skrip SQL, layar lain) tetap meninggalkan jejak. Tidak menolak apa pun.

### 4.3 Layar
- **`HppDashboardView.tsx`** (layar HPP yang benar-benar dipakai, lewat `ResepTabView.tsx`; berkas kembar
  admin-dashboard & manager, diubah bersamaan): `handleSavePusatHpp` memanggil `ubah_hpp_menu` alih-alih
  `.update({ hpp_override | channel_hpp })`. Editor inline dapat input **"Berlaku mulai"** (default hari ini,
  `max` = hari ini, `min` = batas K5). `updated_by/updated_at` tetap ditulis lewat update terpisah.
  Upsert `menu_outlet_prices` (+10% mitra) **tidak diubah**. Di admin-dashboard, setelah simpan panggil
  `revalidateOwnerDashboardCache()` (cache Owner Dashboard 1 jam); manager tak bisa → cache kedaluwarsa ≤ 1 jam.
- **`ResepEditor.tsx`** (kembar): `hpp_override` disimpan lewat `ubah_hpp_menu` dengan tanggal hari ini (tanpa
  input tanggal — perubahan mundur dilakukan di layar HPP); `price/updated_by/updated_at` tetap update biasa.

## 5. Pembacaan — aturan tiap laporan TETAP, sumber angkanya per tanggal

Tiap laporan hari ini punya aturan HPP sendiri yang **sengaja tidak disatukan** (menyatukannya akan
menggeser angka dan melanggar gerbang §7.1). Contoh: `get_owner_dashboard_summary` mengabaikan
`channel_hpp` dan menjumlah `hpp_override` komponen paket; `get_mitra_item_hpp_base` memakai `channel_hpp`
dulu dan rekursif untuk paket. Perubahan di semua pembaca hanya satu: **nilai `hpp_override`/`channel_hpp`
milik menu dan komponen paketnya diambil dari rekonstruksi pada tanggal order (§3.2), bukan dari `menu_items`.**

### 5.1 DB
- `menu_hpp_pada(p_menu_item_id uuid, p_tanggal date DEFAULT NULL) RETURNS TABLE(hpp_override numeric, channel_hpp jsonb)`
  — STABLE, SECURITY INVOKER; `p_tanggal` NULL = hari ini WIB.
- `get_mitra_item_hpp_base`, `get_mitra_item_hpp`, `get_mitra_item_hpp_by_name` mendapat parameter ketiga
  **`p_tanggal date DEFAULT NULL`**. Fungsi lama di-`DROP` lalu dibuat ulang (bukan overload — panggilan dua
  argumen akan ambigu), grant disamakan dengan yang lama.
- `get_mitra_orders_summary`: meneruskan tanggal WIB tiap order.
- `get_owner_dashboard_summary`: CTE `menu_hpp` diganti — **pasangan (menu, tanggal WIB) yang benar-benar
  terjual dikumpulkan dulu, baru diberi HPP** lewat `menu_hpp_pada`. Wajib, fungsi ini pernah dioptimasi
  6,2 dtk → 0,7 dtk (pelajaran `20260916110000`: agregasi sebelum penetapan harga). Target < 1,5 dtk untuk
  31 hari semua outlet.

### 5.2 TypeScript
`apps/admin-dashboard/src/lib/hpp/riwayatHpp.ts` (salinan identik `apps/finance/src/lib/hpp/riwayatHpp.ts`,
pola repo: salinan per app): `ambilRiwayatHpp`, `tanggalWib`, `nilaiHppPada`, `buatPenerapRiwayat`.
`buatPenerapRiwayat(...).untuk(tanggal)` mengembalikan `{ terapkan(menu), byId, byName }` — objek menu yang
nilai HPP-nya (termasuk komponen paket) sudah ditimpa nilai pada tanggal itu. Fungsi `getItemHpp` tiap
konsumen **tidak diubah**; pemanggilnya yang menyuplai objek hasil `terapkan` dan peta `byId/byName`.
Gagal memuat riwayat = **error**, bukan diam-diam memakai angka hari ini.

| App | Berkas |
|---|---|
| admin-dashboard | `hooks/useHpp.ts`, `hooks/useHppByChannel.ts`, `app/actions/mitraPnl.ts` (jalur cadangan), `app/actions/mitraRoi.ts` (jalur cadangan), `app/actions/ownerDashboard.ts` (bagian ecommerce), `app/dashboard/reports/pos/ReportsView.tsx`, `app/dashboard/pawoon-import/profit/page.tsx` |
| finance | `hooks/useHppByChannel.ts`, `app/laporan/penjualan/ReportsView.tsx` |

Semua select bersarang `menu_items(...)` / `component:menu_items!menu_item_id(...)` wajib ikut mengambil `id`
(tanpa id, objek tak bisa dicocokkan ke riwayat dan diam-diam memakai angka hari ini).

## 6. Migration & risiko

- Timestamp hari ini (`20260925…`), bukan 2030 (`migration-timestamp-lint` menolak > 2 hari ke depan).
  **Cek `schema_migrations` sebelum memilih timestamp** (sesi paralel).
- ⚠️ `get_owner_dashboard_summary` dan fungsi mitra juga didefinisikan migration **2030**
  (`20300116000000`, `20300125000000`) yang terurut setelahnya → replay dari nol akan menimpa versi baru.
  Produksi aman (sudah terstempel). Didokumentasikan, tidak di-rename (preseden 2026-09-09).
- Fungsi mitra INVOKER dan kini membaca `menu_hpp_riwayat`; `anon` (yang pernah diberi EXECUTE) tak punya
  SELECT → panggilan anon gagal. Tidak ada pemanggil anon yang sah; grant anon lama adalah celah pre-existing.
- Apply lewat `-f file` + verifikasi katalog + stempel (`supabase db query` inline bisa no-op untuk DDL).

## 7. Pengujian

1. **Nol pergeseran (gerbang utama).** Sebelum apply, catat: `get_owner_dashboard_summary` Agustus & 1–24 Sep
   (semua outlet + per outlet), hasil `get_mitra_orders_summary` outlet mitra periode sama, dan angka
   halaman Profit/Rangkuman Penjualan/P&L mitra (admin-dashboard & finance). Setelah apply + deploy:
   **identik sampai rupiah terakhir.**
2. **Kasus 19 Sep** (transaksi + `ROLLBACK`): `ubah_hpp_menu` satu menu, berlaku 19 Sep. Cek `menu_hpp_pada`
   18 Sep = lama, 19 Sep = baru; `get_mitra_item_hpp_base` & owner summary per tanggal; paket berisi menu itu
   ikut per tanggal; `menu_items` = angka baru; perubahan mundur pada satu kunci tidak dikalahkan baris kunci lain.
3. **Kontrol negatif:** tanggal masa depan ditolak; sebelum batas ditolak; crew & `admin_finance` ditolak
   (`42501`); `anon` tak bisa SELECT riwayat. Tiap asersi punya kontrol yang terbukti bisa gagal.
4. **Trigger:** UPDATE langsung `menu_items.hpp_override` → 1 baris `sumber='trigger'`; lewat RPC → tidak dobel.
5. **TS:** unit test `riwayatHpp` (batas tanggal, kunci ditambah/dihapus belakangan, paket, objek tanpa id,
   menu tanpa riwayat).
6. `yarn type-check`, `yarn test` & build `admin-dashboard`, `manager`, `finance`.

## 8. Urutan go-live

1. Catat baseline (§7.1) → apply migration → verifikasi 7.1–7.4.
2. Redeploy `admin-dashboard`, `manager`, `finance` → verifikasi 7.1 di layar.
3. Baru kemudian owner/admin memasukkan HPP baru di layar HPP dengan **Berlaku mulai = 19 Sep 2026**
   (paling lambat **10 Oktober** — batas K5 untuk bulan September).

## 9. Revisi saat menyusun plan (2026-09-25)

- Model riwayat diubah dari snapshot dua kolom → **per kunci** (alasan di §3.1).
- Layar penulis yang benar adalah `HppDashboardView.tsx`, bukan `HPPView.tsx` (kode mati).
- "Satu aturan untuk semua laporan" dibatalkan → aturan tiap laporan tetap, hanya sumber angkanya (§5).
- `p_hpp_override = 0` tidak lagi dinormalisasi jadi NULL (nilai disimpan apa adanya; logika `> 0` sudah ada di pembaca).
