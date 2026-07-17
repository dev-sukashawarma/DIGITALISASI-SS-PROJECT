# Native Superapp (Android Kotlin) — Fase 1: Absensi Production-Ready

**Tanggal:** 2026-07-17
**Status:** Approved (brainstorming session)
**Workspace:** `mobile/native-superapp` (Android native — Kotlin + Jetpack Compose)

## Konteks & Keputusan Strategis

- `mobile/native-superapp` (Kotlin + Compose + Supabase Kotlin SDK + ML Kit + TFLite) ditetapkan sebagai **superapp mobile resmi** ke depan. Folder mobile lain (`pos-mobile` RN, `native-pos`, `pos-temp`, `superapp`) tidak dikembangkan lagi; pembersihannya masuk Fase 2.
- Absensi web (`apps/absensi`, kiosk di outlet) **masih berjalan produksi dan tidak boleh terganggu**. Android hidup berdampingan selama masa transisi; jangka panjang semua absensi pindah ke Android (Fase 4).
- Model pemakaian Fase 1: **HP pribadi crew** — tiap crew login akun sendiri, absen dengan verifikasi wajah 1:1 + GPS radius outlet. (Mode kiosk 1:N di HP outlet = di luar scope.)
- Enrollment wajah di Android: **SPV/Leader-driven** (konsisten kebijakan web) — crew datang ke SPV/leader, enrollment lewat akun SPV.

## Masalah yang Diselesaikan

1. **KRITIS — Inkompatibilitas & korupsi face descriptor lintas platform.** Android (TFLite, ~192-d) dan web (`@vladmandic/human`, 1024-d) baca/tulis kolom `outlet_staff.face_descriptor` yang **sama**. Terverifikasi di kode: `SupabaseClient.saveEnrollment` menulis `face_descriptor` (kolom web). Enrollment dari Android hari ini merusak absensi web crew tersebut, dan descriptor web tidak akan pernah cocok dengan kamera Android.
2. **Jalur "sukses palsu" di produksi:** `FaceRecognizer` fallback ke embedding dummy `0.5f` bila model tak ada; `MainActivity` fallback ke `SupabaseClient(isTesting = true)` bila belum ter-init.
3. **Role tidak sinkron:** gating pakai `admin/manager/cashier/kitchen_staff`, padahal role kanonik ekosistem: `admin/owner/spv/leader/korlap/kasir/crew/kiosk/kitchen/mitra/staff_pusat`.
4. **Threshold verifikasi tidak konsisten:** 0.85 dan 0.80 hardcoded di dua jalur berbeda `AttendanceScreen.kt`.
5. Kredensial Supabase hardcoded di `SuperAppApplication`; fallback UI menipu (`"Halo, Andi"`, bottom nav dekoratif).

## Desain

### 1. Data Model — Kolom Descriptor Terpisah untuk Mobile

Pendekatan terpilih (dari 3 alternatif — lihat "Alternatif Ditolak"): **kolom mobile terpisah, web tak disentuh.**

Migration aditif `supabase/migrations/` di `outlet_staff`:

```sql
ALTER TABLE outlet_staff
  ADD COLUMN IF NOT EXISTS face_descriptor_mobile real[],
  ADD COLUMN IF NOT EXISTS mobile_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS mobile_enrolled_by uuid,
  ADD COLUMN IF NOT EXISTS mobile_re_enroll_reason text,
  ADD COLUMN IF NOT EXISTS ref_photo_url_mobile text;
```

- Kolom web (`face_descriptor`, `enrolled_at`, `re_enrolled_*`, `ref_photo_url`) **tidak disentuh**.
- Android baca/tulis **hanya** kolom `*_mobile`: `saveEnrollment` dan `getStaffProfile` di-repoint.
- Foto referensi mobile: `face-refs/{outlet_id}/{staff_id}_mobile.jpg` (tidak menimpa foto web).
- Consent PDP (`consent_at`/`consent_by`) **dipakai bersama** lintas platform: enrollment Android mengisi bila kosong, tidak menimpa bila sudah ada.
- Fase 4 (di luar scope): kolom web dipensiunkan, `*_mobile` jadi kanonik.

**Regression guard terpenting fase ini:** `saveEnrollment` menulis `face_descriptor_mobile` dan **tidak** menyentuh `face_descriptor`.

### 2. Role & Akses

Gating diganti ke role kanonik, dua lapis (menu Dashboard + guard `NavigationManager.navigateTo`):

| Role | Akses Fase 1 |
|---|---|
| `crew`, `kasir`, `kitchen` | Dashboard, Absensi (verifikasi 1:1 wajah sendiri) |
| `spv`, `leader`, `korlap` | + Enrollment (daftarkan/re-enroll crew outlet binaan) |
| `admin`, `owner` | Sama dengan spv |
| `mitra`, `staff_pusat`, `kiosk`, lainnya | Dashboard saja; menu absensi disembunyikan |

Sumber role: `outlet_staff.role` yang sudah di-fetch saat login — tanpa perubahan DB.

### 3. Model Face Recognition & Verifikasi

**Pemilihan model final = task pertama Fase 1**, sebelum crew mana pun enroll (kolom mobile masih kosong = momen paling murah menetapkan model; ganti model belakangan = re-enroll semua orang).

- Model existing `facenet.tflite` (input 112×112, output 192-d) ≈ **MobileFaceNet** (LFW ~99.55%) — baseline layak.
- Kandidat upgrade (urutan preferensi):
  1. **EdgeFace-S/XS** — juara kompetisi efficient FR IJCB 2023 kelas <2M & 2–5M param; perlu konversi PyTorch→TFLite.
  2. **GhostFaceNetV2** — ~99%+ LFW dengan FLOPs jauh di bawah MobileFaceNet (~51–62 vs ~440 MFLOPs); Keras→TFLite mudah; 7–12 MB.
  3. **MobileFaceNet existing** — fallback bila konversi dua kandidat bermasalah.
- Evaluasi via **layar debug internal** (pola `face-debug` web): ukur skor same-person vs different-person di HP nyata, pilih model + threshold dari data itu.
- `FaceRecognizer` sudah baca shape input/output dinamis → swap model = ganti file asset + kalibrasi threshold.

**Verifikasi:**
- **Satu konstanta** `MOBILE_MATCH_THRESHOLD` di `FaceRecognizer` (ganti 0.85/0.80 inline). Nilai awal 0.80 (metrik cosine), final dari kalibrasi lapangan.
- 1:1 verification: descriptor kamera vs `face_descriptor_mobile` milik akun login saja (perilaku existing dipertahankan).
- **Guard belum-enroll:** `face_descriptor_mobile` null → instruksi "Hubungi SPV untuk pendaftaran wajah".
- **Guard dimensi:** ukuran descriptor DB ≠ output model → tolak eksplisit dengan pesan re-enroll (bukan crash / false-reject misterius).
- Deteksi wajah tetap **ML Kit** (sudah jalan, tidak diganti).

### 4. Hardening Produksi

1. `FaceRecognizer`: model gagal load → error state eksplisit di UI; **hapus mock embedding**. Verifikasi `facenet.tflite` ter-bundle (`noCompress("tflite")` sudah ada).
2. `MainActivity`: **hapus fallback** `SupabaseClient(isTesting = true)`. Test tetap inject mock via konstruktor (pola existing untuk Robolectric dipertahankan).
3. `MainShell`: hapus fallback `"Andi"`; bottom nav dekoratif disembunyikan/disable jujur (implementasi penuh = Fase 3).
4. Supabase URL/anon key → `BuildConfig` field (via gradle), bukan hardcode; memungkinkan env dev/prod terpisah.
5. **Cek RLS saat implementasi:** SPV/leader update `face_descriptor_mobile` crew outlet binaan harus lolos policy `outlet_staff` existing; bila terlalu ketat → tambah policy **aditif** (jangan ubah policy web).

### 5. Testing

- Unit test Robolectric existing (8 file) tetap hijau.
- Test baru: gating role kanonik, guard belum-enroll, guard dimensi, threshold konstanta tunggal, dan regression guard `saveEnrollment` (tulis kolom mobile, kolom web utuh).
- Smoke test manual HP fisik: enroll via akun SPV → login crew → clock-in/out dalam radius GPS → verifikasi row `attendance` masuk, `face_descriptor_mobile` terisi, `face_descriptor` (web) tidak berubah.

## Alternatif Ditolak

- **Samakan model web ↔ Android:** konversi tfjs↔TFLite rawan, kalibrasi ulang dua sisi, menyentuh app web produksi — investasi besar untuk platform yang akan dipensiunkan.
- **Verifikasi server-side (upload foto → edge function):** wajib online (mematikan offline queue existing), latensi tiap absen, upload foto wajah tiap absen (isu PDP), butuh compute server.
- **Self-service enrollment:** tanpa pengawasan kualitas capture + celah enroll wajah orang lain; varian dengan approval SPV menambah workflow baru di luar scope Fase 1.

## Roadmap (Backlog Terdokumentasi)

- **Fase 2 — Fondasi:** pecah `SupabaseClient.kt` (763 baris, god object) per domain; satukan navigasi (dobel backstack `NavigationManager` vs `NavHost`); hapus folder mobile mati + putuskan nasib `pos-mobile` RN; theming konsisten (buang warna hardcode, pakai `ui/theme`).
- **Fase 3 — Modul operasional:** Inventory & Fulfillment nyata (permintaan bahan, terima kiriman, pola `apps/stok`); bottom nav difungsikan.
- **Fase 4 — Migrasi total absensi:** pensiunkan kiosk web absensi; kolom `*_mobile` jadi kanonik; evaluasi mode kiosk 1:N di HP outlet sebagai pengganti kiosk web.

## Referensi

- Kode kunci: `app/src/main/java/com/sukashawarma/superapp/` — `data/SupabaseClient.kt`, `utils/FaceRecognizer.kt`, `ui/features/attendance/AttendanceScreen.kt`, `ui/features/enrollment/EnrollmentScreen.kt`, `ui/navigation/NavigationManager.kt`, `ui/MainShell.kt`.
- Sejarah kalibrasi web (pelajaran untuk mobile): threshold 0.25 → 0.45 → cosine 0.725, enrollment frontal-only (CLAUDE.md Session 2026-06-24).
- Model: [EdgeFace (arXiv 2307.01838)](https://arxiv.org/html/2307.01838v2), [GhostFaceNet++ (Springer 2025)](https://link.springer.com/article/10.1007/s11554-025-01768-x).
