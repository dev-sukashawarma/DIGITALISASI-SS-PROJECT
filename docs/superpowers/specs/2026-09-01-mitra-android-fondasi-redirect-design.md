# Sub-proyek 0 — Fondasi & Redirect Mitra (Android)

**Tanggal:** 2026-09-01
**Repo:** `SUPER-APPS-SS-MOBILE` (native Android, Kotlin + Compose)
**Status:** Disetujui untuk dilanjutkan ke rencana implementasi

## Latar

Permintaan awal: *"ketika login dengan role mitra maka akan langsung diarahkan ke dashboard mitra."*

Redirect-nya sendiri sepele. Yang tidak sepele: **dashboard mitra belum ada** di app Android. Rute app hari ini cuma `login` → `home` → `absensi` (`MainActivity.kt`), dan `HomeScreen` menampilkan satu tile (Absensi) tanpa gating role sama sekali.

Portal mitra di web (`apps/admin-dashboard/src/app/dashboard/mitra/`) berisi ~3.000 baris di 5 halaman. Paritas penuh dipilih sebagai tujuan akhir, lalu dipecah jadi 6 sub-proyek. Dokumen ini hanya mencakup **sub-proyek 0**.

### Peta sub-proyek (konteks, bukan cakupan dokumen ini)

| # | Sub-proyek | Catatan |
|---|---|---|
| **0** | **Fondasi & Redirect Mitra** | **Dokumen ini.** Memblokir semua yang lain. |
| 0,5 | ROI/BEP jadi RPC bersama | Logika `mitraRoi.ts` masih TypeScript; kalau ditulis ulang di Kotlin, angka ROI di HP dan web akan divergen. |
| 1 | Dashboard Saya | Terbesar. Membentuk lapisan data yang dipakai 2–5. |
| 2 | Transfer Bagi Hasil | `mitra_transfers` + unduh bukti via signed URL. |
| 3 | Tim Outlet | Daftar crew/leader. |
| 4 | Saran & Kritik | Satu-satunya alur tulis milik mitra. |
| 5 | Riwayat Orderan | Terberat (padanan `ReportsView`). Sengaja terakhir. |

2, 3, dan 4 saling independen setelah 1 selesai.

## Temuan yang mendasari desain

Diverifikasi langsung ke DB produksi (`khpkoreaaucvyqfhynfq`), read-only.

### Akun mitra ada di `outlet_staff` — login Android tidak perlu diubah

Kekhawatiran awal: `AppSession.loadStaffOrSignOut()` menolak siapa pun tanpa baris `outlet_staff` aktif, sedangkan portal mitra web bekerja di atas `mitra_profiles`. Ternyata **semua 18 akun role `mitra` punya baris `outlet_staff` berstatus `active`**. Alur login yang ada meloloskan mereka; tidak perlu jalur autentikasi khusus mitra.

### Setengah akun mitra tidak punya profil

| Fakta | Angka |
|---|---|
| Akun `outlet_staff` role `mitra` | 18, semua `active` |
| Punya `mitra_profiles` | 9 |
| Tanpa profil (yatim) | 9 |
| Mitra dengan >1 outlet | 0 |
| `outlet_staff.outlet_id` = `mitra_profiles.outlet_ids[1]` | 9 dari 9 cocok |

Tiap outlet mitra punya **dua** akun: satu bernama orang (dibuat 8 Agustus, punya profil) dan satu bernama outlet (gelombang 3 Agustus, yatim).

**Cileungsi menyimpang:** profilnya menempel di akun generik `mitra_cileungsi`, sedangkan akun bernama orang `mitra_wati` justru yatim. Dikonfirmasi pemilik produk: `mitra_wati` **seharusnya** yang punya profil.

### RLS sudah ramah mobile — tidak perlu policy baru

| Tabel | Policy baca | Ekspresi |
|---|---|---|
| `mitra_profiles` | `mitra_profiles_select_own` | `user_id = auth.uid()` |
| `mitra_investments` | `mitra_investments_select_own` | via `unnest(outlet_ids)` profil sendiri |
| `mitra_transfers` | `mitra_transfers_select_own` | via `unnest(outlet_ids)` profil sendiri |
| `mitra_suggestions` | `_select_own` + `_insert_own` | `user_id = auth.uid()` |

Android bisa query PostgREST langsung memakai JWT user. Sub-proyek 2 dan 4 nanti juga tidak butuh perubahan DB.

## Prasyarat data (DB produksi)

Dijalankan **terpisah dari kode**, hanya setelah persetujuan eksplisit. Urutan wajib:

1. Pindahkan `mitra_profiles` milik Cileungsi dari `user_id` `mitra_cileungsi` ke `mitra_wati`.
2. Set `status = 'inactive'` pada 9 akun generik: `mitra_cibinong`, `mitra_cibubur`, `mitra_cicurug`, `mitra_ciseeng`, `mitra_kalisari`, `mitra_paledang`, `mitra_pekayon`, `mitra_sentul`, `mitra_cileungsi`.

Terbalik urutannya, Cileungsi kehilangan akses sepenuhnya — akun yang memegang profilnya dinonaktifkan sebelum profil itu dipindah.

**Risiko diketahui:** verifikasi `last_sign_in_at` untuk akun generik tidak dijalankan (ditolak saat sesi desain). Asumsi yang dipakai: tidak ada mitra yang masih login memakai akun generik. Kalau asumsi ini salah, orang tersebut terkunci keluar tanpa peringatan — di web maupun Android.

Setelah langkah ini, akun generik tidak lagi bisa login sama sekali — `loadStaffOrSignOut()` menolak status non-`active` sebelum profil mitra sempat diperiksa. Keadaan "tanpa profil" jadi praktis tak terjangkau. Penanganannya tetap dibangun (lihat di bawah) karena provisioning bisa keliru lagi; separuh akun sudah pernah begitu.

## Desain

### Model & sesi

`MitraProfile`: `id`, `userId`, `namaMitra`, `outletIds: List<String>`, `profitSharingPct`, data bank (nama, nomor, pemilik), `noPks`, `tanggalPks`, `tanggalBerakhirPks`, `status`.

`MitraRepository.getProfile(userId): MitraProfile?` — PostgREST, mengikuti pola `StaffRepository`.

`AppSession` mendapat `mitraProfile: StateFlow<MitraProfile?>`, dimuat tepat setelah `StaffProfile` dan **hanya bila role = MITRA**. Dimuat di **dua** jalur: `login()` dan `tryAutoLogin()`. Jalur auto-login inilah yang biasanya terlupa; akibatnya app terlihat benar saat login pertama lalu jadi layar kosong keesokan harinya.

`outletIds` dimodelkan jamak meski semua mitra hari ini single-outlet: kolom DB-nya memang array, dan menampungnya sekarang nyaris tanpa biaya.

### Routing

- `Routes.MITRA` baru.
- Satu fungsi murni `resolveStartDestination(staff, mitraProfile)` menjadi **satu-satunya** penentu tujuan, dipakai `RootNav` maupun callback login. Dua tempat menebak aturan role sendiri-sendiri adalah persis penyakit yang pernah terjadi di guard approval `apps/stok`.
- Untuk mitra, `HOME` dan `ABSENSI` **tidak didaftarkan sama sekali** di NavHost — tidak ada jalan ke sana lewat Back maupun deep link. Ini mencerminkan route-guard web (`RoleContext.tsx:67`) yang mengunci mitra ke `/dashboard/mitra/*`.

### Tiga keadaan mitra

| Keadaan | Layar |
|---|---|
| Punya profil | `MitraDashboardScaffold` |
| Tanpa profil | `MitraNoProfileScreen` — "hubungi admin pusat" + Keluar |
| Gagal memuat profil (jaringan/server) | Pesan galat + Coba lagi |

Keadaan 2 dan 3 **wajib dibedakan**. Kalau disamakan, mitra dengan sinyal jelek disuruh menelepon admin pusat untuk masalah yang akan hilang sendiri.

### Layar tujuan

`MitraDashboardScaffold` minimal: sapaan `nama_mitra`, nama outlet, badge status, tombol Keluar. Sengaja kosong — isinya pekerjaan sub-proyek 1. Nilainya di sini: alurnya bisa dites di HP nyata dengan akun `mitra_anis`.

### Berkas

**Baru:** modul `feature/mitra` (`MitraDashboardScaffold`, `MitraNoProfileScreen`), `MitraProfile.kt`, `MitraRepository.kt`, `MitraRouting.kt`.
**Diubah:** `AppSession.kt`, `MainActivity.kt`, `settings.gradle.kts`.

### Pengujian

`resolveStartDestination` dan pemetaan tiga keadaan dibuat sebagai fungsi murni tanpa dependensi Android, sehingga bisa diuji unit sungguhan. Sisanya smoke test manual di HP fisik dengan akun mitra nyata.

## Di luar cakupan

KPI, omzet, ROI/BEP, tren harian, orderan, menu terlaris, transfer bagi hasil, tim outlet, saran & kritik. Semua itu sub-proyek 1–5.

---

## Temuan yang sengaja ditunda (hasil eksekusi, 2026-09-01)

Ditemukan oleh review menyeluruh saat sub-proyek 0 dieksekusi. Semuanya **belum menggigit hari ini** karena layar mitra masih kosong — tapi ketiga yang pertama **wajib diputuskan sebelum sub-proyek 1 menampilkan angka uang**.

| # | Temuan | Kenapa ditunda | Kapan wajib digarap |
|---|---|---|---|
| F5 | `MitraRepository.getProfile` memakai `limit=1` tanpa `order` — kalau satu user punya dua baris `mitra_profiles`, app diam-diam mengambil mana saja yang lebih dulu dikembalikan Postgres | Butuh keputusan: tambah `order` deterministik, atau perlakukan `size() > 1` sebagai anomali yang dilaporkan | Sebelum sub-proyek 1. Provisioning mitra **sudah pernah salah sekali** (9 akun yatim + profil Cileungsi menempel di `user_id` keliru), dan perbaikan manual Task 0 memindahkan `user_id` — persis operasi yang bisa meninggalkan duplikat |
| F6 | `resolveStartDestination` mengabaikan `MitraProfile.isAktif` — mitra yang kemitraannya sudah berakhir tetap mendarat di `MITRA_DASHBOARD`, bedanya cuma badge merah | Tak berbahaya selama layarnya kosong | Sebelum sub-proyek 1, atau mantan mitra terus melihat keuangan outlet |
| F7 | Dashboard menampilkan `staff?.outletName`, yang diturunkan dari `outlet_staff.outlet_id` **dan ditimpa baris absensi hari ini** (mekanisme BKO/mutasi harian) — padahal sumber kebenaran outlet mitra adalah `mitra_profiles.outlet_ids` | Audit menunjukkan keduanya cocok 9/9 hari ini, jadi masih kosmetik | Saat sub-proyek 1 memakai outlet untuk memfilter angka. Override absensi membuatnya lebih buruk dari sekadar beda statis |
| F9 | `app/build.gradle.kts` punya dua blok `dependencies { }` berisi daftar `project(...)` identik | Pre-existing & repo-wide; merapikannya menyeret diff branch fondasi ke luar cakupan | Commit pembersihan tersendiri. Akan menggigit orang yang menambah dependency ke satu salinan saja |
| F10 | `feature/mitra` mendeklarasikan 4 dependency tak terpakai (`navigation-compose`, `activity-compose`, `core:network`, Hilt+kapt) | Byte-identik dengan `feature/home` — itu konvensi repo, bukan cacat branch ini | Bersamaan dengan F9. Biayanya satu putaran kapt tiap build modul |

Dua hal lain yang sudah **diverifikasi aman** dan tidak perlu digarap: rute `home`/`absensi` yang tetap terdaftar saat logged out **tidak** punya permukaan deep link (manifest hanya punya intent-filter MAIN/LAUNCHER), dan `NavGraph.equals` bersifat struktural termasuk `startDestinationId` — dikonfirmasi dari bytecode androidx.navigation 2.7.7 — sehingga back stack tidak ter-reset oleh recomposition biasa, sekaligus itulah yang membuat transisi retry-berhasil bekerja.

---

## Utang teknis app-wide: buka app tanpa jaringan menghapus sesi (ditemukan saat smoke test, 2026-09-02)

**Bukan cacat sub-proyek ini.** Diverifikasi: tak satu pun dari 8 commit branch `feat/mitra-fondasi-redirect` menyentuh blok `tryAutoLogin`. Berlaku untuk **semua role**, bukan hanya mitra.

**Gejala.** Buka app saat tidak ada koneksi → langsung ke layar login. Bukan cuma tampilan: refresh token di disk ikut terhapus, jadi setelah jaringan pulih pengguna wajib mengetik password lagi.

**Mekanisme** (dari kode, bukan dugaan):

1. `SessionTokenHolder.accessToken` hanya hidup di memori — hilang begitu proses di-kill. Yang persisten di `AuthPrefs` hanya refresh token.
2. Cold start memanggil `AppSession.tryAutoLogin()` → `AuthSessionManager.ensureAuthenticated()`. Token memori kosong, jadi `isUsable(null)` = false → masuk `refresh()`.
3. `refresh()` memanggil `authApi.refreshSession(...)`; tanpa jaringan ia melempar exception, ditangkap `catch (e: Exception) { e.printStackTrace(); false }`.
4. `tryAutoLogin` menjalankan `if (ok) loadStaffOrSignOut() else signOut()` — dan `AppSession.signOut()` memanggil `AuthSessionManager.signOut()`, yang menjalankan `AuthPrefs.clear()`.

**Akar masalah:** `refresh()` mengembalikan `false` yang sama untuk dua hal yang sangat berbeda — **refresh token ditolak server** (memang harus logout) dan **tidak ada koneksi** (seharusnya sesi dipertahankan). Pemanggil tak punya cara membedakannya, jadi memperlakukan keduanya sebagai logout.

Ini persis penyakit yang sudah diperbaiki satu tingkat di bawahnya untuk mitra (`mitraLoadFailed` memisahkan "tidak punya profil" dari "gagal memuat"), tapi masih hidup di lapisan auth di atasnya.

**Dampak nyata:** crew yang membuka app absensi di area sinyal jelek kehilangan sesinya dan harus login ulang. Mitra pun sama.

**Konsekuensi untuk pengujian:** skenario "cold start tanpa jaringan harus memunculkan layar Gagal Memuat Data Kemitraan" di rencana sub-proyek 0 **tidak mungkin tercapai** — proses tak pernah sampai ke pemuatan profil mitra. Layar `MITRA_LOAD_ERROR` hanya terjangkau bila autentikasi berhasil tetapi khusus query `mitra_profiles` yang gagal. Pembedaan itu sendiri tetap benar dan sudah dipin unit test.

**Arah perbaikan bila digarap:** buat `refresh()` membedakan kegagalan jaringan dari penolakan kredensial (mis. kembalikan sealed result, bukan `Boolean`), lalu `tryAutoLogin` hanya `signOut()` pada penolakan kredensial. Menyentuh jalur auth semua role, jadi layak jadi pekerjaan tersendiri dengan spec dan review sendiri.
