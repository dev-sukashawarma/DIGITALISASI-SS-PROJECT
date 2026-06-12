# M1 → kebutuhan dari M0 (koordinasi Dev A ↔ Dev B)

> Status: Menunggu konfirmasi Dev B (2026-06-09)
> Konteks: M1 (Absensi + Face Matching) diblokir M0. Kode M0 belum ada di repo (semua commit masih dokumentasi). Dokumen ini = daftar kontrak yang Dev A butuhkan dari M0 sebelum implementasi M1 dimulai.
> Spec M1: [`2026-06-09-m1-absensi-face-matching-design.md`](2026-06-09-m1-absensi-face-matching-design.md)

## 1. Yang perlu dikonfirmasi/disediakan M0

### A. Supabase project (Outlet Suite)
- [ ] Project Supabase "Outlet Suite" sudah dibuat (akun/org terpisah, per ADR-004)?
- [ ] URL project + `anon key` untuk dev (lewat `.env.example` / `config.example.js`, bukan di-commit).
- [ ] Supabase CLI terhubung ke project ini untuk migrations.

### B. Tabel `outlets` (salinan sinkron dari Ecosystem)
- [ ] Tabel `outlets` ada dengan kolom minimal: `id (uuid)`, `slug`, `name`, `lat`, `lng`, `is_active`.
- [ ] `lat`/`lng` terisi untuk 19 outlet (M1 butuh untuk validasi radius GPS).
- [ ] `id` = uuid yang sama dengan Ecosystem (sudah di-seed via `sync-outlets`).

### C. Tabel `outlet_staff` (identitas kanonik)
- [ ] Tabel `outlet_staff` ada: `id`, `outlet_id (FK)`, `name`, `role (crew|kasir|spv|kepala_outlet)`, `status`.
- [ ] **Kolom enroll wajah** — M1 butuh: `face_descriptor (jsonb)`, `ref_photo_url`, `consent_at`, `consent_by`, `enrolled_at`.
      → Apakah M0 yang menambahkan, atau M1 menambah lewat migration sendiri? (perlu sepakat — ini tabel inti, butuh review)

### D. Autentikasi & RLS
- [ ] Mekanisme login "akun outlet" (sesi panjang per device): apakah 1 user Supabase Auth per outlet?
- [ ] **JWT membawa `outlet_id`** (custom claim) yang dipakai RLS & Edge Function `submit-attendance`.
      → Bagaimana cara `outlet_id` masuk ke JWT? (custom access token hook / app_metadata?)
- [ ] Pola RLS per-outlet standar yang bisa M1 ikuti (helper function `current_outlet_id()`?).

### E. Design system & app shell
- [ ] `packages/design-system` sudah berisi token SUKA (warna `--suka-orange #f29744`, `--suka-brown #701604`, font Lilita One + Plus Jakarta Sans) sebagai package yang bisa di-import.
- [ ] Pola app-shell Next.js (static export) + Supabase client + **offline-queue reusable** — apakah M0 menyediakan, atau M1 bikin sendiri di `lib/queue`?

## 2. Yang M1 (Dev A) buat sendiri (tidak menyentuh M0)
- Tabel `attendance`, `outlet_attendance_config` (config jam kerja/radius).
- Storage bucket `selfies/`, `face-refs/` + RLS per-outlet.
- Edge Function `submit-attendance`, `cleanup-selfies`, job `mark-alpha`.
- App `apps/absensi` (clock, enroll, rekap) + `lib/face`, `lib/gps`, `lib/attendance`.

## 3. Titik yang butuh kesepakatan eksplisit (tabel inti / review wajib)
1. **Kolom enroll di `outlet_staff`** — siapa yang menambah, agar tak bentrok migration.
2. **Custom claim `outlet_id` di JWT** — desain Edge Function `submit-attendance` bergantung penuh pada ini.
3. **Urutan migration** — `attendance` butuh `outlet_staff` + `outlets` sudah ada lebih dulu.

## 4. Rekomendasi langkah
1. Kirim dokumen ini ke Dev B; minta konfirmasi bagian 1 (A–E) + keputusan bagian 3.
2. Begitu A–D dikonfirmasi & tersedia di project, M1 lanjut ke implementation plan (writing-plans) lalu eksekusi.
3. Sambil menunggu, bagian "tanpa dependensi M0" (mis. `lib/face` + kalibrasi threshold pakai foto sampel, `lib/gps` haversine, struktur `lib/queue`) bisa dimulai duluan bila ingin.
