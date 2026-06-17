# ADR-008 — SSO gerbang tunggal via Portal + model gate per-runtime

- Status: Accepted
- Tanggal: 2026-06-17
- Terkait: ADR-005 (static export), ADR-007 (unifikasi `outlet_staff`)

## Konteks

Tiap app suite sebelumnya punya halaman login sendiri (absensi, pos-kasir),
dengan implementasi & penyimpanan sesi yang tidak seragam:

- pos-kasir menulis sesi ke cookie ber-nama custom (`sb-pos-kasir-auth-token`),
  sementara `@suka/auth` (dipakai portal & absensi) memakai cookie default
  `sb-<project-ref>-auth-token`. Akibatnya sesi tidak terbagi antar-app dan
  bahkan tidak konsisten antara browser-client vs middleware di dalam pos-kasir.
- absensi memasang middleware `enforceAppAccess`, padahal `output: 'export'`
  (ADR-005) membuat middleware tidak pernah dieksekusi → gate mati diam-diam.

Sejak unifikasi identitas (`outlet_staff`, ADR-007) seluruh suite berbagi satu
tabel user, sehingga login tunggal jadi memungkinkan dan diinginkan.

## Keputusan

1. **Portal (`apps/portal`) = satu-satunya gerbang login.** App lain tidak punya
   form login sendiri; halaman `/login` mereka me-redirect ke Portal.
   Pengecualian: **device kiosk** pos-kasir diaktifkan kasir via QR lokal
   (`/kiosk/qr-login`), bukan lewat Portal.
2. **Sesi seragam = cookie Supabase default `@suka/auth`.** pos-kasir berhenti
   memakai cookie name custom dan memakai `createSupabaseBrowserClient` dari
   `@suka/auth`. Sharing: lintas-port di lokal (cookie host-only `localhost`),
   lewat `NEXT_PUBLIC_COOKIE_DOMAIN=.sukashawarma.com` di prod.
3. **Pseudo-email terpusat.** Login berbasis username (kasir) dinormalkan
   `username` → `username@outlet.local` via `normalizeLoginIdentifier` di
   `@suka/auth`, dipakai Portal agar kasir tetap bisa login dengan username.
4. **Model gate mengikuti runtime app** (bukan dipaksa seragam karena ADR-005):
   - App **static export** (absensi, stok, distribusi) → **gate client-side**
     (`AuthGuard`): cek session + `hasAppAccess` + status `active`, tolak ke Portal.
   - App **SSR/Node** (pos-kasir, portal) → **middleware** `enforceAppAccess`.
5. **URL app di Launcher = env-driven** (`NEXT_PUBLIC_APP_URL_<APP>`), agar Launcher
   benar di lokal (localhost:port) maupun prod (subdomain), fallback subdomain prod.

## Alternatif yang ditolak

- **Pindahkan semua app ke SSR + middleware seragam** — ditolak: melanggar ADR-005
  (deploy cPanel shared, no root). Static export tetap dipertahankan untuk app non-POS.
- **Pertahankan login per-app** — ditolak: bukan SSO, duplikasi logika gate (mudah
  kelewat, mis. lupa cek status), sesi tak terbagi.
- **Portal email-only + migrasi kasir ke email asli** — ditolak: memaksa migrasi data
  akun kasir; pseudo-email lebih murah dan sudah jadi pola pos-kasir.

## Konsekuensi

- (+) Satu titik login, satu sumber matriks akses, sesi terbagi mulus lintas-app.
- (+) Gate tiap app sesuai kemampuan runtime-nya; tidak melanggar ADR-005.
- (−) Dua mekanisme gate (client-side vs middleware) harus dijaga konsisten —
  diringankan dgn helper bersama di `@suka/auth`.
- (−) Gate client-side bukan penghalang keamanan sejati (UI-only); **keamanan data
  tetap bertumpu pada RLS Supabase**, gate hanya untuk UX/redirect.
- (−) Port dev harus unik per app (pos-kasir dipindah 3001→3004 karena bentrok stok).
