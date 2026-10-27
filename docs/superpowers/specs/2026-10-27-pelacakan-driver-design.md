# Pelacakan Driver Distribusi — Desain

**Tanggal:** 2026-10-27
**Status:** Disetujui owner (sesi grilling 14 keputusan), belum dikerjakan
**App:** `apps/distribusi` (web), `mobile/native-superapp` (Android), Supabase (DB)
**Rilis:** sekaligus (keputusan Q14)

## 1. Tujuan

Pusat (kitchen, admin, purchasing, owner, developer) bisa melihat **di mana driver
sekarang** dan **SJ mana yang sudah sampai** — di web distribusi. Outlet penerima
melihat status ringkas kiriman miliknya. Posisi dikirim dari app native superapp
di HP driver.

Bukan tujuan: mengubah alur stok surat jalan. Pelacakan adalah **lapisan di atas**
alur yang sudah ada; trigger potong stok, saldo vendor, verifikasi outlet, dan
auto-verifikasi malam tidak disentuh.

## 2. Keputusan owner (grilling 2026-10-27)

| # | Keputusan |
|---|---|
| Q1 | Checkpoint per kiriman **+** lokasi live selama perjalanan |
| Q2 | Lokasi dari app native; web hanya membaca (realtime), peta Leaflet/OSM |
| Q3 | GPS terikat ke **perjalanan**; satu perjalanan membawa banyak SJ ke banyak outlet |
| Q4 | Kitchen tetap menandai SJ `dikirim` (stok gudang terpotong seperti sekarang). Driver memilih SJ `dikirim` yang belum dibawa siapa pun, lalu "Berangkat" |
| Q5 | "Tiba" mencatat jam + koordinat + jarak ke outlet. **Tidak menolak**, tidak mengubah status SJ, tidak menyentuh stok |
| Q6 | Kirim posisi tiap 30 dtk **atau** pindah ≥100 m (mana duluan); diam = tidak kirim; antre offline di HP; interval diatur dari pusat |
| Q7 | Titik rute dihapus setelah **2 bulan**; ringkasan perjalanan permanen |
| Q8 | Outlet melihat status ringkas SJ-nya (driver, jam berangkat, "N outlet lagi") — **tanpa peta, tanpa koordinat** |
| Q9 | Sistem mengusulkan urutan, driver mengoreksi saat Berangkat & boleh ubah di jalan; Tiba lompat urutan tetap dicatat |
| Q10 | Tombol "Selesaikan Perjalanan" + "tiba dari verifikasi outlet" + penutupan otomatis 21:00 WIB |
| Q11 | SJ yang dibawa kurir eksternal berjalan seperti sekarang, label "tidak dilacak"; nama tanda tangan Supir internal dari akun driver |
| Q12 | Halaman `/distribusi/driver` + satu baris di detail SJ + kartu ringkas di dashboard |
| Q13 | Didesain untuk **HP pribadi**: izin "saat aplikasi digunakan" + foreground service location, panduan baterai/Autostart |
| Q14 | Semua dalam satu rilis |

## 3. Fakta lapangan yang membentuk desain (dicek 2026-10-27)

- Driver: **1 orang** (`Adam Sandy Rakhman`, `02a653e1-…`, status active).
- `outlets.lat/lng` terisi untuk 22 dari 23 outlet aktif internal+mitra.
  **Gudang Pusat (`d23e11b3-…`) belum punya koordinat** → titik awal usulan urutan
  memakai posisi GPS driver saat menekan Berangkat, bukan koordinat gudang.
- `accessible_outlet_ids()` di DB live **sudah memuat `driver`** (diterapkan manual,
  tak terstempel; berkas `20300254010700_allow_driver_role_accessible_outlets.sql`
  masih untracked dan bertimestamp 2030 → ditolak lint CI).
  Akibat sampingan: policy `surat_jalan_update_scoped` (`outlet_id IN accessible_outlet_ids()`)
  kini membolehkan driver **UPDATE semua surat jalan**. Ditutup di desain ini (§6.6).
- Tabel lokasi lama (`staff_live_locations`, `staff_location_trails`) **sudah tidak ada**
  di DB; `apps/monitoring` `LiveLocationBoard` membaca tabel yang hilang. Komponen
  peta Leaflet-nya (`LiveLocationMap.tsx`) dipakai sebagai **pola**, bukan dependensi.
- Native superapp: satu modul `:app`, supabase-kt 3.0.3 (postgrest, auth, realtime),
  lokasi hanya one-shot (`LocationHelper.getCurrentLocation`), **manifest belum
  mendeklarasikan `ACCESS_FINE_LOCATION`** (bug laten absensi juga), tidak ada
  service, tidak ada penyimpanan lokal (Room/DataStore), belum pernah memanggil RPC.
- Perubahan driver yang belum di-commit di working tree memasukkan `driver` ke
  `isPusat` di 4 tempat → driver bisa "Validasi & tutup" SJ (`handleVerifyPusat`).
  Diganti dengan `isDriver` tersendiri (§7.4).

## 4. Konsep

```
perjalanan (1 driver, 1x Berangkat, GPS menyala)
  ├─ stop 1: SJ → Outlet Empang      tiba 10:12 · 35 m · sumber driver
  ├─ stop 2: SJ → Outlet Pajajaran   tiba 10:47 · sumber verifikasi_outlet
  └─ stop 3: SJ → Outlet Dramaga     menunggu
  → semua stop selesai  = perjalanan selesai, GPS mati
```

Satu stop = satu SJ. Dua SJ ke outlet yang sama = dua stop dengan urutan
berdampingan (tiba bisa ditandai bersamaan di app).

**Status perjalanan:** `berjalan` → `selesai` (semua stop tuntas / driver menekan
Selesaikan) atau `ditutup_otomatis` (lewat batas jam).

**Status stop:** `menunggu` → `tiba` | `tidak_ditandai` (perjalanan diselesaikan
sebelum ditandai) | `dibatalkan` (SJ dibatalkan di tengah jalan).

**Sumber tiba:** `driver` (ada koordinat & jarak) atau `verifikasi_outlet`
(outlet memverifikasi penerimaan sebelum driver menekan Tiba; tanpa koordinat).

## 5. Model data

### 5.1 `driver_perjalanan`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| driver_id | uuid FK outlet_staff | |
| status | text CHECK (`berjalan`,`selesai`,`ditutup_otomatis`) | |
| berangkat_at | timestamptz | |
| berangkat_lat, berangkat_lng | numeric | posisi saat Berangkat |
| selesai_at | timestamptz null | |
| total_km | numeric null | dihitung saat selesai dari jejak (haversine berurutan) |
| durasi_detik | int null | selesai_at − berangkat_at |
| created_at | timestamptz | |

Unique parsial: satu perjalanan `berjalan` per driver
(`UNIQUE (driver_id) WHERE status = 'berjalan'`).

### 5.2 `driver_perjalanan_stop`
| Kolom | Tipe | Catatan |
|---|---|---|
| id | uuid PK | |
| perjalanan_id | uuid FK CASCADE | |
| surat_jalan_id | uuid FK surat_jalan | |
| outlet_id | uuid FK outlets | disalin dari SJ |
| urutan | int | 1..n, boleh diubah selama `menunggu` |
| status | text CHECK (`menunggu`,`tiba`,`tidak_ditandai`,`dibatalkan`) | |
| tiba_at | timestamptz null | |
| tiba_sumber | text CHECK (`driver`,`verifikasi_outlet`) null | |
| tiba_lat, tiba_lng, tiba_akurasi_m | numeric null | hanya sumber driver |
| tiba_jarak_m | numeric null | jarak ke `outlets.lat/lng`; NULL bila outlet tanpa koordinat |

Unique: `surat_jalan_id` hanya boleh ada di **satu** stop yang tidak `dibatalkan`
(`UNIQUE (surat_jalan_id) WHERE status <> 'dibatalkan'`).

### 5.3 `driver_lokasi_terkini` (1 baris per driver, ditimpa)
`driver_id` PK, `perjalanan_id`, `lat`, `lng`, `akurasi_m`, `kecepatan_mps`,
`arah_derajat`, `baterai_persen`, `direkam_at` (waktu HP), `diterima_at` (now()).
Hanya diperbarui bila `direkam_at` lebih baru (titik antrean offline yang telat
tidak memundurkan pin). Masuk publikasi `supabase_realtime` (begitu juga
`driver_perjalanan` dan `driver_perjalanan_stop`, agar panel stop ikut live;
RLS menjaga outlet tetap tidak menerima event).

### 5.4 `driver_lokasi_jejak` (riwayat titik)
`id` bigint identity, `perjalanan_id`, `driver_id`, `lat`, `lng`, `akurasi_m`,
`direkam_at`, `diterima_at`. Unique `(driver_id, direkam_at)` → kirim ulang
antrean offline idempoten. Index `(perjalanan_id, direkam_at)`.
Dihapus otomatis bila `direkam_at` > 60 hari (§6.5). Tidak masuk realtime
(web menarik jejak perjalanan saat dibuka, pin live dari tabel terkini).

### 5.5 Pengaturan — `global_settings` key `driver_tracking` (jsonb)
```json
{ "interval_detik": 30, "jarak_min_m": 100, "batas_tutup_wib": "21:00", "retensi_hari": 60 }
```
Dibaca app native saat Berangkat dan dikembalikan oleh RPC kirim lokasi
(perubahan berlaku tanpa rilis APK). Nilai bawaan di kode bila baris tak ada.

## 6. Database

Semua tulis dari driver lewat RPC `SECURITY DEFINER SET search_path = public`
yang memeriksa `outlet_staff` (role `driver`, status `active`, `id = auth.uid()`).
Tabel di-`REVOKE ALL FROM anon, authenticated`; hanya `SELECT` yang di-GRANT ke
`authenticated`, lewat RLS.

### 6.1 RLS baca
- **Pusat** (`kitchen, admin, purchasing, owner, developer`, active): baca semua
  dari keempat tabel. Helper baru `is_pelacak_driver()`.
- **Driver**: baca baris miliknya sendiri (`driver_id = auth.uid()`, stop lewat perjalanan).
- **Outlet**: **tidak** membaca tabel ini. Status ringkas lewat RPC §6.3.
- Tulis langsung: tidak ada policy INSERT/UPDATE/DELETE.

### 6.2 RPC driver
| RPC | Isi |
|---|---|
| `driver_sj_siap_dibawa()` | SJ `dikirim`/`dikirim_lengkap`, belum ada di stop aktif, dibuat ≤ 3 hari terakhir; kolom: id, document_number, outlet_id, nama outlet, lat, lng, jumlah item |
| `driver_mulai_perjalanan(p_sj_ids uuid[], p_lat, p_lng)` | cek role & tak ada perjalanan berjalan; cek tiap SJ masih siap dibawa (bila tidak → error berisi nomor SJ); buat perjalanan + stop dengan `urutan` = urutan array; kembalikan id perjalanan + pengaturan |
| `driver_ubah_urutan(p_perjalanan_id, p_stop_ids uuid[])` | hanya stop `menunggu`; urutan baru setelah stop yang sudah tuntas |
| `driver_tandai_tiba(p_stop_id, p_lat, p_lng, p_akurasi_m)` | stop harus `menunggu` milik perjalanan berjalan driver; isi tiba_*, sumber `driver`, jarak haversine ke outlet; boleh lompat urutan; bila semua stop tuntas → selesaikan perjalanan |
| `driver_kirim_lokasi(p_titik jsonb)` | array `{lat,lng,akurasi_m,kecepatan_mps,arah_derajat,baterai_persen,direkam_at}`, maks 500/panggilan; insert jejak `ON CONFLICT DO NOTHING`; upsert terkini bila lebih baru; **kembalikan `{status_perjalanan, pengaturan}`** — app mematikan GPS bila status bukan `berjalan` |
| `driver_selesaikan_perjalanan(p_perjalanan_id)` | stop `menunggu` → `tidak_ditandai`; isi selesai_at, total_km, durasi; status `selesai` |
| `driver_perjalanan_aktif()` | perjalanan berjalan driver + stop berurutan (dipakai app saat dibuka ulang / proses mati) |

Titik yang dikirim untuk perjalanan yang sudah tidak `berjalan` (antrean offline
telat) tetap disimpan ke jejak bila `direkam_at` ≤ `selesai_at`; selebihnya dibuang.

### 6.3 RPC outlet — `status_antar_sj(p_sj_id uuid)`
`SECURITY DEFINER`; hanya mengembalikan baris bila `p_sj_id` milik outlet yang
boleh dibaca pemanggil (`outlet_id IN accessible_outlet_ids()`). Kolom:
`dilacak bool`, `nama_driver`, `berangkat_at`, `status_stop`, `tiba_at`,
`tiba_sumber`, `outlet_sebelum` (jumlah stop `menunggu` dengan urutan lebih kecil).
**Tidak pernah** mengembalikan koordinat.

### 6.4 Trigger di `surat_jalan` — sinkron stop
`AFTER UPDATE OF status`:
- `dikirim/dikirim_lengkap` → `diterima_*` / `selesai`, stop masih `menunggu` →
  `tiba`, sumber `verifikasi_outlet`, `tiba_at = now()`; bila semua stop tuntas →
  perjalanan `selesai` (total_km dihitung).
- → `dibatalkan`, stop `menunggu` → `dibatalkan`.
Trigger hanya menulis tabel pelacakan; tidak menyentuh ledger/stok.
`auto_verifikasi_surat_jalan` (02:00 WIB) ikut memicu ini — perjalanan sudah
ditutup 21:00, jadi stop yang masih `tidak_ditandai` tidak diubah (hanya
`menunggu` yang disentuh).

### 6.5 Jadwal (pg_cron, UTC)
- `driver-tutup-perjalanan` tiap 15 menit: perjalanan `berjalan` ditutup bila jam WIB
  ≥ `batas_tutup_wib` → stop `menunggu` → `tidak_ditandai`, status `ditutup_otomatis`.
- `driver-retensi-jejak` `40 20 * * *` (03:40 WIB): hapus jejak > `retensi_hari`.
  Ringkasan (§5.1) tidak terhapus.

### 6.6 Pengetatan akses yang ikut di rilis ini
1. Berkas untracked `20300254010700_allow_driver_role_accessible_outlets.sql`
   dinamai ulang ke timestamp 2026-10-27 dan distempel (isinya sudah live).
2. `surat_jalan_update_scoped` dan policy UPDATE `surat_jalan_item` ditambah syarat
   pemanggil **bukan** `driver` (driver tak pernah menulis SJ; semua lewat RPC §6.2).
   Diuji: kitchen tetap bisa update, driver ditolak.

## 7. Web — `apps/distribusi`

### 7.1 Halaman `/distribusi/driver` ("Pelacakan Driver")
Hanya `PERAN_PELACAK = ['kitchen','admin','purchasing','owner','developer']`
(cek di halaman; data dilindungi RLS).
- **Peta** (Leaflet + OSM, `next/dynamic` `ssr:false`, pola `LiveLocationMap`):
  pin per driver dengan perjalanan berjalan dari `driver_lokasi_terkini` (realtime),
  polyline jejak perjalanan hari ini, penanda outlet tujuan (abu = menunggu,
  hijau = tiba, merah = tidak_ditandai/jarak > 500 m). Label "diperbarui N lalu":
  normal < 2 mnt, kuning 2–10 mnt, merah > 10 mnt.
- **Panel per perjalanan**: driver, jam berangkat, km berjalan, daftar stop:
  `✓ 10:12 · 35 m`, `✓ dari verifikasi outlet`, `⚠ ditekan 4,2 km dari outlet`,
  `○ menunggu`, `✗ tidak ditandai tiba`, `— dibatalkan`.
- **Tab Riwayat**: pilih tanggal → daftar perjalanan (ringkasan permanen). Tombol
  "lihat rute" hanya bila jejak masih ada (≤ 60 hari).

### 7.2 Detail SJ (`SuratJalanDetail.tsx`)
Satu baris di bawah status: pusat → "Dibawa Adam · berangkat 09:40 · tiba 10:12 ·
[lihat di peta]"; outlet → kalimat dari `status_antar_sj` ("Sedang diantar oleh
Adam · berangkat 09:40 · 2 outlet lagi sebelum outletmu"). SJ tanpa stop →
"tidak dilacak" (pusat saja; outlet tetap melihat "Dalam Transit").

### 7.3 Dashboard & halaman Terima outlet
- Dashboard pusat: kartu "N driver sedang antar · M SJ menunggu tiba → buka peta".
- Halaman Terima outlet: tiap SJ `dikirim` menampilkan kalimat §7.2 (realtime
  lewat invalidasi `surat_jalan` + polling 60 dtk untuk status stop, karena outlet
  tidak berlangganan tabel pelacakan).

### 7.4 Role `driver` di web
`isDriver` tersendiri; driver **dikeluarkan** dari daftar `isPusat` di
`dashboard/page.tsx`, `SuratJalanDetail.tsx`, `SuratJalanList.tsx`,
`useSuratJalanList.ts`. Driver di web: lihat daftar & detail SJ (read-only),
unduh PDF/cetak; tanpa buat SJ, tanpa validasi pusat, tanpa batal PO.
Satu sumber daftar role: `src/lib/peran.ts` (PERAN_PUSAT, PERAN_PELACAK, isDriver).

### 7.5 Tanda tangan Supir
`SignatureFlow` opsi "Supir Internal": dropdown hanya berisi staf aktif ber-role
`driver` (bukan semua staf); bila hanya satu, terpilih otomatis. Opsi
"Vendor / Lalamove" tidak berubah.

## 8. Native — `mobile/native-superapp`

### 8.1 Menu "Pengantaran"
`Roles.PENGANTARAN = setOf("driver")` → `Screen.Pengantaran` → cabang
`NavigationManager` → `DashboardMenu` tile "Pengantaran" → `appMeta` → MainShell.
Driver juga tetap melihat Absensi (tambahkan `driver` ke `Roles.ATTENDANCE` —
driver sudah absen via shift 3 di DB).

### 8.2 Alur layar
1. **Pilih muatan**: daftar `driver_sj_siap_dibawa()` dengan centang.
2. **Urutan**: usulan otomatis (nearest-neighbor dari posisi driver saat ini,
   fungsi murni Kotlin `UsulanUrutan`), driver geser atas/bawah. Tombol **Berangkat**.
3. **Dalam perjalanan**: daftar stop berurutan, tombol **Tiba** per stop
   (stop berikutnya disorot; stop lain tetap bisa ditekan), ubah urutan, banner
   "terakhir terkirim N dtk lalu · M titik menunggu sinyal", tombol
   **Selesaikan Perjalanan** (konfirmasi bila masih ada stop menunggu).
4. Perjalanan selesai/ditutup → ringkasan (km, durasi) → kembali ke langkah 1.

Saat app dibuka (termasuk setelah proses dimatikan), `driver_perjalanan_aktif()`
menentukan layar & menyalakan ulang service bila masih `berjalan`.

### 8.3 Foreground service `PengantaranLocationService`
- `foregroundServiceType="location"`; notifikasi tetap "Sedang mengantar · 2/4 outlet".
- `FusedLocationProviderClient.requestLocationUpdates` dengan
  `Priority.PRIORITY_HIGH_ACCURACY`, `interval = interval_detik`,
  `minUpdateDistanceMeters` tidak dipakai sebagai syarat tunggal; filter di kode:
  kirim bila ≥ interval **atau** ≥ jarak_min sejak titik terakhir terkirim; titik
  yang praktis diam (< 15 m & < interval) dibuang.
- Titik masuk **antrean berkas** (`filesDir/pengantaran_antrean.jsonl`, satu
  baris per titik) lalu dikirim per batch via `driver_kirim_lokasi`; baris dihapus
  setelah sukses. Bertahan bila proses mati.
- Respons `status_perjalanan ≠ berjalan` → service berhenti sendiri.
- Profil staf: service tidak bergantung pada state Compose; memakai sesi auth-kt
  dan RPC (identitas dari `auth.uid()` di server).

### 8.4 Izin & manifest
Tambahkan: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`,
`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`
(Android 13+), `<service android:foregroundServiceType="location">`.
Tidak meminta `ACCESS_BACKGROUND_LOCATION`: service dimulai dari layar yang sedang
terbuka (tombol Berangkat). Layar panduan sekali-jalan: izin lokasi, notifikasi,
"abaikan optimasi baterai" (`ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`), dan
untuk Xiaomi/Oppo/Vivo petunjuk Autostart (deteksi `Build.MANUFACTURER`).
Menambah izin lokasi ke manifest sekaligus memperbaiki bug absensi (§3).

## 9. Privasi
- Lokasi hanya direkam selama perjalanan `berjalan`; mati otomatis paling lambat
  `batas_tutup_wib`.
- Koordinat hanya terbaca pusat & driver sendiri; outlet tidak pernah.
- Titik rute dihapus 60 hari; ringkasan tanpa koordinat rute disimpan.
- Notifikasi tetap selama pelacakan aktif (driver selalu tahu sedang dilacak).

## 10. Di luar cakupan
- ETA menit / perkiraan jam tiba.
- Geofence yang menolak atau auto-tiba.
- Driver ditugaskan oleh kitchen; kurir eksternal dilacak.
- Notifikasi push ke outlet "driver mendekat".
- Memperbaiki `apps/monitoring` LiveLocationBoard yang membaca tabel hilang
  (dicatat sebagai temuan terpisah).

## 11. Risiko & mitigasi
| Risiko | Mitigasi |
|---|---|
| HP pribadi mematikan service (MIUI dll) | panduan baterai/Autostart; banner "terakhir terkirim" di web jujur menunjukkan basi |
| Driver lupa Tiba | tiba dari verifikasi outlet; tutup otomatis 21:00 |
| Antrean offline dikirim dobel | unique `(driver_id, direkam_at)` |
| Titik telat memundurkan pin | upsert terkini hanya bila `direkam_at` lebih baru |
| Driver menulis SJ lewat policy lama | §6.6 pengetatan UPDATE |
| Realtime terkini bocor ke outlet | RLS tabel; outlet hanya via RPC tanpa koordinat |

## 12. Verifikasi
- Uji SQL `supabase/verifikasi/pelacakan_driver/` (transaksi + ROLLBACK, simulasi
  `request.jwt.claims`): mulai/tiba/kirim lokasi/selesai, tolak non-driver,
  tolak SJ ganda, trigger verifikasi outlet, tutup otomatis, retensi, outlet tak
  bisa baca koordinat, driver tak bisa UPDATE surat_jalan, kontrol negatif tiap asersi.
- Vitest web: fungsi murni label status stop & kesegaran lokasi, daftar peran.
- Unit test native: `UsulanUrutan`, filter titik (interval/jarak/diam), antrean
  berkas (tulis/baca/hapus setelah sukses), gating menu driver.
- Uji lapangan HP Adam: satu perjalanan 2+ outlet, layar mati 10 menit, mode
  pesawat 5 menit lalu kembali, app di-kill dari recent apps.

## 13. Deploy
1. Migration DB (applied + stempel + verifikasi katalog).
2. Redeploy `distribusi`.
3. Build & pasang APK baru di HP Adam (versionCode naik).
