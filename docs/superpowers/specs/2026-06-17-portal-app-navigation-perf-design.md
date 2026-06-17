# Spec: Optimasi Perpindahan Portal → App

**Tanggal:** 2026-06-17
**Status:** Design — disetujui untuk lanjut ke implementation plan
**Owner:** Dev Suka Shawarma

## Masalah

Perpindahan dari portal (`app.sukashawarma.com`) ke app tujuan (mis. `stok.sukashawarma.com`) terasa lambat. Klik kartu portal = navigasi full-page lintas subdomain ke Node app Passenger terpisah.

### Jejak terverifikasi: 1 klik portal → stok

| Tahap | Yang terjadi | Round-trip (RT) Supabase |
|-------|-------------|--------------------------|
| Cold start | Passenger spawn Node + boot Next (jika app idle) | — |
| `GET /` | middleware `enforceAppAccess` → `getUser()` (network) + `getOutletStaff()`, lalu `page.tsx` `redirect('/dashboard')` (307) | 2 |
| `GET /dashboard` | middleware `enforceAppAccess` jalan lagi → `getUser()` + `getOutletStaff()`. `dashboard/page.tsx` adalah `'use client'` → server hanya kirim shell kosong | 2 |
| Hidrasi client | `AuthProvider.init()`: `getSession()` (lokal, OK) + `getOutletStaff()` (network). Race `INITIAL_SESSION` (guard `initialised` baru true setelah async) bisa memicu fetch staff lagi | 1–2 |

**Total: 5–6 RT Supabase** per perpindahan; baris `outlet_staff` yang sama diambil 3–4 kali dalam hitungan detik, ditambah cold-start dan redirect berantai.

### Akar masalah

1. `getUser()` di middleware = panggilan jaringan ke Supabase Auth tiap request (validasi token), jalan 2× karena redirect.
2. Redirect `/` → `/dashboard` menggandakan putaran middleware (request + 2 RT ekstra).
3. `/dashboard` adalah client component → konten tidak ter-render di server; user lihat shell + spinner sampai JS + AuthProvider selesai fetch staff lagi.
4. AuthProvider race (`AuthProvider.tsx` baris ~78): `initialised` baru `true` setelah `loadStaff` async → `onAuthStateChange('INITIAL_SESSION')` bisa tiba lebih dulu dan memicu fetch staff ganda.
5. Cold start Passenger: app idle = tidak ada proses; klik pertama harus spawn.

## Prinsip Desain

Middleware tetap satu-satunya gerbang akses (`enforceAppAccess` di `@suka/auth`). Optimasi = hilangkan kerja redundan di critical path, bukan memindahkan gate. RLS Supabase tetap lapis keamanan kedua.

## Cakupan

**Termasuk** (4 app seragam yang memakai `enforceAppAccess`): `stok`, `distribusi`, `absensi`, `owner-dashboard`.

**Dikecualikan:** `pos-kasir` — punya middleware gate kustom per-path (admin/kasir/kiosk), injeksi `x-outlet-id` sendiri, dan akan mendapat gate baru "staff harus sudah absensi hari ini" yang belum diimplementasikan. pos-kasir + gate absensi dirancang terpisah sebagai fitur sendiri (lihat Pekerjaan Lanjutan).

## Perubahan per Fix

### #4 — Verifikasi JWT lokal (ganti `getUser()`)

- Helper baru di `@suka/auth`: `verifyAccessToken(token, secret)` — verifikasi signature HS256 access token Supabase pakai `SUPABASE_JWT_SECRET` via `jose`, tanpa network. Mengembalikan `sub` (user id) + claims, atau `null` jika invalid/expired.
- `enforceAppAccess` membaca access token dari cookie sesi → verifikasi lokal → dapat user id. **0 RT auth** (sebelumnya 1 network call/request).
- `getOutletStaff` **tetap** dipanggil untuk cek `role` + `status` (gate butuh ini) → 1 RT DB tersisa, lalu diteruskan ke client (#3).
- Env baru `SUPABASE_JWT_SECRET` di `.env.local` tiap app + panel produksi. Didokumentasikan di `DEPLOY-CPANEL.md`.
- Fallback: jika `SUPABASE_JWT_SECRET` tak di-set, helper kembali ke `getUser()` (aman, tak memecah lokal/dev yang belum set env).

### #3 — Teruskan staff via request header

- Setelah gate lolos, `enforceAppAccess` menulis staff sebagai JSON ke request header `x-suka-staff` melalui `NextResponse.next({ request: { headers } })`.
- **Anti-spoof:** middleware lebih dulu menghapus header `x-suka-staff` apa pun dari request klien, sebelum menulis nilai tepercaya.
- Root layout (server component) membaca `headers().get('x-suka-staff')`, parse, dan mengoper sebagai `initialStaff` ke `Providers` → `AuthProvider`.
- `AuthProvider` menerima prop opsional `initialStaff`: seed `outletStaff` darinya dan **skip fetch staff pertama**. Tetap `getSession()` untuk sesi + tetap `onAuthStateChange` untuk logout/refresh. Hilangkan 1–2 RT staff di client.

### #5 — Fix race AuthProvider

- Set `initialised = true` segera setelah seed dari `initialStaff` (atau sinkron sebelum subscribe), bukan setelah `loadStaff` async selesai. Guard `INITIAL_SESSION` agar tidak memicu fetch staff ganda. Dengan `initialStaff` hadir, fetch pertama memang di-skip.

### #2 — Hapus redirect `/` → `/dashboard`

- Tiap app: ganti `page.tsx` yang `redirect('/dashboard')` agar `/` **langsung render** komponen dashboard (bukan 307). Hilangkan 1 request penuh + 1× putaran middleware.
- Route `/dashboard` tetap ada sebagai alias agar link internal yang sudah ada tidak putus.

### #1 — Anti cold-start (ops, bukan kode app)

- Set `PassengerMinInstances 1` per app agar minimal 1 instance tetap hidup.
- Tambah `scripts/keepalive.sh`: cron ping tiap ~5 menit ke tiap subdomain via `curl --resolve <domain>:443:103.77.106.237` (loopback server selalu balik defaultwebpage — lihat catatan deploy).
- Didokumentasikan di `DEPLOY-CPANEL.md`.

## Komponen yang Disentuh

**`@suka/auth` (shared, berlaku ke semua app via `enforceAppAccess`):**
- `verifyAccessToken()` baru (#4)
- `enforceAppAccess`: verifikasi lokal + strip & set header `x-suka-staff` (#3, #4)
- `AuthProvider`: prop `initialStaff` + fix race (#3, #5)

**Per app (stok, distribusi, absensi, owner-dashboard):**
- Root `layout.tsx`: baca `x-suka-staff` → oper `initialStaff` ke `Providers`
- `Providers.tsx`: teruskan `initialStaff` ke `AuthProvider`
- `page.tsx`: render dashboard langsung, bukan `redirect` (#2)
- Env `SUPABASE_JWT_SECRET` (.env.local + panel produksi)

**Ops:** `scripts/keepalive.sh`, `DEPLOY-CPANEL.md`, konfigurasi `PassengerMinInstances`.

## Pengujian

- Unit test `verifyAccessToken`: token valid, signature salah, expired, secret tak di-set (fallback path). Pakai vitest (stok sudah punya infra; tambahkan di `@suka/auth` bila perlu).
- Unit/logic test serialisasi & strip header `x-suka-staff` (tepercaya vs spoof).
- Smoke test manual: login portal → klik tiap app → verifikasi 1 RT staff (cek Network/log), tanpa redirect 307, dashboard ter-render tanpa flash spinner panjang.

## Hasil yang Diharapkan

Per perpindahan: **5–6 RT Supabase → 1 RT** (hanya staff untuk gate), **0 RT auth**, tanpa redirect berantai, tanpa cold-start.

## Pekerjaan Lanjutan (di luar spec ini)

- **pos-kasir gate absensi:** staff hanya bisa akses pos-kasir bila sudah melakukan absensi (check-in) hari ini. Fitur baru — perlu desain sendiri (sumber data absensi, definisi "hari ini" per outlet/shift, perilaku kiosk vs kasir). Sekalian optimasi #1–#5 untuk pos-kasir saat itu.
