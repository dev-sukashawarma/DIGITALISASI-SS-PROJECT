# App Retail Tahap 2 — Banner (desain)

**Tanggal:** 2026-09-10
**Status:** Disetujui untuk dilanjutkan ke rencana implementasi
**Lingkup:** `apps/admin-dashboard`, `apps/retail-gateway`, `mobile/customer-app`, satu migration

---

## 1. Kenapa ini ada

Aplikasi pelanggan sudah punya tiga permukaan promosi yang berjalan di
Beranda, seluruhnya berisi teks dan gambar **hardcoded**. Tak ada satu pun
yang bisa diubah tanpa membangun ulang APK.

| Permukaan | Berkas | Isi sekarang |
|---|---|---|
| `PromoMediaCarousel` | `HomeScreen.kt:197` | 3 slide, `promoSlideItems` baris 318–341 |
| `SecondaryMediaBanner` | `HomeScreen.kt:292` | kartu cerita merek, **nol parameter** |
| `PromoPopupDialog` | `PromoPopupDialog.kt` | popup layar penuh, muncul tiap tiba di Beranda |

Jadi pekerjaan ini **bukan membangun banner** — melainkan memberi sumber data
pada permukaan yang sudah ada, dan menutup satu cacat yang menumpang di sana.

### 1a. Penghalang rilis: aplikasi menjanjikan voucher yang tidak ada

Slide ketiga berbunyi *"Voucher Diskon 40% — Gunakan kode SUKABARU di
checkout"*, dan popup mengulanginya (`PromoPopupDialog.kt:63-64`: kode
`SUKABARU`, *"Potongan s.d. Rp 25.000"*).

**Voucher itu tidak ada.** Yang diverifikasi: **nol berkas di
`supabase/migrations/` menyebut voucher** (dua hasil grep yang muncul adalah
komentar "banner stok menipis" dan item inventaris fisik "BANNER
BESAR/KECIL"), dan `DISKON_PILOT_PERSEN = 0` di kedua pemanggil `hitungTotal`
(`checkout/validate/route.ts:10`, `orders/route.ts:11`). Pelanggan yang
mencari tempat mengetik `SUKABARU` tidak akan menemukannya — kolomnya memang
tidak ada.

⚠️ **Batas bukti:** migration di repo ini tidak menggambarkan basis data
hidup secara utuh — ada riwayat remote-only dari dev lain. Yang benar-benar
dibuktikan adalah **gateway tak pernah membaca tabel promo apa pun**, jadi
tak ada jalur bagi kode voucher untuk berlaku. Tabel `promos` milik POS
memang ada (167 baris, seluruhnya nonaktif) — itu **domain berbeda**, tak
tersambung ke `retail-gateway`, dan jangan dicampur saat voucher digarap.

APK **belum dirilis** (dikonfirmasi owner 2026-09-10), jadi ini belum melukai
siapa pun. Tapi ia **wajib hilang sebelum rilis**, dan desain ini yang
menghilangkannya.

### 1b. Aset mockup jadi aset produksi

Keempat URL gambar menunjuk ke `lh3.googleusercontent.com/aida.../` — aset
mockup Stitch, bukan milik Suka Shawarma, bisa berhenti dilayani kapan saja.

Salah satunya (`HomeScreen.kt:539`) dipakai sebagai **gambar cadangan untuk
menu yang tak punya foto**. **Keputusan owner 2026-09-10: dibiarkan.**
Tercatat sebagai risiko yang diterima, di luar lingkup pekerjaan ini.

---

## 2. Keputusan yang mengikat

| # | Keputusan | Alasan |
|---|---|---|
| K1 | Carousel **dan** popup jadi berbasis data | Owner memilih cakupan penuh |
| K2 | `SecondaryMediaBanner` **tetap hardcoded** | Lihat §3a — bentuknya berbeda |
| K3 | Popup tampil **sekali per banner per pelanggan** | Admin mengendalikan frekuensi lewat mengganti banner |
| K4 | Ketukan memilih dari **daftar tetap**, bukan URL bebas | Lihat §3c |
| K5 | Banner **global**, tanpa lingkup outlet | Belum ada promo per-outlet; kolom `outlet_id` bisa ditambah aditif nanti |
| K6 | **Aktif/nonaktif saja**, tanpa jadwal tanggal | Lihat §3d |

---

## 3. Model data

### Tabel `app_banners`

| kolom | tipe | catatan |
|---|---|---|
| `id` | uuid PK | |
| `slot` | text | `carousel` \| `popup` (CHECK) |
| `urutan` | int NOT NULL | urutan slide; juga penentu popup pemenang |
| `badge` | text NULL | chip, mis. `🔥 Promo Spesial`; kosong → chip tak dirender |
| `judul` | text NOT NULL | satu-satunya teks yang wajib |
| `subjudul` | text NULL | kosong → baris tak dirender |
| `teks_tombol` | text NULL | kosong → tombol tak dirender |
| `gambar_url` | text NULL | kosong → slot gambar diisi warna latar tema, **bukan** gambar cadangan dari luar |
| `aksi` | text | `tidak_ada` \| `menu` \| `menu_item` (CHECK) |
| `target_menu_item_id` | uuid NULL | FK `menu_items(id)` |
| `aktif` | boolean NOT NULL DEFAULT false | |
| `dibuat_pada` / `diubah_pada` | timestamptz | |

**CHECK gabungan:** `target_menu_item_id IS NOT NULL` **jika dan hanya jika**
`aksi = 'menu_item'`. Ditegakkan basis data, bukan diserahkan ke formulir —
formulir bisa dilewati, `CHECK` tidak.

### 3a. Kenapa tidak ada slot `sekunder`

`SecondaryMediaBanner` menerima **hanya** `onCekInfo: () -> Unit`
(`HomeScreen.kt:652-654`). Seluruh isinya literal di dalam badan fungsi:
badge `⭐ JAMINAN KUALITAS SUKA`, judul `Kisah Rasa`, kartu cokelat tanpa
gambar. Itu **cerita merek**, bukan promo.

Memasukkannya ke tabel ini membuat separuh kolomnya selalu kosong dan `aksi`
tak punya arti. Kalau nanti cerita merek memang perlu diganti-ganti, ia dapat
tabelnya sendiri dengan bentuk yang benar.

### 3b. Popup ganda

Bila lebih dari satu baris `slot='popup'` aktif, gateway mengambil `urutan`
terkecil. Deterministik, dan admin tak perlu diingatkan aturan "cuma boleh
satu" yang tak ditegakkan apa pun.

### 3c. Kenapa ketukan bukan URL bebas

Kolom tautan bebas di aplikasi pelanggan berarti siapa pun yang bisa menulis
baris `app_banners` bisa mengarahkan pelanggan ke alamat mana saja. Sapuan
RLS 2026-09-10 menemukan pola `USING(true)` masih terbuka di belasan tabel
basis data ini — sebagian bahkan untuk `anon`. Menambah permukaan pengalihan
di tengah keadaan itu tidak sebanding dengan manfaatnya.

### 3d. Kenapa tanpa jadwal tanggal

Begitu ada tanggal, gateway harus menyaring dengan waktu, dan waktu di sini
berarti **zona waktu**: server UTC, outlet WIB. Banner yang dijadwalkan
berakhir "31 Ramadan" akan mati 07:00 WIB kalau perbandingannya salah —
kelas kekeliruan yang sama dengan cron auto-verifikasi (`0 19 * * *` UTC =
02:00 WIB).

Dengan sakelar manual, matinya banner selalu keputusan sadar seseorang.
Menambahkan jadwal nanti = dua kolom tanggal + satu klausa `WHERE`.

### 3e. Hak akses — wajib eksplisit

Tabel baru di Supabase **otomatis menerima `GRANT ALL` ke `anon` dan
`authenticated`** lewat default privileges. Menulis `GRANT` di migration
tidak membatasi apa pun (pelajaran `bahan_baku_supplier`, 2026-09-08).

Migration wajib:

1. `REVOKE ALL ON app_banners FROM anon, authenticated;`
2. `ENABLE ROW LEVEL SECURITY`
3. Satu policy tulis untuk role `admin` saja — pola `menu_items_all_admin`.
   **Role `admin` persis**; `owner` dan `admin_hr` adalah role berbeda dan
   tidak lolos.
4. **Nol policy untuk `anon`.**

Pembacaan pelanggan tidak lewat RLS: gateway membaca dengan service client,
sama seperti `/api/v1/outlets`. **Aplikasi Android tak pernah menyentuh
Supabase** — tanpa SDK, tanpa anon key, tanpa URL Supabase.

---

## 4. Endpoint gateway

`GET /api/v1/banners` — mengikuti `outlets/route.ts` persis: `force-dynamic`,
`createServiceClient()`, balas `502` dengan pesan Indonesia bila query gagal.

```json
{
  "carousel": [
    { "id": "…", "badge": "…", "judul": "…", "subjudul": "…",
      "teks_tombol": "…", "gambar_url": "…",
      "aksi": "menu_item", "target_menu_item_id": "…" }
  ],
  "popup": { "…": "bentuk sama" }
}
```

`popup` bernilai `null` bila tak ada yang aktif. `carousel` array kosong bila
tak ada yang aktif.

**Tanpa cache.** Katalog punya cache 5 menit karena ia besar dan sering
dibaca; banner kecil dan dibaca sekali per buka Beranda. Cache di sini hanya
menciptakan lagi pertanyaan "kenapa perubahan saya belum muncul" — persis
yang menghabiskan waktu saat menelusuri harga aplikasi Extra Keju.

---

## 5. Sisi Android (`mobile/customer-app`)

### Dihapus

- `promoSlideItems` (`HomeScreen.kt:318-341`) — 3 slide hardcoded.
- Blok voucher `PromoPopupDialog.kt` baris 228 & 245 — kode voucher dan
  info diskon. **Dicabut bloknya, bukan diganti teksnya:** selama belum ada
  voucher, popup tidak boleh punya tempat untuk memajang satu pun.
- Seluruh nilai default `PromoPopupDialog` (baris 57–64). Parameter jadi
  wajib. Default berisi janji promo adalah cara cacat ini lahir; parameter
  wajib membuatnya tak bisa terulang diam-diam.
- `DEFAULT_PROMO_IMAGE_URL` (`PromoPopupDialog.kt:47`).

### Ditambah

- `BannerDto` + panggilan di `GatewayClient`, mengikuti pola DTO yang ada.
- `BannerDilihatStore` — SharedPreferences **biasa** (bukan terenkripsi),
  menyimpan himpunan `id` popup yang sudah dilihat. Pola dan alasan persis
  `OutletStore`: ini preferensi tampilan, bukan identitas, jadi jangan
  dicampur ke berkas yang seharusnya hanya berisi rahasia.
- Penerjemah `aksi` → tujuan: `tidak_ada` → tak bisa diketuk; `menu` →
  `onBukaMenu()`; `menu_item` → detail menu tersebut.

### Keadaan kosong adalah keadaan yang benar

Tanpa banner aktif — keadaan tepat setelah fitur ini live, sebelum admin
mengunggah apa pun — carousel dan popup **tidak dirender sama sekali**. Bukan
spinner, bukan placeholder. Beranda langsung ke daftar menu.

Ini yang membuat `SUKABARU` hilang begitu kode masuk, tanpa menunggu siapa
pun mengisi data.

### Catatan "sudah dilihat"

Disimpan **di HP masing-masing**. Pelanggan yang ganti HP atau menghapus data
akan melihat popup lagi. Itu wajar dan sengaja tidak ditutup dengan
menyimpannya di server.

---

## 6. Dashboard admin

Halaman baru `/dashboard/app-retail/banner`, entri **keempat** di grup nav
App Retail. Daftar per slot (carousel bisa digeser urutannya, popup
terpisah), formulir, unggah gambar, sakelar aktif.

### Penulisan DB

Lewat `apps/admin-dashboard/src/app/dashboard/app-retail/actions.ts` — berkas
itu satu-satunya penulis di App Retail. **Pola `pastikanTerubah` wajib
diikuti:** setiap `UPDATE`/`INSERT` memakai `.select('id')` lalu memeriksa
hasilnya.

Alasannya bukan gaya: **UPDATE yang ditolak RLS di PostgREST bukan error — ia
sukses dengan nol baris terpengaruh.** Tanpa pemeriksaan itu, admin yang tak
berhak melihat "Tersimpan" padahal tak ada yang berubah. Itu Critical 2 di
tahap 1.

### Bucket gambar

Bucket baru `app-banners`, baca publik.

⚠️ **Namanya wajib diverifikasi ke proyek Supabase yang hidup sebelum ditulis
ke kode.** Di tahap 1, nama `menu_images` ditulis di spec, diwarisi rencana →
brief → kode → produksi, dan unggah foto gagal senyap; yang benar
`menu-images`. Review per-task secara struktural tak bisa menangkapnya karena
semua lapisan salah bersama-sama.

---

## 7. Isolasi

Syarat keras owner masih berlaku, tapi **batasnya bergeser dan itu
disengaja**: `mobile/customer-app` kini ikut disentuh — ia aplikasi retail,
bukan POS.

Yang wajib **nol baris** dalam `git diff --name-only origin/main...HEAD`:

- `apps/pos-kasir/`
- `pos-admin/`
- `mobile/native-pos/`
- `mobile/native-superapp/`

Ditegakkan sebagai pemeriksaan, bukan sebagai niat.

**Migration butuh persetujuan owner sebelum di-apply.** Timestamp bertanggal
hari ini — `scripts/migration-timestamp-lint.mjs` menolak apa pun lebih dari
2 hari ke depan, jadi **jangan ada timestamp 2030**.

---

## 8. Pengujian

**Fungsi murni ber-TDD:**
- pemilih popup pemenang (`urutan` terkecil di antara yang aktif; `null` bila
  tak ada)
- penerjemah `aksi` → tujuan navigasi

**`navConfig.test.ts` ikut diperbarui** — ia menyimpan snapshot himpunan route
dan jumlah grup **per role**, jadi entri nav keempat membuatnya merah kalau
tak disesuaikan. Itu memang gunanya.

**Uji manual:**
1. Unggah satu banner carousel → muncul di aplikasi.
2. Nonaktifkan → hilang.
3. Tanpa banner aktif → Beranda langsung ke daftar menu, tanpa ruang kosong.
4. Popup muncul sekali; tutup, pindah layar, kembali ke Beranda → tidak
   muncul lagi.
5. Ketuk banner ber-`aksi='menu_item'` → mendarat di menu yang benar.

---

## 9. Urutan live, dan kenapa Android paling akhir

| Lapis | Kapan berlaku |
|---|---|
| Migration | setelah di-apply (butuh persetujuan owner) |
| Gateway | setelah redeploy Coolify |
| Dashboard admin | setelah redeploy Coolify |
| **Android** | **setelah APK di-build ulang dan dipasang di HP penguji** |

Selama APK lama masih terpasang, ia tetap menampilkan tiga slide hardcoded —
**termasuk SUKABARU**. Endpoint dan dashboard yang sudah live tidak
mengubahnya.

---

## 10. Sengaja tidak dikerjakan

- **Voucher** — tahap terpisah. Pipanya sudah ada sebagian
  (`hitungTotal(items, diskonPersen)` + rem 50%, kolom `discount_amount`
  sudah ditulis ke draft order dan terbawa ke webhook Xendit), tapi tabel,
  penukaran kode, dan batas pakai per pelanggan belum ada.
- **`DISKON_PILOT_PERSEN` diduplikasi di dua berkas** — ranjau yang perlu
  disatukan saat voucher digarap: mengubah satu tanpa yang lain membuat angka
  di layar konfirmasi berbeda dari yang ditagih.
- **Banner per-outlet** — K5.
- **Jadwal tanggal** — K6.
- **Gambar cadangan mockup Stitch** (`HomeScreen.kt:539`) — keputusan owner,
  dibiarkan.
- **Cerita merek `SecondaryMediaBanner`** — §3a.
