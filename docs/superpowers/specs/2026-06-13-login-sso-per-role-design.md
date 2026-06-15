# Spec Desain — Login SSO Per Role (Suka Shawarma Outlet Suite)

**Tanggal:** 2026-06-13
**Status:** Disepakati (hasil brainstorming)
**Terkait:** [docs/ROLE-JOBDESK.md](../../ROLE-JOBDESK.md), `CLAUDE.md` (Outlet Model & RLS)

## 1. Tujuan & Masalah

Lima aplikasi (`pos-kasir`, `absensi`, `stok`, `distribusi`, `owner-dashboard`) berjalan di subdomain berbeda dengan login terpisah. Tujuan: **login satu kali (SSO)** yang berlaku di semua app, dengan akses **per role** yang sesuai jobdesk operasional, dan pengalaman yang seamless.

**Tiga masalah inti saat ini:**
1. **Dua tabel identitas** — `outlet_staff` (stok/absensi/distribusi) vs `profiles` (pos-kasir). Set role berbeda.
2. **Login berulang** — satu orang harus login di tiap subdomain.
3. **Routing role tak konsisten** — `stok` abaikan role (hardcode `/dashboard`), `pos-kasir` sudah role-based.

**Non-goals:** modul FoodApps (belum ada), keputusan SPV melihat angka penjualan (ditunda), penugasan SPV per-area (SPV = semua 19 outlet untuk sekarang).

## 2. Model Role & Akses

Sumber lengkap: [docs/ROLE-JOBDESK.md](../../ROLE-JOBDESK.md). Ringkas:

7 role: `admin | owner | spv | kepala_outlet | kasir | crew | kiosk`.

Matriks akses (= konstanta `ROLE_APP_ACCESS`):

| Role | pos-kasir | absensi | stok | distribusi | owner-dashboard |
|------|:---:|:---:|:---:|:---:|:---:|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| owner | ❌ | ❌ | ❌ | ❌ | ✅ (read-only) |
| spv | ❌ | ✅ semua outlet | ✅ semua outlet | ✅ | ⚠️ ditunda |
| kepala_outlet | ✅ | ✅ binaan | ✅ binaan | ✅ | ❌ |
| kasir | ✅ | ✅ | ❌ | ❌ | ❌ |
| crew | ❌ | ✅ | ❌ | ❌ | ❌ |
| kiosk | ✅ (kiosk mode) | ❌ | ❌ | ❌ | ❌ |

Scope outlet (ditegakkan terpisah dari matriks, via RLS/view):
- `kasir`, `crew`, `kiosk` → 1 outlet (`outlet_staff.outlet_id`).
- `kepala_outlet` → beberapa outlet via `staff_outlets`.
- `spv`, `admin`, `owner` → semua outlet.

## 3. Arsitektur SSO

Semua app sudah menunjuk **Supabase project yang sama**, jadi SSO ringan: seragamkan cookie sesi ke domain induk.

- Semua supabase client (browser, server, middleware di portal + 5 app) di-set `cookieOptions.domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN`, `path:'/'`, `sameSite:'lax'`, `secure:true`.
- Produksi: `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` → cookie `sb-<ref>-auth-token` ber-scope ke seluruh subdomain → login di mana pun dikenali di mana pun. Tanpa redirect token/OAuth.
- **Lokal dev**: env dikosongkan → cookie per-port (login per app seperti sekarang). SSO penuh diverifikasi di staging/prod.

## 4. Portal Launcher

App baru `apps/portal` di subdomain sendiri (mis. `app.sukashawarma.com`).

**Alur:**
```
1. Buka portal → belum login → form login (email/username + password)
2. signInWithPassword → cookie sesi domain .sukashawarma.com
3. Fetch outlet_staff (role, status):
   - status != active     → "akun nonaktif, hubungi admin"
   - tidak ada baris staff → "akun belum terhubung, hubungi admin"
   - role kiosk            → tolak (kiosk pakai alur QR)
4. Render kartu app sesuai ROLE_APP_ACCESS[role]
5. Klik kartu → buka subdomain app (sudah ter-autentikasi)
6. Logout → hapus cookie .sukashawarma.com → logout global
```

**Auto-redirect (opsional, configurable):** bila role hanya punya akses 1 app (mis. `crew`→absensi), portal langsung redirect ke app itu alih-alih menampilkan 1 kartu.

## 5. Guard per App

Tiap app punya `middleware.ts` standar:
1. Ambil `user` dari sesi.
2. Belum login → redirect ke portal.
3. Fetch role dari `outlet_staff`.
4. `ROLE_APP_ACCESS[role]` tidak memuat app ini → redirect ke portal + pesan "tidak berwenang".
5. Berwenang → lanjut. (Pengecekan scope outlet di level query/RLS, bukan middleware.)

Mengganti routing hardcode `stok → /dashboard` dengan guard berbasis role yang seragam.

## 6. Perubahan Data (Migrasi)

Urutan migrasi (`supabase/migrations/`):

1. **Enum/constraint role** `outlet_staff.role`: tambah `owner`, `kiosk` (sehingga lengkap: admin, owner, spv, kepala_outlet, kasir, crew, kiosk).
2. **Tabel `staff_outlets`** (many-to-many):
   ```sql
   create table staff_outlets (
     staff_id uuid references outlet_staff(id) on delete cascade,
     outlet_id uuid references outlets(id) on delete cascade,
     primary key (staff_id, outlet_id)
   );
   ```
   Diisi hanya untuk `kepala_outlet`.
3. **Migrasi `profiles` → `outlet_staff`**: upsert tiap baris `profiles` ke `outlet_staff` by `id` (sama-sama FK `auth.users`). Petakan role lama → role baru (`kiosk` tetap `kiosk`).
4. **View kompat `profiles`**: ubah `profiles` menjadi VIEW ke `outlet_staff` (kolom `role`, `outlet_id`) agar kode pos-kasir lama tak langsung pecah; dirombak bertahap.
5. **RLS**: kebijakan akses `kepala_outlet` cek keanggotaan `staff_outlets` (bukan `outlet_id` tunggal). `spv` tetap lewat view definer existing. Pertahankan `ledger_read` untuk crew/kasir.

## 7. Komponen yang Dibangun/Diubah

1. **`packages/auth`** (pola seperti `packages/design-system`):
   - `AuthProvider` / `useAuth` terpadu (menggantikan 4 AuthContext yang duplikat).
   - `getOutletStaff(supabase)`.
   - `ROLE_APP_ACCESS` (konstanta matriks, satu sumber).
   - `requireRole(role, app)` + `getAccessibleOutlets(staff)` (resolusi scope).
   - `createSupabaseBrowserClient` / `createSupabaseServerClient` dengan cookie domain configurable.
2. **`apps/portal`** (baru): login + launcher.
3. **Migrasi DB** (Bagian 6).
4. **5 app existing**:
   - Ganti supabase client → pakai `packages/auth` (cookie domain configurable).
   - Tambah/standarkan `middleware.ts` guard.
   - Login page lama → redirect ke portal (pertahankan sebagai fallback dev).
   - `pos-kasir`: baca role dari `outlet_staff`/view `profiles`; alur QR kiosk tidak disentuh.

## 8. Penanganan Khusus & Error

- **Kiosk**: tidak lewat portal/SSO manusia; alur QR device-bound pos-kasir tetap apa adanya.
- **Akun tanpa staff / nonaktif**: portal & guard tampilkan pesan jelas, arahkan ke admin.
- **Migration history drift** (lihat `CLAUDE.md`): jalankan `migration repair` sebelum `db push`.
- **Lokal dev**: cookie domain kosong → perilaku per-port lama dipertahankan.

## 9. Testing / Verifikasi

- Login 1× di portal → buka tiap subdomain tanpa login ulang (staging).
- Tiap role: hanya app sesuai matriks yang muncul & bisa diakses; app lain → redirect + pesan.
- `kepala_outlet` multi-outlet: hanya outlet binaan yang terlihat di stok/absensi/distribusi.
- `spv`: monitoring lintas semua outlet berfungsi (view definer).
- Logout global: logout di 1 app → sesi hilang di semua.
- Kiosk QR tetap berjalan terpisah.

## 10. Open Items

- SPV melihat angka penjualan (owner-dashboard / laporan) — ditunda.
- `owner` sebagai role penuh terpisah vs subset admin — diasumsikan terpisah (read-only).
- Penugasan SPV per-area bila kelak SPV dibagi regional.
- Subdomain final portal (`app.` vs `home.`).
