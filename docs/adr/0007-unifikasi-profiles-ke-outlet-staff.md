# ADR-007 — Unifikasi `profiles` (POS) ke dalam `outlet_staff`

- Status: Accepted
- Tanggal: 2026-06-13

## Konteks
POS Kasir (`apps/pos-kasir`) awalnya punya tabel identitas sendiri, `profiles` (role `admin|kasir|kiosk`, `is_active`, `inactive_reason`, `username`), terpisah dari `outlet_staff` (identitas kanonik absensi/stok, role `crew|kasir|spv|kepala_outlet`). Keduanya sama-sama ber-`id` = `auth.users.id`.

Punya dua tabel user untuk satu `auth.users` menimbulkan masalah nyata: satu orang (mis. kasir) bisa ada di `outlet_staff` tapi tidak di `profiles` (atau sebaliknya) → login POS gagal `PGRST116 "0 rows"` saat query `.single()`; RLS & RPC dobel (`get_user_role`, `attendance_read_kasir`, gate checklist) harus menyebut tabel yang "benar"; dan integrasi sistem berikutnya di repo ini akan makin pecah.

## Keputusan
Jadikan **`outlet_staff` satu-satunya tabel identitas user** untuk seluruh suite. `profiles` di-DROP; datanya dipindah ke `outlet_staff`:
- `role` diperluas jadi 6 nilai: `crew | kasir | spv | kepala_outlet | admin | kiosk`.
- Tambah kolom `is_active`, `inactive_reason`, `username` (gate akun + login pseudo-email POS).
- `outlet_id` jadi **nullable** (khusus `admin` global lintas-cabang).
- RPC `get_user_role()` / `get_user_outlet_id()` & semua RLS/kode POS diarahkan ke `outlet_staff`.

Migration: `supabase/migrations/20260613000100_unify_profiles_into_outlet_staff.sql`.

## Alternatif yang ditolak
- **VIEW kompatibilitas `profiles` di atas `outlet_staff`** — transisi lebih mulus (kode lama tak perlu diubah), tapi butuh INSTEAD OF trigger untuk jalur tulis (buat/edit user), menyisakan dua nama untuk satu konsep, dan menunda kebersihan. Ditolak demi satu sumber kebenaran.
- **Kolom `pos_role` terpisah** di `outlet_staff` — dua kolom role harus dijaga konsisten; ditolak demi kesederhanaan satu kolom `role`.

## Konsekuensi
- (+) Satu tabel user lintas sistem; login/RLS/RPC konsisten; bug `PGRST116` saat login hilang.
- (+) Sistem lain di repo tinggal referensi `outlet_staff`.
- (−) `DROP TABLE profiles` ireversibel — wajib backup sebelum apply; semua kode yang menyebut `profiles` harus sudah dialihkan (sudah dilakukan).
- (−) Role absensi & POS kini berbagi satu domain nilai; UI per-app harus toleran terhadap role yang bukan miliknya (mis. absensi memperlakukan `admin`/`kiosk` sebagai non-SPV).
