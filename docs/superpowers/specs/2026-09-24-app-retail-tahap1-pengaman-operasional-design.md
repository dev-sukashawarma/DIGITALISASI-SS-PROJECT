# App Retail Tahap 1 — Pengaman Operasional

**Tanggal:** 2026-09-24 · **Status:** draf, menunggu review owner
**Dasar:** [2026-09-24-app-retail-admin-keputusan.md](2026-09-24-app-retail-admin-keputusan.md) (keputusan 1–6, 16, 17, 18)

## 1. Masalah

Aplikasi pelanggan live sejak 2026-09-23 di 21 outlet. Tiga lubang membuat pelanggan bisa **membayar
tanpa ada yang melayani, dan uangnya tidak kembali**:

1. **Tak ada jam buka.** Gateway tak membaca `outlets.open_hour/close_hour`; outlet dianggap buka
   selama `is_active`. Pelanggan bisa bayar QRIS pukul 01.00.
2. **Menu habis per outlet diabaikan.** POS menyembunyikan menu lewat
   `kiosk_settings.unavailable_menu_ids` (per outlet) dan `menu_items.available_outlets`; katalog
   gateway tak membaca keduanya.
3. **Tak ada refund.** Pesanan dibayar lalu dibatalkan outlet hanya memicu notifikasi "dibatalkan".
   Tak ada catatan, tak ada antrean, pusat tak tahu.

Ditambah: pesanan yang tak disadari outlet (tablet mati, suara mati) tak terlihat oleh siapa pun.

## 2. Cakupan

**Masuk:** jam buka + batas pesan terakhir (gateway) · tutup sementara & tutup semua · menu habis per
outlet · halaman Pesanan Aplikasi (tertahan + refund) · halaman Pengaturan Aplikasi (6 setelan) ·
log perubahan · cek role di server · perubahan APK Android yang diperlukan (termasuk cek versi minimum).

**Tidak masuk (tahap berikutnya):** Ringkasan jadi papan pantau, halaman Pelanggan, kurasi Menu
Terlaris (tahap 2) · voucher & biaya Xendit (tahap 3) · broadcast (tahap 4) · refund otomatis Xendit ·
notifikasi ke pusat · aplikasi iOS (`mobile/customer-ios-app`) — gateway tetap kompatibel mundur,
iOS menyusul.

## 3. Data (migration baru, semua aditif)

### 3.1 `public.app_pengaturan` — satu baris

| Kolom | Tipe | Bawaan | Dipakai |
|---|---|---|---|
| `id` | smallint PK, `CHECK (id = 1)` | 1 | — |
| `menit_pesan_terakhir` | int, `CHECK 0..180` | 30 | gateway: tolak checkout N menit sebelum tutup |
| `menit_tertahan` | int, `CHECK 1..120` | 10 | admin: batas merah Pesanan Aplikasi |
| `estimasi_siap` | text, ≤ 40 char | `'15–20 menit'` | APK: layar status & sukses |
| `wa_cs` | text, format `62…` atau NULL | NULL | APK: tombol "Hubungi CS" |
| `versi_minimum_android` | int ≥ 1 | 1 | APK: blokir & minta update bila `versionCode` < ini |
| `url_syarat` / `url_privasi` | text NULL | NULL | APK: Profil |
| `diubah_oleh` / `diubah_pada` | uuid / timestamptz | — | log |

Tabel baru bertipe kolom, **bukan** `global_settings` (kolom `value` TEXT, jebakan string JSON
berlapis — lihat memori `global-settings-jsonb-quote-trap`).

### 3.2 `public.outlet_tutup_sementara`

| Kolom | Keterangan |
|---|---|
| `id` uuid PK | |
| `outlet_id` uuid NULL FK outlets | **NULL = semua outlet** |
| `sampai` timestamptz NOT NULL | aktif lagi otomatis setelah ini |
| `alasan` text NULL, ≤ 120 | tampil ke pelanggan |
| `dibuat_oleh`, `dibuat_pada` | |
| `dicabut_oleh`, `dicabut_pada` NULL | "Buka sekarang" sebelum `sampai` |

Aktif bila `dicabut_pada IS NULL AND now() < sampai`. **Tidak ada job terjadwal** — "aktif lagi
otomatis" adalah akibat pembacaan berbasis waktu, jadi tak bisa lupa dan tak butuh cron.
Riwayat tetap tersimpan (tak pernah dihapus).

### 3.3 `retail.refund_pesanan`

| Kolom | Keterangan |
|---|---|
| `id` uuid PK · `order_id` uuid UNIQUE FK orders | satu refund per pesanan |
| `draft_id`, `customer_id`, `outlet_id` | disalin dari `retail.order_drafts` |
| `nominal` numeric | `order_drafts.total_amount` (yang benar-benar dibayar) |
| `status` text `CHECK IN ('perlu','sudah')` | |
| `catatan`, `diproses_oleh`, `diproses_pada` | diisi saat "Sudah dikembalikan" |
| `dibuat_pada` | |

**Diisi trigger** `AFTER UPDATE OF status ON orders` dengan
`WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.sales_source = 'app')`,
hanya bila draft terkait berstatus `dibayar`. `ON CONFLICT (order_id) DO NOTHING` (idempoten bila
dibatalkan dua kali). Trigger, bukan route gateway: pemanggilan `notify-app-status` dari POS bersifat
*fire-and-forget* dan bisa hilang; trigger tidak. `WHEN` di tingkat trigger membuat baris `orders`
lain (±1.000/hari) tak menjalankan fungsi sama sekali.

### 3.4 `public.app_retail_log`

`id`, `aksi` (text: `pengaturan_ubah`, `tutup_sementara`, `buka_sekarang`, `jam_ubah`,
`menu_habis_ubah`, `refund_selesai`), `sasaran_id` uuid NULL, `data` jsonb (nilai sebelum & sesudah),
`oleh`, `pada`. Hanya INSERT; tak ada UPDATE/DELETE.

### 3.5 Hak akses (semua tabel baru)

`REVOKE ALL FROM anon, authenticated` lalu:
- SELECT `TO authenticated USING (is_owner_or_admin())`.
- Tulis **hanya lewat server action** admin-dashboard dengan service role **setelah cek role di
  server** (pola `requireOpnameApprover`, Session 2026-07-20) — tak ada policy INSERT/UPDATE untuk
  `authenticated`.
- Gateway membaca dengan service role (sudah begitu untuk `outlets`/`menu_items`).

Trigger refund `SECURITY DEFINER SET search_path = public, retail` (pelajaran `ledger_stamp_saldo`
dan `bbs_tulis_riwayat`: trigger INVOKER di tabel tanpa policy tulis gagal senyap/rollback).

## 4. Gateway (`apps/retail-gateway`)

### 4.1 Fungsi murni baru `lib/jamBuka.ts` (TDD)

```ts
statusOutlet(input: {
  sekarang: Date                     // dihitung dalam Asia/Jakarta
  openHour: string | null            // 'HH:MM:SS'
  closeHour: string | null
  isActive: boolean
  tutupSementara: { sampai: Date; alasan: string | null } | null  // yang berlaku (outlet atau semua)
  menitPesanTerakhir: number
}): {
  bisaPesan: boolean
  alasan: 'buka' | 'nonaktif' | 'tutup_sementara' | 'belum_buka' | 'sudah_tutup' | 'lewat_pesan_terakhir'
  bukaLagi: Date | null               // untuk teks "buka 14.00" / "buka lagi 25 Sep"
  pesanTerakhir: Date | null
  alasanTutup: string | null          // alasan tutup sementara
}
```

Aturan:
- `open_hour` atau `close_hour` NULL → dianggap buka sepanjang hari (outlet tanpa data jam tak
  terkunci diam-diam).
- `close_hour <= open_hour` → jam tutup lewat tengah malam (tak dipakai sekarang, tapi tak boleh salah).
- Pesan terakhir = `close_hour − menitPesanTerakhir`; di antara itu dan jam tutup → `lewat_pesan_terakhir`.
- Tutup sementara menang atas jam buka; bila outlet & "semua" sama-sama aktif, pakai `sampai` terjauh.
- Zona waktu **wajib Asia/Jakarta**, bukan UTC server (pelajaran drop-ship: `current_date` UTC).

### 4.2 `GET /api/v1/outlets` — field tambahan (aditif)

`open_hour`, `close_hour`, `bisa_pesan`, `alasan`, `buka_lagi`, `pesan_terakhir`, `alasan_tutup`.
`is_active` **dipertahankan** dengan arti lama (APK lama tetap jalan). Outlet tutup tetap
dikirim — pelanggan tetap bisa melihat menu.

### 4.3 Katalog — menu habis per outlet

`ambilKatalog(outletId)`:
- Buang item yang `available_outlets` terisi dan tak memuat `outletId` (dijual di outlet lain saja).
- Tandai `is_available = false` untuk id di `kiosk_settings.unavailable_menu_ids` outlet itu
  (dibaca dengan aturan bobot yang sama dengan POS `app/page.tsx`: baris outlet > PUSAT > global).
  Item tetap dikirim (pelanggan lihat "Habis"), bukan dibuang.
- `auto_unavailable_menu_ids` / `force_available_menu_ids` diikutkan dengan aturan POS yang sama,
  agar kasir & aplikasi selalu sepakat.
- Cache 5 menit tetap; **checkout memakai katalog segar** (`paksaSegar`) sehingga menu yang baru
  ditandai habis ditolak saat bayar walau daftar di HP masih lama.

### 4.4 `POST /api/v1/checkout/validate` dan `POST /api/v1/orders`

Tolak bila `statusOutlet(...).bisaPesan = false` dengan kode yang bisa dibaca APK:
`outlet_tutup` + pesan manusia, mis. *"Outlet sedang tutup, buka lagi pukul 14.00."*
Pengecekan di **kedua** endpoint: `validate` untuk umpan balik cepat, `orders` karena itu titik
pembuatan tagihan QRIS. Draft yang sudah dibuat sebelum tutup dan dibayar sesudahnya **tetap
diterima** (uang sudah diambil); batas pesan terakhir 30 menit adalah penyangganya.

### 4.5 `GET /api/v1/config` (baru, publik, cache 60 dtk)

`{ estimasi_siap, wa_cs, versi_minimum_android, url_syarat, url_privasi }`. Gagal baca DB →
kembalikan bawaan (aplikasi tak boleh terkunci karena config gagal).

## 5. Admin-dashboard (`apps/admin-dashboard`, grup App Retail)

Semua aksi tulis = server action: cek role OWNER/ADMIN di server → tulis dengan service role →
tulis `app_retail_log` dalam urutan yang sama. Nav tetap `roles: ['OWNER','ADMIN']`.

### 5.1 Outlet Aplikasi (dikembangkan)

Per baris outlet, tambahan:
- **Status sekarang** dari `statusOutlet` yang **sama**: `jamBuka.ts` **disalin** ke
  `apps/admin-dashboard/src/lib/appRetail/jamBuka.ts` beserta berkas test-nya, identik
  (preseden `printLayout.ts` di 3 app). Bukan lewat `GET /api/v1/outlets`, karena endpoint itu hanya
  memuat outlet `app_enabled` sedangkan halaman ini juga menampilkan yang mati. Admin melihat apa
  yang dilihat pelanggan.
- **Jam buka/tutup** bisa diubah (menulis `outlets.open_hour/close_hour`).
- **Tutup sementara** → dialog: sampai [tutup hari ini | besok buka | tanggal-jam] + alasan.
  Saat aktif: badge "Tutup s/d …" + tombol **Buka sekarang**.
- **Menu habis** → dialog daftar menu aplikasi outlet itu dengan saklar; menulis
  `kiosk_settings.unavailable_menu_ids` baris outlet itu (daftar yang **sama** dengan POS), dalam
  **format yang sama persis** dengan yang dibaca `parseIds` di POS — periksa bentuk nilai yang ada di
  DB sebelum menulis, jangan diasumsikan. Id menu lain di daftar itu (yang bukan menu aplikasi)
  wajib dipertahankan, bukan ditimpa.
  Sebelum rilis: tampilkan isi 4 outlet yang sudah punya daftar (terakhir 24 Agu) untuk ditinjau owner.

Di atas tabel: tombol **Tutup semua outlet** (dialog yang sama, `outlet_id = NULL`).

### 5.2 Pesanan Aplikasi (baru, `/dashboard/app-retail/pesanan`)

- **Tab "Hari ini":** pesanan `sales_source='app'` hari ini (WIB), terbaru di atas, dengan status.
  **Tertahan** = `status='preparing' AND kitchen_receipt_printed = false AND now() − dibuat > menit_tertahan`
  → baris merah di paling atas + nomor telepon outlet. (Sinyal ini andal: pesanan aplikasi masuk
  `preparing` tanpa cetak dapur, dan tombol POS "Mulai Masak" yang men-set `kitchen_receipt_printed`.)
- **Tab "Perlu dikembalikan":** `retail.refund_pesanan` status `perlu`: waktu, outlet, nomor
  pesanan, nominal, nama & WA pelanggan (tautan `wa.me`). Tombol **Sudah dikembalikan** → dialog
  catatan/referensi wajib → status `sudah` + log + notifikasi pelanggan (tipe `order_status`,
  "Dana Rp X untuk pesanan #N sudah dikembalikan").
- Tab "Selesai dikembalikan" untuk riwayat.

Data dibaca dengan paginasi eksplisit (`.range()`), bukan `.select()` polos — pelajaran batas 1.000
baris PostgREST.

### 5.3 Pengaturan Aplikasi (baru, `/dashboard/app-retail/pengaturan`)

Formulir 6 setelan §3.1 dengan validasi yang sama dengan `CHECK` DB, plus **Riwayat perubahan**
(20 entri terakhir `app_retail_log`, semua aksi, siapa & kapan).

## 6. APK Android (`mobile/customer-app`)

Semua tambahan dibaca dari field baru; field tak ada → perilaku lama (tahan terhadap gateway lama).

1. **Cek versi minimum** saat start: `GET /config` → bila `BuildConfig.VERSION_CODE < versi_minimum_android`
   tampilkan layar penuh "Perbarui aplikasi" + tombol ke Play Store, tanpa jalan pintas. Gagal
   memuat config → lanjut (jangan kunci pelanggan karena jaringan). **Wajib ada di APK ini**, supaya
   update tahap 3 bisa dipaksakan.
2. **Status outlet:** Pilih Outlet & kepala Beranda/Menu menampilkan "Tutup · buka 14.00" /
   "Tutup sementara · buka lagi 25 Sep · Renovasi" / "Pesan terakhir 21.30". Menu tetap bisa dilihat;
   tombol tambah ke keranjang & checkout nonaktif dengan teks alasan.
3. **Galat `outlet_tutup`** saat checkout ditampilkan dengan pesan dari gateway (bukan "gagal memuat").
4. **Estimasi siap** di layar status & sukses dari config (ganti "~15–20 mnt" tertanam).
5. **Hubungi CS** (WA) di Profil & layar pesanan dibatalkan; tampil hanya bila `wa_cs` terisi.
6. **Syarat & Kebijakan Privasi** di Profil; tampil hanya bila URL terisi.
7. Naikkan `versionCode` 1 → 2.

## 7. Galat & tepi

| Kasus | Perilaku |
|---|---|
| Admin salah isi jam (tutup < buka tak disengaja) | Validasi form: minta konfirmasi "melewati tengah malam?" |
| Tutup sementara `sampai` di masa lalu | Ditolak form |
| Dua tutup sementara bertumpuk | Diizinkan; berlaku yang `sampai`-nya terjauh |
| Pesanan dibatalkan sebelum dibayar | Tak ada refund (draft bukan `dibayar`) |
| Pesanan dibatalkan dua kali / dibuka lagi | Satu baris refund (`UNIQUE`), status tak di-reset |
| Kiosk POS & aplikasi menandai habis bersamaan | Satu daftar yang sama — tak mungkin bertentangan |
| DB tak terjangkau saat baca `app_pengaturan` di gateway | Pakai bawaan (30 mnt), jangan buka 24 jam |

## 8. Pengujian

- **Unit (TDD):** `statusOutlet` — buka, belum buka, lewat pesan terakhir, sudah tutup, tanpa data jam,
  lewat tengah malam, tutup sementara outlet vs semua, zona WIB di sekitar 00.00–07.00 WIB.
  Penyaring katalog `available_outlets` + bobot `kiosk_settings`. Perbandingan versi di APK.
- **DB:** uji SQL dalam transaksi + `ROLLBACK`, masing-masing dengan kontrol negatif yang benar-benar
  gagal: trigger refund (app dibayar → 1 baris; belum dibayar → 0; bukan app → 0; batal dua kali → 1),
  RLS (crew/anon tak bisa baca tabel baru), `CHECK` pengaturan.
- **Manual di HP:** outlet tes dengan jam dimundurkan → "Tutup · buka …", checkout ditolak; tutup
  sementara 5 menit → aktif lagi sendiri; tandai menu habis → tampil "Habis" & ditolak saat bayar;
  batalkan pesanan uji di POS → muncul di "Perlu dikembalikan"; `versi_minimum_android = 99` →
  layar perbarui, kembalikan ke 1.

## 9. Rilis

1. Migration (tabel + trigger + seed `app_pengaturan`) → verifikasi katalog DB, bukan exit code.
2. Owner meninjau isi `unavailable_menu_ids` 4 outlet (§5.1) **sebelum** gateway baru dideploy,
   karena begitu dideploy menu itu langsung hilang dari aplikasi di outlet tsb.
3. Redeploy `retail-gateway` + `admin-dashboard`.
4. Build & rilis APK `versionCode 2`.
5. Isi Pengaturan Aplikasi (WA CS, URL S&K/privasi) sebelum rilis Play Store.
