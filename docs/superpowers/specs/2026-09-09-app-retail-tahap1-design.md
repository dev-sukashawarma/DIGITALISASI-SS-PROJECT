# App Retail — Tahap 1: Rumah, Pengaturan Menu, Outlet Aplikasi

**Tanggal:** 9 September 2026
**App:** `apps/admin-dashboard`
**Status:** rancangan disetujui, rencana implementasi belum ditulis

## 1. Masalah

SukaShawarma APP sudah melayani pesanan sungguhan, tetapi **tidak ada satu pun
layar** yang mengatur kanal itu. Kolom yang menentukan apa yang dilihat
pelanggan hanya bisa diubah lewat SQL langsung ke tabel produksi:

| Kolom | Menentukan | UI hari ini |
|---|---|---|
| `menu_items.tampil_di_app` | menu terbit di aplikasi | tombol di layar menu POS (9 Sep) |
| `menu_items.foto_app`, `deskripsi_app` | tampilan menu di aplikasi | tidak ada |
| `outlets.app_enabled` | outlet melayani aplikasi | **tidak ada** |

`app_enabled` yang paling berbahaya: `GET /api/v1/outlets` menyaring
`app_enabled = true`, jadi satu baris `UPDATE` yang salah membuka outlet
sungguhan untuk pelanggan.

Pengaturan menu aplikasi juga sedang menumpang layar menu POS — layar yang
penuh kolom food-apps, promo, dan paket yang tidak relevan untuk aplikasi.

## 2. Keputusan owner yang mengikat

1. **Tahap 1 = rumah + pengaturan menu + outlet aplikasi.** Banner dan voucher
   tahap berikutnya, masing-masing spec sendiri.
2. **Hanya kurasi.** Menu tetap dibuat dan dihapus di POS. App Retail hanya
   menentukan yang tayang di aplikasi dan bagaimana tampilannya.
3. **Global dulu.** Satu daftar menu berlaku di semua outlet `app_enabled`;
   per-outlet menyusul kalau memang dibutuhkan.
4. **Nol gangguan ke POS, web maupun native.** Syarat keras, bukan preferensi —
   lihat §3.

## 3. Aturan isolasi (mengikat, sudah diverifikasi)

| # | Aturan | Cara ditegakkan |
|---|---|---|
| 1 | Nol berkas berubah di `apps/pos-kasir`, `mobile/`, dan `src/app/dashboard/pos-admin/` | `git diff --name-only` sebelum commit |
| 2 | Nol migration, nol perubahan skema | semua kolom sudah ada |
| 3 | **Tidak menambah baris ke `sales_channels`** | lihat bahaya di bawah |
| 4 | Penulisan `channel_prices` **menggabung**, tidak menimpa | fungsi murni ber-test (§9) |
| 5 | Kolom yang boleh ditulis hanya `tampil_di_app`, `foto_app`, `deskripsi_app`, dan kunci `aplikasi` di dalam `channel_prices` | apa pun di luar itu menyentuh POS |

### Kenapa aturan 3 penting

Mode "Satu Harga Semua" di `MenuView.tsx` menyapu **seluruh baris
`sales_channels`** dan menulis satu harga ke semua slug-nya. Menambahkan baris
"Aplikasi" ke tabel itu membuat harga aplikasi ikut tersapu setiap kali admin
mengatur harga food apps — perubahan yang tidak pernah diminta siapa pun. Slug
`aplikasi` sengaja hidup **hanya** sebagai kunci di `channel_prices`, tanpa
baris master.

### Bukti isolasi harga

`resolveBasePrice` (`apps/pos-kasir/lib/promo-calculator.ts:109`) mencari
**kunci persis** `channelPrices[salesSource.toLowerCase()]` — bukan kunci
pertama, bukan seluruh objek. POS tidak pernah memakai
`salesSource = 'aplikasi'`, jadi kunci itu inert di sana.

Pencarian `channel_prices|tampil_di_app|menu_items` di seluruh `mobile/`
(dua kali: jenis berkas terbatas, lalu semua jenis) mengembalikan **nol hasil**.
Superapp native tidak pernah membaca tabel menu.

## 4. Rute & navigasi

```
/dashboard/app-retail            Ringkasan
/dashboard/app-retail/menu       Pengaturan Menu Aplikasi
/dashboard/app-retail/outlet     Outlet Aplikasi
```

Satu **grup nav baru** "App Retail" (ikon `Smartphone`), `roles: ['OWNER','ADMIN']`.

Grup baru, bukan menyisipkan item ke grup yang ada: grup nav dipakai bersama
antar-role, dan memindahkan item antar grup diam-diam mengubah nav OWNER
(gotcha tercatat di CLAUDE.md, Session 2026-09-05).

`navConfig.test.ts` mensnapshot himpunan rute per role dan memeriksa tiap `href`
punya `page.tsx`. Test itu **diperbarui**, tidak diakali.

## 5. Halaman Ringkasan

Tiga angka, semuanya dari skema `public`:

1. menu tayang di aplikasi — `count(menu_items where tampil_di_app)`
2. outlet melayani aplikasi — `count(outlets where app_enabled)`
3. pesanan aplikasi hari ini — `count(orders where source = 'app')`

Bukan dasbor analitik. Pertanyaan yang dijawab halaman ini hanya satu: *apakah
kanal ini hidup dan waras?*

**Draft `menunggu_bayar` sengaja TIDAK ditampilkan.** `retail.order_drafts`
GRANT-nya hanya untuk `service_role`; membacanya dari admin-dashboard berarti
menambah jalur service-role baru — pola yang di repo ini sudah pernah menjadi
lubang otorisasi (Session 2026-07-20). Tidak sepadan demi satu angka. Kalau
nanti dibutuhkan, lewat endpoint gateway yang sudah memiliki haknya.

## 6. Halaman Pengaturan Menu Aplikasi

Satu tabel, satu panel edit.

**Kolom tabel:** foto · nama · kategori · **harga kasir** · **harga aplikasi** ·
status tayang. Harga kasir ikut tampil meski tidak bisa diubah di sini — tanpa
pembanding, mengisi harga aplikasi menjadi menebak.

**Penyaring:** `Tayang` / `Belum tayang` / `Semua`, plus pencarian nama. Tidak
ada penyaring kanal food-apps; justru itu yang membuat layar POS berat untuk
keperluan ini.

**Panel edit** menyentuh empat hal saja: toggle tayang · `foto_app` ·
`deskripsi_app` · harga aplikasi. **Tidak ada tombol buat, tidak ada tombol
hapus.**

**Harga aplikasi kosong berarti "ikut harga kasir", bukan "gratis".** Aturan ini
sudah ditegakkan di sisi gateway (`hargaAplikasi` di
`apps/retail-gateway/src/lib/catalog.ts`, ber-test): nilai kosong, nol, atau
tidak masuk akal jatuh ke `menu_items.price`. Halaman ini wajib memakai kalimat
yang sama supaya admin tidak mengira mengosongkan kolom akan menggratiskan menu.

**Peringatan cakupan ada di layar:** *"Perubahan berlaku serentak di N outlet
yang melayani aplikasi"* — N terhitung nyata, nama outletnya bisa dibuka. Hari
ini tidak ada tempat mana pun yang memberi tahu hal itu.

**Foto** memakai bucket `menu-images` yang sudah dipakai POS. Bucket baru
berarti kebijakan akses baru untuk untung nol.

**Urutan tampil TIDAK ikut tahap ini.** `sort_order` dipakai bersama POS;
mengubahnya di sini menggeser urutan menu di kasir. Urutan khusus aplikasi
membutuhkan kolom baru (`urutan_app`) dan tidak diselundupkan ke sini. Sementara
itu katalog aplikasi urut mengikuti kategori dan `sort_order` yang ada.

## 7. Halaman Outlet Aplikasi

Daftar outlet dengan toggle `app_enabled`, ditemani tiga kolom yang membuat
toggle itu bisa dipakai dengan sadar: **jenis outlet**, **aktif/tidak**, dan
**jumlah menu yang akan terbit**.

**Outlet tes wajib terlihat.** Aturan "outlet tes jangan masuk perhitungan"
berlaku untuk laporan, bukan untuk layar ini — `retail-gateway` memang sengaja
tidak menyaringnya, karena outlet tes satu-satunya baris `app_enabled = true`
hari ini. Jenis outlet ditampilkan supaya tidak tertukar dengan outlet sungguhan.

**Menyalakan minta konfirmasi; mematikan tidak.** Menyalakan outlet sungguhan
adalah tindakan menghadap publik — dialognya menyebut nama outletnya. Mematikan
hanya menutup pintu: pesanan yang sedang berjalan tidak terpengaruh, karena
draft dan `orders` sudah menyimpan `outlet_id` masing-masing.

**Dua keadaan ditandai, bukan diperbaiki diam-diam:**

1. `app_enabled` menyala tetapi `is_active` mati. `GET /api/v1/outlets`
   menyaring `app_enabled` **tanpa** menyaring `is_active`, jadi outlet yang
   sudah dinonaktifkan tetap ditawarkan kepada pelanggan. Endpoint **tidak
   diubah** di tahap ini — itu perilaku berjalan dan di luar lingkup; halaman
   hanya menandainya merah supaya keadaannya terlihat.
2. Menyala tetapi nol menu tayang. Ini persis kegagalan "Menu belum terbit" pada
   uji coba 8 September: katalog kosong, aplikasi tampak rusak, padahal belum
   ada menu yang diterbitkan.

## 8. Data

**Dibaca:** `menu_items` (`id, name, category_id, price, channel_prices,
image_url, foto_app, deskripsi_app, tampil_di_app, is_available`, embed
`categories(name, sort_order)`) · `outlets` (`id, name, type, is_active,
app_enabled`) · `orders` (hitung `source = 'app'` hari ini).

**Ditulis:** hanya empat, sesuai §3 aturan 5.

Halaman baru memakai server action sendiri di folder rutenya, tanpa mengimpor
apa pun dari `pos-admin/menu`. Konsekuensinya `tampil_di_app` memiliki dua
penulis sampai duplikasinya dibereskan (§11) — keduanya menulis satu boolean
yang sama, jadi tidak ada keadaan yang bisa bertengkar.

## 9. Fungsi murni & pengujian

Dua fungsi diuji, karena keduanya bisa salah tanpa kelihatan.

**`gabungHargaChannel(lama, harga)`** — menggabung, tidak menimpa. Kasus uji:
harga GoFood tetap utuh · kolom dikosongkan menghapus kunci `aplikasi` saja ·
`channel_prices` berbentuk string JSON tetap terbaca · `null` atau isi rusak
tidak melempar.

Ini yang paling mudah salah dan paling mahal akibatnya: menulis
`{ aplikasi: '9000' }` polos akan menghapus harga GoFood, GrabFood, dan
ShopeeFood dalam satu klik.

**`periksaKesiapanOutlet(outlet, jumlahMenuTayang)`** — menandai `app_enabled`
tanpa `is_active`, dan menyala tetapi nol menu.

Ditambah `navConfig.test.ts` yang diperbarui.

## 10. Verifikasi sebelum commit

- `git diff --name-only` — nol berkas di `apps/pos-kasir`, `mobile/`, `pos-admin/`
- `yarn type-check` — tetap 3 error baseline (`mitraPolicy.test.ts` TS6133,
  `vitest.config.ts` ×2)
- `vitest run --dir src` — tetap hijau (baseline 240/240 per 9 September)
- `yarn build` — sukses, tiga rute `app-retail` muncul di keluaran

`vitest run` tanpa `--dir src` memindai salinan di `.claude/worktrees/**` dan
selalu merah; itu bukan ukuran.

## 11. Diketahui, sengaja dibiarkan

**Toggle dan harga aplikasi ada di dua tempat.** Pekerjaan 9 September menaruh
toggle, filter "Khusus Aplikasi", dan kartu harga aplikasi di dalam layar menu
POS. Mencabutnya berarti menyentuh POS — melanggar §2 keputusan 4 — jadi
keduanya dibiarkan hidup berdampingan. Membingungkan bagi yang membuka POS,
tetapi tidak menghasilkan data yang bertengkar. Memindahkannya adalah pekerjaan
tersendiri dengan ujinya sendiri, setelah tab ini terbukti dipakai.

## 12. Di luar lingkup Tahap 1

banner · voucher · `urutan_app` · menu per-outlet · membuat atau menghapus menu ·
menyaring `is_active` di `GET /api/v1/outlets` · memindahkan pengaturan aplikasi
keluar dari layar POS.
